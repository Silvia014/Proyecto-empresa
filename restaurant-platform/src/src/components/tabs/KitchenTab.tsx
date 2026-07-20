import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Card } from "../Ticket";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:4000";

export function KitchenTab() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.kitchen.recipes(token).then(setRecipes);

    // Conexión en vivo: si el director de cocina publica un cambio,
    // aquí se refleja al instante sin recargar la página.
    const socket = io(SOCKET_URL);
    const flashSync = () => {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2000);
    };
    socket.on("recipe:created", (recipe) => {
      setRecipes((prev) => [...prev, recipe]);
      flashSync();
    });
    socket.on("recipe:updated", (recipe) => {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
      flashSync();
    });
    socket.on("recipe:deleted", ({ id }) => {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      flashSync();
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <LangButton active={lang === "es"} onClick={() => setLang("es")} label="ES" />
          <LangButton active={lang === "en"} onClick={() => setLang("en")} label="EN" />
        </div>
        {justSynced && (
          <span style={{ color: "var(--sage)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            ● sincronizado en tiempo real
          </span>
        )}
      </div>

      {recipes.length === 0 && (
        <p style={{ color: "var(--ink-dim)" }}>Todavía no hay recetas ni normas publicadas.</p>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {recipes.map((r) => (
          <Card key={r.id} title={lang === "es" ? r.nameEs : r.nameEn} eyebrow={r.locationId ? "Local" : "Global"}>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{lang === "es" ? r.instructionsEs : r.instructionsEn}</p>
            {(lang === "es" ? r.rulesEs : r.rulesEn) && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--ink-dim)",
                }}
              >
                <strong style={{ color: "var(--ink)" }}>Normas: </strong>
                {lang === "es" ? r.rulesEs : r.rulesEn}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function LangButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent)" : "var(--surface-raised)",
        color: active ? "#fff" : "var(--ink-dim)",
        border: "none",
        borderRadius: 4,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
      }}
    >
      {label}
    </button>
  );
}
