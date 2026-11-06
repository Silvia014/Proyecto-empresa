"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MoneyMap = Record<string, number>;
type NullableMoneyMap = Record<string, number | null>;
type DashboardData = {
  generatedAt: string;
  orders: Array<{
    id: string; createdAt: string; total: number; currency: string; status: string;
    paymentStatus: string; locationName: string; items: Array<{ name: string; quantity: number }>;
  }>;
  metrics: {
    revenueByCurrency: MoneyMap;
        averagePaidOrderByCurrency: MoneyMap;
    averageTableCheckByCurrency: MoneyMap;
        averageSpendPerGuestByCurrency: NullableMoneyMap;
    paidOrderCount: number;
    onlineOrderCount: number;
    monthlySales: Array<{ month: string; revenueByCurrency: MoneyMap; paidOrders: number }>;
    productsSold: Array<{ name: string; category: string; quantity: number; revenueByCurrency: MoneyMap }>;
    discountsByCurrency: MoneyMap;
    cancelledOrders: number;
    cancelledReservations: number;
    guestsServed: number;
        valueForMoneyAverage: number | null;
        feedbackCount: number;
  };
  dataAvailability: { customerFeedback: boolean; orderGuestCount: boolean; note: string; recentFeedback: Array<{ rating: number; comment: string; createdAt: string }> };
};

const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-6";
const card = "rounded-2xl border border-[#eadfce] bg-[#fdfaf5] p-4";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", {
      style: "currency", currency, maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function moneyList(values: NullableMoneyMap) {
  const entries = Object.entries(values).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]));
  return entries.length ? entries.map(([currency, value]) => formatMoney(value, currency)).join(" · ") : "—";
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function BusinessDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Sign in again to view business intelligence.");
      const response = await fetch("/api/business-dashboard", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load business performance data.");
      setData(result as DashboardData);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load business performance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Realtime events refresh the data immediately; polling remains as a fallback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const supabase = createClient();
    const channel = supabase.channel("business-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "Order" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "OrderItem" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_feedback" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .subscribe();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  if (loading && !data) return <section className={panel}><p className="text-sm text-gray-600">Loading live business data…</p></section>;

  return <div className="space-y-6">
    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Business intelligence · 00</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Sales and restaurant performance</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">Live totals are read from ERP orders and reservation records. Revenue and discounts include paid orders only; COP and USD stay separate so figures are not mixed across currencies.</p>
        </div>
        <button onClick={() => { setLoading(true); void load(); }} disabled={loading} className="rounded-xl border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b] disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh now"}
        </button>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {data && <p className="mt-4 text-xs text-gray-500">Updated {dateTime(data.generatedAt)} · Refreshes automatically every 30 seconds</p>}
    </section>

    {data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={card}><p className="text-sm text-gray-600">Revenue received</p><p className="mt-3 text-xl font-semibold text-[#5a1f2b]">{moneyList(data.metrics.revenueByCurrency)}</p><p className="mt-2 text-xs text-gray-500">Paid, non-cancelled orders</p></article>
        <article className={card}><p className="text-sm text-gray-600">Average table check</p><p className="mt-3 text-xl font-semibold text-[#5a1f2b]">{moneyList(data.metrics.averageTableCheckByCurrency) || "Not available"}</p><p className="mt-2 text-xs text-gray-500">Paid dine-in orders linked to a reservation</p></article>
        <article className={card}><p className="text-sm text-gray-600">Online orders</p><p className="mt-3 text-3xl font-semibold text-[#5a1f2b]">{data.metrics.onlineOrderCount}</p><p className="mt-2 text-xs text-gray-500">All online orders in the database</p></article>
        <article className={card}><p className="text-sm text-gray-600">Paid orders</p><p className="mt-3 text-3xl font-semibold text-[#5a1f2b]">{data.metrics.paidOrderCount}</p><p className="mt-2 text-xs text-gray-500">All sources · excludes cancelled or unpaid orders</p></article>
        <article className={card}><p className="text-sm text-gray-600">Guests recorded for paid orders</p><p className="mt-3 text-3xl font-semibold text-[#5a1f2b]">{data.metrics.guestsServed.toLocaleString()}</p><p className="mt-2 text-xs text-gray-500">Online covers and restaurant checks</p></article>
        <article className={card}><p className="text-sm text-gray-600">Discounts applied</p><p className="mt-3 text-xl font-semibold text-[#5a1f2b]">{moneyList(data.metrics.discountsByCurrency)}</p><p className="mt-2 text-xs text-gray-500">Paid orders, including Brasapuntos discounts</p></article>
        <article className={card}><p className="text-sm text-gray-600">Cancelled orders</p><p className="mt-3 text-3xl font-semibold text-[#5a1f2b]">{data.metrics.cancelledOrders}</p><p className="mt-2 text-xs text-gray-500">All order sources</p></article>
        <article className={card}><p className="text-sm text-gray-600">Cancelled reservations</p><p className="mt-3 text-3xl font-semibold text-[#5a1f2b]">{data.metrics.cancelledReservations}</p><p className="mt-2 text-xs text-gray-500">Online reservation records</p></article>
        <article className={card}><p className="text-sm text-gray-600">Average spend per guest</p><p className="mt-3 text-xl font-semibold text-[#5a1f2b]">{moneyList(data.metrics.averageSpendPerGuestByCurrency) || "Not available"}</p><p className="mt-2 text-xs text-gray-500">Paid order total divided by recorded guests</p></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={panel}>
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Paid sales</p><h4 className="mt-2 text-xl font-semibold text-[#5a1f2b]">Monthly revenue · last 12 months</h4></div>
          {data.metrics.monthlySales.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-3 pr-4">Month</th><th className="pb-3 pr-4">Revenue</th><th className="pb-3">Paid orders</th></tr></thead><tbody>{data.metrics.monthlySales.map((row) => <tr key={row.month} className="border-t border-[#eadfce]"><td className="py-3 pr-4 font-medium text-gray-800">{new Date(`${row.month}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td><td className="py-3 pr-4 text-gray-700">{moneyList(row.revenueByCurrency)}</td><td className="py-3 text-gray-700">{row.paidOrders}</td></tr>)}</tbody></table></div> : <p className="mt-5 text-sm text-gray-500">No paid sales are recorded yet.</p>}
        </div>

        <div className={panel}>
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Product mix</p><h4 className="mt-2 text-xl font-semibold text-[#5a1f2b]">Products sold</h4><p className="mt-1 text-xs text-gray-500">Based on paid, non-cancelled orders</p></div>
          {data.metrics.productsSold.length ? <div className="mt-5 space-y-3">{data.metrics.productsSold.slice(0, 12).map((product) => <article key={`${product.category}-${product.name}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fdfaf5] px-4 py-3"><div><p className="font-medium text-gray-900">{product.name}</p><p className="text-xs text-gray-500">{product.category} · {moneyList(product.revenueByCurrency)}</p></div><span className="rounded-full bg-[#efe2d3] px-3 py-1 text-sm font-semibold text-[#5a1f2b]">{product.quantity} sold</span></article>)}</div> : <p className="mt-5 text-sm text-gray-500">No paid product sales are recorded yet.</p>}
        </div>
      </section>

      <section className={panel}>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Customer experience</p><h4 className="mt-2 text-xl font-semibold text-[#5a1f2b]">Value for money feedback</h4></div>
        <div className="mt-4 rounded-xl bg-[#fdfaf5] p-4">
          <p className="text-2xl font-semibold text-[#5a1f2b]">{data.metrics.valueForMoneyAverage == null ? "—" : `${data.metrics.valueForMoneyAverage.toFixed(1)} / 5`}</p>
          <p className="mt-1 text-sm text-gray-600">Average customer value-for-money rating · {data.metrics.feedbackCount} reviews</p>
          {data.dataAvailability.recentFeedback.length ? <div className="mt-4 space-y-3">{data.dataAvailability.recentFeedback.map((review, index) => <article key={`${review.createdAt}-${index}`} className="border-t border-[#eadfce] pt-3"><p className="text-sm font-semibold text-[#5a1f2b]">{review.rating} / 5 · {dateTime(review.createdAt)}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{review.comment || "No written comment"}</p></article>)}</div> : <p className="mt-3 text-sm text-gray-600">Reviews will appear here after a customer submits feedback from their account.</p>}
        </div>
      </section>

      <section className={panel}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Website channel</p><h4 className="mt-2 text-xl font-semibold text-[#5a1f2b]">Online orders</h4></div><p className="text-sm text-gray-500">{data.orders.length} records</p></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-3 pr-4">Order</th><th className="pb-3 pr-4">Received</th><th className="pb-3 pr-4">Location</th><th className="pb-3 pr-4">Items</th><th className="pb-3 pr-4">Total</th><th className="pb-3">Status / payment</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id} className="border-t border-[#eadfce] align-top"><td className="py-3 pr-4 font-mono text-xs text-gray-700">{order.id.slice(0, 8)}</td><td className="py-3 pr-4 text-gray-700">{dateTime(order.createdAt)}</td><td className="py-3 pr-4 text-gray-700">{order.locationName || "—"}</td><td className="py-3 pr-4 text-gray-700">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "—"}</td><td className="py-3 pr-4 font-medium text-gray-900">{formatMoney(order.total, order.currency)}</td><td className="py-3 text-gray-700">{order.status} · {order.paymentStatus}</td></tr>)}</tbody></table></div>
        {data.orders.length === 0 && <p className="mt-3 text-sm text-gray-500">No online orders are stored yet.</p>}
      </section>
    </>}
  </div>;
}
