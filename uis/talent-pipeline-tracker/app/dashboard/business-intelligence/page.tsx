import Image from "next/image";
import Link from "next/link";
import BusinessDashboard from "../_components/business-dashboard";

import salesOutlook from "./sales-outlook.json";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function BusinessIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#f5f0e8]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-block text-sm font-semibold text-[#5a1f2b] underline">
          Back to dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-[#5a1f2b]">Business dashboard</h1>
        <section aria-labelledby="sales-outlook" className="rounded-2xl border border-[#eadfce] bg-white p-5">
          <h2 id="sales-outlook" className="text-xl font-semibold text-[#5a1f2b]">Consolidated sales outlook</h2>
          <p className="mt-2 text-sm text-gray-700">
            Planning estimates in USD. Latest actual sales used: December {salesOutlook.lastYear}.
          </p>
          <p className="mt-4 rounded-xl bg-[#f5f0e8] p-4 text-sm text-gray-800">
            <strong>Seasonal alert · January.</strong>{" "}
            January ranked among the three lowest-sales months in {salesOutlook.januaryBottomThreeYears} of{" "}
            {salesOutlook.lastYear - salesOutlook.firstYear + 1} years.
            Its typical sales were {Math.abs(salesOutlook.januaryTypicalChangePercent)}%{" "}
            {salesOutlook.januaryTypicalChangePercent < 0 ? "below" : "above"} the monthly average for the same year.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {salesOutlook.estimates.map(({ month, revenueUsd }) => (
              <div key={month} className="rounded-xl border border-[#eadfce] p-4">
                <dt className="text-sm text-gray-700">{monthLabel.format(new Date(`${month}-01T00:00:00Z`))}</dt>
                <dd className="mt-1 text-2xl font-semibold text-[#5a1f2b]">{usd.format(revenueUsd)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-gray-700">
            Estimates use the last actual for the same month and the median growth over three years.
            January compounds growth for two years and carries more uncertainty.
            From {salesOutlook.backtestStartYear} to {salesOutlook.lastYear}, the mean absolute monthly error
            was {usd.format(salesOutlook.outlookMaeUsd)}, compared with {usd.format(salesOutlook.baselineMaeUsd)}{" "}
            when repeating the prior year.
          </p>
        </section>
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
