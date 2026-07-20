import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type MenuItem } from "../lib/api";
import { useCart } from "../context/CartContext";

export function Menu() {
  const { location, lines, addItem, setQuantity, totalItems, totalPrice } = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!location) {
      navigate("/");
      return;
    }
    api
      .menu(location.id)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [location, navigate]);

  if (!location) return null;

  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass">{location.name}</p>
          <h1 className="mt-1 text-3xl font-semibold">Carta</h1>
        </div>
        <button onClick={() => navigate("/")} className="text-sm text-walnut/60 hover:text-wine">
          Cambiar restaurante
        </button>
      </div>

      {loading && <p className="mt-10 text-walnut/60">Cargando carta…</p>}
      {!loading && items.length === 0 && (
        <p className="mt-10 text-walnut/60">
          Este restaurante todavía no tiene platos publicados. Añádelos desde el panel operativo (módulo de menú).
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="text-xl font-semibold">{cat}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {items
                  .filter((i) => i.category === cat)
                  .map((item) => (
                    <div key={item.id} className="rounded-lg border border-walnut/10 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {item.description && (
                            <p className="mt-1 text-sm text-walnut/60">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-display text-lg font-semibold text-wine">
                          {formatPrice(item.price, item.currency)}
                        </span>
                        <button
                          onClick={() => addItem(item)}
                          className="rounded-md bg-wine px-4 py-1.5 text-sm font-semibold text-cream hover:bg-wine/90"
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        {/* Carrito lateral */}
        <aside className="rounded-xl border border-walnut/10 bg-white p-5 lg:sticky lg:top-6 lg:self-start">
          <h2 className="font-semibold">Tu pedido ({totalItems})</h2>
          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-walnut/50">Todavía no has añadido nada.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {lines.map((l) => (
                <div key={l.item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{l.item.name}</p>
                    <p className="text-walnut/50">{formatPrice(l.item.price, l.item.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`Quitar una unidad de ${l.item.name}`}
                      onClick={() => setQuantity(l.item.id, l.quantity - 1)}
                      className="h-6 w-6 rounded border border-walnut/20 text-walnut/60"
                    >
                      −
                    </button>
                    <span className="w-4 text-center">{l.quantity}</span>
                    <button
                      aria-label={`Añadir una unidad de ${l.item.name}`}
                      onClick={() => setQuantity(l.item.id, l.quantity + 1)}
                      className="h-6 w-6 rounded border border-walnut/20 text-walnut/60"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-walnut/10 pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(totalPrice, location.currency)}</span>
              </div>
              <button onClick={() => navigate("/checkout")} className="btn-primary mt-2 w-full">
                Ir a pagar
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
