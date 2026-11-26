"use client";

import { useEffect, useState } from "react";
import type { LocationSummary } from "../crm-sections";

const briefingAreas = [
  { area: "El Poblado", city: "Medellín", country: "Colombia" },
  { area: "Laureles", city: "Medellín", country: "Colombia" },
  { area: "Envigado", city: "Medellín", country: "Colombia" },
  { area: "Sabaneta", city: "Medellín", country: "Colombia" },
  { area: "Usaquén", city: "Bogotá", country: "Colombia" },
  { area: "Chapinero", city: "Bogotá", country: "Colombia" },
  { area: "Zona Rosa", city: "Bogotá", country: "Colombia" },
  { area: "Granada", city: "Cali", country: "Colombia" },
  { area: "Ciudad Jardín", city: "Cali", country: "Colombia" },
  { area: "Unicentro", city: "Cali", country: "Colombia" },
  { area: "Brickell", city: "Miami", country: "United States" },
  { area: "Coral Gables", city: "Miami", country: "United States" },
  { area: "Downtown", city: "Orlando", country: "United States" },
  { area: "International Drive", city: "Orlando", country: "United States" },
];
const panel = "rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-7";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const countryKey = (value: string) => /colombia|^co$/i.test(value) ? "colombia" : /usa|^us$|united states|estados unidos/i.test(value) ? "united states" : normalize(value);

export default function LocationsWorkspace({ locations }: { locations: LocationSummary[] }) {
  const [country, setCountry] = useState("All");
  const [selected, setSelected] = useState("");
  useEffect(() => { if (!selected && locations.length) setSelected(`db:${locations[0].id}`); }, [locations, selected]);
  const cityCounts = new Map<string, number>();
  for (const item of locations) {
    const key = `${normalize(item.city || "")}|${countryKey(item.country || "")}`;
    cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
  }
  const areas = briefingAreas.filter((item) => country === "All" || countryKey(item.country) === countryKey(country));
  const selectedLocation = locations.find((item) => `db:${item.id}` === selected);
  const selectedArea = areas.find((item) => `area:${item.area}:${item.city}:${item.country}` === selected);
  const query = selectedLocation ? [selectedLocation.name, selectedLocation.city, selectedLocation.country].filter(Boolean).join(", ") : selectedArea ? `${selectedArea.area}, ${selectedArea.city}, ${selectedArea.country}` : "Brasaland restaurant locations";
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const embedHref = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return <section className={panel}>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">Restaurant map</p><h4 className="mt-2 text-2xl font-semibold text-[#5a1f2b]">Locations</h4><p className="mt-2 max-w-3xl text-sm text-gray-600">Saved restaurant locations come from the ERP database. The 14 areas below follow the official 4Geeks Brasaland brief; they are approximate map previews, not verified street addresses.</p></div><select aria-label="Filter locations by country" value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-lg border border-[#d8c9b5] bg-white px-3 py-2 text-sm"><option>All</option><option>United States</option><option>Colombia</option></select></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{locations.filter((item) => country === "All" || countryKey(item.country || "") === countryKey(country)).map((item) => { const duplicate = (cityCounts.get(`${normalize(item.city || "")}|${countryKey(item.country || "")}`) || 0) > 1; return <button key={item.id} type="button" onClick={() => setSelected(`db:${item.id}`)} className={`rounded-xl border p-4 text-left ${selected === `db:${item.id}` ? "border-[#5a1f2b] bg-[#f8f0e8]" : "border-[#eadfce] bg-[#fdfaf5]"}`}><strong className="block text-[#5a1f2b]">{item.name}</strong><span className="mt-1 block text-sm text-gray-600">{[item.city, item.country].filter(Boolean).join(", ") || "Address not stored"}</span><span className="mt-2 block text-xs font-medium text-green-800">Saved ERP location</span>{duplicate && <span className="mt-1 block text-xs font-semibold text-amber-800">More than one saved record for this city</span>}</button>; })}{areas.map((item) => { const key = `area:${item.area}:${item.city}:${item.country}`; return <button key={key} type="button" onClick={() => setSelected(key)} className={`rounded-xl border border-dashed p-4 text-left ${selected === key ? "border-[#5a1f2b] bg-[#f8f0e8]" : "border-[#c9b49f] bg-white"}`}><strong className="block text-[#5a1f2b]">Brasaland · {item.area}</strong><span className="mt-1 block text-sm text-gray-600">{item.city}, {item.country}</span><span className="mt-2 block text-xs font-medium text-amber-800">Approximate area preview · street address to confirm</span></button>; })}</div>
    {!locations.length && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No restaurant records are currently saved in the database. Map previews do not create or imply real restaurant branches.</p>}
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fdfaf5]"><iframe title={`Map: ${query}`} src={embedHref} className="h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span className="text-gray-600">Map search: {query}</span><a href={mapHref} target="_blank" rel="noreferrer" className="font-semibold text-[#5a1f2b] underline">Open in Google Maps</a></div></div>
  </section>;
}
