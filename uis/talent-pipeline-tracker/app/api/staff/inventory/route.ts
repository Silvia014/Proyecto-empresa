import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "inventory")) return NextResponse.json({ error: "You do not have access to inventory." }, { status: 403 });
  const locationId = new URL(request.url).searchParams.get("locationId");
  let itemQuery = actor.service.from("inventory_items").select("id, name, category, location_id, unit_of_measure, reorder_point, updated_at").order("name").limit(500);
  if (locationId) itemQuery = itemQuery.eq("location_id", locationId);

  const [{ data: inventory, error }, { data: locations, error: locationsError }, { data: movements, error: movementError }, { data: suppliers, error: supplierError }] = await Promise.all([
    itemQuery,
    actor.service.from("Location").select("id, name, city, country").order("name"),
    actor.service.from("inventory_movements").select("item_id, movement_type, quantity, supplier_id, unit_cost, created_at").order("created_at", { ascending: false }).limit(5000),
    actor.service.from("supplier_directory").select("id, name, currency").limit(500),
  ]);
  if (error || locationsError || movementError || supplierError) {
    console.error("Inventory workspace query failed:", error?.message || locationsError?.message || movementError?.message || supplierError?.message);
    return NextResponse.json({ error: "Unable to read inventory items, stock movements, supplier records, or restaurant locations." }, { status: 503 });
  }
  const locationById = new Map((locations || []).map((item) => [item.id, item]));
  const supplierById = new Map((suppliers || []).map((item) => [item.id, item]));
  const movementByItem = new Map<number, { onHand: number; supplierId: number | null; unitCost: number | null }>();
  for (const movement of movements || []) {
    const current = movementByItem.get(movement.item_id) || { onHand: 0, supplierId: null, unitCost: null };
    const quantity = Number(movement.quantity || 0);
    current.onHand += movement.movement_type === "inbound" ? quantity : movement.movement_type === "outbound" ? -quantity : quantity;
    if (!current.supplierId && movement.supplier_id) current.supplierId = movement.supplier_id;
    if (current.unitCost == null && movement.unit_cost != null) current.unitCost = Number(movement.unit_cost);
    movementByItem.set(movement.item_id, current);
  }
  const items = (inventory || []).map((item) => {
    const stock = movementByItem.get(item.id) || { onHand: 0, supplierId: null, unitCost: null };
    const location = locationById.get(item.location_id);
    const supplier = stock.supplierId ? supplierById.get(stock.supplierId) : null;
    return {
      id: String(item.id), name: item.name, category: item.category, unit: item.unit_of_measure,
      currentStock: stock.onHand, minStock: Number(item.reorder_point || 0), price: stock.unitCost || 0,
      currency: supplier?.currency || (/colombia/i.test(location?.country || "") ? "COP" : "USD"),
      updatedAt: item.updated_at || new Date().toISOString(), supplierName: supplier?.name || null, location: location || null,
    };
  });
  return NextResponse.json({ items, locations: locations || [], updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
