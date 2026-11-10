const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createAdminClient, getUserFromRequest } = require("../lib/api-supabase");

const CATALOG_PATH = path.join(__dirname, "..", "data", "catalog.json");
const DELIVERY_RADIUS_KM = 5;
const USD_TO_COP_RATE = 4100;
const USD_TO_EUR_RATE = 0.92;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BRANCHES = {
  bogota: {
    address: "Callejón del Embudo 5, 110111 Bogotá, Colombia",
    countryCode: "CO",
    country: "Colombia",
  },
  cali: {
    address: "Avenida 9 Norte 10-23, Granada, Cali, Colombia",
    countryCode: "CO",
    country: "Colombia",
  },
  medellin: {
    address: "Carrera 43A 1-50, El Poblado, Medellín, Colombia",
    countryCode: "CO",
    country: "Colombia",
  },
  miami: {
    address: "1200 Brickell Avenue, Miami, FL 33131, USA",
    countryCode: "US",
    country: "United States",
  },
  orlando: {
    address: "123 Church Street, Orlando, FL 32801, USA",
    countryCode: "US",
    country: "United States",
  },
};
const branchCoordinates = new Map();

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function readCatalog() {
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    if (!Array.isArray(catalog) || catalog.length === 0) throw new Error("Catalog is empty.");
    return catalog;
  } catch (error) {
    console.error("Online menu could not be loaded:", error.message);
    const wrapped = new Error("The online menu is unavailable right now.");
    wrapped.statusCode = 503;
    throw wrapped;
  }
}

function cityKey(city) {
  const normalized = String(city || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("bogot")) return "bogota";
  if (normalized.includes("cali")) return "cali";
  if (normalized.includes("medell")) return "medellin";
  if (normalized.includes("miami")) return "miami";
  if (normalized.includes("orlando")) return "orlando";
  return null;
}

async function getOrderingLocations(supabase) {
  const { data, error } = await supabase
    .from("Location")
    .select("id, name, city, country, currency");
  if (error) throw error;

  const supported = (data || []).filter((location) => cityKey(location.city));
  const locationIds = supported.map((location) => location.id);
  let menuCounts = new Map();
  if (locationIds.length) {
    const { data: menuRows, error: menuError } = await supabase
      .from("MenuItem")
      .select("locationId")
      .eq("available", true)
      .in("locationId", locationIds);
    if (menuError) throw menuError;
    menuCounts = (menuRows || []).reduce((counts, item) => {
      counts.set(item.locationId, (counts.get(item.locationId) || 0) + 1);
      return counts;
    }, new Map());
  }

  const selectedByCity = new Map();
  for (const location of supported) {
    const key = cityKey(location.city);
    const current = selectedByCity.get(key);
    const count = menuCounts.get(location.id) || 0;
    const currentCount = current ? menuCounts.get(current.id) || 0 : -1;
    if (!current || count > currentCount || (count === currentCount && location.name.localeCompare(current.name) < 0)) {
      selectedByCity.set(key, location);
    }
  }
  return ["bogota", "cali", "medellin", "miami", "orlando"]
    .map((key) => selectedByCity.get(key))
    .filter(Boolean)
    .map((location) => ({
      ...location,
      deliveryFee: convertCatalogPrice(5, "USD", location.currency),
    }));
}

function getBranch(location) {
  const key = cityKey(location?.city);
  return key ? { key, ...BRANCHES[key] } : null;
}

function roundMoney(value, currency) {
  return currency === "COP" ? Math.round(value) : Number(value.toFixed(2));
}

// Keep this conversion aligned with order.js, which currently displays the
// repository catalog (priced in EUR) in the selected restaurant's currency.
function convertCatalogPrice(value, sourceCurrency, targetCurrency) {
  const source = String(sourceCurrency || "EUR").toUpperCase();
  const target = String(targetCurrency || "USD").toUpperCase();
  const usd = source === "EUR"
    ? value / USD_TO_EUR_RATE
    : source === "COP"
      ? value / USD_TO_COP_RATE
      : value;
  const converted = target === "EUR"
    ? usd * USD_TO_EUR_RATE
    : target === "COP"
      ? usd * USD_TO_COP_RATE
      : usd;
  return roundMoney(converted, target);
}

async function geocode(address, regionCode) {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    const error = new Error("Delivery address checking is not configured yet. Choose pickup or contact the restaurant.");
    error.statusCode = 503;
    throw error;
  }
  const endpoint = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}`);
  if (regionCode) endpoint.searchParams.set("regionCode", regionCode);
  let response;
  try {
    response = await fetch(endpoint, {
      headers: { "X-Goog-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("Address geocoding request failed:", error.message);
    const wrapped = new Error("We could not check that address right now. Please try again or choose pickup.");
    wrapped.statusCode = 503;
    throw wrapped;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) {
    console.error("Google Geocoding API request was rejected:", result.error?.status || response.status);
    const error = new Error("Address checking is temporarily unavailable. Please try again or choose pickup.");
    error.statusCode = 503;
    throw error;
  }
  const point = (result.results || []).map((entry) => entry.location).find((location) =>
    Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude));
  if (!point) {
    const error = new Error("We could not find that delivery address. Check the street, number, postcode, city, and country.");
    error.statusCode = 422;
    throw error;
  }
  return { latitude: point.latitude, longitude: point.longitude };
}

async function deliveryDistanceKm(address, branch) {
  let branchPoint = branchCoordinates.get(branch.key);
  if (!branchPoint) {
    branchPoint = await geocode(branch.address, branch.countryCode);
    branchCoordinates.set(branch.key, branchPoint);
  }
  const destination = await geocode(address, branch.countryCode);
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(branchPoint.latitude);
  const lat2 = radians(destination.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(destination.longitude - branchPoint.longitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function validateCheckout(body) {
  const customer = body?.customer || {};
  const items = body?.items;
  if (typeof body?.locationId !== "string" || !body.locationId.trim()) return "Choose a restaurant before placing your order.";
  if (!["pickup", "delivery"].includes(body.fulfillment)) return "Choose pickup or delivery.";
  if (typeof customer.name !== "string" || customer.name.trim().length < 2 || customer.name.trim().length > 160) return "Enter a valid name.";
  if (typeof customer.email !== "string" || customer.email.length > 254 || !EMAIL_PATTERN.test(customer.email.trim())) return "Enter a valid email address.";
  if (typeof customer.phone !== "string" || customer.phone.trim().length < 6 || customer.phone.trim().length > 80) return "Enter a valid phone number.";
  if (body.fulfillment === "delivery" && (typeof body.deliveryAddress !== "string" || body.deliveryAddress.trim().length < 8 || body.deliveryAddress.trim().length > 500)) return "Enter a complete delivery address.";
  if (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000)) return "Order notes must be 2,000 characters or fewer.";
  if (!Array.isArray(items) || items.length < 1 || items.length > 36) return "Your cart is empty or contains too many items.";
  const seen = new Set();
  for (const item of items) {
    const id = String(item?.menuItemId || "");
    const quantity = Number(item?.quantity);
    if (!id || seen.has(id)) return "Each menu item can only appear once in your cart.";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return "Each item quantity must be between 1 and 50.";
    seen.add(id);
  }
  return null;
}

async function getVerifiedCustomer(supabase, req, customerInput, location, branch) {
  const authorization = req.headers.authorization || "";
  const hasBearer = authorization.startsWith("Bearer ");
  const user = hasBearer ? await getUserFromRequest(supabase, req) : null;
  if (hasBearer && !user) {
    const error = new Error("Your Brasaclub session has expired. Sign in again or continue as a guest.");
    error.statusCode = 401;
    throw error;
  }

  const email = customerInput.email.trim().toLowerCase();
  if (user && String(user.email || "").trim().toLowerCase() !== email) {
    const error = new Error("The order email must match the signed-in Brasaclub account.");
    error.statusCode = 403;
    throw error;
  }
  const { data: customerId, error } = await supabase.rpc("ensure_brasaland_customer", {
    p_user_id: user?.id || null,
    p_name: customerInput.name.trim(),
    p_email: email,
    p_phone: customerInput.phone.trim(),
    p_country: branch.country,
    p_city: location.city,
    p_create_membership: Boolean(user),
  });
  if (error) throw error;
  if (typeof customerId !== "string" || !customerId) throw new Error("The customer account could not be linked to this order.");
  return { id: customerId, email };
}

async function createOrder(supabase, req, body) {
  const locations = await getOrderingLocations(supabase);
  const location = locations.find((item) => item.id === body.locationId);
  if (!location) {
    const error = new Error("That restaurant is not available for online orders. Return to the menu and select one of our listed locations.");
    error.statusCode = 404;
    throw error;
  }
  const branch = getBranch(location);
  if (!branch) {
    const error = new Error("Delivery is not configured for this restaurant.");
    error.statusCode = 503;
    throw error;
  }

  if (body.fulfillment === "delivery") {
    const distance = await deliveryDistanceKm(body.deliveryAddress.trim(), branch);
    if (distance > DELIVERY_RADIUS_KM) {
      const error = new Error(`This address is ${distance.toFixed(1)} km from the restaurant. Delivery is available only within 5 km. Choose pickup or enter an address closer to ${location.city}.`);
      error.statusCode = 422;
      throw error;
    }
  }

  const catalog = readCatalog();
  const catalogById = new Map(catalog.map((item) => [String(item.id), item]));
  const lines = body.items.map((item) => {
    const product = catalogById.get(String(item.menuItemId));
    if (!product || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
      const error = new Error("A menu item is no longer available. Refresh the menu and try again.");
      error.statusCode = 400;
      throw error;
    }
    const quantity = Number(item.quantity);
    const unitPrice = convertCatalogPrice(Number(product.price), product.currency, location.currency);
    return {
      id: randomUUID(),
      dishName: String(product.name).slice(0, 160),
      quantity,
      unitPrice,
      subtotal: roundMoney(unitPrice * quantity, location.currency),
      menuItemId: String(product.id),
    };
  });
  const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.subtotal, 0), location.currency);
  const deliveryFee = body.fulfillment === "delivery"
    ? convertCatalogPrice(5, "USD", location.currency)
    : 0;
  const customer = await getVerifiedCustomer(supabase, req, body.customer, location, branch);
  const now = new Date().toISOString();
  const orderId = randomUUID();
  const orderPayload = {
    id: orderId,
    customerId: customer.id,
    locationId: location.id,
    currency: location.currency,
    subtotal,
    discount: 0,
    total: subtotal + deliveryFee,
    status: "RECEIVED",
    source: "ONLINE",
    fulfillment: body.fulfillment,
    deliveryAddress: body.fulfillment === "delivery" ? body.deliveryAddress.trim() : null,
    customerNotes: body.notes?.trim() || null,
    paymentStatus: "PENDING",
    deliveryFee,
    createdAt: now,
    updatedAt: now,
  };
  const { data: order, error } = await supabase
    .from("Order")
    .insert(orderPayload)
    .select("id, status, paymentStatus, total, currency")
    .single();
  if (error) throw error;

  // PostgREST does not accept a related table as a nested column in a plain
  // insert. Save the parent first, then its OrderItem rows using the actual
  // deployed schema. If the second write fails, mark the order cancelled so
  // staff never mistake an incomplete cart for a valid order.
  const itemRows = lines.map((line) => ({ ...line, orderId: order.id }));
  const { error: itemsError } = await supabase.from("OrderItem").insert(itemRows);
  if (itemsError) {
    const { error: cancelError } = await supabase
      .from("Order")
      .update({ status: "CANCELLED", paymentStatus: "FAILED", updatedAt: new Date().toISOString() })
      .eq("id", order.id);
    if (cancelError) console.error("Incomplete order cleanup failed:", cancelError.code || cancelError.message);
    throw itemsError;
  }

  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentOptions: ["PAYMENT_LINK", "CASH"],
    total: order.total,
    currency: order.currency,
    message: "Order received. The restaurant will confirm availability and contact you to arrange payment.",
  };
}

async function savePaymentPreference(supabase, body) {
  const orderId = String(body?.orderId || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const preference = body?.paymentPreference;
  if (!orderId || !EMAIL_PATTERN.test(email) || !["CASH", "PAYMENT_LINK", "BIZUM"].includes(preference)) {
    const error = new Error("Choose cash or card and enter the order email.");
    error.statusCode = 400;
    throw error;
  }
  const { data: order, error: readError } = await supabase
    .from("Order")
    .select("id, customerId, paymentStatus")
    .eq("id", orderId)
    .maybeSingle();
  if (readError) throw readError;
  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  const { data: customer, error: customerError } = await supabase
    .from("Customer")
    .select("email")
    .eq("id", order.customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (String(customer?.email || "").trim().toLowerCase() !== email) {
    const error = new Error("This order does not match that email address.");
    error.statusCode = 403;
    throw error;
  }
  if (order.paymentStatus !== "PENDING") {
    const error = new Error("Payment preference can only be changed while payment is pending.");
    error.statusCode = 409;
    throw error;
  }
  const { data: updatedOrder, error: updateError } = await supabase
    .from("Order")
    .update({ paymentPreference: preference, updatedAt: new Date().toISOString() })
    .eq("id", orderId)
    .eq("paymentStatus", "PENDING")
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedOrder) {
    const error = new Error("This order is no longer awaiting payment.");
    error.statusCode = 409;
    throw error;
  }
  return { ok: true, paymentPreference: preference };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendError(res, 405, "Method not allowed.");
  }

  try {
    const supabase = createAdminClient();
    if (req.method === "GET") {
      const requestUrl = new URL(req.url, "http://localhost");
      const locations = await getOrderingLocations(supabase);
      const locationId = requestUrl.searchParams.get("locationId");
      if (!locationId) return res.status(200).json(locations);

      const location = locations.find((item) => item.id === locationId);
      if (!location) return sendError(res, 404, "Restaurant location not found.");
      const menu = readCatalog().map((item) => ({
        ...item,
        id: String(item.id),
        locationId: location.id,
      }));
      return res.status(200).json(menu);
    }

    if (req.method === "POST") {
      const message = validateCheckout(req.body || {});
      if (message) return sendError(res, 400, message);
      const result = await createOrder(supabase, req, req.body);
      return res.status(201).json(result);
    }

    const result = await savePaymentPreference(supabase, req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    console.error("Ordering request failed:", error.message);
    return sendError(res, error.statusCode || (error.code === "SUPABASE_CONFIG_MISSING" ? 503 : 500),
      error.statusCode ? error.message : error.code === "SUPABASE_CONFIG_MISSING"
        ? error.message
        : "The restaurant could not complete this request. Please try again or contact the restaurant.");
  }
};
