import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Card } from "../Ticket";

export function BiTab() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    if (!token) return;
    api.bi.salesSummary(token).then(setSummary);
  }, [token]);

  if (!summary) return <p style={{ color: "var(--ink-dim)" }}>Cargando datos de ventas…</p>;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <BigStat label="Ventas totales (USD)" value={`$${summary.totalUsd.toLocaleString("en-US")}`} />
        <BigStat label="Ventas totales (COP)" value={`$${summary.totalCop.toLocaleString("es-CO")}`} />
        <BigStat label="Pedidos" value={summary.ordersCount} />
      </div>

      <Card title="Ventas por local" eyebrow={`Tasa usada: 1 USD = ${summary.fxRateUsed} COP`}>
        {summary.byLocation.length === 0 ? (
          <p style={{ color: "var(--ink-dim)" }}>Todavía no hay pedidos registrados.</p>
        ) : (
          <table style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-dim)" }}>
                <th style={{ padding: "6px 10px 10px 0" }}>Local</th>
                <th style={{ padding: "6px 10px 10px 0" }}>Pedidos</th>
                <th style={{ padding: "6px 10px 10px 0" }}>USD</th>
                <th style={{ padding: "6px 10px 10px 0" }}>COP</th>
              </tr>
            </thead>
            <tbody>
              {summary.byLocation.map((l: any) => (
                <tr key={l.locationId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px 8px 0" }}>{l.locationName}</td>
                  <td style={{ padding: "8px 10px 8px 0" }}>{l.orders}</td>
                  <td style={{ padding: "8px 10px 8px 0" }}>${l.totalUsd.toLocaleString("en-US")}</td>
                  <td style={{ padding: "8px 10px 8px 0" }}>${l.totalCop.toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginBottom: 8 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 600, color: "var(--accent-bright)" }}>
        {value}
      </div>
    </Card>
  );
}
