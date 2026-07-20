import { useState, type FormEvent, type CSSProperties } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.18em",
              color: "var(--ink-dim)",
              textTransform: "uppercase",
            }}
          >
            Comanda · Panel operativo
          </div>
          <h1 style={{ fontSize: 28, marginTop: 6 }}>Ventanilla de acceso</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--ticket)",
            color: "#2a2620",
            borderRadius: 6,
            padding: "28px 24px",
            boxShadow: "0 18px 0 -8px var(--ticket-shadow), 0 24px 40px -20px rgba(0,0,0,0.6)",
            position: "relative",
          }}
        >
          {/* Muesca perforada superior, como si se arrancara del taco de comandas */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -1,
              left: 0,
              right: 0,
              height: 10,
              backgroundImage:
                "radial-gradient(circle, var(--bg) 3px, transparent 3.5px)",
              backgroundSize: "16px 10px",
              backgroundPosition: "8px -5px",
            }}
          />

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@restaurante.com"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                background: "#f4d9d5",
                color: "var(--alert)",
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 4,
                marginBottom: 14,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.02em",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Comprobando..." : "Entrar al panel"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 4,
  border: "1px solid #cbbfa0",
  background: "#fffdf8",
  fontFamily: "var(--font-body)",
  fontSize: 14,
};
