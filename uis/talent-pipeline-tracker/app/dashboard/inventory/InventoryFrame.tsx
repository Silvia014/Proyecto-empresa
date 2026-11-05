"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const pages: Record<string, string> = {
  products: "products.html",
  "orders-inbound": "orders-inbound.html",
  "orders-outbound": "orders-outbound.html",
  orders: "orders.html",
};

export default function InventoryFrame({ view }: { view: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const frame = useRef<HTMLIFrameElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/staff/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const staff = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(staff.permissions) || !staff.permissions.includes("inventory")) {
        router.replace(response.status === 401 || response.status === 403 ? "/dashboard" : "/login");
        return;
      }

      setToken(data.session.access_token);
      setAuthReady(true);
    }

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!alive) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        setToken(session.access_token);
      }
    );

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const sendToken = useCallback(() => {
    if (!token) return;

    frame.current?.contentWindow?.postMessage(
      { type: "CRM_ACCESS_TOKEN", token },
      window.location.origin
    );
  }, [token]);

  useEffect(() => {
    sendToken();
  }, [sendToken]);

  const page = pages[view];

  if (!page) return <p>Vista de inventario no encontrada.</p>;

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-5 flex flex-wrap gap-4 text-sm">
          <Link className="text-[#5a1f2b] underline" href="/dashboard">
            CRM Dashboard
          </Link>
          <Link className="text-[#5a1f2b] underline" href="/dashboard/inventory/products">
            Productos
          </Link>
          <Link className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders-inbound">
            Entradas
          </Link>
          <Link className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders-outbound">
            Salidas
          </Link>
          <Link className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders">
            Historial
          </Link>
        </nav>

        {!authReady && <p>Comprobando sesión del CRM...</p>}

        {authReady && (
          <iframe
            key={view}
            ref={frame}
            title={`Inventario: ${view}`}
            src={`/backoffice/inventory/${page}`}
            onLoad={sendToken}
            className="w-full rounded-xl border-0 bg-white"
            style={{ minHeight: "850px" }}
          />
        )}
      </div>
    </main>
  );
}
