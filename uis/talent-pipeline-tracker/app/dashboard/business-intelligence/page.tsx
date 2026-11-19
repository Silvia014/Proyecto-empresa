import Image from "next/image";
import Link from "next/link";
import BusinessDashboard from "../_components/business-dashboard";

export default function BusinessIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#f5f0e8]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-block text-sm font-semibold text-[#5a1f2b] underline">
          Back to dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-[#5a1f2b]">Business dashboard</h1>
        <section className="rounded-2xl border border-[#eadfce] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#5a1f2b]">Monthly sales forecast backtest</h2>
          <p className="mt-2 text-sm text-gray-700">
            Actual and forecast sales for January 2024 through December 2025.
            The historical variability band covered 14 of 24 months.
          </p>
          <Image src="/brasaland-sales-forecast.png" width={1760} height={800} alt="Monthly actual and forecast sales in USD with a shaded P10–P90 variability band." className="mt-4 h-auto w-full" />
        </section>
        <BusinessDashboard />
      </div>
    </main>
  );
}
