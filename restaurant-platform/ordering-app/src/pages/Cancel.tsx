import { Link } from "react-router-dom";

export function Cancel() {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-3xl font-semibold">Pago cancelado</h1>
      <p className="mt-3 text-walnut/70">
        No se ha realizado ningún cargo. Tu carrito sigue disponible si quieres intentarlo de nuevo.
      </p>
      <Link to="/menu" className="btn-primary mt-8 inline-block">
        Volver a la carta
      </Link>
    </div>
  );
}
