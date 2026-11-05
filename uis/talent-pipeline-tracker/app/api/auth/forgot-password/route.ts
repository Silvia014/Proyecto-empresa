import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { escapeEmailHtml, sendResendEmail } from "@/lib/resend-email";
import { getErpPublicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const requests = new Map<string, number[]>();

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the email address for your staff account." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Password reset email is not configured. Set the server Supabase and Resend variables in Vercel." }, { status: 503 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `${forwardedFor}:${email}`;
  const now = Date.now();
  const recent = (requests.get(rateKey) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 4) return NextResponse.json({ error: "Too many reset requests. Wait a while and try again." }, { status: 429 });
  recent.push(now);
  requests.set(rateKey, recent);

  try {
    const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const siteUrl = getErpPublicUrl(request);
    const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
    // Keep unknown addresses indistinguishable from existing accounts.
    if (error || !data.properties.hashed_token) {
      if (error) console.info("Password reset requested for an account without a recovery link.");
      return NextResponse.json({ ok: true });
    }

    const safeEmail = escapeEmailHtml(email);
    const actionLink = new URL("/reset-password", siteUrl);
    actionLink.searchParams.set("token_hash", data.properties.hashed_token);
    actionLink.searchParams.set("type", "recovery");
    const safeActionLink = escapeEmailHtml(actionLink.toString());
    const sent = await sendResendEmail({
      to: email,
      subject: "Reset your Brasaland staff password",
      html: `<!doctype html><html><body style="margin:0;background:#f7f1e7;color:#382b24;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fffdf9;border-radius:16px"><p style="margin:0;color:#762b3e;font-weight:bold;letter-spacing:.12em">BRASALAND CRM</p><h1 style="color:#762b3e;font-size:26px">Reset your password</h1><p>We received a request to reset the staff account for ${safeEmail}.</p><p style="margin:28px 0"><a href="${safeActionLink}" style="display:inline-block;background:#762b3e;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p></main></body></html>`,
      text: `Reset your Brasaland staff password\n\nWe received a request to reset the staff account for ${email}.\n\nOpen this link to choose a new password: ${actionLink.toString()}\n\nIf you did not request this, ignore this email.`,
    });
    if (!sent) return NextResponse.json({ error: "We could not send the reset email. Check the Resend sender configuration and try again." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Staff password reset failed:", error instanceof Error ? error.name : "request error");
    return NextResponse.json({ error: "We could not send the reset email. Try again later." }, { status: 503 });
  }
}
