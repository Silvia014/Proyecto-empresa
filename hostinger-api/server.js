const http = require("node:http");
const { URL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const allowedOrigins = new Set([
  "https://brasaland.site",
  "https://www.brasaland.site",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const routes = new Map([
  ["/api/account", require("./api/account")],
  ["/api/candidate", require("./api/candidate")],
  ["/api/chat", require("./api/chat")],
  ["/api/ordering", require("./api/ordering")],
  ["/api/reservas", require("./api/reservas")],
]);

function writeJson(res, status, value) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function createResponseAdapter(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(value) {
      if (res.writableEnded) return this;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(value));
      return this;
    },
    send(value) {
      if (!res.writableEnded) res.end(value);
      return this;
    },
  };
}

async function readJsonBody(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", "600");
  }

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return writeJson(res, 403, { error: "Origin is not allowed." });
    res.statusCode = 204;
    return res.end();
  }

  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return writeJson(res, 400, { error: "Invalid request URL." });
  }

  if (url.pathname === "/api/health" && req.method === "GET") {
    return writeJson(res, 200, {
      ok: true,
      service: "brasaland-api",
      supabaseConfigured: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      orderingConfigured: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
        && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
        && fs.existsSync(path.join(__dirname, "data", "catalog.json")),
      deliveryDistanceConfigured: Boolean(process.env.GOOGLE_GEOCODING_API_KEY),
      chatConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  const handler = routes.get(url.pathname);
  if (!handler) return writeJson(res, 404, { error: "API route not found." });

  try {
    const body = await readJsonBody(req);
    const query = Object.fromEntries(url.searchParams.entries());
    const adaptedRequest = Object.assign(req, { body, query, url: req.url });
    await handler(adaptedRequest, createResponseAdapter(res));
    if (!res.writableEnded) writeJson(res, 204, {});
  } catch (error) {
    console.error("API request failed:", error.message);
    if (!res.headersSent) writeJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : "The API could not complete the request." });
    else if (!res.writableEnded) res.end();
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Brasaland API listening on port ${port}`);
});
