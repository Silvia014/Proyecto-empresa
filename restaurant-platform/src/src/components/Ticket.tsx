import type { ReactNode } from "react";

export function TicketTab({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: active ? "var(--ticket)" : "var(--surface-raised)",
        color: active ? "#2a2620" : "var(--ink-dim)",
        border: "none",
        borderRadius: "6px 6px 0 0",
        padding: "12px 18px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
        marginRight: 6,
        transform: active ? "translateY(0)" : "translateY(4px)",
        boxShadow: active ? "0 -2px 10px rgba(0,0,0,0.25)" : "none",
      }}
    >
      {/* borde perforado arriba, solo visible en la pestaña activa */}
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -1,
            left: 4,
            right: 4,
            height: 8,
            backgroundImage: "radial-gradient(circle, var(--surface) 2.5px, transparent 3px)",
            backgroundSize: "12px 8px",
            backgroundPosition: "4px -4px",
          }}
        />
      )}
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          style={{
            marginLeft: 8,
            background: "var(--alert)",
            color: "#fff",
            borderRadius: 10,
            padding: "1px 7px",
            fontSize: 11,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function Card({ title, children, eyebrow }: { title?: string; eyebrow?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-dim)",
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </div>
      )}
      {title && <h3 style={{ fontSize: 17, marginBottom: 14 }}>{title}</h3>}
      {children}
    </div>
  );
}
