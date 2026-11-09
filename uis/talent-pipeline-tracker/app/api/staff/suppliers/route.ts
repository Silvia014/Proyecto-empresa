import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "suppliers")) {
    return NextResponse.json({ error: "You do not have access to suppliers." }, { status: 403 });
  }

  const country = new URL(request.url).searchParams.get("country");
  let query = actor.service.from("supplier_directory")
    .select("id, name, country, categories, rate_per_unit, currency, status, contact_email, notes, updated_at")
    .order("name", { ascending: true });
  if (country) {
    const values = country === "United States" ? ["USA", "United States", "US"] : [country];
    query = query.in("country", values);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Supplier workspace query failed:", error.message);
    return NextResponse.json({ error: "Unable to load the existing supplier_directory records." }, { status: 503 });
  }
  return NextResponse.json({ suppliers: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
