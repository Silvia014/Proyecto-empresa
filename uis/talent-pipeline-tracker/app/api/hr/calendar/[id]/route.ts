import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
import { validateHrCalendarEntry } from "@/lib/hr-calendar";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

async function authorizeHr(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "hr")) return NextResponse.json({ error: "You do not have access to staff requirements." }, { status: 403 });
  return actor;
}

export async function PATCH(request: Request, context: RouteContext) {
  const actor = await authorizeHr(request);
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter the calendar entry details." }, { status: 400 });
  const validated = validateHrCalendarEntry(body as Record<string, unknown>);
  if (validated.error || !validated.value) return NextResponse.json({ error: validated.error || "Invalid calendar entry." }, { status: 400 });
  const { data, error } = await actor.service.from("hr_calendar_events")
    .update({ ...validated.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("HR calendar entry update failed:", error.message);
    return NextResponse.json({ error: "Could not update this calendar entry." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Calendar entry not found." }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const actor = await authorizeHr(request);
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  const { data, error } = await actor.service.from("hr_calendar_events").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("HR calendar entry delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete this calendar entry." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Calendar entry not found." }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
