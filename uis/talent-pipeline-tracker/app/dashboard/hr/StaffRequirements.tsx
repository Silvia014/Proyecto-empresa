"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { LocationSummary } from "../crm-sections";

type EventType = "absence" | "holiday_request" | "bank_holiday";
type EventStatus = "pending" | "approved" | "rejected";
type CalendarEvent = {
  id: string;
  title: string;
  event_type: EventType;
  employee_name: string | null;
  location_id: string | null;
  start_date: string;
  end_date: string;
  status: EventStatus;
  notes: string | null;
};
type EventForm = Omit<CalendarEvent, "id">;

const emptyForm = (date: string): EventForm => ({
  title: "",
  event_type: "absence",
  employee_name: "",
  location_id: "",
  start_date: date,
  end_date: date,
  status: "pending",
  notes: "",
});
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const eventColors: Record<EventType, string> = {
  absence: "bg-[#f8e9e8] text-[#8a3442] border-[#e9c5c4]",
  holiday_request: "bg-[#f7efd9] text-[#80601e] border-[#e8d7a5]",
  bank_holiday: "bg-[#e7eee4] text-[#45633d] border-[#c8d7c2]",
};

function eventLabel(type: EventType) {
  return type === "absence" ? "Absence" : type === "holiday_request" ? "Holiday request" : "Bank holiday";
}

export default function StaffRequirements({ locations }: { locations: LocationSummary[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [form, setForm] = useState<EventForm>(() => emptyForm(dateKey(new Date())));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError || !data.session) {
        router.replace("/login");
        return;
      }
      setToken(data.session.access_token);
    });
    return () => { alive = false; };
  }, [router, supabase]);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`/api/hr/calendar?month=${monthKey}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Could not load the staff calendar.");
      setEvents(result.events || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the staff calendar.");
    }
  }, [monthKey, router, token]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const calendarDays = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), index - offset + 1);
    return { date, key: dateKey(date), inMonth: date.getMonth() === cursor.getMonth() };
  });
  const selectedEvents = events.filter((item) => item.start_date <= selectedDate && item.end_date >= selectedDate);
  const monthTitle = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function chooseDate(key: string) {
    const chosen = new Date(`${key}T12:00:00`);
    if (chosen.getMonth() !== cursor.getMonth() || chosen.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(chosen.getFullYear(), chosen.getMonth(), 1));
    }
    setSelectedDate(key);
    if (!editingId) setForm(emptyForm(key));
  }

  function editEvent(item: CalendarEvent) {
    setEditingId(item.id);
    setSelectedDate(item.start_date);
    setForm({
      title: item.title,
      event_type: item.event_type,
      employee_name: item.employee_name || "",
      location_id: item.location_id || "",
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      notes: item.notes || "",
    });
    document.getElementById("staff-requirements-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/hr/calendar/${editingId}` : "/api/hr/calendar", {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save this calendar entry.");
      setMessage(editingId ? "Calendar entry updated." : "Calendar entry added.");
      setEditingId(null);
      setForm(emptyForm(selectedDate));
      await loadEvents();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this calendar entry.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(id: string) {
    if (!token || !window.confirm("Delete this staff calendar entry?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/hr/calendar/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete this entry.");
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm(selectedDate));
      }
      setMessage("Calendar entry deleted.");
      await loadEvents();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this entry.");
    } finally {
      setBusy(false);
    }
  }

  function changeType(eventType: EventType) {
    setForm((current) => ({ ...current, event_type: eventType, status: eventType === "bank_holiday" ? "approved" : current.status === "approved" ? "pending" : current.status }));
  }

  return <section id="staff-requirements" className="scroll-mt-6 rounded-2xl border border-[#e3d8c8] bg-[#fbf8f3] p-4 shadow-sm sm:p-6 lg:p-7">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c6a52]">People calendar</p>
        <h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b] sm:text-3xl">Staff requirements</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Record absences, holiday requests, and public holidays. Entries are saved for the HR team and shown on the calendar.</p>
      </div>
      <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm(selectedDate)); document.getElementById("staff-requirements-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-xl bg-[#5a1f2b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4a1a28] focus:outline-none focus:ring-2 focus:ring-[#b08d57] focus:ring-offset-2">Add calendar entry</button>
    </div>

    {message && <p className="mb-4 rounded-lg border border-[#c8d7c2] bg-[#e7eee4] px-4 py-3 text-sm text-[#45633d]" role="status">{message}</p>}
    {error && <p className="mb-4 rounded-lg border border-[#e9c5c4] bg-[#f8e9e8] px-4 py-3 text-sm text-[#8a3442]" role="alert">{error}</p>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.8fr)]">
      <div className="rounded-xl border border-[#e5dccf] bg-white p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" aria-label="Previous month" onClick={() => { const next = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); setCursor(next); chooseDate(dateKey(next)); }} className="rounded-lg border border-[#e5dccf] px-3 py-2 text-sm text-[#5a1f2b] hover:bg-[#f8f3eb]">←</button>
          <h4 className="text-lg font-semibold capitalize text-[#332820]">{monthTitle}</h4>
          <button type="button" aria-label="Next month" onClick={() => { const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); setCursor(next); chooseDate(dateKey(next)); }} className="rounded-lg border border-[#e5dccf] px-3 py-2 text-sm text-[#5a1f2b] hover:bg-[#f8f3eb]">→</button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#eee7dc] pb-2 text-center text-xs font-semibold text-gray-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, key, inMonth }) => {
            const dayEvents = events.filter((item) => item.start_date <= key && item.end_date >= key);
            const selected = selectedDate === key;
            return <button key={key} type="button" onClick={() => chooseDate(key)} aria-pressed={selected} className={`min-h-[76px] border-b border-r border-[#f0ebe3] p-1.5 text-left transition sm:min-h-[92px] sm:p-2 ${inMonth ? "bg-white" : "bg-[#faf8f4] text-gray-400"} ${selected ? "ring-2 ring-inset ring-[#762b3e]" : "hover:bg-[#fbf7f0]"}`}>
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${selected ? "bg-[#762b3e] font-semibold text-white" : "text-gray-600"}`}>{date.getDate()}</span>
              <span className="mt-1 block space-y-1">
                {dayEvents.slice(0, 2).map((item) => <span key={item.id} title={`${item.title} · ${eventLabel(item.event_type)}`} className={`block truncate rounded border px-1 py-0.5 text-[10px] leading-4 ${eventColors[item.event_type]}`}>{item.title}</span>)}
                {dayEvents.length > 2 && <span className="block px-1 text-[10px] text-gray-500">+{dayEvents.length - 2} more</span>}
              </span>
            </button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
          {(["absence", "holiday_request", "bank_holiday"] as EventType[]).map((type) => <span key={type} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${type === "absence" ? "bg-[#8a3442]" : type === "holiday_request" ? "bg-[#b08d35]" : "bg-[#54764b]"}`} />{eventLabel(type)}</span>)}
        </div>
      </div>

      <form id="staff-requirements-form" onSubmit={saveEvent} className="rounded-xl border border-[#e5dccf] bg-white p-4 sm:p-5">
        <h4 className="text-lg font-semibold text-[#5a1f2b]">{editingId ? "Edit calendar entry" : "Add a request or holiday"}</h4>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-gray-700">Entry type
            <select value={form.event_type} onChange={(event) => changeType(event.target.value as EventType)} className="rounded-lg border border-[#d9cdbd] bg-white px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20">
              <option value="absence">Staff absence</option><option value="holiday_request">Holiday request</option><option value="bank_holiday">Public / bank holiday</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">Title<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Annual leave" className="rounded-lg border border-[#d9cdbd] px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20" /></label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">Staff member (optional)<input maxLength={120} value={form.employee_name || ""} onChange={(event) => setForm({ ...form, employee_name: event.target.value })} placeholder="Employee name" className="rounded-lg border border-[#d9cdbd] px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20" /></label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">Location
            <select value={form.location_id || ""} onChange={(event) => setForm({ ...form, location_id: event.target.value || null })} className="rounded-lg border border-[#d9cdbd] bg-white px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20">
              <option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.city ? ` · ${location.city}` : ""}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium text-gray-700">From<input required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value, end_date: form.end_date < event.target.value ? event.target.value : form.end_date })} className="min-w-0 rounded-lg border border-[#d9cdbd] px-2 py-2.5 focus:border-[#762b3e] focus:outline-none" /></label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">To<input required type="date" min={form.start_date} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} className="min-w-0 rounded-lg border border-[#d9cdbd] px-2 py-2.5 focus:border-[#762b3e] focus:outline-none" /></label>
          </div>
          {form.event_type !== "bank_holiday" && <label className="grid gap-1 text-sm font-medium text-gray-700">Request status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EventStatus })} className="rounded-lg border border-[#d9cdbd] bg-white px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
          </label>}
          <label className="grid gap-1 text-sm font-medium text-gray-700">Notes (optional)<textarea rows={2} maxLength={500} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="resize-y rounded-lg border border-[#d9cdbd] px-3 py-2.5 focus:border-[#762b3e] focus:outline-none focus:ring-2 focus:ring-[#762b3e]/20" /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} type="submit" className="rounded-lg bg-[#5a1f2b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a1a28] disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Add to calendar"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm(selectedDate)); }} className="rounded-lg border border-[#d9cdbd] px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#faf8f4]">Cancel</button>}
        </div>
      </form>
    </div>

    <div className="mt-6 rounded-xl border border-[#e5dccf] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-lg font-semibold text-[#5a1f2b]">Entries on {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h4><span className="text-xs text-gray-500">{selectedEvents.length} {selectedEvents.length === 1 ? "entry" : "entries"}</span></div>
      {selectedEvents.length === 0 ? <p className="rounded-lg bg-[#faf8f4] px-4 py-5 text-sm text-gray-600">No entries on this date. Choose a day or add a staff request above.</p> : <ul className="divide-y divide-[#eee7dc]">{selectedEvents.map((item) => <li key={item.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${eventColors[item.event_type]}`}>{eventLabel(item.event_type)}</span><span className="rounded-full bg-[#f2eee8] px-2 py-1 text-xs text-gray-600">{item.status}</span></div><p className="mt-2 font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm text-gray-600">{item.employee_name || "All staff"}{item.end_date !== item.start_date ? ` · ${item.start_date} to ${item.end_date}` : ` · ${item.start_date}`}{item.location_id ? ` · ${locations.find((location) => String(location.id) === item.location_id)?.name || "Location"}` : " · All locations"}</p>{item.notes && <p className="mt-1 text-sm text-gray-500">{item.notes}</p>}</div>
        <div className="flex shrink-0 gap-2"><button type="button" onClick={() => editEvent(item)} className="rounded-lg border border-[#d9cdbd] px-3 py-2 text-xs font-semibold text-[#5a1f2b] hover:bg-[#faf8f4]">Edit</button><button type="button" onClick={() => void removeEvent(item.id)} disabled={busy} className="rounded-lg border border-[#e9c5c4] px-3 py-2 text-xs font-semibold text-[#8a3442] hover:bg-[#f8e9e8] disabled:opacity-50">Delete</button></div>
      </li>)}</ul>}
    </div>
  </section>;
}
