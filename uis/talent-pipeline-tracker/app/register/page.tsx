"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/staff-access";

type RoleOption = { value: StaffRole; label: string };

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"authorize" | "create">("authorize");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function authorizeAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (signInError || !data.session) throw new Error("The administrator email or password is incorrect.");

      const response = await fetch("/api/staff/users", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error(result.error || "Only an admin or superadmin can create staff accounts.");
      }
      if (!Array.isArray(result.roles) || result.roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("No account roles are available for this administrator.");
      }
      setRoles(result.roles);
      setRole(result.roles[0].value);
      setStep("create");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Administrator verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function createStaffAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!role) return setError("Choose an access category.");
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Administrator session expired. Start again.");
      const response = await fetch("/api/staff/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, password, role }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create the staff account.");
      await supabase.auth.signOut();
      const query = new URLSearchParams({ staffCreated: "1", emailSent: result.confirmationEmailSent ? "1" : "0", existing: result.existingAccountEnabled ? "1" : "0" });
      router.replace(`/login?${query.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the staff account.");
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    await supabase.auth.signOut();
    setStep("authorize");
    setAdminPassword("");
    setError("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-serif font-bold text-[#5a1f2b]">Brasaland CRM</h1>
          <p className="mt-2 text-sm text-gray-600">Create a staff account</p>
        </div>

        {step === "authorize" ? <form onSubmit={authorizeAdmin} className="space-y-5">
          <div className="rounded-xl bg-[#f5f0e8] p-4 text-sm leading-6 text-gray-700">
            An existing admin or superadmin must verify their credentials before a new staff account can be created.
          </div>
          <label className="block text-sm font-medium text-gray-700">Admin email
            <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} autoComplete="username" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Admin password
            <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-[#5a1f2b] px-4 py-3 font-medium text-white hover:bg-[#431720] disabled:opacity-50">{loading ? "Verifying…" : "Verify administrator"}</button>
        </form> : <form onSubmit={createStaffAccount} className="space-y-5">
          <div className="flex items-center justify-between rounded-xl bg-[#f5f0e8] p-4 text-sm text-gray-700">
            <span>Administrator verified. Enter the staff account details. If the email already exists, this password will be set and staff access enabled.</span>
            <button type="button" onClick={restart} className="shrink-0 font-medium text-[#5a1f2b] underline">Change</button>
          </div>
          <label className="block text-sm font-medium text-gray-700">Staff name
            <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Staff email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Access category
            <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} required className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]">
              {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Confirm password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-[#5a1f2b]" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-[#5a1f2b] px-4 py-3 font-medium text-white hover:bg-[#431720] disabled:opacity-50">{loading ? "Creating account…" : "Create staff account"}</button>
        </form>}

        <p className="mt-6 text-center text-sm text-gray-600">Already have staff access? <a href="/login" className="font-medium text-[#5a1f2b] hover:underline">Sign in</a></p>
      </div>
    </main>
  );
}
