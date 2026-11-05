import { NextResponse } from "next/server";
import { creatableRoles, isStaffRole, roleLabels } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";
import { escapeEmailHtml, sendResendEmail } from "@/lib/resend-email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request, true);
  if (isDenied(actor)) return actor;
  const roles = creatableRoles(actor.role);
  if (!roles.length) return NextResponse.json({ error: "Only an admin or superadmin can create staff accounts." }, { status: 403 });
  return NextResponse.json({ roles: roles.map((role) => ({ value: role, label: roleLabels[role] })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getStaffActor(request, true);
  if (isDenied(actor)) return actor;
  const availableRoles = creatableRoles(actor.role);
  if (!availableRoles.length) return NextResponse.json({ error: "Only an admin or superadmin can create staff accounts." }, { status: 403 });

  let body: { email?: unknown; password?: unknown; role?: unknown; displayName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the new staff account details." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!displayName) return NextResponse.json({ error: "Enter the staff member's name." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!isStaffRole(role) || !availableRoles.includes(role)) return NextResponse.json({ error: "You cannot assign that staff role." }, { status: 403 });
  if (email === "roldansilvi@gmail.com") return NextResponse.json({ error: "The owner account is reserved as the sole superadmin." }, { status: 409 });

  const { data: created, error: createError } = await actor.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: displayName ? { name: displayName } : {},
  });
  let targetUser = created.user;
  let createdAuthUser = Boolean(targetUser);
  let existingAccountEnabled = false;

  if (createError && /already (been )?(registered|used|exists)|email_exists|user_already_exists/i.test(createError.message)) {
    targetUser = null;
    for (let page = 1; page <= 20 && !targetUser; page += 1) {
      const { data: usersPage, error: usersError } = await actor.service.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) return NextResponse.json({ error: "The existing account could not be located. Contact support." }, { status: 500 });
      targetUser = usersPage.users.find((user) => user.email?.toLowerCase() === email) || null;
      if (usersPage.users.length < 1000) break;
    }
    if (!targetUser) return NextResponse.json({ error: "That email already exists, but its account could not be located." }, { status: 409 });

    const { data: existingProfile, error: existingProfileError } = await actor.service
      .from("staff_profiles").select("user_id").eq("user_id", targetUser.id).maybeSingle();
    if (existingProfileError) return NextResponse.json({ error: "Unable to check existing staff access." }, { status: 503 });
    if (existingProfile) return NextResponse.json({ error: "This account already has staff access." }, { status: 409 });

    const { data: updatedUser, error: confirmError } = await actor.service.auth.admin.updateUserById(targetUser.id, {
      email_confirm: true,
      password,
      user_metadata: { ...(targetUser.user_metadata || {}), name: displayName },
    });
    if (confirmError || !updatedUser.user) return NextResponse.json({ error: "Unable to activate the existing account." }, { status: 500 });
    targetUser = updatedUser.user;
    createdAuthUser = false;
    existingAccountEnabled = true;
  } else if (createError || !targetUser) {
    return NextResponse.json({ error: createError?.message || "Unable to create the staff account." }, { status: 400 });
  }

  const { error: profileError } = await actor.service.from("staff_profiles").insert({
    user_id: targetUser.id,
    email,
    role,
    display_name: displayName || null,
    created_by: actor.user.id,
  });
  if (profileError) {
    const { error: rollbackError } = createdAuthUser
      ? await actor.service.auth.admin.deleteUser(targetUser.id)
      : { error: null };
    if (rollbackError) console.error("Staff account rollback failed:", rollbackError.message);
    return NextResponse.json({ error: "The account could not be assigned a staff role, so creation was rolled back." }, { status: 500 });
  }

  const erpUrl = (process.env.ERP_PUBLIC_URL || "https://erp.brasaland.site").replace(/\/$/, "");
  const safeName = escapeEmailHtml(displayName);
  const label = roleLabels[role];
  const subject = "Your Brasaland staff account is ready";
  const message = existingAccountEnabled
    ? "An administrator has enabled your existing account for Brasaland staff access and set the password you provided during account setup."
    : "An administrator has created your Brasaland staff account. Sign in with the password they provided to you.";
  const confirmationEmailSent = await sendResendEmail({
    to: email,
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f7f1e7;color:#382b24;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fffdf9;border-radius:16px"><p style="margin:0;color:#762b3e;font-weight:bold;letter-spacing:.12em">BRASALAND CRM</p><h1 style="color:#762b3e;font-size:26px">Your staff account is ready</h1><p>Hello ${safeName},</p><p>${message}</p><p>Your access category: <strong>${escapeEmailHtml(label)}</strong></p><p style="margin:28px 0"><a href="${erpUrl}/login" style="display:inline-block;background:#762b3e;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Open staff login</a></p><p style="color:#776c64;font-size:13px">If you did not expect this account, contact Brasaland.</p></main></body></html>`,
    text: `Hello ${displayName},\n\n${message}\n\nYour access category: ${label}\nSign in: ${erpUrl}/login`,
  });

  return NextResponse.json({
    message: existingAccountEnabled ? "Existing account enabled for staff access." : "Staff account created.",
    email,
    role,
    existingAccountEnabled,
    confirmationEmailSent,
  }, { status: createdAuthUser ? 201 : 200 });
}
