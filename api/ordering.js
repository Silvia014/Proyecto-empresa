function getOrderingApiUrl() {
  const configuredUrl = process.env.ORDERING_API_URL;
  if (configuredUrl) {
    const apiUrl = new URL(configuredUrl);
    apiUrl.pathname = apiUrl.pathname.replace(/\/+$/, "") || "/api";
    return apiUrl.toString().replace(/\/$/, "");
  }
  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:8000/api";
  throw new Error("ORDERING_API_URL is required in production");
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
    const baseUrl = getOrderingApiUrl();

    if (req.method === "GET") {
      const requestUrl = new URL(req.url, "http://localhost");
      const locationId = requestUrl.searchParams.get("locationId");
      const path = locationId
        ? `/menu?locationId=${encodeURIComponent(locationId)}`
        : "/menu/locations";
      return await forwardRequest(`${baseUrl}${path}`, { method: "GET" }, res);
    }

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
      error: error.message.includes("ORDERING_API_URL")
        ? error.message
        : "The ERP ordering service is offline or unreachable. Keep the ERP API running on port 8000 and set ORDERING_API_URL=http://127.0.0.1:8000/api for local use.",
    });
  }
};
