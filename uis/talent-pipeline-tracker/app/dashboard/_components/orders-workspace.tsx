"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Location = { id: string; name: string; city: string; country: string; timezone: string | null };
type MenuItem = { id: string; name: string; category: string; price: number; currency: string };
type Reservation = {
  id: string; first_name: string; last_name: string; email: string; phone: string; party_size: number;
  reservation_date: string; reservation_time: string; source: string; status: string; notes: string | null;
  consumptionRecorded: boolean;
};
type DraftItem = { menuItemId: string; quantity: number };

const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";
const input = "w-full rounded-lg border border-[#d8c9b5] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#5a1f2b] focus:ring-2 focus:ring-[#5a1f2b]/15";

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency, maximumFractionDigits: currency === "COP" ? 0 : 2 }).format(value);
}

export default function OrdersWorkspace() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (requestedLocationId = locationId, requestedDate = date) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Sign in again to access orders.");
      const params = new URLSearchParams();
      if (requestedLocationId) params.set("locationId", requestedLocationId);
      if (requestedDate) params.set("date", requestedDate);
      const response = await fetch(`/api/staff/orders?${params}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load the Orders workspace.");
      setLocations(result.locations || []);
      setLocationId(result.locationId || "");
      setDate(result.date || "");
      setReservations(result.reservations || []);
      setMenu(result.menu || []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the Orders workspace.");
    } finally {
      setLoading(false);
    }
  }, [locationId, date]);

  useEffect(() => {
    // Initial load asks the API to use the selected restaurant's timezone for today's date.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload: Record<string, unknown>) {
    const supabase = createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Sign in again to access orders.");
    const response = await fetch("/api/staff/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not save the order record.");
    return result;
  }

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await post({
        action: "create-reservation", locationId, date: values.get("date"), time: values.get("time"),
        name: values.get("name"), email: values.get("email"), phone: values.get("phone"),
        partySize: values.get("partySize"), notes: values.get("notes"),
      });
      form.reset();
      setMessage("Restaurant reservation saved.");
      await load(locationId, date);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the reservation.");
    } finally { setSaving(false); }
  }

  function updateDraft(reservationId: string, index: number, field: keyof DraftItem, value: string) {
    setDrafts((current) => {
      const next = [...(current[reservationId] || [{ menuItemId: "", quantity: 1 }])];
      next[index] = { ...next[index], [field]: field === "quantity" ? Number(value) : value };
      return { ...current, [reservationId]: next };
    });
  }

  async function recordConsumption(event: FormEvent<HTMLFormElement>, reservation: Reservation) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const items = drafts[reservation.id] || [{ menuItemId: "", quantity: 1 }];
    try {
      const result = await post({
        action: "record-consumption", reservationId: reservation.id, locationId,
        paymentStatus: new FormData(form).get("paymentStatus"),
        discountAmount: new FormData(form).get("discountAmount"), items,
      });
      setMessage(`Consumption saved · ${money(Number(result.total), result.currency)}.`);
      setDrafts((current) => ({ ...current, [reservation.id]: [{ menuItemId: "", quantity: 1 }] }));
      await load(locationId, date);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the consumed items.");
    } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <section className={panel}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Orders · restaurant service</p>
      <h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Today’s reservations and consumption</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">Add the restaurant’s reservations for the selected day, then record the items each table consumed. Saved checks feed sales, products, covers, and average spend per guest in Dashboard 00.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Restaurant
          <select className={input} value={locationId} onChange={(event) => { setLocationId(event.target.value); setDate(""); void load(event.target.value, ""); }}>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.city}, {location.country}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Service date · restaurant local time
          <input className={input} type="date" value={date} onChange={(event) => { setDate(event.target.value); void load(locationId, event.target.value); }} />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    </section>

    <section className={panel}>
      <h4 className="text-xl font-semibold text-[#5a1f2b]">Add a restaurant reservation</h4>
      <p className="mt-1 text-sm text-gray-600">Manual staff entry for phone bookings, walk-ins, and reservations not submitted through the website.</p>
      <form onSubmit={createReservation} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Guest name<input className={input} name="name" maxLength={160} required /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Email · optional<input className={input} name="email" type="email" maxLength={254} /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Phone · optional<input className={input} name="phone" type="tel" maxLength={80} /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Guests<input className={input} name="partySize" type="number" min={1} max={20} defaultValue={2} required /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Date<input className={input} name="date" type="date" defaultValue={date} required /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Time<input className={input} name="time" type="time" required /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 md:col-span-2 xl:col-span-3">Notes · optional<textarea className={input} name="notes" rows={2} maxLength={1000} /></label>
        <button className="rounded-xl bg-[#5a1f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4a1a28] disabled:opacity-50 md:col-span-2 xl:col-span-3" disabled={saving || !locationId}>{saving ? "Saving…" : "Save reservation"}</button>
      </form>
    </section>

    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Service log</p><h4 className="mt-2 text-xl font-semibold text-[#5a1f2b]">Reservations for {date || "selected date"}</h4></div><button type="button" onClick={() => void load(locationId, date)} className="rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b]">Refresh</button></div>
      {loading && <p className="mt-5 text-sm text-gray-500">Loading reservations…</p>}
      {!loading && reservations.length === 0 && <p className="mt-5 rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No reservations recorded for this restaurant and date.</p>}
      <div className="mt-5 space-y-4">
        {reservations.map((reservation) => {
          const selectedItems = drafts[reservation.id] || [{ menuItemId: "", quantity: 1 }];
          return <article key={reservation.id} className="rounded-2xl border border-[#eadfce] bg-[#fdfaf5] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h5 className="font-semibold text-[#5a1f2b]">{reservation.first_name} {reservation.last_name}</h5><p className="mt-1 text-sm text-gray-700">{String(reservation.reservation_time).slice(0, 5)} · {reservation.party_size} guests · {reservation.source === "STAFF" ? "Staff entry" : "Website reservation"}</p><p className="mt-1 text-xs text-gray-500">{reservation.email || "No email"} {reservation.phone ? `· ${reservation.phone}` : ""} · {reservation.status}</p>{reservation.notes && <p className="mt-2 text-sm text-gray-600">{reservation.notes}</p>}</div>
              {reservation.consumptionRecorded && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Consumption saved</span>}
            </div>
            {!reservation.consumptionRecorded && <form onSubmit={(event) => void recordConsumption(event, reservation)} className="mt-4 border-t border-[#eadfce] pt-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">Items consumed</p>
              <div className="space-y-2">{selectedItems.map((item, index) => <div key={`${reservation.id}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                <select className={input} value={item.menuItemId} required onChange={(event) => updateDraft(reservation.id, index, "menuItemId", event.target.value)}><option value="">Choose a menu item</option>{menu.map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.category} · {menuItem.name} · {money(Number(menuItem.price), menuItem.currency)}</option>)}</select>
                <input className={input} type="number" aria-label="Quantity" min={1} max={50} value={item.quantity} required onChange={(event) => updateDraft(reservation.id, index, "quantity", event.target.value)} />
                {selectedItems.length > 1 && <button type="button" className="rounded-lg border border-[#d8c9b5] px-3 text-sm text-[#5a1f2b]" onClick={() => setDrafts((current) => ({ ...current, [reservation.id]: selectedItems.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>}
              </div>)}</div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <button type="button" className="text-sm font-semibold text-[#5a1f2b] underline" onClick={() => setDrafts((current) => ({ ...current, [reservation.id]: [...selectedItems, { menuItemId: "", quantity: 1 }] }))}>Add item</button>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Discount amount
                  <input className="w-36 rounded-lg border border-[#d8c9b5] px-3 py-2 text-sm font-normal normal-case text-gray-900" type="number" name="discountAmount" min={0} step="0.01" defaultValue={0} />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Payment
                  <select className={input} name="paymentStatus" defaultValue="PAID"><option value="PAID">Paid</option><option value="PENDING">Pending</option></select>
                </label>
                <button className="ml-auto rounded-xl bg-[#5a1f2b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4a1a28] disabled:opacity-50" disabled={saving}>{saving ? "Saving…" : "Save consumed items"}</button>
              </div>
            </form>}
          </article>;
        })}
      </div>
    </section>
  </div>;
}
