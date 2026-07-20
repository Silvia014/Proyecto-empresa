import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Card } from "../Ticket";

export function HrTab() {
  const { token } = useAuth();
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any | null>(null);

  useEffect(() => {
    if (!token) return;
    api.hr.timeOff(token).then(setTimeOffs);
    api.hr.kpis(token).then(setKpis);
  }, [token]);

  async function approve(id: string) {
    if (!token) return;
    await api.hr.approveTimeOff(token, id);
    setTimeOffs((prev) => prev.map((t) => (t.id === id ? { ...t, approved: true } : t)));
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiCard label="No-shows" value={kpis ? `${(kpis.noShowRate * 100).toFixed(1)}%` : "—"} />
        <KpiCard
          label="Rotación de mesa"
          value={kpis?.avgTableTurnoverMin ? `${kpis.avgTableTurnoverMin.toFixed(0)} min` : "—"}
        />
        <KpiCard
          label="Tiempo de comida"
          value={kpis?.avgMealTimeMin ? `${kpis.avgMealTimeMin.toFixed(0)} min` : "—"}
        />
      </div>

      <Card title="Vacaciones y ausencias" eyebrow={`${timeOffs.length} solicitudes`}>
        {timeOffs.length === 0 && <p style={{ color: "var(--ink-dim)" }}>No hay solicitudes registradas.</p>}
        {timeOffs.map((t) => (
          <div
            key={t.id}
            style={{
              borderTop: "1px solid var(--border)",
              padding: "10px 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <div>
              <strong>{t.employee?.name}</strong> — {t.type}
              <div style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {new Date(t.startDate).toLocaleDateString()} → {new Date(t.endDate).toLocaleDateString()}
              </div>
            </div>
            {t.approved ? (
              <span style={{ color: "var(--sage)", fontSize: 12, fontWeight: 600 }}>Aprobado</span>
            ) : (
              <button
                onClick={() => approve(t.id)}
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "6px 12px",
                  fontSize: 12,
                }}
              >
                Aprobar
              </button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600 }}>{value}</div>
    </Card>
  );
}
