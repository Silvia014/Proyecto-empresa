"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: number;
  name: string;
  country: string;
  categories: string[];
  rate_per_unit: number;
  currency: string;
  status: string;
  contact_email: string | null;
  notes: string | null;
  updated_at: string;
};

const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";

export default function SuppliersWorkspace() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (filter = country) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Sign in again to view suppliers.");
      const params = new URLSearchParams();
      if (filter) params.set("country", filter);
      const response = await fetch(`/api/staff/suppliers${params.size ? `?${params}` : ""}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load supplier records.");
      setSuppliers(result.suppliers || []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load supplier records.");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { void load(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className={panel}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Live supplier directory</p><h4 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Suppliers</h4><p className="mt-2 text-sm text-gray-600">Records are read from the existing supplier directory; no sample suppliers are added here.</p></div>
      <div className="flex gap-2">
        <select aria-label="Filter suppliers by country" value={country} onChange={(event) => { setCountry(event.target.value); void load(event.target.value); }} className="rounded-lg border border-[#d8c9b5] bg-white px-3 py-2 text-sm"><option value="">All countries</option><option value="Colombia">Colombia</option><option value="United States">United States</option><option value="USA">USA</option></select>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b]">Refresh</button>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p className="mt-5 text-sm text-gray-500">Loading suppliers…</p> : suppliers.length === 0 ? <p className="mt-5 rounded-xl bg-[#fdfaf5] p-4 text-sm text-gray-600">No supplier records were found for this filter.</p> :
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-3 pr-4">Supplier</th><th className="pb-3 pr-4">Country</th><th className="pb-3 pr-4">Categories</th><th className="pb-3 pr-4">Rate</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Updated</th></tr></thead><tbody>{suppliers.map((item) => <tr key={item.id} className="border-t border-[#eadfce] align-top"><td className="py-3 pr-4"><p className="font-semibold text-[#5a1f2b]">{item.name}</p><p className="text-xs text-gray-500">{item.contact_email || "No contact email"}</p></td><td className="py-3 pr-4">{item.country}</td><td className="py-3 pr-4">{(item.categories || []).join(", ") || "—"}</td><td className="py-3 pr-4">{new Intl.NumberFormat(undefined, { style: "currency", currency: item.currency || "USD" }).format(Number(item.rate_per_unit))}</td><td className="py-3 pr-4">{item.status}</td><td className="py-3">{new Date(item.updated_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
  </section>;
}
