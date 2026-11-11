"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string; name: string; email: string | null; phone: string | null; country: string | null; city: string | null;
  preferences: string | null; createdAt: string; brasapoints: number;
  orders: Array<{ id: string; createdAt: string; total: number; currency: string; status: string; paymentStatus: string; source: string }>;
  reservations: Array<{ id: string; reservation_date: string; reservation_time: string; party_size: number; status: string }>;
  feedback: Array<{ id: string; order_id: string; value_for_money_rating: number; comment: string; created_at: string }>;
  messages: Array<{ id: string; category: "suggestion" | "complaint"; message: string; status: string; created_at: string; updated_at: string }>;
};
const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";

export default function CustomersWorkspace() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Sign in again to view customer records.");
      const response = await fetch("/api/staff/customers", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load customers.");
      setRows(result.customers || []); setError("");
      if (!result.feedbackAvailable) setError("Customer profiles and history loaded. Feedback will appear after the business feedback migration is applied.");
      if (!result.messagesAvailable) setError((current) => current ? `${current} Suggestions and complaints will appear after their migration is applied.` : "Suggestions and complaints will appear after their migration is applied.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load customers."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("customer"); if (requested) setSelected(requested); }, []);
  const filtered = rows.filter((item) => `${item.name} ${item.email || ""} ${item.phone || ""} ${item.city || ""}`.toLowerCase().includes(search.toLowerCase()));
  const active = filtered.find((item) => item.id === selected);
  return <section className={panel}>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Customer relationship desk</p><h4 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Customer profiles</h4><p className="mt-2 text-sm text-gray-600">Profiles are linked to the same customer records used by Brasaland Club, reservations, orders, and feedback.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b]">Refresh</button></div>
    <label className="mt-5 block text-sm font-medium text-gray-700">Search customers<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, city" className="mt-2 w-full rounded-lg border border-[#d8c9b5] px-3 py-2.5" /></label>
    {error && <p role={error.startsWith("Customer profiles") ? "status" : "alert"} className={`mt-4 rounded-xl p-4 text-sm ${error.startsWith("Customer profiles") ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{error}</p>}
    {loading && <p className="mt-4 text-sm text-gray-500">Loading customer profiles…</p>}
    {!loading && !error && !filtered.length && <p className="mt-4 rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No customer records found in the connected database.</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(250px,.8fr)_minmax(0,1.2fr)]">
      <div className="max-h-[640px] space-y-2 overflow-auto">{filtered.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-4 text-left ${selected === item.id ? "border-[#5a1f2b] bg-[#f8f0e8]" : "border-[#eadfce] bg-white"}`}><span className="block font-semibold text-[#5a1f2b]">{item.name || "Unnamed customer"}</span><span className="mt-1 block text-sm text-gray-600">{item.email || "No email"}</span><span className="mt-2 block text-xs text-gray-500">{item.brasapoints} Brasapoints · {item.orders.length} orders</span></button>)}</div>
      {active ? <article className="rounded-2xl bg-[#fdfaf5] p-5"><h5 className="text-xl font-semibold text-[#5a1f2b]">{active.name}</h5><p className="mt-2 text-sm text-gray-700">{active.email || "No email"} · {active.phone || "No phone"}</p><p className="text-sm text-gray-700">{[active.city, active.country].filter(Boolean).join(", ") || "Location not provided"}</p><p className="mt-3 text-sm"><strong>Brasapoints:</strong> {active.brasapoints}</p><p className="mt-2 text-sm"><strong>Preferences:</strong> {active.preferences || "No preferences saved"}</p>
        <h6 className="mt-5 font-semibold text-gray-900">Order history</h6><div className="mt-2 space-y-2">{active.orders.length ? active.orders.map((order) => <div key={order.id} className="rounded-lg bg-white p-3 text-sm"><strong>{new Date(order.createdAt).toLocaleDateString()}</strong> · {order.currency} {Number(order.total).toFixed(2)} · {order.status} · {order.paymentStatus}</div>) : <p className="text-sm text-gray-500">No orders linked to this profile.</p>}</div>
        <h6 className="mt-5 font-semibold text-gray-900">Reservations and order feedback</h6>{active.reservations.map((r) => <p key={r.id} className="mt-2 text-sm text-gray-700">{r.reservation_date} · {String(r.reservation_time).slice(0, 5)} · {r.party_size} guests · {r.status}</p>)}{active.feedback.map((f) => <p key={f.id} className="mt-2 rounded-lg bg-white p-3 text-sm text-gray-700">Value for money: {f.value_for_money_rating}/5{f.comment ? ` · ${f.comment}` : ""}</p>)}{!active.reservations.length && !active.feedback.length && <p className="mt-2 text-sm text-gray-500">No reservations or order feedback linked to this profile.</p>}
        <h6 className="mt-5 font-semibold text-gray-900">Suggestions and complaints</h6>{active.messages?.length ? <div className="mt-2 space-y-2">{active.messages.map((message) => <article key={message.id} className="rounded-lg border border-[#eadfce] bg-white p-3"><div className="flex flex-wrap justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[#5a1f2b]"><span>{message.category === "complaint" ? "Complaint" : "Suggestion"} · {message.status}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{message.message}</p></article>)}</div> : <p className="mt-2 text-sm text-gray-500">No suggestions or complaints linked to this profile.</p>}</article> : <p className="rounded-2xl bg-[#fdfaf5] p-5 text-sm text-gray-600">Select a customer to view their account history and preferences.</p>}
    </div>
  </section>;
}
