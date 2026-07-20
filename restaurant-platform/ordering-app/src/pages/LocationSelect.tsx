import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Location } from "../lib/api";
import { useCart } from "../context/CartContext";

export function LocationSelect() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLocation } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .locations()
      .then(setLocations)
      .catch(() => setError("No se pudo cargar la lista de restaurantes"))
      .finally(() => setLoading(false));
  }, []);

  function choose(loc: Location) {
    setLocation(loc);
    navigate("/menu");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass">Pedir online</p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">¿Desde qué Brasaland pides?</h1>
      <p className="mt-3 text-walnut/70">Elige el restaurante más cercano para ver su carta y precios.</p>

      {loading && <p className="mt-10 text-walnut/60">Cargando restaurantes…</p>}
      {error && <p className="mt-10 text-wine">{error}</p>}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => choose(loc)}
            className="rounded-xl border border-walnut/10 bg-white p-6 text-left shadow-sm transition hover:border-brass hover:shadow-md"
          >
            <p className="font-display text-xl font-semibold">{loc.name}</p>
            <p className="mt-1 text-sm text-walnut/60">
              {loc.city}, {loc.country}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brass">
              Precios en {loc.currency}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
