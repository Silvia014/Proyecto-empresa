// ==========================================================
// ORDER.JS — PEDIDO ONLINE BRASALAND
// ==========================================================


// ==========================================================
// PRODUCTOS DE EJEMPLO
// Más adelante podremos sustituir esto por Supabase.
// ==========================================================

const products = [
  {
    id: 1,
    name: "Provoleta Brasaland",
    description: "Queso provolone fundido, tomate seco y un toque de orégano.",
    category: "entrantes",
    price: 9.5
  },
  {
    id: 2,
    name: "Empanadas Argentinas",
    description: "Selección de empanadas artesanales recién horneadas.",
    category: "entrantes",
    price: 8.0
  },
  {
    id: 3,
    name: "Entraña a la Parrilla",
    description: "Entraña seleccionada a la brasa, acompañada de chimichurri.",
    category: "carnes",
    price: 24.0
  },
  {
    id: 4,
    name: "Bife de Chorizo",
    description: "Corte argentino premium preparado a la parrilla.",
    category: "carnes",
    price: 27.5
  },
  {
    id: 5,
    name: "Burger Brasaland",
    description: "Carne a la parrilla, queso, cebolla caramelizada y salsa especial.",
    category: "hamburguesas",
    price: 16.5
  },
  {
    id: 6,
    name: "Burger Clásica",
    description: "Carne de vacuno, queso, lechuga, tomate y nuestra salsa de la casa.",
    category: "hamburguesas",
    price: 14.5
  },
  {
    id: 7,
    name: "Patatas Bravas",
    description: "Patatas crujientes con salsa brava casera.",
    category: "acompanamientos",
    price: 5.5
  },
  {
    id: 8,
    name: "Verduras a la Brasa",
    description: "Selección de verduras de temporada cocinadas a la parrilla.",
    category: "acompanamientos",
    price: 6.5
  },
  {
    id: 9,
    name: "Brownie",
    description: "Brownie de chocolate servido templado.",
    category: "postres",
    price: 6.5
  },
  {
    id: 10,
    name: "Tarta de Queso",
    description: "Tarta cremosa de queso con base crujiente.",
    category: "postres",
    price: 7.0
  },
  {
    id: 11,
    name: "Coca-Cola",
    description: "Refresco frío.",
    category: "bebidas",
    price: 3.0
  },
  {
    id: 12,
    name: "Agua Mineral",
    description: "Agua mineral natural.",
    category: "bebidas",
    price: 2.5
  }
];


// ==========================================================
// ESTADO
// ==========================================================

let selectedCategory = "all";

let cart = [];


// ==========================================================
// ELEMENTOS DEL DOM
// ==========================================================

const productsContainer =
  document.getElementById("products-container");

const categoryButtons =
  document.querySelectorAll(".category-button");

const cartItems =
  document.getElementById("cart-items");

const emptyCart =
  document.getElementById("empty-cart");

const cartSummary =
  document.getElementById("cart-summary");

const cartCount =
  document.getElementById("cart-count");

const headerCartCount =
  document.getElementById("header-cart-count");

const cartSubtotal =
  document.getElementById("cart-subtotal");

const cartTotal =
  document.getElementById("cart-total");

const checkoutButton =
  document.getElementById("checkout-button");


// ==========================================================
// FORMATO DE PRECIO
// ==========================================================

function formatPrice(price) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(price);
}


function getCurrentLanguage() {
  return document.documentElement.lang || "es";
}


function getOrderTranslation(key, fallback) {

  const value =
    key
      .split(".")
      .reduce(
        (currentValue, currentKey) =>
          currentValue?.[currentKey],
        translations[getCurrentLanguage()]?.order
      );

  return value ?? fallback;

}


function getProductCopy(product) {

  const translatedProduct =
    translations[getCurrentLanguage()]?.order?.products?.[product.id];

  return {
    name:
      translatedProduct?.name || product.name,
    description:
      translatedProduct?.description || product.description
  };

}


// ==========================================================
// RENDERIZAR PRODUCTOS
// ==========================================================

function renderProducts() {

  if (!productsContainer) return;


  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter(
          (product) =>
            product.category === selectedCategory
        );


  productsContainer.innerHTML =
    filteredProducts
      .map(
        (product) => {

          const productCopy =
            getProductCopy(product);

          return `
          <article
            class="product-card"
          >

            <span class="product-category">
              ${formatCategory(product.category)}
            </span>


            <h3 class="product-name">
              ${productCopy.name}
            </h3>


            <p class="product-description">
              ${productCopy.description}
            </p>


            <div class="product-footer">

              <span class="product-price">
                ${formatPrice(product.price)}
              </span>


              <button
                class="add-product-button"
                type="button"
                data-product-id="${product.id}"
              >
                ${getOrderTranslation("add", "+ Añadir")}
              </button>

            </div>

          </article>
        `;

        }
      )
      .join("");


  const addButtons =
    document.querySelectorAll(
      ".add-product-button"
    );


  addButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const productId =
            Number(
              button.dataset.productId
            );

          addToCart(productId);

        }
      );

    }
  );

}


// ==========================================================
// FORMATEAR CATEGORÍA
// ==========================================================

function formatCategory(category) {

  return getOrderTranslation(
    `categories.${category}`,
    category
  );

}


// ==========================================================
// AÑADIR AL CARRITO
// ==========================================================

function addToCart(productId) {

  const existingProduct =
    cart.find(
      (item) =>
        item.id === productId
    );


  if (existingProduct) {

    existingProduct.quantity += 1;

  } else {

    const product =
      products.find(
        (item) =>
          item.id === productId
      );


    if (!product) return;


    cart.push({
      ...product,
      quantity: 1
    });

  }


  renderCart();

}


// ==========================================================
// CAMBIAR CANTIDAD
// ==========================================================

function changeQuantity(
  productId,
  change
) {

  const product =
    cart.find(
      (item) =>
        item.id === productId
    );


  if (!product) return;


  product.quantity += change;


  if (product.quantity <= 0) {

    removeFromCart(productId);

    return;

  }


  renderCart();

}


// ==========================================================
// ELIMINAR DEL CARRITO
// ==========================================================

function removeFromCart(productId) {

  cart =
    cart.filter(
      (item) =>
        item.id !== productId
    );


  renderCart();

}


// ==========================================================
// CALCULAR TOTAL DE PRODUCTOS
// ==========================================================

function getTotalItems() {

  return cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

}


// ==========================================================
// CALCULAR PRECIO TOTAL
// ==========================================================

function getTotalPrice() {

  return cart.reduce(
    (total, item) =>
      total +
      item.price *
      item.quantity,
    0
  );

}


// ==========================================================
// RENDERIZAR CARRITO
// ==========================================================

function renderCart() {

  if (
    !cartItems ||
    !emptyCart ||
    !cartSummary
  ) {
    return;
  }


  const totalItems =
    getTotalItems();

  const totalPrice =
    getTotalPrice();


  // CONTADORES

  if (cartCount) {

    cartCount.textContent =
      totalItems;

  }


  if (headerCartCount) {

    headerCartCount.textContent =
      `${totalItems} ${
        totalItems === 1
          ? getOrderTranslation(
              "cart.product",
              "producto"
            )
          : getOrderTranslation(
              "cart.products",
              "productos"
            )
      }`;

  }


  // CARRITO VACÍO

  if (cart.length === 0) {

    emptyCart.classList.remove(
      "hidden"
    );

    cartItems.classList.add(
      "hidden"
    );

    cartSummary.classList.add(
      "hidden"
    );

    cartItems.innerHTML = "";

    return;

  }


  // MOSTRAR CARRITO

  emptyCart.classList.add(
    "hidden"
  );

  cartItems.classList.remove(
    "hidden"
  );

  cartSummary.classList.remove(
    "hidden"
  );


  // PRODUCTOS

  cartItems.innerHTML =
    cart
      .map(
        (item) => {

          const productCopy =
            getProductCopy(item);

          return `
          <article
            class="cart-item"
          >

            <div class="cart-item-header">

              <div>

                <h3 class="cart-item-name">
                  ${productCopy.name}
                </h3>

                <p class="cart-item-unit-price">
                  ${formatPrice(item.price)}
                  ·
                  ${item.quantity}
                  ${
                    item.quantity === 1
                      ? getOrderTranslation("unit", "unidad")
                      : getOrderTranslation("units", "unidades")
                  }
                </p>

              </div>


              <span class="cart-item-price">

                ${formatPrice(
                  item.price *
                  item.quantity
                )}

              </span>

            </div>


            <div class="cart-item-controls">


              <button
                class="remove-product-button"
                type="button"
                data-remove-id="${item.id}"
              >
                Eliminar
              </button>


              <div
                class="quantity-controls"
              >

                <button
                  class="quantity-button"
                  type="button"
                  data-decrease-id="${item.id}"
                  aria-label="Quitar una unidad"
                >
                  −
                </button>


                <span
                  class="quantity-value"
                >
                  ${item.quantity}
                </span>


                <button
                  class="quantity-button plus"
                  type="button"
                  data-increase-id="${item.id}"
                  aria-label="Añadir una unidad"
                >
                  +
                </button>

              </div>

            </div>

          </article>
        `;

        }
      )
      .join("");


  // SUBTOTAL

  if (cartSubtotal) {

    cartSubtotal.textContent =
      formatPrice(totalPrice);

  }


  // TOTAL

  if (cartTotal) {

    cartTotal.textContent =
      formatPrice(totalPrice);

  }


  // EVENTOS ELIMINAR

  document
    .querySelectorAll(
      "[data-remove-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            removeFromCart(
              Number(
                button.dataset.removeId
              )
            );

          }
        );

      }
    );


  // EVENTOS RESTAR

  document
    .querySelectorAll(
      "[data-decrease-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            changeQuantity(
              Number(
                button.dataset.decreaseId
              ),
              -1
            );

          }
        );

      }
    );


  // EVENTOS SUMAR

  document
    .querySelectorAll(
      "[data-increase-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            changeQuantity(
              Number(
                button.dataset.increaseId
              ),
              1
            );

          }
        );

      }
    );

}


// ==========================================================
// FILTROS POR CATEGORÍA
// ==========================================================

categoryButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        categoryButtons.forEach(
          (item) =>
            item.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        selectedCategory =
          button.dataset.category;


        renderProducts();

      }
    );

  }
);


// ==========================================================
// CHECKOUT
// ==========================================================

if (checkoutButton) {

  checkoutButton.addEventListener(
    "click",
    () => {

      if (cart.length === 0) {

        alert(
          getOrderTranslation(
            "emptyAlert",
            "Añade al menos un producto antes de continuar."
          )
        );

        return;

      }


      /*
       * Aquí conectaremos posteriormente:
       *
       * - Supabase
       * - creación del pedido
       * - Stripe Checkout
       * - página de confirmación
       */

      console.log(
        "Pedido preparado:",
        cart
      );


      alert(
        getOrderTranslation(
          "readyAlert",
          "Tu pedido está listo para continuar al pago."
        )
      );

    }
  );

}


// ==========================================================
// INICIALIZACIÓN
// ==========================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderProducts();

    renderCart();

  }
);


document.addEventListener(
  "languagechange",
  () => {

    renderProducts();

    renderCart();

  }
);