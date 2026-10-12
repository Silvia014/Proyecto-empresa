import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";

export function Success() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const unpaid = params.get("unpaid") === "1";
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("No pudimos confirmar tu pedido. Vuelve a la página principal e inténtalo de nuevo.");
      return;
    }

    setLoading(true);
    setError(null);

    api
      .order(orderId)
      .then((data) => {
        setOrder(data);
      })
      .catch(() => {
        setError("No pudimos cargar la confirmación del pedido. Puedes intentarlo de nuevo o volver al inicio.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Confirmando tu pedido…</h1>
        <p className="mt-3 text-walnut/70">Esto puede tardar unos segundos.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">No hemos podido confirmar tu pedido</h1>
        <p className="mt-3 text-walnut/70">{error}</p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reintentar
          </button>
          <Link to="/" className="btn-secondary inline-block">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/15 text-sage">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="mt-6 text-3xl font-semibold">¡Pedido confirmado!</h1>
      <p className="mt-3 text-walnut/70">
        {unpaid
          ? "Tu pedido se ha registrado. El pago con tarjeta todavía no está activado en este restaurante — te contactaremos para confirmar el cobro."
          : "Hemos recibido tu pago. Te enviamos la confirmación por email y el restaurante ya está preparando tu pedido."}
      </p>
      {order && <p className="mt-4 text-sm text-walnut/50">Nº de pedido: {order.id}</p>}
      <Link to="/" className="btn-secondary mt-8 inline-block">
        Volver al inicio
      </Link>
    </div>
  );
}
