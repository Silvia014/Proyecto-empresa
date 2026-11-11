import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPERADMIN_EMAIL, isStaffRole, type StaffRole } from "./staff-access";

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error("ERP staff access is missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.");
    Object.assign(error, { code: "STAFF_SUPABASE_CONFIG_MISSING" });
    throw error;
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type StaffActor = {
  user: User;
  role: StaffRole;
  displayName: string | null;
  service: ReturnType<typeof getServiceClient>;
};

export async function getStaffActor(request: Request, requireRecentAuth = false): Promise<StaffActor | NextResponse> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });

  try {
    const service = getServiceClient();
    const { data, error } = await service.auth.getUser(token);
    if (error || !data.user || !data.user.email) {
      return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    }
    if (requireRecentAuth) {
      const payload = token.split(".")[1];
      const claims = payload ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) : {};
      const authTime = Number(claims.auth_time);
      const ageSeconds = Math.floor(Date.now() / 1000) - authTime;
      if (!Number.isFinite(authTime) || ageSeconds < 0 || ageSeconds > 10 * 60) {
        return NextResponse.json({ error: "Verify your admin password again before creating staff accounts." }, { status: 401 });
      }
    }

    const email = data.user.email.trim().toLowerCase();
    const { data: existingProfile, error: profileError } = await service
      .from("staff_profiles")
      .select("role, display_name, email")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    let profile = existingProfile;

    // The owner is provisioned as superadmin even on a fresh development DB.
    // This is based on the verified Auth email, never editable user metadata.
    if (!profile && email === SUPERADMIN_EMAIL) {
      const { data: inserted, error: insertError } = await service
        .from("staff_profiles")
        .insert({ user_id: data.user.id, email, role: "superadmin", display_name: "Silvia Guerra" })
        .select("role, display_name, email")
        .single();
      if (insertError) throw insertError;
      profile = inserted;
    }

    if (!profile || !isStaffRole(profile.role)) {
      return NextResponse.json({ error: "This account does not have staff access. Ask an administrator." }, { status: 403 });
    }
    if (profile.role === "superadmin" && email !== SUPERADMIN_EMAIL) {
      return NextResponse.json({ error: "Superadmin access is reserved for the owner account." }, { status: 403 });
    }

    return { user: data.user, role: profile.role, displayName: profile.display_name, service };
  } catch (error) {
    console.error("Staff authorization failed:", error instanceof Error ? error.message : error);
    const configMissing = error instanceof Error && "code" in error && error.code === "STAFF_SUPABASE_CONFIG_MISSING";
    return NextResponse.json({
      error: configMissing
        ? "ERP server configuration is incomplete. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for this Vercel environment."
        : "ERP could not verify staff roles. Confirm the staff_profiles migration is applied to the Supabase project configured for this Vercel deployment and that server-side database access is available.",
    }, { status: 503 });
  }
}

export function isDenied(value: StaffActor | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
