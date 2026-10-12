"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getCrmSectionBySlug,
  getCrmSections,
  type LocationSummary,
} from "../crm-sections";

type User = {
  email?: string;
  user_metadata?: {
    role?: string;
  };
};

type DashboardShellProps = {
  initialSectionSlug: string;
};

export default function DashboardShell({
  initialSectionSlug,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [previewSlug, setPreviewSlug] = useState(initialSectionSlug);

  useEffect(() => {
    setPreviewSlug(initialSectionSlug);
  }, [initialSectionSlug]);

  useEffect(() => {
    async function loadDashboardContext() {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!authUser) {
          router.push("/login");
          return;
        }

        setUser(authUser);

        const { data: locationData, error: locationError } = await supabase
          .from("Location")
          .select("id, name");

        if (locationError) {
          throw locationError;
        }

        setLocations(locationData ?? []);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError(
          err instanceof Error ? err.message : "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboardContext();
  }, [router, supabase]);

  const sections = useMemo(() => getCrmSections(locations), [locations]);
  const activeSection =
    getCrmSectionBySlug(previewSlug, locations) ?? sections[0];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <p className="text-[#5a1f2b]">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#5a1f2b]">
            We couldn&apos;t load your dashboard
          </h1>

          <p className="mt-3 text-sm text-gray-600">{error}</p>

          <button
            onClick={() => router.push("/login")}
            className="mt-6 rounded-lg bg-[#5a1f2b] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a1a28]"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8]">
      <header className="border-b border-[#d8c9b5] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#5a1f2b]">
              Brasaland CRM
            </h1>

            <p className="mt-1 text-sm text-gray-500">Backoffice</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-[#5a1f2b] px-4 py-2 text-sm font-medium text-[#5a1f2b] hover:bg-[#5a1f2b] hover:text-white sm:w-auto"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-gray-500">Welcome back</p>

            <h2 className="mt-1 break-all text-3xl font-semibold text-gray-900">
              {user.email}
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Browse the CRM from the left rail. Hover or focus each card to
              preview the module, then open the section page when you want to
              work on it.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5a1f2b]">
              Current preview
            </p>

            <p className="mt-2 text-lg font-semibold text-gray-900">
              {activeSection.title}
            </p>

            <p className="mt-1 text-sm text-gray-600">
              {activeSection.description}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="mb-4 px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5a1f2b]">
                CRM navigation
              </p>

              <p className="mt-2 text-sm text-gray-600">
                Each card opens a different module page.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:block lg:space-y-3">
              {sections.map((section, index) => {
                const isPreview = activeSection.slug === section.slug;
                const isCurrentRoute =
                  pathname === section.route ||
                  (pathname === "/dashboard" && initialSectionSlug === section.slug);

                return (
                  <Link
                    key={section.slug}
                    href={section.route}
                    onMouseEnter={() => setPreviewSlug(section.slug)}
                    onFocus={() => setPreviewSlug(section.slug)}
                    className={[
                      "block w-full rounded-2xl border p-4 transition",
                      isPreview || isCurrentRoute
                        ? "border-[#5a1f2b] bg-[#5a1f2b] text-white shadow-md"
                        : "border-[#eadfce] bg-[#fdfaf5] text-gray-900 hover:border-[#c9b49f] hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p
                          className={[
                            "text-xs font-semibold uppercase tracking-[0.2em]",
                            isPreview || isCurrentRoute
                              ? "text-[#f8e9d8]"
                              : "text-[#8c6a52]",
                          ].join(" ")}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </p>

                        <h3 className="mt-2 text-lg font-semibold">
                          {section.title}
                        </h3>
                      </div>

                      <div>
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-medium",
                            isPreview || isCurrentRoute
                              ? "bg-white/15 text-white"
                              : "bg-[#efe2d3] text-[#5a1f2b]",
                          ].join(" ")}
                        >
                          {section.navLabel}
                        </span>
                      </div>
                    </div>

                    <p
                      className={[
                        "mt-3 text-sm",
                        isPreview || isCurrentRoute
                          ? "text-[#fdf3ea]"
                          : "text-gray-600",
                      ].join(" ")}
                    >
                      {section.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">
                    {activeSection.navLabel}
                  </p>

                  <h3 className="mt-3 text-3xl font-semibold text-[#5a1f2b]">
                    {activeSection.panelTitle}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {activeSection.panelDescription}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                  <Link
                    href={activeSection.route}
                    className="rounded-xl bg-[#5a1f2b] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[#4a1a28] sm:flex-1 lg:flex-none"
                  >
                    {activeSection.ctaLabel}
                  </Link>

                  <Link
                    href="/profile"
                    className="rounded-xl border border-[#5a1f2b] px-5 py-3 text-center text-sm font-medium text-[#5a1f2b] transition hover:bg-[#5a1f2b] hover:text-white sm:flex-1 lg:flex-none"
                  >
                    Open profile
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {activeSection.metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-gray-500">{metric.label}</p>

                  <p className="mt-3 text-3xl font-semibold text-gray-900">
                    {metric.value}
                  </p>
                </article>
              ))}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">
                    Module data
                  </p>

                  <h4 className="mt-2 text-2xl font-semibold text-gray-900">
                    {activeSection.recordsTitle}
                  </h4>
                </div>

                <p className="text-sm text-gray-500">
                  Data preview for {activeSection.title.toLowerCase()}
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeSection.records.map((record) => (
                  <article
                    key={`${activeSection.slug}-${record.name}`}
                    className="rounded-2xl bg-[#f5f0e8] p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <h5 className="text-lg font-semibold text-[#5a1f2b]">
                        {record.name}
                      </h5>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#5a1f2b]">
                        {record.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {record.meta}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}