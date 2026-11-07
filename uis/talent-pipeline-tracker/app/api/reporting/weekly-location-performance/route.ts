import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { detail: "Server Supabase configuration is missing." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes can be unavailable in a read-only render context.
        }
      },
    },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json(
      { detail: "Staff sign-in required. Please sign in to the CRM." },
      { status: 401 },
    );
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return NextResponse.json(
      { detail: "Your CRM session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  const staffRequest = new Request(request.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const actor = await getStaffActor(staffRequest);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "dashboard")) {
    return NextResponse.json(
      { detail: "You do not have access to business reporting." },
      { status: 403 },
    );
  }

  const apiBase = (
    process.env.REPORTING_API_URL ||
    process.env.NEXT_PUBLIC_INVENTORY_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
  const query = new URL(request.url).searchParams.toString();

  try {
    const upstream = await fetch(
      `${apiBase}/reporting/weekly-location-performance${query ? `?${query}` : ""}`,
      {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    const body = await upstream.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { detail: "The reporting API returned an invalid response." },
        { status: 502 },
      );
    }
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { detail: "The reporting API is unavailable." },
      { status: 503 },
    );
  }
}
