"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyRecoveryLink() {
      const supabase = createClient();
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (active) {
            setError("This reset link is invalid or has expired. Request a new one.");
            setCheckingLink(false);
          }
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError || !data.session) {
        setError("This reset link is invalid or has expired. Request a new one.");
        setValidSession(false);
      } else {
        setValidSession(true);
        setError("");
      }

      setCheckingLink(false);
    }

    verifyRecoveryLink();

    return () => {
      active = false;
    };
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage("Password updated successfully. You can now log in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password. Please request a new link."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-3xl font-bold">Reset Password</h1>

        {checkingLink ? (
          <p>Verifying your reset link...</p>
        ) : validSession ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="mb-1 block">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
                className="w-full rounded border p-2"
              />
            </div>

            {error && (
              <p aria-live="polite" className="text-sm text-red-600">
                {error}
              </p>
            )}
            {message && (
              <p aria-live="polite" className="text-sm text-green-600">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>
        ) : (
          <div>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <Link href="/forgot-password" className="underline">
              Request a new reset link
            </Link>
          </div>
        )}

        {validSession && message && (
          <Link href="/login" className="mt-4 block underline">
            Back to login
          </Link>
        )}

        {!validSession && !checkingLink && (
          <Link href="/login" className="mt-4 block underline">
            Back to login
          </Link>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
