"use strict";

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const statusElement = document.getElementById("report-status");
const messageElement = document.getElementById("report-message");
const periodElement = document.getElementById("report-period");
const rowsElement = document.getElementById("performance-rows");
const weekInput = document.getElementById("week-start");
const countryFilter = document.getElementById("country-filter");
const refreshButton = document.getElementById("refresh-report");
const API_BASE_URL = "http://127.0.0.1:8000";

function setStatus(text, isError = false) {
  statusElement.textContent = text;
  statusElement.classList.toggle("error", isError);
}

function setMessage(text, isError = false) {
  messageElement.textContent = text;
  messageElement.classList.toggle("error", isError);
}

function formatMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

function renderReport(report) {
  rowsElement.replaceChildren();

  const locations = Array.isArray(report.locations) ? report.locations : [];
  const week = report.week_start || "";

  periodElement.textContent = week
    ? `Reporting week starting ${week}`
    : "No reporting week is available yet.";

  if (week && !weekInput.value) {
    weekInput.value = week;
  }

  if (locations.length === 0) {
    setMessage("No KPI rows were returned for this period.");
    return;
  }

  for (const location of locations) {
    const row = document.createElement("tr");
    const currency = location.currency || "USD";

    addCell(row, location.location_id || "—");
    addCell(row, location.country || "—");
    addCell(row, location.week_start || week || "—");
    addCell(row, formatMoney(location.total_purchase_cost, currency));
    addCell(row, formatMoney(location.total_waste_cost, currency));

    const ratio = Number(location.waste_ratio);
    addCell(
      row,
      Number.isFinite(ratio)
        ? new Intl.NumberFormat(undefined, {
            style: "percent",
            maximumFractionDigits: 2,
          }).format(ratio)
        : "—"
    );

    addCell(row, String(location.stockout_events_count ?? "—"));
    addCell(row, String(location.price_alert_events_count ?? "—"));

    rowsElement.appendChild(row);
  }

  setMessage(`${locations.length} location(s) reported.`);
}

async function loadReport() {
  refreshButton.disabled = true;
  setStatus("Loading KPI report…");
  setMessage("");

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw new Error(`Could not read CRM session: ${error.message}`);

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Please sign in through the existing CRM login first.");
    }

    const params = new URLSearchParams();
    if (weekInput.value) params.set("week_start", weekInput.value);
    if (countryFilter.value) params.set("country", countryFilter.value);

    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/reporting/weekly-location-performance${query ? `?${query}` : ""}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof body?.detail === "string" ? ` ${body.detail}` : "";
      throw new Error(`Could not load KPI report (HTTP ${response.status}).${detail}`);
    }

    renderReport(body);
    setStatus("KPI report updated.");
  } catch (error) {
    setStatus("KPI report unavailable.", true);
    setMessage(error.message || "Could not load the report.", true);
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadReport);
weekInput.addEventListener("change", loadReport);
countryFilter.addEventListener("change", loadReport);

loadReport();