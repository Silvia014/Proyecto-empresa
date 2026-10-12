"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
          <a className="text-[#5a1f2b] underline" href="/dashboard">
            CRM Dashboard
          </a>
          <a className="text-[#5a1f2b] underline" href="/dashboard/inventory/products">
            Productos
          </a>
          <a className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders-inbound">
            Entradas
          </a>
          <a className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders-outbound">
            Salidas
          </a>
          <a className="text-[#5a1f2b] underline" href="/dashboard/inventory/orders">
            Historial
          </a>
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
