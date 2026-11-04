let products = [];
let locations = [{
  id: "brasaland",
  name: "Brasaland",
  city: "Madrid",
  country: "Spain",
  currency: "EUR",
}];
let selectedLocation = locations[0];
let selectedCategory = "all";
let cart = [];

try {
  const saved = JSON.parse(localStorage.getItem("brasalandCart") || "[]");
  cart = Array.isArray(saved) ? saved : [];
} catch {
  localStorage.removeItem("brasalandCart");
}

const fallbackProducts = [
  {
    id: 1,
    name: "Empanadas de Asado (2 pcs)",
    category: "entrantes",
    description: "Hand-cut prime ribeye, caramelized onions, and traditional spices in a crispy crust. Served with house chimichurri and ají casero.",
    price: 12.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 2,
    name: "Provolone al Horno",
    category: "entrantes",
    description: "Melted aged provolone cheese baked in a cast-iron skillet with oregano, roasted red peppers, and olive oil. Served with grilled sourdough.",
    price: 13.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 3,
    name: "Chorizo & Morcilla Board",
    category: "entrantes",
    description: "Artisanal chorizo and traditional blood sausage grilled over oak charcoal. Served with mini corn arepas and lime wedges.",
    price: 15,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 4,
    name: "Arepitas con Hogao & Queso",
    category: "entrantes",
    description: "Mini white corn cakes grilled over open flames, topped with traditional Colombian hogao sauce and melted fresh cheese.",
    price: 11,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 5,
    name: "Grilled Bone Marrow / Tuétano a la Brasa",
    category: "entrantes",
    description: "Roasted marrow bones sprinkled with sea salt, lemon zest, and fresh parsley. Served with grilled garlic crostini.",
    price: 14,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 6,
    name: "Classic Caesar a la Brasa",
    category: "ensaladas",
    description: "Lightly charred romaine heart lettuce, garlic-herb croutons, shaved Parmigiano-Reggiano, and house anchovy dressing.",
    price: 13.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 7,
    name: "Burrata & Charred Tomato",
    category: "ensaladas",
    description: "Creamy burrata paired with smoky wood-fired tomatoes, fresh basil, toasted pine nuts, and a balsamic reduction.",
    price: 15.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 8,
    name: "Arugula, Mango & Avocado",
    category: "ensaladas",
    description: "Fresh baby arugula, sweet Colombian mango slices, avocado, toasted almonds, and a passion fruit (maracuyá) vinaigrette.",
    price: 15,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 9,
    name: "Bife de Lomo / Filet Mignon (250g / 9oz)",
    category: "carnes",
    description: "Lean, exceptionally tender center-cut tenderloin with garlic herb butter.",
    price: 29,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 10,
    name: "Ojo de Bife / Ribeye (350g / 12oz)",
    category: "carnes",
    description: "Richly marbled cut offering maximum tenderness and deep, smoky flavor.",
    price: 32.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 11,
    name: "Bife de Chorizo / New York Strip (350g / 12oz)",
    category: "carnes",
    description: "Classic thick-cut sirloin with a rich outer cap of flavor.",
    price: 31,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 12,
    name: "Punta de Anca / Picanha (300g / 10oz)",
    category: "carnes",
    description: "Top sirloin cap, highly popular across the Americas, grilled hot with a crunchy sea salt crust.",
    price: 34,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 13,
    name: "Entraña / Skirt Steak (300g / 10oz)",
    category: "carnes",
    description: "Traditional Latin American favorite, intensely flavorful and juicy.",
    price: 28.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 14,
    name: "Tomahawk Steak (1kg / 35oz) — For Two / Para Compartir",
    category: "carnes",
    description: "On-the-bone long ribeye steak cooked on our open-flame grill. Served with garlic butter and signature sauces.",
    price: 49,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 15,
    name: "Costillas de Cerdo al BBQ / Pork Ribs",
    category: "carnes",
    description: "Full or half rack of tender pork ribs glazed with house-made guava-barbecue sauce.",
    price: 26,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 16,
    name: "The Smoky Brasa Burger",
    category: "hamburguesas",
    description: "200g beef patty, smoked cheddar, crispy bacon, caramelized onions, and chipotle mayo on a toasted brioche bun.",
    price: 18.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 17,
    name: "The Gaucho Burger",
    category: "hamburguesas",
    description: "200g beef patty, grilled provolone, roasted red pepper, arugula, and fresh house chimichurri.",
    price: 18,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 18,
    name: "The Colombian Criolla",
    category: "hamburguesas",
    description: "200g beef patty, melted costeño-style cheese, crushed plantain chips (patacón crumble), fried egg, and garlic hogao mayo.",
    price: 19,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 19,
    name: "Yuca Frita con Suero Costeño",
    category: "acompanamientos",
    description: "Crispy cassava fries served with authentic sour cream.",
    price: 7.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 20,
    name: "Patacones con Hogao",
    category: "acompanamientos",
    description: "Twice-fried green plantain disks topped with savory tomato-onion sauce.",
    price: 7,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 21,
    name: "Triple-Cooked Hand-Cut Fries",
    category: "acompanamientos",
    description: "Crispy skin-on potatoes with rosemary sea salt.",
    price: 6,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 22,
    name: "Charred Asparagus",
    category: "acompanamientos",
    description: "Fire-grilled with lemon zest and Maldon salt.",
    price: 8,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 23,
    name: "Maduro con Queso",
    category: "acompanamientos",
    description: "Sweet roasted ripe plantain topped with melted cheese.",
    price: 6.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 24,
    name: "Mashed Potatoes with Smoked Garlic",
    category: "acompanamientos",
    description: "Creamy Yukon Gold potatoes infused with roasted garlic.",
    price: 7,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 25,
    name: "Volcán de Arequipe / Dulce de Leche",
    category: "postres",
    description: "Warm molten lava cake filled with rich caramelized milk, served with vanilla bean ice cream.",
    price: 9,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 26,
    name: "Ostras de Piña a la Brasa",
    category: "postres",
    description: "Wood-fired pineapple rings glazed with rum and brown sugar, topped with coconut sorbet.",
    price: 9.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 27,
    name: "Tres Leches Cake",
    category: "postres",
    description: "Traditional sponge cake soaked in three milks, topped with toasted meringue and fresh berries.",
    price: 8.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 28,
    name: "Flan Tradicional de la Casa",
    category: "postres",
    description: "Classic vanilla custard served with extra arequipe and whipped cream.",
    price: 8,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 29,
    name: "Aguardiente Sour",
    category: "bebidas",
    description: "Colombian Aguardiente, lime juice, simple syrup, egg white, and Angostura bitters.",
    price: 11,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 30,
    name: "Smoked Old Fashioned",
    category: "bebidas",
    description: "Bourbon, Angostura bitters, sugar cube, infused with applewood smoke.",
    price: 12.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 31,
    name: "Charred Maracuyá Margarita",
    category: "bebidas",
    description: "Tequila, fire-roasted passion fruit juice, agave, and a chili-salt rim.",
    price: 12,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 32,
    name: "Red & White Sangria",
    category: "bebidas",
    description: "Wine, brandy, fresh tropical fruits, and cinnamon.",
    price: 10.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 33,
    name: "Local & Imported Beers",
    category: "bebidas",
    description: "Club Colombia, BBC, Craft IPAs, Bud Light, Stella Artois.",
    price: 7,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 34,
    name: "Natural Tropical Juices",
    category: "bebidas",
    description: "Lulo, Maracuyá, Mango, Guanábana served in water or milk.",
    price: 6,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 35,
    name: "Limonada de Coco",
    category: "bebidas",
    description: "Creamy coconut and fresh lime smoothie.",
    price: 5.5,
    currency: "EUR",
    locationId: "brasaland",
  },
  {
    id: 36,
    name: "Mineral Water (Still / Sparkling)",
    category: "bebidas",
    description: "Still or sparkling mineral water served ice-cold.",
    price: 3.5,
    currency: "EUR",
    locationId: "brasaland",
  },
];

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function saveCart() {
  localStorage.setItem("brasalandCart", JSON.stringify(cart));
}

function formatPrice(value, currency = selectedLocation?.currency || cart[0]?.currency || "EUR") {
  return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency }).format(value);
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
    throw new Error("Could not reach the project API. Start `npx vercel dev` from the project root and open its local URL.");
  }
  const raw = await response.text();
  let result = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { /* handled with status below */ }
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
  products = fallbackProducts
    .filter((item) => String(item.locationId) === String(location.id))
    .map((item) => ({ ...item, id: String(item.id), locationId: String(item.locationId), currency: item.currency || location.currency }));

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
  const savedLocationId = localStorage.getItem("brasalandLocationId") || selectedLocation.id;
  loadMenu(savedLocationId, cart.length > 0);
  setCatalogMessage("");
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
