const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || "Error de comunicación con el restaurante", res.status);
  }
  return res.json();
}

export interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  available: boolean;
}

export interface CheckoutPayload {
  locationId: string;
  fulfillment: "pickup" | "delivery";
  deliveryAddress?: string;
  customer: { name: string; email: string; phone: string };
  items: { menuItemId: string; quantity: number }[];
}

export const api = {
  locations: () => request<Location[]>("/menu/locations"),
  menu: (locationId: string) => request<MenuItem[]>(`/menu?locationId=${locationId}`),
  checkout: (payload: CheckoutPayload) =>
    request<{ orderId: string; checkoutUrl?: string; error?: string }>("/ordering/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  order: (id: string) => request<any>(`/ordering/${id}`),
};
