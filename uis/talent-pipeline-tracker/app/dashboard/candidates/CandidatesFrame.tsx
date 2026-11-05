"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CandidatesFrame() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const frame = useRef<HTMLIFrameElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function authorize() {
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
      if (!response.ok || !staff.permissions?.includes("candidates")) {
        router.replace(response.status === 401 ? "/login" : "/dashboard");
        return;
      }
      setToken(data.session.access_token);
      setReady(true);
    }
    void authorize();
    return () => { alive = false; };
  }, [router, supabase]);

  const sendToken = useCallback(() => {
    if (!token) return;
    frame.current?.contentWindow?.postMessage({ type: "CRM_ACCESS_TOKEN", token }, window.location.origin);
  }, [token]);

  useEffect(() => { sendToken(); }, [sendToken]);

  return <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
    {!ready && <p className="p-6 text-sm text-gray-600">Verifying staff access…</p>}
    {ready && <iframe ref={frame} title="Job applications and CVs" src="/backoffice/candidates.html" onLoad={sendToken} className="block w-full border-0" style={{ minHeight: "820px" }} />}
  </section>;
}
