import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { TicketTab } from "../components/Ticket";
import { InventoryTab } from "../components/tabs/InventoryTab";
import { CrmTab } from "../components/tabs/CrmTab";
import { HrTab } from "../components/tabs/HrTab";
import { KitchenTab } from "../components/tabs/KitchenTab";
import { BiTab } from "../components/tabs/BiTab";
import { OrdersTab } from "../components/tabs/OrdersTab";

type TabKey = "ORDERS" | "INVENTORY" | "CRM" | "HR" | "KITCHEN" | "BI";

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: "ORDERS", label: "Pedidos (POS)" },
  { key: "INVENTORY", label: "Inventario" },
  { key: "CRM", label: "Reservas/CRM" },
  { key: "HR", label: "RRHH" },
  { key: "KITCHEN", label: "Cocina" },
  { key: "BI", label: "BI" },
];

export function Dashboard() {
  const { me, can, logout } = useAuth();
  const visibleTabs = ALL_TABS.filter((t) => can(t.key, "READ"));
  const [active, setActive] = useState<TabKey | null>(visibleTabs[0]?.key ?? null);

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 28px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "var(--ink-dim)",
              textTransform: "uppercase",
            }}
          >
            Comanda
          </div>
          <h1 style={{ fontSize: 20 }}>Panel operativo</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div>{me?.name}</div>
            <div style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {me?.role}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: "transparent",
              color: "var(--ink-dim)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "8px 14px",
              fontSize: 12,
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {visibleTabs.length === 0 ? (
        <div style={{ padding: 40, color: "var(--ink-dim)" }}>
          Tu rol ({me?.role}) todavía no tiene ningún módulo asignado. Habla con el superadmin.
        </div>
      ) : (
        <>
          <nav style={{ display: "flex", padding: "20px 28px 0" }}>
            {visibleTabs.map((t) => (
              <TicketTab key={t.key} label={t.label} active={active === t.key} onClick={() => setActive(t.key)} />
            ))}
          </nav>

          <main
            style={{
              flex: 1,
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              padding: 28,
            }}
          >
            {active === "ORDERS" && <OrdersTab />}
            {active === "INVENTORY" && <InventoryTab />}
            {active === "CRM" && <CrmTab />}
            {active === "HR" && <HrTab />}
            {active === "KITCHEN" && <KitchenTab />}
            {active === "BI" && <BiTab />}
          </main>
        </>
      )}
    </div>
  );
}