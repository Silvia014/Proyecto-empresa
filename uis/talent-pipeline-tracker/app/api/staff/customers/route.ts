import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "customers")) return NextResponse.json({ error: "You do not have access to customer records." }, { status: 403 });

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") || 250), 1), 500);
  const { data: customers, error } = await actor.service.from("Customer")
    .select("id, name, email, phone, country, city, preferences, createdAt")
    .order("createdAt", { ascending: false }).limit(limit);
  if (error) {
    console.error("Customer workspace query failed:", error.message);
    return NextResponse.json({ error: "Unable to load customers from the ERP Customer table." }, { status: 503 });
  }
  const ids = (customers || []).map((customer) => customer.id);
  if (!ids.length) return NextResponse.json({ customers: [], updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });

  const [pointsResult, ordersResult, reservationsResult, feedbackResult] = await Promise.all([
    actor.service.from("BrasapointsAccount").select('customerId, balance').in("customerId", ids),
    actor.service.from("Order").select("id, customerId, createdAt, total, currency, status, paymentStatus, source").in("customerId", ids).order("createdAt", { ascending: false }).limit(1000),
    actor.service.from("reservations").select('id, customer_id, reservation_date, reservation_time, party_size, status').in("customer_id", ids).order("created_at", { ascending: false }).limit(1000),
    actor.service.from("customer_feedback").select('id, customer_id, order_id, value_for_money_rating, comment, created_at').in("customer_id", ids).order("created_at", { ascending: false }).limit(1000),
  ]);
  const failed = [pointsResult.error, ordersResult.error, reservationsResult.error].find(Boolean);
  if (failed) {
    console.error("Customer profile details query failed:", failed.message);
    return NextResponse.json({ error: "Customer records loaded, but order, reservation, feedback, or loyalty tables are not available. Apply the current CRM migrations." }, { status: 503 });
  }
  const byCustomer = new Map((customers || []).map((customer) => [customer.id, {
    ...customer,
    brasapoints: pointsResult.data?.find((row) => row.customerId === customer.id)?.balance ?? 0,
    orders: (ordersResult.data || []).filter((row) => row.customerId === customer.id),
    reservations: (reservationsResult.data || []).filter((row) => row.customer_id === customer.id),
    feedback: (feedbackResult.data || []).filter((row) => row.customer_id === customer.id),
  }]));
  return NextResponse.json({ customers: [...byCustomer.values()], feedbackAvailable: !feedbackResult.error, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
