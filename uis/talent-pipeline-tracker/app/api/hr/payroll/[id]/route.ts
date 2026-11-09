import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "hr")) return NextResponse.json({ error: "You do not have access to HR payroll." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!id || (body?.status !== "paid" && body?.status !== "pending")) return NextResponse.json({ error: "Choose pending or paid." }, { status: 400 });
  const status = body.status;
  const { data, error } = await actor.service.from("hr_payroll_entries").update({ status, paid_at: status === "paid" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).select("id, status, paid_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update payroll payment status." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Payroll entry not found." }, { status: 404 });
  return NextResponse.json({ entry: data });
}
