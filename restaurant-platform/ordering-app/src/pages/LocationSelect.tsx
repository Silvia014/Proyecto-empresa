import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Location } from "../lib/api";
import { useCart } from "../context/CartContext";

export function LocationSelect() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLocation } = useCart();
  const navigate = useNavigate();
  const requestIdRef = useRef(0);

  const loadLocations = useCallback(() => {
    if (loading) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    api
      .locations()
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setLocations(data);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("No se pudo cargar la lista de restaurantes");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });
  }, [loading]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

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
      {error && (
        <div className="mt-10">
          <p className="text-wine">{error}</p>
          <button
            type="button"
            onClick={loadLocations}
            disabled={loading}
            className="mt-4 rounded-md border border-wine px-4 py-2 text-sm font-medium text-wine transition hover:bg-wine/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reintentar
          </button>
        </div>
      )}

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
