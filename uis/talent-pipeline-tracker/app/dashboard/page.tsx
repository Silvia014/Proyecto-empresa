"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type User = {
  id: number;
  email: string;
  is_active: boolean;
  role: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("access_token");

      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load user.");
        }

        const data = await response.json();
        setUser(data);
      } catch {
        localStorage.removeItem("access_token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <p className="text-[#5a1f2b]">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8]">
      <header className="border-b border-[#d8c9b5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#5a1f2b]">
              Brasaland CRM
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Backoffice
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b] hover:bg-[#5a1f2b] hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-gray-500">Welcome back</p>

          <h2 className="mt-1 text-3xl font-semibold text-gray-900">
            {user.email}
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Role: <span className="font-medium">{user.role}</span>
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-[#5a1f2b]">
              Suppliers
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Manage Brasaland suppliers and rates.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-[#5a1f2b]">
              Customers
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Manage customers and their information.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-[#5a1f2b]">
              Orders
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Manage orders and operations.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-[#5a1f2b]">
              Inventory
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Manage inventory across locations.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-[#5a1f2b]">
              Brasapuntos
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Manage customer loyalty activity.
            </p>
          </div>

          <button
            onClick={() => router.push("/profile")}
            className="rounded-xl bg-white p-6 text-left shadow-sm transition hover:shadow-md"
            >
            <h3 className="text-lg font-semibold">Profile</h3>
            <p className="mt-2 text-sm text-gray-600">
                Manage your profile information.
            </p>
          </button>
        </div>
      </section>
    </main>
  );
}