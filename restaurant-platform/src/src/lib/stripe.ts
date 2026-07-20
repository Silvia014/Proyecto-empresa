import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY no configurada");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Monedas sin decimales en Stripe (ahí el importe se manda en unidades
// enteras, no en centavos). COP es una de ellas, por eso no basta con
// hacer "* 100" a ciegas para todas las monedas.
const ZERO_DECIMAL_CURRENCIES = new Set(["cop", "jpy", "krw", "vnd"]);

/**
 * Convierte un importe "humano" (ej. 25.50 USD, o 45000 COP) a la unidad
 * mínima que espera Stripe para esa moneda.
 */
export function toStripeAmount(amount: number, currency: string): number {
  const code = currency.toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}