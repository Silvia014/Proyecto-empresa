"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  email: string;
  name: string;
  phone: string;
  address: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        const metadata = user.user_metadata ?? {};
        const nextProfile = {
          email: user.email ?? "",
          name: typeof metadata.name === "string" ? metadata.name : "",
          phone: typeof metadata.phone === "string" ? metadata.phone : "",
          address: typeof metadata.address === "string" ? metadata.address : "",
        };

        setProfile(nextProfile);
        setEmail(nextProfile.email);
        setName(nextProfile.name);
        setPhone(nextProfile.phone);
        setAddress(nextProfile.address);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          name,
          phone,
          address,
        },
      });

      if (updateError) {
        throw updateError;
      }

      const nextProfile = {
        email: data.user?.email ?? email,
        name,
        phone,
        address,
      };

      setProfile(nextProfile);
      setEmail(nextProfile.email);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8]">
        <p className="text-[#5a1f2b]">Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-4 text-sm font-medium text-[#5a1f2b] hover:underline"
          >
            ← Back to Dashboard
          </button>

          <h1 className="font-serif text-3xl font-bold text-[#5a1f2b]">
            My Profile
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Manage your CRM profile information.
          </p>

          {email && (
            <p className="mt-3 break-all text-sm text-gray-500">
              Signed in as {email}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#5a1f2b]"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Phone
              </label>

              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#5a1f2b]"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Address
              </label>

              <textarea
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#5a1f2b]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#5a1f2b] px-4 py-3 font-medium text-white transition hover:bg-[#431720] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}