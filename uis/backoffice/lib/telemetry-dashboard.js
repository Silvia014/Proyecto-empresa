(() => {
    "use strict";

    const API_BASE_URL = window.TELEMETRY_API_BASE_URL || "";
    const REPORT_ENDPOINT = `${API_BASE_URL}/telemetry/report`;

    const statusElement = document.getElementById("telemetry-status");
    const refreshButton = document.getElementById("telemetry-refresh-button");

    const containers = {
        eventsPerDay: document.getElementById("events-per-day"),
        errorRateByType: document.getElementById("error-rate-by-type"),
        apiLatencyByDay: document.getElementById("api-latency-by-day"),
        eventVolumeByType: document.getElementById("event-volume-by-type"),
    };

    if (!statusElement || !refreshButton || Object.values(containers).some(el => !el)) {
        return;
    }

    const numberFormat = new Intl.NumberFormat();
    const percentFormat = new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
    });

    function setStatus(message, type = "") {
        statusElement.textContent = message;
        statusElement.classList.toggle("error", type === "error");
    }

    function formatDate(value) {
        if (!value) return "Unknown date";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString();
    }

    function formatMetric(value, suffix = "") {
        const numericValue = Number(value);
        return Number.isFinite(numericValue)
            ? `${numberFormat.format(numericValue)}${suffix}`
            : "—";
    }

    function renderList(container, rows, getLabel, getValue, emptyMessage = "No data available for this period.") {
        container.replaceChildren();

        if (!Array.isArray(rows) || rows.length === 0) {
            const empty = document.createElement("p");
            empty.className = "telemetry-empty";
            empty.textContent = emptyMessage;
            container.appendChild(empty);
            return;
        }

        const list = document.createElement("ul");
        rows.forEach(row => {
            const item = document.createElement("li");
            const label = document.createElement("span");
            const value = document.createElement("strong");

            label.textContent = getLabel(row);
            value.textContent = getValue(row);

            item.append(label, document.createTextNode(": "), value);
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    function renderReport(report) {
        const metrics = report && report.metrics;
        if (!metrics || typeof metrics !== "object") {
            throw new Error("The telemetry API returned an unexpected response.");
        }

        renderList(
            containers.eventsPerDay,
            metrics.events_per_day,
            row => `${formatDate(row.date)} · ${row.event_type || "Unknown event"}`,
            row => formatMetric(row.event_count)
        );

        renderList(
            containers.errorRateByType,
            metrics.error_rate_by_type,
            row => row.event_type || "Unknown event",
            row => {
                const rate = Number(row.error_rate);
                return Number.isFinite(rate)
                    ? `${percentFormat.format(rate)} (${formatMetric(row.error_count)} errors / ${formatMetric(row.event_count)} events)`
                    : "—";
            }
        );

        renderList(
            containers.apiLatencyByDay,
            metrics.api_latency_by_day,
            row => `${formatDate(row.date)} · ${row.route_template || "Unknown route"}`,
            row => `${formatMetric(row.mean_duration_ms, " ms")} average; ${formatMetric(row.max_duration_ms, " ms")} max (${formatMetric(row.request_count)} requests)`
        );

        renderList(
            containers.eventVolumeByType,
            metrics.event_volume_by_type,
            row => row.event_type || "Unknown event",
            row => {
                const share = Number(row.share);
                const shareText = Number.isFinite(share)
                    ? ` · ${percentFormat.format(share)}`
                    : "";
                return `${formatMetric(row.event_count)} events${shareText}`;
            }
        );

        const from = report.period?.from ? formatDate(report.period.from) : null;
        const to = report.period?.to ? formatDate(report.period.to) : null;
        const periodText = from && to ? ` Period: ${from} – ${to}.` : "";
        setStatus(`Telemetry metrics updated successfully.${periodText}`);
    }

    async function loadTelemetryReport() {
        refreshButton.disabled = true;
        const originalText = refreshButton.textContent;
        refreshButton.textContent = "Loading…";
        setStatus("Loading telemetry metrics…");

        try {
            const response = await fetch(REPORT_ENDPOINT, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });

            if (!response.ok) {
                let detail = "";
                try {
                    const body = await response.json();
                    detail = typeof body.detail === "string" ? ` ${body.detail}` : "";
                } catch {
                    // The response may not contain JSON.
                }
                throw new Error(`Could not load telemetry (HTTP ${response.status}).${detail}`);
            }

            renderReport(await response.json());
        } catch (error) {
            setStatus(
                error instanceof TypeError
                    ? "Could not connect to the telemetry API. Check the API URL and CORS configuration."
                    : error.message || "Could not load telemetry metrics.",
                "error"
            );
        } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = originalText;
        }
    }

    refreshButton.addEventListener("click", loadTelemetryReport);
    loadTelemetryReport();
})();
