import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
import { validateHrCalendarEntry } from "@/lib/hr-calendar";

export const dynamic = "force-dynamic";

async function authorizeHr(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "hr")) return NextResponse.json({ error: "You do not have access to staff requirements." }, { status: 403 });
  return actor;
}

export async function GET(request: Request) {
  const actor = await authorizeHr(request);
  if (actor instanceof NextResponse) return actor;
  const month = new URL(request.url).searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Choose a valid calendar month." }, { status: 400 });
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return NextResponse.json({ error: "Choose a valid calendar month." }, { status: 400 });
  const firstDate = `${month}-01`;
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const { data, error } = await actor.service.from("hr_calendar_events")
    .select("id, title, event_type, employee_name, location_id, start_date, end_date, status, notes")
    .lte("start_date", lastDate)
    .gte("end_date", firstDate)
    .order("start_date", { ascending: true });
  if (error) {
    console.error("HR calendar query failed:", error.message);
    return NextResponse.json({ error: "Could not load the staff calendar. Apply the HR calendar database migration if this is a new environment." }, { status: 503 });
  }
  return NextResponse.json({ events: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await authorizeHr(request);
  if (actor instanceof NextResponse) return actor;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter the calendar entry details." }, { status: 400 });
  const validated = validateHrCalendarEntry(body as Record<string, unknown>);
  if (validated.error || !validated.value) return NextResponse.json({ error: validated.error || "Invalid calendar entry." }, { status: 400 });
  const { data, error } = await actor.service.from("hr_calendar_events")
    .insert({ ...validated.value, created_by: actor.user.id })
    .select("id, title, event_type, employee_name, location_id, start_date, end_date, status, notes")
    .single();
  if (error) {
    console.error("HR calendar entry insert failed:", error.message);
    return NextResponse.json({ error: "Could not save this calendar entry." }, { status: 500 });
  }
  return NextResponse.json({ event: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
