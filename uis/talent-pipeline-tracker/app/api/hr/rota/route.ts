import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "hr")) return NextResponse.json({ error: "You do not have access to HR scheduling." }, { status: 403 });
  return actor;
}

export async function GET(request: Request) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const { data, error } = await actor.service.from("hr_rota_shifts").select("id, employee_name, employee_email, location_id, shift_date, start_time, end_time, role, notes, Location(name, city)").order("shift_date", { ascending: true }).limit(500);
  if (error) {
    console.error("HR rota query failed:", error.message);
    return NextResponse.json({ error: "Could not load the rota. Apply migration 20261107120000_hr_payroll_and_rota.sql to the production database." }, { status: 503 });
  }
  return NextResponse.json({ shifts: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Enter shift details." }, { status: 400 });
  const name = typeof body.employeeName === "string" ? body.employeeName.trim() : "";
  const email = typeof body.employeeEmail === "string" ? body.employeeEmail.trim().toLowerCase() : "";
  const date = typeof body.shiftDate === "string" ? body.shiftDate : "";
  const start = typeof body.startTime === "string" ? body.startTime : "";
  const end = typeof body.endTime === "string" ? body.endTime : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const role = typeof body.role === "string" ? body.role.trim().slice(0, 100) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
  if (!name || name.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) return NextResponse.json({ error: "Check the staff name, date, and shift times. End time must follow start time." }, { status: 400 });
  if (locationId) {
    const { data: location, error } = await actor.service.from("Location").select("id").eq("id", locationId).maybeSingle();
    if (error || !location) return NextResponse.json({ error: "Choose a valid restaurant location." }, { status: 400 });
  }
  const { data, error } = await actor.service.from("hr_rota_shifts").insert({ employee_name: name, employee_email: email || null, shift_date: date, start_time: start, end_time: end, location_id: locationId || null, role: role || null, notes: notes || null, created_by: actor.user.id }).select("id, employee_name, employee_email, location_id, shift_date, start_time, end_time, role, notes").single();
  if (error) {
    console.error("HR rota insert failed:", error.message);
    return NextResponse.json({ error: "Could not save the shift. Apply the HR payroll and rota migration." }, { status: 503 });
  }
  return NextResponse.json({ shift: data }, { status: 201 });
}
