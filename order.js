let products = [];
let locations = [];
let selectedLocation = { id: "", name: "", city: "", country: "", currency: "USD" };
let selectedCategory = "all";
let cart = [];
let selectedRestaurant = localStorage.getItem("brasalandRestaurant") || "colombia";

try {
  const saved = JSON.parse(localStorage.getItem("brasalandCart") || "[]");
  cart = Array.isArray(saved) ? saved : [];
} catch {
  localStorage.removeItem("brasalandCart");
}

const productsContainer = document.getElementById("products-container");
const categoriesContainer = document.getElementById("order-categories");
const catalogMessage = document.getElementById("catalog-message");
const cartItems = document.getElementById("cart-items");
const emptyCart = document.getElementById("empty-cart");
const cartSummary = document.getElementById("cart-summary");
const cartCount = document.getElementById("cart-count");
const headerCartCount = document.getElementById("header-cart-count");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal = document.getElementById("cart-total");
const checkoutButton = document.getElementById("checkout-button");
const clearCartButton = document.getElementById("clear-cart-button");

async function getFallbackOrderingData(url) {
  const requestUrl = new URL(url, window.location.origin);
  const locationId = requestUrl.searchParams.get("locationId");

  const fallbackLocations = [
    { id: "bogota", name: "Brasaland Bogotá", city: "Bogotá", country: "Colombia", currency: "COP" },
    { id: "orlando", name: "Brasaland Orlando", city: "Orlando", country: "United States", currency: "USD" },
  ];

  try {
    const response = await fetch("/services/api/app/ordering/catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog) || !catalog.length) return fallbackLocations;

    if (locationId) {
      const normalizedId = String(locationId).toLowerCase();
      const location = fallbackLocations.find((item) => String(item.id).toLowerCase() === normalizedId) || fallbackLocations[0];
      return catalog.map((item) => ({
        ...item,
        id: String(item.id),
        locationId: location.id,
        currency: item.currency || location.currency,
      }));
    }

    return fallbackLocations;
  } catch {
    return fallbackLocations;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function saveCart() {
  localStorage.setItem("brasalandCart", JSON.stringify(cart));
}

const USD_TO_COP_RATE = 4100;
const USD_TO_EUR_RATE = 0.92;

function convertCurrencyValue(value, fromCurrency = "USD", toCurrency = "USD") {
  const numericValue = Number(value) || 0;
  const normalizedFrom = String(fromCurrency || "USD").toUpperCase();
  const normalizedTo = String(toCurrency || "USD").toUpperCase();

  if (normalizedFrom === normalizedTo) return numericValue;

  const usdValue = (() => {
    switch (normalizedFrom) {
      case "USD": return numericValue;
      case "EUR": return numericValue / USD_TO_EUR_RATE;
      case "COP": return numericValue / USD_TO_COP_RATE;
      default: return numericValue;
    }
  })();

  switch (normalizedTo) {
    case "USD": return usdValue;
    case "EUR": return usdValue * USD_TO_EUR_RATE;
    case "COP": return usdValue * USD_TO_COP_RATE;
    default: return numericValue;
  }
}

function getDisplayCurrency(currency = selectedLocation?.currency || cart[0]?.currency || "USD") {
  const explicitCurrency = String(currency || selectedLocation?.currency || "USD").toUpperCase();
  if (selectedLocation?.currency) return String(selectedLocation.currency).toUpperCase();
  return explicitCurrency === "COP" ? "COP" : "USD";
}

function getDisplayPrice(value, currency = selectedLocation?.currency || cart[0]?.currency || "USD") {
  const targetCurrency = getDisplayCurrency(currency);
  const sourceCurrency = String(currency || "USD").toUpperCase();
  return convertCurrencyValue(value, sourceCurrency, targetCurrency);
}

function formatPrice(value, currency = selectedLocation?.currency || cart[0]?.currency || "USD") {
  const displayCurrency = getDisplayCurrency(currency);
  const displayValue = getDisplayPrice(value, currency);

  if (displayCurrency === "COP") {
    return `COP ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(displayValue)}`;
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(displayValue);
}

function translation(key, fallback) {
  const language = document.documentElement.lang || "es";
  return key.split(".").reduce((value, part) => value?.[part], translations[language]?.order) ?? fallback;
}

function productCopy(product) {
  const language = document.documentElement.lang || "es";
  const translated = translations[language]?.order?.products?.[product.id];
  return {
    name: translated?.name || (language === "en" ? product.nameEn : null) || product.name,
    description: translated?.description || product.description || "",
  };
}

function showApiError(status, fallback) {
  if (status === 405) {
    return "Local Server rejected the API request (HTTP 405). Stop Live Server, run `npx vercel dev` from the project root, then open the URL printed by Vercel Dev.";
  }
  return fallback;
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    if (url.startsWith("/api/ordering")) {
      return await getFallbackOrderingData(url);
    }
    throw new Error("Could not reach the project API. Start `npx vercel dev` from the project root and open the URL printed by Vercel Dev.");
  }
  const raw = await response.text();
  let result = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { /* handled with status below */ }
  if ([404, 405, 503].includes(response.status) && url.startsWith("/api/ordering")) {
    return await getFallbackOrderingData(url);
  }
  if (response.status === 405) throw new Error(showApiError(405));
  if (!response.ok) throw new Error(result?.error || `Project API returned HTTP ${response.status}.`);
  if (result === null) throw new Error("Project API returned an empty or invalid response. Check the Vercel Dev terminal.");
  return result;
}

function setCatalogMessage(message) {
  if (!catalogMessage) return;
  catalogMessage.textContent = message;
  catalogMessage.classList.toggle("hidden", !message);
}

function renderCategoryButtons() {
  if (!categoriesContainer) return;
  const categories = ["all", ...new Set(products.map((product) => product.category).filter(Boolean))];
  categoriesContainer.innerHTML = categories.map((category, index) => {
    const label = category === "all" ? translation("categories.all", "All") : translation(`categories.${category}`, category);
    return `<button class="category-button ${index === 0 ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(label)}</button>`;
  }).join("");
  categoriesContainer.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    categoriesContainer.querySelectorAll(".category-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    renderProducts();
  }));
}

function renderProducts() {
  if (!productsContainer) return;
  const visible = selectedCategory === "all" ? products : products.filter((item) => item.category === selectedCategory);
  if (!visible.length) {
    productsContainer.innerHTML = `<p class="catalog-empty">${escapeHtml(translation("emptyMenu", "No real menu items are set up for this restaurant yet."))}</p>`;
    return;
  }
  productsContainer.innerHTML = visible.map((product) => {
    const copy = productCopy(product);
    return `<article class="product-card">
      <span class="product-category">${escapeHtml(translation(`categories.${product.category}`, product.category))}</span>
      <h3 class="product-name">${escapeHtml(copy.name)}</h3>
      <p class="product-description">${escapeHtml(copy.description)}</p>
      <div class="product-footer"><span class="product-price">${formatPrice(product.price, product.currency)}</span>
      <button class="add-product-button" type="button" data-product-id="${escapeHtml(product.id)}">${escapeHtml(translation("add", "+ Añadir"))}</button></div>
    </article>`;
  }).join("");
  productsContainer.querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.productId)));
}

function renderCart() {
  if (!cartItems || !emptyCart || !cartSummary) return;
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (cartCount) cartCount.textContent = String(count);
  if (headerCartCount) headerCartCount.textContent = `${count} ${count === 1 ? translation("cart.product", "item") : translation("cart.products", "items")}`;
  if (!cart.length) {
    emptyCart.classList.remove("hidden"); cartItems.classList.add("hidden"); cartSummary.classList.add("hidden"); cartItems.replaceChildren();
    return;
  }
  emptyCart.classList.add("hidden"); cartItems.classList.remove("hidden"); cartSummary.classList.remove("hidden");
  cartItems.innerHTML = cart.map((item) => {
    const copy = productCopy(item);
    return `<article class="cart-item"><div class="cart-item-header"><div>
      <h3 class="cart-item-name">${escapeHtml(copy.name)}</h3>
      <p class="cart-item-unit-price">${formatPrice(item.price, item.currency)} · ${item.quantity}</p></div>
      <span class="cart-item-price">${formatPrice(item.price * item.quantity, item.currency)}</span></div>
      <div class="cart-item-controls"><button class="remove-product-button" type="button" data-remove-id="${escapeHtml(item.id)}">${escapeHtml(translation("remove", "Remove"))}</button>
      <div class="quantity-controls"><button class="quantity-button" type="button" data-change-id="${escapeHtml(item.id)}" data-change="-1" aria-label="Remove one">−</button>
      <span class="quantity-value">${item.quantity}</span><button class="quantity-button plus" type="button" data-change-id="${escapeHtml(item.id)}" data-change="1" aria-label="Add one">+</button></div></div></article>`;
  }).join("");
  if (cartSubtotal) cartSubtotal.textContent = formatPrice(total);
  if (cartTotal) cartTotal.textContent = formatPrice(total);
  cartItems.querySelectorAll("[data-remove-id]").forEach((button) => button.addEventListener("click", () => {
    cart = cart.filter((item) => String(item.id) !== button.dataset.removeId); saveCart(); renderCart();
  }));
  cartItems.querySelectorAll("[data-change-id]").forEach((button) => button.addEventListener("click", () => {
    const item = cart.find((entry) => String(entry.id) === button.dataset.changeId);
    if (!item) return;
    item.quantity += Number(button.dataset.change);
    if (item.quantity < 1) cart = cart.filter((entry) => entry !== item);
    saveCart(); renderCart();
  }));
}

function addToCart(id) {
  const product = products.find((item) => String(item.id) === String(id));
  if (!product) return;
  const existing = cart.find((item) => String(item.id) === String(id));
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, quantity: 1 });
  saveCart(); renderCart();
}

function loadMenu(locationId = selectedLocation.id, reconcileCart = false) {
  const location = locations.find((item) => String(item.id) === String(locationId)) || selectedLocation || locations[0];
  selectedLocation = location;
  products = location.menuItems || [];

  if (reconcileCart && cart.length) {
    const current = new Map(products.map((item) => [String(item.id), item]));
    const normalized = cart.map((item) => {
      const product = current.get(String(item.id));
      return product && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0
        ? { ...product, quantity: Number(item.quantity) } : null;
    });
    if (normalized.some((item) => !item)) {
      cart = [];
      localStorage.removeItem("brasalandCart");
    } else {
      cart = normalized.filter(Boolean);
      saveCart();
    }
  }

  localStorage.setItem("brasalandLocationId", String(location.id));
  selectedCategory = "all";
  renderCategoryButtons();
  renderProducts();
  renderCart();
}

async function initializeCatalog() {
  try {
    locations = await fetchJson("/api/ordering");
    if (!Array.isArray(locations) || !locations.length) throw new Error("No ordering locations are configured.");
    const radios = [...document.querySelectorAll('input[name="restaurant-choice"]')];
    const savedId = localStorage.getItem("brasalandLocationId");
    let location = locations.find((row) => String(row.id) === savedId);
    if (!location) location = locations.find((row) => selectedRestaurant === "orlando" ? /orlando/i.test(row.city) : /bogot/i.test(row.city)) || locations[0];
    selectedRestaurant = /orlando/i.test(location.city) ? "orlando" : "colombia";
    radios.forEach((radio) => { radio.checked = radio.value === selectedRestaurant; });
    await chooseRestaurant(location, cart.length > 0);
    radios.forEach((radio) => radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      const next = locations.find((row) => radio.value === "orlando" ? /orlando/i.test(row.city) : /bogot/i.test(row.city));
      if (!next) return;
      if (cart.length && !window.confirm("Changing restaurant clears your current cart. Continue?")) {
        radios.forEach((item) => { item.checked = item.value === selectedRestaurant; });
        return;
      }
      cart = [];
      localStorage.removeItem("brasalandCart");
      await chooseRestaurant(next, false);
    }));
    setCatalogMessage("");
  } catch (error) {
    setCatalogMessage(error.message || "The restaurant menu could not be loaded.");
  }
}

async function chooseRestaurant(location, reconcileCart) {
  selectedRestaurant = /orlando/i.test(location.city) ? "orlando" : "colombia";
  const live = await fetchJson(`/api/ordering?locationId=${encodeURIComponent(location.id)}`);
  selectedLocation = { ...location, menuItems: live.map((item) => ({ ...item, id: String(item.id), locationId: String(location.id), currency: item.currency || location.currency })) };
  const priorCart = cart;
  products = selectedLocation.menuItems;
  if (reconcileCart && priorCart.length) {
    const current = new Map(products.map((item) => [String(item.id), item]));
    const updated = priorCart.map((item) => current.has(String(item.id)) ? { ...current.get(String(item.id)), quantity: Number(item.quantity) } : null);
    if (updated.some((item) => !item)) {
      cart = [];
      localStorage.removeItem("brasalandCart");
      setCatalogMessage("We refreshed the live menu. Your old cart items were removed; add the current items again.");
    } else cart = updated;
  }
  localStorage.setItem("brasalandRestaurant", selectedRestaurant);
  localStorage.setItem("brasalandLocationId", String(location.id));
  selectedCategory = "all";
  renderCategoryButtons(); renderProducts(); renderCart();
}

clearCartButton?.addEventListener("click", () => {
  if (!cart.length || !window.confirm(translation("clearCartConfirm", "Remove all items from your cart?"))) return;
  cart = []; localStorage.removeItem("brasalandCart"); renderCart();
});

checkoutButton?.addEventListener("click", () => {
  if (!cart.length) { window.alert(translation("checkoutEmpty", "Your cart is empty.")); return; }
  saveCart(); window.location.href = "checkout.html";
});

document.addEventListener("DOMContentLoaded", () => { renderCart(); void initializeCatalog(); });
document.addEventListener("languagechange", () => { renderCategoryButtons(); renderProducts(); renderCart(); });
