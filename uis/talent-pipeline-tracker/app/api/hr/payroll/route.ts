import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "hr")) return NextResponse.json({ error: "You do not have access to HR payroll." }, { status: 403 });
  return actor;
}

export async function GET(request: Request) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const { data, error } = await actor.service.from("hr_payroll_entries").select("id, employee_name, employee_email, pay_period_start, pay_period_end, amount, currency, status, paid_at, notes, created_at").order("pay_period_start", { ascending: false }).limit(500);
  if (error) {
    console.error("HR payroll query failed:", error.message);
    return NextResponse.json({ error: "Could not load payroll records. Apply migration 20261107120000_hr_payroll_and_rota.sql to the production database." }, { status: 503 });
  }
  return NextResponse.json({ entries: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Enter payroll details." }, { status: 400 });
  const employeeName = typeof body.employeeName === "string" ? body.employeeName.trim() : "";
  const employeeEmail = typeof body.employeeEmail === "string" ? body.employeeEmail.trim().toLowerCase() : "";
  const start = typeof body.payPeriodStart === "string" ? body.payPeriodStart : "";
  const end = typeof body.payPeriodEnd === "string" ? body.payPeriodEnd : "";
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  if (!employeeName || employeeName.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || !Number.isFinite(amount) || amount < 0 || !["USD", "COP", "EUR"].includes(currency)) return NextResponse.json({ error: "Check employee, period, amount, and currency." }, { status: 400 });
  const { data, error } = await actor.service.from("hr_payroll_entries").insert({ employee_name: employeeName, employee_email: employeeEmail || null, pay_period_start: start, pay_period_end: end, amount, currency, notes: notes || null, created_by: actor.user.id }).select("id, employee_name, employee_email, pay_period_start, pay_period_end, amount, currency, status, paid_at, notes, created_at").single();
  if (error) {
    console.error("HR payroll insert failed:", error.message);
    return NextResponse.json({ error: "Could not save payroll. Apply the HR payroll and rota migration and check database access." }, { status: 503 });
  }
  return NextResponse.json({ entry: data }, { status: 201 });
}
