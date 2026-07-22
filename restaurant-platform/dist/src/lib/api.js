"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.ApiError = void 0;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
exports.ApiError = ApiError;
async function request(path, options = {}, token) {
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
    if (res.status === 204)
        return undefined;
    return res.json();
}
exports.api = {
    login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: (token) => request("/auth/me", {}, token),
    inventory: {
        list: (token) => request("/inventory", {}, token),
        alerts: (token) => request("/inventory/alerts", {}, token),
        suppliers: (token) => request("/inventory/suppliers", {}, token),
        updateStock: (token, id, currentStock) => request(`/inventory/${id}/stock`, { method: "PATCH", body: JSON.stringify({ currentStock }) }, token),
    },
    crm: {
        customers: (token) => request("/crm/customers", {}, token),
        orders: (token, customerId) => request(`/crm/customers/${customerId}/orders`, {}, token),
        suggestions: (token, customerId) => request(`/crm/customers/${customerId}/suggestions`, {}, token),
    },
    hr: {
        employees: (token) => request("/hr/employees", {}, token),
        timeOff: (token) => request("/hr/time-off", {}, token),
        approveTimeOff: (token, id) => request(`/hr/time-off/${id}/approve`, { method: "PATCH" }, token),
        kpis: (token) => request("/hr/kpis", {}, token),
    },
    kitchen: {
        recipes: (token) => request("/kitchen/recipes", {}, token),
    },
    orders: {
        list: (token, status) => request(`/orders${status ? `?status=${status}` : ""}`, {}, token),
        updateStatus: (token, id, status) => request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
    },
    orders: {
        list: (token, status) => request(`/orders${status ? `?status=${status}` : ""}`, {}, token),
        updateStatus: (token, id, status) => request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
    },
    bi: {
        salesSummary: (token) => request("/bi/sales-summary", {}, token),
    },
};
