"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LocationSummary } from "../crm-sections";

type Payroll = { id: string; employee_name: string; employee_email: string | null; pay_period_start: string; pay_period_end: string; amount: number; currency: string; status: "pending" | "paid"; paid_at: string | null; notes: string | null };
type Shift = { id: string; employee_name: string; employee_email: string | null; location_id: string | null; shift_date: string; start_time: string; end_time: string; role: string | null; notes: string | null; Location?: { name: string; city: string } | { name: string; city: string }[] | null };
const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";
const field = "w-full rounded-lg border border-[#d8c9b5] bg-white px-3 py-2.5 text-sm text-gray-900";

export default function PayrollRotaWorkspace({ locations }: { locations: LocationSummary[] }) {
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const auth = useCallback(async () => {
    const client = createClient();
    const { data, error: authError } = await client.auth.getSession();
    if (authError || !data.session) throw new Error("Sign in again to manage HR records.");
    setToken(data.session.access_token); return data.session.access_token;
  }, []);
  const load = useCallback(async () => {
    setError("");
    try {
      const accessToken = token || await auth();
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [payrollResponse, rotaResponse] = await Promise.all([fetch("/api/hr/payroll", { headers, cache: "no-store" }), fetch("/api/hr/rota", { headers, cache: "no-store" })]);
      const [payrollResult, rotaResult] = await Promise.all([payrollResponse.json().catch(() => ({})), rotaResponse.json().catch(() => ({}))]);
      if (!payrollResponse.ok) throw new Error(payrollResult.error || "Could not load payroll records.");
      if (!rotaResponse.ok) throw new Error(rotaResult.error || "Could not load staff rota.");
      setPayroll(payrollResult.entries || []); setShifts(rotaResult.shifts || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load HR records."); }
  }, [auth, token]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, kind: "payroll" | "rota") {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const form = event.currentTarget; const values = new FormData(form);
    try {
      const accessToken = token || await auth();
      const payload = kind === "payroll" ? {
        employeeName: values.get("employeeName"), employeeEmail: values.get("employeeEmail"), payPeriodStart: values.get("payPeriodStart"), payPeriodEnd: values.get("payPeriodEnd"), amount: values.get("amount"), currency: values.get("currency"), notes: values.get("notes"),
      } : {
        employeeName: values.get("employeeName"), employeeEmail: values.get("employeeEmail"), shiftDate: values.get("shiftDate"), startTime: values.get("startTime"), endTime: values.get("endTime"), locationId: values.get("locationId"), role: values.get("role"), notes: values.get("notes"),
      };
      const response = await fetch(`/api/hr/${kind}`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not save ${kind}.`);
      form.reset(); setMessage(kind === "payroll" ? "Payroll entry saved." : "Staff shift added to the rota."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save HR record."); }
    finally { setSaving(false); }
  }

  async function setPaid(entry: Payroll) {
    setError(""); setMessage("");
    try {
      const accessToken = token || await auth();
      const response = await fetch(`/api/hr/payroll/${entry.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: entry.status === "paid" ? "pending" : "paid" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update payment status.");
      setMessage("Payroll payment status updated."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update payment status."); }
  }

  return <div className="space-y-6">
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className={panel}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">HR · payroll records</p><h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Staff payroll</h3><p className="mt-2 text-sm text-gray-600">Add payroll entries manually and mark each one as paid when processed.</p>
      <form onSubmit={(event) => void submit(event, "payroll")} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm">Staff name<input className={`${field} mt-1`} name="employeeName" maxLength={120} required /></label><label className="text-sm">Staff email · optional<input className={`${field} mt-1`} name="employeeEmail" type="email" /></label><label className="text-sm">Period from<input className={`${field} mt-1`} name="payPeriodStart" type="date" required /></label><label className="text-sm">Period to<input className={`${field} mt-1`} name="payPeriodEnd" type="date" required /></label><label className="text-sm">Amount<input className={`${field} mt-1`} name="amount" type="number" min="0" step="0.01" required /></label><label className="text-sm">Currency<select className={`${field} mt-1`} name="currency"><option>USD</option><option>COP</option><option>EUR</option></select></label><label className="text-sm sm:col-span-2">Notes<input className={`${field} mt-1`} name="notes" maxLength={1000} /></label><button disabled={saving} className="rounded-xl bg-[#5a1f2b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add payroll record"}</button></form>
      <div className="mt-5 space-y-2">{payroll.length ? payroll.map((entry) => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfce] bg-[#fdfaf5] p-4"><div><strong className="text-[#5a1f2b]">{entry.employee_name}</strong><p className="text-sm text-gray-600">{entry.pay_period_start} – {entry.pay_period_end} · {entry.currency} {Number(entry.amount).toFixed(2)} · {entry.employee_email || "No email"}</p></div><button type="button" onClick={() => void setPaid(entry)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${entry.status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{entry.status === "paid" ? "Paid · mark pending" : "Pending · mark paid"}</button></article>) : <p className="rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No payroll entries saved.</p>}</div>
    </section>
    <section className={panel}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">HR · rota</p><h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Staff schedule</h3><p className="mt-2 text-sm text-gray-600">Create shifts for a restaurant and review upcoming staff assignments.</p>
      <form onSubmit={(event) => void submit(event, "rota")} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm">Staff name<input className={`${field} mt-1`} name="employeeName" maxLength={120} required /></label><label className="text-sm">Staff email · optional<input className={`${field} mt-1`} name="employeeEmail" type="email" /></label><label className="text-sm">Date<input className={`${field} mt-1`} name="shiftDate" type="date" required /></label><label className="text-sm">Restaurant<select className={`${field} mt-1`} name="locationId"><option value="">Not assigned</option>{locations.map((location) => <option key={location.id} value={String(location.id)}>{location.name} · {location.city}</option>)}</select></label><label className="text-sm">Start<input className={`${field} mt-1`} name="startTime" type="time" required /></label><label className="text-sm">End<input className={`${field} mt-1`} name="endTime" type="time" required /></label><label className="text-sm">Role / station<input className={`${field} mt-1`} name="role" maxLength={100} /></label><label className="text-sm">Notes<input className={`${field} mt-1`} name="notes" maxLength={500} /></label><button disabled={saving} className="rounded-xl bg-[#5a1f2b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add shift"}</button></form>
      <div className="mt-5 space-y-2">{shifts.length ? shifts.map((shift) => { const loc = Array.isArray(shift.Location) ? shift.Location[0] : shift.Location; return <article key={shift.id} className="rounded-xl border border-[#eadfce] bg-[#fdfaf5] p-4"><strong className="text-[#5a1f2b]">{shift.employee_name}</strong><p className="text-sm text-gray-700">{shift.shift_date} · {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)} · {loc?.name || "Unassigned"}{shift.role ? ` · ${shift.role}` : ""}</p><p className="text-xs text-gray-500">{shift.employee_email || "No email"}{shift.notes ? ` · ${shift.notes}` : ""}</p></article>; }) : <p className="rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No rota shifts saved.</p>}</div>
    </section>
  </div>;
}
