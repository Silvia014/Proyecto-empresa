import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Card } from "../Ticket";

export function InventoryTab() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .inventory.list(token)
      .then(setItems)
      .catch(() => setError("No se pudo cargar el inventario"))
      .finally(() => setLoading(false));
  }, [token]);

  const lowStock = items.filter((i) => i.lowStock);

  if (loading) return <p style={{ color: "var(--ink-dim)" }}>Cargando inventario…</p>;
  if (error) return <p style={{ color: "var(--alert)" }}>{error}</p>;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {lowStock.length > 0 && (
        <Card eyebrow="Alerta" title={`${lowStock.length} artículo(s) por debajo del stock mínimo`}>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--alert)" }}>
            {lowStock.map((i) => (
              <li key={i.id}>
                {i.name}: {i.currentStock} {i.unit} (mínimo {i.minStock} {i.unit})
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Inventario" eyebrow={`${items.length} artículos`}>
        {items.length === 0 ? (
          <p style={{ color: "var(--ink-dim)" }}>
            Todavía no hay artículos cargados. Añádelos vía API (POST /api/inventory) mientras construimos el
            formulario.
          </p>
        ) : (
          <table style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-dim)" }}>
                <th style={th}>Artículo</th>
                <th style={th}>Stock</th>
                <th style={th}>Mínimo</th>
                <th style={th}>Precio</th>
                <th style={th}>Proveedor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{i.name}</td>
                  <td style={{ ...td, color: i.lowStock ? "var(--alert)" : "var(--ink)" }}>
                    {i.currentStock} {i.unit}
                  </td>
                  <td style={td}>
                    {i.minStock} {i.unit}
                  </td>
                  <td style={td}>
                    {i.price} {i.currency}
                  </td>
                  <td style={td}>{i.supplier?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const th = { padding: "6px 10px 10px 0" };
const td = { padding: "8px 10px 8px 0" };
