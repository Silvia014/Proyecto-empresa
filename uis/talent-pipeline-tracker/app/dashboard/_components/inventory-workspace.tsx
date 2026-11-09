"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InventoryItem = { id: string; name: string; category: string; unit: string; currentStock: number; minStock: number; price: number; currency: string; updatedAt: string; supplierName: string | null; location: { id: string; name: string; city: string; country: string } | null };
type Location = { id: string; name: string; city: string; country: string };
const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";

export default function InventoryWorkspace() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (filter = locationId) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Sign in again to view inventory.");
      const url = new URL("/api/staff/inventory", window.location.origin);
      if (filter) url.searchParams.set("locationId", filter);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load inventory.");
      setItems(result.items || []); setLocations(result.locations || []); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load inventory."); }
    finally { setLoading(false); }
  }, [locationId]);
  useEffect(() => { void load(""); }, [load]);
  return <section className={panel}>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Stock room · live ERP records</p><h4 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Inventory</h4><p className="mt-2 text-sm text-gray-600">On-hand amounts are calculated from the existing inbound, outbound, and adjustment movement ledger.</p></div><div className="flex gap-2"><select aria-label="Filter inventory by location" value={locationId} onChange={(event) => { setLocationId(event.target.value); void load(event.target.value); }} className="rounded-lg border border-[#d8c9b5] px-3 py-2 text-sm"><option value="">All restaurants</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.city}</option>)}</select><button type="button" onClick={() => void load()} className="rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b]">Refresh</button></div></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p className="mt-5 text-sm text-gray-500">Loading stock records…</p> : !items.length ? <p className="mt-5 rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No inventory records are stored for this filter.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-3 pr-4">Item</th><th className="pb-3 pr-4">Restaurant</th><th className="pb-3 pr-4">Stock</th><th className="pb-3 pr-4">Reorder point</th><th className="pb-3 pr-4">Supplier on latest movement</th><th className="pb-3">Updated</th></tr></thead><tbody>{items.map((item) => { const low = Number(item.currentStock) <= Number(item.minStock); return <tr key={item.id} className="border-t border-[#eadfce] align-top"><td className="py-3 pr-4"><strong className="text-[#5a1f2b]">{item.name}</strong><p className="text-xs text-gray-500">{item.category} · latest cost {item.price} {item.currency}/{item.unit}</p></td><td className="py-3 pr-4">{item.location?.name || "—"} · {item.location?.city || ""}</td><td className={`py-3 pr-4 font-semibold ${low ? "text-red-700" : "text-gray-800"}`}>{item.currentStock} {item.unit}{low ? " · Low stock" : ""}</td><td className="py-3 pr-4">{item.minStock} {item.unit}</td><td className="py-3 pr-4">{item.supplierName || "—"}</td><td className="py-3">{new Date(item.updatedAt).toLocaleDateString()}</td></tr>; })}</tbody></table></div>}
  </section>;
}
