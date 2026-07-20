const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || "Error de comunicación con la API", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface LoginResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string; locationId: string | null };
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  locationId: string | null;
  permissions: string[]; // ej. ["INVENTORY:READ", "INVENTORY:WRITE"]
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (token: string) => request<MeResponse>("/auth/me", {}, token),

  inventory: {
    list: (token: string) => request<any[]>("/inventory", {}, token),
    alerts: (token: string) => request<any[]>("/inventory/alerts", {}, token),
    suppliers: (token: string) => request<any[]>("/inventory/suppliers", {}, token),
    updateStock: (token: string, id: string, currentStock: number) =>
      request(`/inventory/${id}/stock`, { method: "PATCH", body: JSON.stringify({ currentStock }) }, token),
  },

  crm: {
    customers: (token: string) => request<any[]>("/crm/customers", {}, token),
    orders: (token: string, customerId: string) => request<any[]>(`/crm/customers/${customerId}/orders`, {}, token),
    suggestions: (token: string, customerId: string) =>
      request<any>(`/crm/customers/${customerId}/suggestions`, {}, token),
  },

  hr: {
    employees: (token: string) => request<any[]>("/hr/employees", {}, token),
    timeOff: (token: string) => request<any[]>("/hr/time-off", {}, token),
    approveTimeOff: (token: string, id: string) =>
      request(`/hr/time-off/${id}/approve`, { method: "PATCH" }, token),
    kpis: (token: string) => request<any>("/hr/kpis", {}, token),
  },

  kitchen: {
    recipes: (token: string) => request<any[]>("/kitchen/recipes", {}, token),
  },

  orders: {
    list: (token: string, status?: string) =>
      request<any[]>(`/orders${status ? `?status=${status}` : ""}`, {}, token),
    updateStatus: (token: string, id: string, status: string) =>
      request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
  },

orders: {
  list: (token: string, status?: string) =>
    request<any[]>(`/orders${status ? `?status=${status}` : ""}`, {}, token),
  updateStatus: (token: string, id: string, status: string) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
},

  bi: {
    salesSummary: (token: string) => request<any>("/bi/sales-summary", {}, token),
  },
};
