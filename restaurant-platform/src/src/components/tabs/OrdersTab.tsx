import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:4000";

const COLUMNS: { status: string; label: string; next?: string; nextLabel?: string }[] = [
  { status: "RECEIVED", label: "Recibido", next: "PREPARING", nextLabel: "Empezar a preparar" },
  { status: "PREPARING", label: "En preparación", next: "READY", nextLabel: "Marcar listo" },
  { status: "READY", label: "Listo", next: "COMPLETED", nextLabel: "Entregar" },
  { status: "COMPLETED", label: "Entregado" },
];

export function OrdersTab() {
  const { token, me } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.orders.list(token).then(setOrders).finally(() => setLoading(false));

    const socket: Socket = io(SOCKET_URL);
    const flash = () => {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 1800);
    };

    socket.on("order:created", (order) => {
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
      flash();
    });

    socket.on("order:updated", (order) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        return exists ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev];
      });
      flash();
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  async function moveOrder(id: string, nextStatus: string) {
    if (!token) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o)));
    try {
      await api.orders.updateStatus(token, id, nextStatus);
    } catch {
      // si falla, la próxima carga/orden de socket lo corrige
    }
  }

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED"),
    [orders]
  );

  const seeMultipleLocations = me?.locationId === null;

  if (loading) return <p style={{ color: "var(--ink-dim)" }}>Cargando pedidos…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
          {activeOrders.length} pedido(s) activos{seeMultipleLocations ? " · todos los locales" : ""}
        </p>
        {justSynced && (
          <span style={{ color: "var(--sage)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            ● actualizado en tiempo real
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(240px, 1fr))",
          gap: 14,
          overflowX: "auto",
        }}
      >
        {COLUMNS.map((col) => {
          const columnOrders = activeOrders
            .filter((o) => o.status === col.status)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          return (
            <div key={col.status} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 240 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-dim)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{col.label}</span>
                <span>{columnOrders.length}</span>
              </div>

              {columnOrders.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 12,
                    color: "var(--ink-dim)",
                    textAlign: "center",
                  }}
                >
                  Sin pedidos
                </div>
              )}

              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  showLocation={seeMultipleLocations}
                  onAdvance={col.next ? () => moveOrder(order.id, col.next!) : undefined}
                  advanceLabel={col.nextLabel}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  showLocation,
  onAdvance,
  advanceLabel,
}: {
  order: any;
  showLocation: boolean;
  onAdvance?: () => void;
  advanceLabel?: string;
}) {
  const isPendingPayment = order.paymentStatus === "PENDING" && order.source === "ONLINE";

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <strong>{order.customer?.name ?? "Cliente"}</strong>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
            background: order.source === "ONLINE" ? "var(--accent)" : "var(--surface)",
            color: order.source === "ONLINE" ? "#fff" : "var(--ink-dim)",
          }}
        >
          {order.source}
        </span>
      </div>

      {showLocation && (
        <div style={{ color: "var(--ink-dim)", fontSize: 11, marginTop: 2 }}>{order.location?.name}</div>
      )}

      <ul style={{ margin: "8px 0", paddingLeft: 16, color: "var(--ink)" }}>
        {order.items?.map((it: any) => (
          <li key={it.id}>
            {it.quantity}× {it.dishName}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-dim)", fontSize: 12 }}>
        <span>{order.fulfillment === "delivery" ? "A domicilio" : "Recoger"}</span>
        <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {isPendingPayment && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--alert)" }}>Pago pendiente de confirmar</div>
      )}

      {onAdvance && (
        <button
          onClick={onAdvance}
          style={{
            marginTop: 10,
            width: "100%",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "7px 0",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {advanceLabel}
        </button>
      )}
    </div>
  );
}