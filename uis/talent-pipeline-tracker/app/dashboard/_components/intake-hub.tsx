"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type IntakeData = {
  reservations: Array<{
    id: string; first_name: string; last_name: string; email: string; phone: string;
    city: string; country: string; party_size: number; reservation_date: string;
    reservation_time: string; location_preference: string | null; notes: string | null;
    status: string; created_at: string;
  }>;
  candidates: Array<{
    id: string; name: string; email: string; phone: string; position: string;
    experienceYears: number; cvFilename: string; cvUrl: string | null;
    status: string; createdAt: string;
  }>;
  members: Array<{ id: string; name: string; email: string; balance: number; createdAt: string }>;
  orders: Array<{
    id: string; createdAt: string; total: number; currency: string; status: string;
    paymentStatus: string; fulfillment: string; customerName: string; customerEmail: string;
    locationName: string; items: Array<{ dishName: string; quantity: number }>;
  }>;
  updatedAt: string;
};

const cardClass = "rounded-2xl border border-[#eadfce] bg-[#fdfaf5] p-4";
const showDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type IntakeView = "all" | "reservations" | "candidates";

export default function IntakeHub({ view = "all" }: { view?: IntakeView }) {
  const [data, setData] = useState<IntakeData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Sign in again to view staff intake.");
      setError("");
      const response = await fetch(`/api/intake?view=${view}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load intake records.");
      setData(result as IntakeData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load intake records.");
    } finally {
      setLoading(false);
    }
  }, [view]);

  function refresh() {
    setLoading(true);
    setError("");
    void load();
  }

  useEffect(() => {
    // load updates component state only after its asynchronous session and API requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return <section className="rounded-3xl bg-white p-6 shadow-sm lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Staff intake hub</p>
        <h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">
          {view === "reservations" ? "Online reservations" : view === "candidates" ? "Job applications and CVs" : "Reservations, candidates and new members"}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {view === "reservations" ? "Live booking requests received from the public website." : view === "candidates" ? "Live applications received from the public website. CV links are private and expire after five minutes." : "Latest records arriving from the website and Brasaclub registration."}
        </p>
      </div>
      <button onClick={refresh} disabled={loading} className="rounded-xl border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b] disabled:opacity-50">
        {loading ? "Refreshing…" : "Refresh"}
      </button>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && !data && <p className="mt-6 text-sm text-gray-500">Loading live records…</p>}
    {data && <div className={`mt-7 grid gap-6 ${view === "all" ? "xl:grid-cols-2" : "grid-cols-1"}`}>
      {(view === "all" || view === "reservations") && <div>
        <h4 className="mb-3 font-semibold text-gray-900">Reservations <span className="ml-1 text-xs font-normal text-gray-500">Latest {data.reservations.length}</span></h4>
        <div className="space-y-3">
          {data.reservations.length === 0 && <p className={cardClass + " text-sm text-gray-500"}>No reservations received yet.</p>}
          {data.reservations.map((item) => <article key={item.id} className={cardClass}>
            <p className="font-semibold text-[#5a1f2b]">{item.first_name} {item.last_name}</p>
            <p className="mt-1 text-sm text-gray-700">{item.reservation_date} · {item.reservation_time.slice(0, 5)} · {item.party_size} guests</p>
            <p className="mt-1 text-sm text-gray-700">{item.city}, {item.country} · <a className="underline" href={`mailto:${item.email}`}>{item.email}</a> · <a className="underline" href={`tel:${item.phone}`}>{item.phone}</a></p>
            <p className="mt-1 text-xs text-gray-500">{item.location_preference || "No location preference"} · {item.status} · received {showDate(item.created_at)}</p>
            {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{item.notes}</p>}
          </article>)}
        </div>
      </div>}
      {(view === "all" || view === "candidates") && <div>
        <h4 className="mb-3 font-semibold text-gray-900">Job applications <span className="ml-1 text-xs font-normal text-gray-500">Latest {data.candidates.length}</span></h4>
        <div className="space-y-3">
          {data.candidates.length === 0 && <p className={cardClass + " text-sm text-gray-500"}>No applications received yet.</p>}
          {data.candidates.map((item) => <article key={item.id} className={cardClass}>
            <p className="font-semibold text-[#5a1f2b]">{item.name}</p>
            <p className="mt-1 text-sm text-gray-700">{item.position} · {item.experienceYears} years</p>
            <p className="mt-1 text-sm text-gray-700"><a className="underline" href={`mailto:${item.email}`}>{item.email}</a> · <a className="underline" href={`tel:${item.phone}`}>{item.phone}</a></p>
            <p className="mt-1 text-xs text-gray-500">{item.status} · received {showDate(item.createdAt)}</p>
            {item.cvUrl && <a className="mt-3 inline-block text-sm font-medium text-[#5a1f2b] underline" href={item.cvUrl} target="_blank" rel="noreferrer">Open {item.cvFilename}</a>}
          </article>)}
        </div>
      </div>}
      {view === "all" && <div>
        <h4 className="mb-3 font-semibold text-gray-900">New Brasaclub members <span className="ml-1 text-xs font-normal text-gray-500">Latest {data.members.length}</span></h4>
        <div className="space-y-3">
          {data.members.length === 0 && <p className={cardClass + " text-sm text-gray-500"}>No members received yet.</p>}
          {data.members.map((item) => <article key={item.id} className={cardClass}>
            <p className="font-semibold text-[#5a1f2b]">{item.name}</p>
            <p className="mt-1 text-sm text-gray-700">{item.email}</p>
            <p className="mt-1 text-xs text-gray-500">{item.balance} points · joined {showDate(item.createdAt)}</p>
          </article>)}
        </div>
      </div>}
      {view === "all" && <div>
        <h4 className="mb-3 font-semibold text-gray-900">Online orders <span className="ml-1 text-xs font-normal text-gray-500">Latest {data.orders.length}</span></h4>
        <div className="space-y-3">
          {data.orders.length === 0 && <p className={cardClass + " text-sm text-gray-500"}>No online orders received yet.</p>}
          {data.orders.map((item) => <article key={item.id} className={cardClass}>
            <p className="font-semibold text-[#5a1f2b]">Order {item.id}</p>
            <p className="mt-1 text-sm text-gray-700">{item.customerName} · {item.customerEmail}</p>
            <p className="mt-1 text-xs text-gray-500">{item.locationName} · {item.fulfillment} · {item.status}</p>
            <p className="mt-2 text-sm">{item.items.map((line) => `${line.quantity} × ${line.dishName}`).join(" · ")}</p>
            <p className="mt-1 text-sm font-semibold">{new Intl.NumberFormat(item.currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency: item.currency }).format(item.total)}</p>
            <p className="mt-1 text-xs font-medium text-amber-800">Payment: {item.paymentStatus}</p>
          </article>)}
        </div>
      </div>}
    </div>}
    {data && <p className="mt-6 text-right text-xs text-gray-400">Updated {showDate(data.updatedAt)}</p>}
  </section>;
}
