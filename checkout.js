// ==========================================
// GET CART FROM LOCAL STORAGE
// ==========================================

const cart = JSON.parse(
  localStorage.getItem("brasalandCart")
) || [];

const checkoutItems = document.getElementById("checkout-items");
const checkoutTotal = document.getElementById("checkout-total");


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
        <strong>${item.name}</strong>
        <span>Quantity: ${item.quantity}</span>
      </div>

      <strong>
        €${itemTotal.toFixed(2)}
      </strong>
    `;

    checkoutItems.appendChild(itemElement);

  });

  checkoutTotal.textContent =
    `€${total.toFixed(2)}`;
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

const addressInput =
  document.getElementById("address");

orderTypeInputs.forEach((input) => {

  input.addEventListener("change", () => {

    if (input.value === "delivery" && input.checked) {

      deliveryAddress.classList.remove("hidden");

      addressInput.required = true;

    } else if (input.value === "pickup" && input.checked) {

      deliveryAddress.classList.add("hidden");

      addressInput.required = false;

      addressInput.value = "";

    }

  });

});


// ==========================================
// CONFIRM ORDER
// ==========================================

const checkoutForm =
  document.getElementById("checkout-form");

checkoutForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    const orderType =
      document.querySelector(
        'input[name="order-type"]:checked'
      ).value;

    const order = {
      customer: {
        name:
          document
            .getElementById("customer-name")
            .value
            .trim(),

        email:
          document
            .getElementById("customer-email")
            .value
            .trim(),

        phone:
          document
            .getElementById("customer-phone")
            .value
            .trim(),
      },

      orderType,

      address:
        orderType === "delivery"
          ? addressInput.value.trim()
          : null,

      notes:
        document
          .getElementById("order-notes")
          .value
          .trim(),

      items: cart,

      total: cart.reduce(
        (sum, item) =>
          sum + item.price * item.quantity,
        0
      ),
    };

    console.log("Order ready:", order);

    // Simulate sending the order
    await new Promise(
      (resolve) => setTimeout(resolve, 500)
    );

    // Clear the cart
    localStorage.removeItem("brasalandCart");

    // Show success message
    document.querySelector(".checkout-container").innerHTML = `
      <div class="order-success">

        <h1>🎉 Order received!</h1>

        <p>
          Thank you, ${order.customer.name}.
          We have received your order.
        </p>

        <p>
          Total: <strong>€${order.total.toFixed(2)}</strong>
        </p>

        <p>
          We will contact you if necessary.
        </p>

        <a href="order.html" class="checkout-button">
          Back to menu
        </a>

      </div>
    `;

  }
);


// ==========================================
// INITIALIZE
// ==========================================

renderCheckout();