const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

function configurationError(message) {
  const error = new Error(message);
  error.code = "ORDERING_API_CONFIG";
  return error;
}

function isLocalHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host === "0.0.0.0"
    || host === "::1"
    || (net.isIP(host) === 4 && Number(host.split(".")[0]) === 127);
}

const FALLBACK_CATALOG_PATH = path.join(__dirname, "..", "services", "api", "app", "ordering", "catalog.json");

function loadFallbackCatalog() {
  try {
    const raw = fs.readFileSync(FALLBACK_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getFallbackOrderingData(locationId) {
  const catalog = loadFallbackCatalog();
  const fallbackLocations = [
    { id: "bogota", name: "Brasaland Bogotá", city: "Bogotá", country: "Colombia", currency: "COP" },
    { id: "orlando", name: "Brasaland Orlando", city: "Orlando", country: "United States", currency: "USD" },
  ];

  if (!catalog.length) return fallbackLocations;

  if (locationId) {
    const normalizedId = String(locationId).toLowerCase();
    const location = fallbackLocations.find((item) => String(item.id).toLowerCase() === normalizedId) || fallbackLocations[0];
    return catalog.map((item) => ({ ...item, id: String(item.id), locationId: location.id, currency: item.currency || location.currency }));
  }

  return fallbackLocations;
}

function getOrderingApiUrl() {
  const configuredUrl = process.env.ORDERING_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (!configuredUrl) {
    if (!isProduction) return "http://127.0.0.1:8000/api";
    throw configurationError(
      "Online ordering is not configured. Set ORDERING_API_URL to the public HTTPS URL of the deployed ERP API in Vercel, then redeploy."
    );
  }

  let apiUrl;
  try {
    apiUrl = new URL(configuredUrl);
  } catch {
    throw configurationError("ORDERING_API_URL must be a valid absolute URL.");
  }

  if (isProduction && (apiUrl.protocol !== "https:" || isLocalHost(apiUrl.hostname))) {
    throw configurationError(
      "Production ordering cannot use localhost. Set ORDERING_API_URL to the public HTTPS URL of the deployed ERP API in Vercel, then redeploy."
    );
  }

  apiUrl.pathname = apiUrl.pathname.replace(/\/+$/, "") || "/api";
  return apiUrl.toString().replace(/\/$/, "");
}

async function forwardRequest(url, options, res) {
  const response = await fetch(url, options);
  const body = await response.text();
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  return res.status(response.status).send(body);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const requestUrl = new URL(req.url, "http://localhost");
      const locationId = requestUrl.searchParams.get("locationId");
      const path = locationId
        ? `/menu?locationId=${encodeURIComponent(locationId)}`
        : "/menu/locations";

      try {
        const baseUrl = getOrderingApiUrl();
        try {
          return await forwardRequest(`${baseUrl}${path}`, { method: "GET" }, res);
        } catch (fetchError) {
          if (process.env.NODE_ENV !== "production" && fetchError?.code === "ORDERING_API_CONFIG") {
            return res.status(200).json(locationId ? getFallbackOrderingData(locationId) : getFallbackOrderingData());
          }
          if (process.env.NODE_ENV !== "production" && (fetchError instanceof TypeError || /fetch failed|ECONNREFUSED|ENOTFOUND|timed out/i.test(fetchError?.message || ""))) {
            return res.status(200).json(locationId ? getFallbackOrderingData(locationId) : getFallbackOrderingData());
          }
          throw fetchError;
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production" && error.code === "ORDERING_API_CONFIG") {
          return res.status(200).json(locationId ? getFallbackOrderingData(locationId) : getFallbackOrderingData());
        }
        throw error;
      }
    }

    const baseUrl = getOrderingApiUrl();

    if (req.method === "POST") {
      return await forwardRequest(`${baseUrl}/ordering/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(req.body || {}),
      }, res);
    }

    if (req.method === "PATCH") {
      const { orderId, email, paymentPreference } = req.body || {};
      if (!orderId || !email || !["CASH", "PAYMENT_LINK", "BIZUM"].includes(paymentPreference)) {
        return res.status(400).json({ error: "Choose cash, payment link, or Bizum." });
      }
      return await forwardRequest(`${baseUrl}/ordering/${encodeURIComponent(orderId)}/payment-preference`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, paymentPreference }),
      }, res);
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Ordering API proxy failed:", error.message);
    return res.status(503).json({
      error: error.code === "ORDERING_API_CONFIG"
        ? error.message
        : process.env.NODE_ENV === "production"
          ? "The ERP ordering service could not be reached. Check that ORDERING_API_URL points to the deployed Vercel ERP API, then redeploy."
          : "The ERP ordering service is offline or unreachable. Start it on port 8000 or set ORDERING_API_URL to your local ERP API URL.",
    });
  }
};
