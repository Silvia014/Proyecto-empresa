import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type MeResponse } from "../lib/api";

interface AuthContextValue {
  token: string | null;
  me: MeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (module: string, action?: "READ" | "WRITE") => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("comanda_token"));
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(setMe)
      .catch(() => {
        setToken(null);
        localStorage.removeItem("comanda_token");
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    localStorage.setItem("comanda_token", res.token);
    setToken(res.token);
  }

  function logout() {
    localStorage.removeItem("comanda_token");
    setToken(null);
    setMe(null);
  }

  function can(module: string, action: "READ" | "WRITE" = "READ") {
    return me?.permissions.includes(`${module}:${action}`) ?? false;
  }

  return (
    <AuthContext.Provider value={{ token, me, loading, login, logout, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
