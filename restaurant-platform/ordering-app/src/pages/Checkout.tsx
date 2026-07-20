import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../lib/api";

interface FormState {
  name: string;
  email: string;
  phone: string;
  fulfillment: "pickup" | "delivery";
  deliveryAddress: string;
}

const initialState: FormState = { name: "", email: "", phone: "", fulfillment: "pickup", deliveryAddress: "" };

export function Checkout() {
  const { location, lines, totalPrice, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  if (!location) {
    navigate("/");
    return null;
  }
  if (lines.length === 0) {
    navigate("/menu");
    return null;
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Escribe tu nombre completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Escribe un email válido.";
    const digits = form.phone.replace(/[\s()-]/g, "");
    if (!/^(\+?\d{1,3})?\d{9,12}$/.test(digits)) errs.phone = "Escribe un teléfono válido.";
    if (form.fulfillment === "delivery" && !form.deliveryAddress.trim()) {
      errs.deliveryAddress = "Escribe la dirección de entrega.";
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!location) return; // no debería pasar (ya se valida arriba), pero TS necesita la comprobación aquí también
    setGeneralError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.checkout({
        locationId: location.id,
        fulfillment: form.fulfillment,
        deliveryAddress: form.fulfillment === "delivery" ? form.deliveryAddress : undefined,
        customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
      });

      if (res.checkoutUrl) {
        // Redirige a la página de pago hospedada por Stripe
        window.location.href = res.checkoutUrl;
        return;
      }

      // Todavía sin Stripe configurado en el backend: el pedido se creó
      // igualmente, avisamos en vez de fallar en silencio.
      clear();
      navigate(`/success?order=${res.orderId}&unpaid=1`);
    } catch (err) {
      setGeneralError(
        err instanceof ApiError ? err.message : "No se pudo procesar el pedido. Inténtalo de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Tus datos</h1>
      <p className="mt-2 text-walnut/70">
        Pedido en {location.name} · Total {formatPrice(totalPrice, location.currency)}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5" noValidate>
        <div>
          <label htmlFor="name" className="field-label">
            Nombre completo *
          </label>
          <input
            id="name"
            className="field-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="email" className="field-label">
            Email *
          </label>
          <input
            id="email"
            type="email"
            className="field-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="field-label">
            Teléfono *
          </label>
          <input
            id="phone"
            className="field-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>

        <div>
          <span className="field-label">Entrega *</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="fulfillment"
                checked={form.fulfillment === "pickup"}
                onChange={() => setForm({ ...form, fulfillment: "pickup" })}
              />
              Recoger en el restaurante
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="fulfillment"
                checked={form.fulfillment === "delivery"}
                onChange={() => setForm({ ...form, fulfillment: "delivery" })}
              />
              A domicilio
            </label>
          </div>
        </div>

        {form.fulfillment === "delivery" && (
          <div>
            <label htmlFor="deliveryAddress" className="field-label">
              Dirección de entrega *
            </label>
            <input
              id="deliveryAddress"
              className="field-input"
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
              aria-invalid={!!errors.deliveryAddress}
            />
            {errors.deliveryAddress && <p className="field-error">{errors.deliveryAddress}</p>}
          </div>
        )}

        {generalError && (
          <div role="alert" className="rounded-md border border-wine/30 bg-wine/5 p-3 text-sm text-wine">
            {generalError}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Procesando…" : "Pagar con tarjeta"}
        </button>
      </form>
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
