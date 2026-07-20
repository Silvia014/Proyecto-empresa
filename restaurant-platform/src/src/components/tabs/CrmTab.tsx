import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Card } from "../Ticket";

export function CrmTab() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.crm.customers(token).then(setCustomers);
  }, [token]);

  useEffect(() => {
    if (!token || !selected) return;
    setSuggestions(null);
    setSuggestError(null);
    api.crm.orders(token, selected).then(setOrders);
  }, [token, selected]);

  async function loadSuggestions() {
    if (!token || !selected) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await api.crm.suggestions(token, selected);
      setSuggestions(res.suggestions ?? []);
    } catch {
      setSuggestError("No se pudieron generar sugerencias (revisa que ANTHROPIC_API_KEY esté configurada)");
    } finally {
      setSuggestLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
      <Card title="Clientes" eyebrow={`${customers.length}`}>
        <div style={{ display: "grid", gap: 4 }}>
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              style={{
                textAlign: "left",
                background: selected === c.id ? "var(--surface-raised)" : "transparent",
                border: "none",
                borderRadius: 4,
                padding: "8px 10px",
                color: "var(--ink)",
                fontSize: 13,
              }}
            >
              {c.name}
            </button>
          ))}
          {customers.length === 0 && (
            <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>Sin clientes todavía.</p>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gap: 20 }}>
        <Card title="Historial de pedidos">
          {!selected && <p style={{ color: "var(--ink-dim)" }}>Selecciona un cliente para ver su historial.</p>}
          {selected && orders.length === 0 && (
            <p style={{ color: "var(--ink-dim)" }}>Este cliente aún no tiene pedidos registrados.</p>
          )}
          {orders.map((o) => (
            <div key={o.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", fontSize: 13 }}>
              <div style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {new Date(o.createdAt).toLocaleDateString()} · ${o.totalUsd.toFixed(2)}
              </div>
              {o.items.map((it: any) => (
                <div key={it.id}>
                  {it.quantity}× {it.dishName}
                </div>
              ))}
            </div>
          ))}
        </Card>

        {selected && (
          <Card title="Sugerencias con IA" eyebrow="Basadas en su historial">
            <button
              onClick={loadSuggestions}
              disabled={suggestLoading}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
                opacity: suggestLoading ? 0.7 : 1,
              }}
            >
              {suggestLoading ? "Pensando…" : "Generar sugerencias"}
            </button>

            {suggestError && <p style={{ color: "var(--alert)", fontSize: 13 }}>{suggestError}</p>}

            {suggestions && (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {suggestions.map((s: any, idx: number) => (
                  <li key={idx} style={{ marginBottom: 6, fontSize: 13 }}>
                    <strong>{s.dish}</strong> — {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
