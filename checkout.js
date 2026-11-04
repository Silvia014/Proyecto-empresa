// ==========================================
// GET CART FROM LOCAL STORAGE
// ==========================================

let cart = [];
try {
  const storedCart = JSON.parse(localStorage.getItem("brasalandCart") || "[]");
  cart = Array.isArray(storedCart) ? storedCart : [];
} catch {
  localStorage.removeItem("brasalandCart");
}

const checkoutItems = document.getElementById("checkout-items");
const checkoutTotal = document.getElementById("checkout-total");
let checkoutLocationId = "";
const chosenLocationId = localStorage.getItem("brasalandLocationId") || cart[0]?.locationId || "";

async function apiJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new Error("Could not reach the project API. Stop Live Server, run `npx vercel dev` from the project root, then open the URL printed by Vercel Dev.");
  }
  const responseText = await response.text();
  let result = null;
  try { result = responseText ? JSON.parse(responseText) : null; } catch { /* report the server response below */ }
  if (response.status === 405) {
    throw new Error("The local server returned HTTP 405 for an API request. Stop Live Server, run `npx vercel dev` from the project root, then open the URL printed by Vercel Dev.");
  }
  if (!response.ok) throw new Error(result?.detail || result?.error || `The project API returned HTTP ${response.status}.`);
  if (!result) throw new Error("The project API returned an empty or invalid response. Check the Vercel Dev terminal.");
  return result;
}

async function loadBrasaclubCheckoutSession() {
  const prompt = document.getElementById("checkout-member-prompt");
  const active = document.getElementById("checkout-member-active");
  let session;
  try { session = JSON.parse(localStorage.getItem("brasaland_session") || "null"); } catch { session = null; }
  if (!session?.access_token) return;

  try {
    const result = await apiJson("/api/account", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    document.getElementById("customer-name").value = result.member.name || "";
    document.getElementById("customer-email").value = result.member.email || "";
    document.getElementById("customer-email").readOnly = true;
    document.getElementById("customer-email").setAttribute("aria-readonly", "true");
    document.getElementById("customer-phone").value = result.member.phone || "";
    prompt?.classList.add("hidden");
    if (active) {
      const isEnglish = localStorage.getItem("language") !== "es";
      active.textContent = isEnglish
        ? `Brasaclub · ${result.member.name}. This saved order will appear in your account history. Automatic points earning will activate after the location currency rules are configured.`
        : `Brasaclub · ${result.member.name}. Este pedido guardado aparecerá en tu historial. La acumulación automática se activará cuando se configuren las reglas de moneda de cada local.`;
      active.classList.remove("hidden");
    }
  } catch {
    document.getElementById("customer-email").readOnly = false;
  }
}


// ==========================================
// IF CART IS EMPTY
// ==========================================

if (cart.length === 0) {
  checkoutItems.innerHTML = `
    <p>Your cart is empty.</p>
  `;
}


// ==========================================
// DISPLAY ORDER
// ==========================================

function renderCheckout() {

  checkoutItems.innerHTML = "";

  let total = 0;

  cart.forEach((item) => {

    const itemTotal = item.price * item.quantity;

    total += itemTotal;

    const itemElement = document.createElement("div");

    itemElement.classList.add("checkout-item");

    itemElement.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>Quantity: ${item.quantity}</span>
      </div>

      <strong>
        ${formatPrice(itemTotal, item.currency || "USD")}
      </strong>
    `;

    checkoutItems.appendChild(itemElement);

  });

  checkoutTotal.textContent = formatPrice(total, cart[0]?.currency || "USD");
}


// ==========================================
// SHOW DELIVERY ADDRESS
// ==========================================

const orderTypeInputs =
  document.querySelectorAll(
    'input[name="order-type"]'
  );

const deliveryAddress =
  document.getElementById("delivery-address");

const addressInputs = [
  document.getElementById("address-street"),
  document.getElementById("address-number"),
  document.getElementById("address-postcode"),
  document.getElementById("address-city"),
  document.getElementById("address-country"),
];

orderTypeInputs.forEach((input) => {

  input.addEventListener("change", () => {

    if (input.value === "delivery" && input.checked) {

      deliveryAddress.classList.remove("hidden");

      addressInputs.forEach((field) => { field.required = true; });

    } else if (input.value === "pickup" && input.checked) {

      deliveryAddress.classList.add("hidden");

      addressInputs.forEach((field) => {
        field.required = false;
        field.value = "";
      });

    }

  });

});


// ==========================================
// SUBMIT ORDER TO ERP
// ==========================================

const checkoutForm = document.getElementById("checkout-form");
const submitButton = document.querySelector('[form="checkout-form"]');
const checkoutFeedback = document.createElement("p");
checkoutFeedback.className = "checkout-feedback";
checkoutFeedback.setAttribute("role", "status");
checkoutFeedback.setAttribute("aria-live", "polite");
checkoutForm.appendChild(checkoutFeedback);

async function reconcileCartWithLiveMenu() {
  if (!cart.length) throw new Error("Your cart is empty. Return to the menu and add current items.");
  const locations = await apiJson("/api/ordering");
  if (!Array.isArray(locations)) throw new Error("The restaurant list returned an invalid response.");

  const cartLocationIds = [...new Set(cart.map((item) => item.locationId).filter(Boolean).map(String))];
  if (cartLocationIds.length > 1) throw new Error("Your cart contains items from different restaurants. Return to the menu and place one restaurant order at a time.");
  let locationId = chosenLocationId || cartLocationIds[0] || "";
  if (!locations.some((location) => String(location.id) === locationId)) locationId = "";

  let matchingLocation = locationId ? locations.find((location) => String(location.id) === locationId) : null;
  let liveItems = null;
  if (matchingLocation) {
    const result = await apiJson(`/api/ordering?locationId=${encodeURIComponent(locationId)}`);
    if (!Array.isArray(result)) throw new Error("The current menu could not be loaded.");
    liveItems = result;
  } else {
    const matches = [];
    for (const location of locations) {
      let result;
      try { result = await apiJson(`/api/ordering?locationId=${encodeURIComponent(location.id)}`); }
      catch { continue; }
      if (!Array.isArray(result)) continue;
      const ids = new Set(result.map((item) => String(item.id)));
      if (cart.every((item) => ids.has(String(item.id)))) matches.push({ location, items: result });
    }
    if (matches.length === 1) {
      matchingLocation = matches[0].location;
      liveItems = matches[0].items;
      locationId = String(matchingLocation.id);
    }
  }

  if (!matchingLocation || !Array.isArray(liveItems)) {
    throw new Error("Your saved cart is from an older menu or has no restaurant selected. Return to the menu, choose a restaurant, and add its current items. Once submitted, the restaurant will confirm the order and send a payment link; you can ask to pay cash instead.");
  }
  const menuById = new Map(liveItems.map((item) => [String(item.id), item]));
  const normalized = cart.map((item) => {
    const live = menuById.get(String(item.id));
    if (!live || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) return null;
    return { ...live, id: String(live.id), locationId: String(matchingLocation.id), quantity: Number(item.quantity) };
  });
  if (normalized.some((item) => !item)) {
    throw new Error("One or more items are no longer on this menu. Return to the menu and update your cart. The restaurant will send a payment link after you submit a valid order.");
  }
  cart = normalized;
  checkoutLocationId = String(matchingLocation.id);
  localStorage.setItem("brasalandLocationId", checkoutLocationId);
  const restaurantSummary = document.getElementById("checkout-restaurant-summary");
  if (restaurantSummary) restaurantSummary.textContent = `Restaurant: ${matchingLocation.name} · Delivery available within 20 km of ${matchingLocation.city}.`;
  const deliveryCity = document.getElementById("delivery-city-label");
  if (deliveryCity) deliveryCity.textContent = matchingLocation.city;
  localStorage.setItem("brasalandCart", JSON.stringify(cart));
  renderCheckout();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatPrice(value, currency) {
  return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", {
    style: "currency", currency,
  }).format(value);
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  checkoutFeedback.textContent = "";
  checkoutFeedback.classList.remove("error");

  if (!cart.length) {
    checkoutFeedback.textContent = "Your cart is empty.";
    checkoutFeedback.classList.add("error");
    return;
  }

  const locationId = checkoutLocationId || cart[0]?.locationId || localStorage.getItem("brasalandLocationId") || "";

  const fulfillment = document.querySelector('input[name="order-type"]:checked')?.value || "pickup";
  const customer = {
    name: document.getElementById("customer-name").value.trim(),
    email: document.getElementById("customer-email").value.trim(),
    phone: document.getElementById("customer-phone").value.trim(),
  };
  const payload = {
    locationId,
    fulfillment,
    deliveryAddress: fulfillment === "delivery"
      ? addressInputs.map((field) => field.value.trim()).join(", ")
      : undefined,
    customer,
    notes: document.getElementById("order-notes").value.trim(),
    items: cart.map((item) => ({ menuItemId: String(item.id), quantity: Number(item.quantity) })),
  };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending order…";
  }

  try {
    const result = await apiJson("/api/ordering", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!result.orderId || result.paymentStatus !== "PENDING") {
      throw new Error("The ERP did not return a saved order with pending payment. Your cart has been kept; please try again or contact the restaurant.");
    }

    localStorage.removeItem("brasalandCart");
    sessionStorage.setItem("brasalandPendingOrder", JSON.stringify({
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
      customerName: customer.name,
      customerEmail: customer.email,
      total: result.total,
      currency: result.currency || cart[0].currency || "USD",
      locationName: document.getElementById("checkout-restaurant-summary")?.textContent || "",
    }));
    window.location.assign("order-pending.html");
  } catch (error) {
    checkoutFeedback.textContent = error instanceof Error ? error.message : "The restaurant could not receive your order. Please try again.";
    checkoutFeedback.classList.add("error");
  } finally {
    if (submitButton?.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = "Send order to restaurant";
    }
  }
});


// INITIALIZE
// ==========================================

renderCheckout();
void loadBrasaclubCheckoutSession();
void reconcileCartWithLiveMenu().catch((error) => {
  // The ERP rechecks availability and prices when the order is submitted.
  // A temporary menu refresh failure must not block that authoritative check.
  checkoutFeedback.textContent = error instanceof Error
    ? `${error.message} You can still submit your order; the restaurant system will validate it before saving.`
    : "The menu could not be refreshed. You can still submit your order and the restaurant system will validate it before saving.";
});
