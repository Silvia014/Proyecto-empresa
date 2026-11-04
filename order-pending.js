const pendingPanel = document.getElementById("pending-order");
const missingPanel = document.getElementById("missing-order");
let savedOrder = null;
const english = localStorage.getItem("language") === "en";
const setCopy = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };

setCopy("pending-eyebrow", english ? "BRASALAND ONLINE ORDER" : "PEDIDO ONLINE BRASALAND");
setCopy("pending-state", english ? "ORDER RECEIVED · PAYMENT PENDING" : "PEDIDO RECIBIDO · PAGO PENDIENTE");
setCopy("pending-title", english ? "Order successfully sent" : "¡Pedido recibido!");
setCopy("pending-payment-copy", english ? "Your order has been sent. Select one payment option below." : "Hemos enviado tu pedido. Elige una de las opciones de pago.");
setCopy("payment-preference-title", english ? "How would you like to pay?" : "¿Cómo quieres pagar?");
setCopy("pay-cash-label", english ? "Pay with cash" : "Pagar en efectivo");
setCopy("pay-cash-description", english ? "Pay in cash when your order arrives." : "Paga en efectivo cuando llegue tu pedido.");
setCopy("pay-cash-action", english ? "Choose cash" : "Elegir efectivo");
setCopy("pay-link-label", english ? "Pay by card" : "Pagar con tarjeta");
setCopy("pay-link-description", english ? "We’ll email you a payment link to complete and confirm your order." : "Te enviaremos un enlace de pago por email para completar y confirmar tu pedido.");
setCopy("pay-link-action", english ? "Choose card" : "Elegir tarjeta");
setCopy("pending-menu-link", english ? "Back to menu" : "Volver al menú");
setCopy("missing-title", english ? "Order details unavailable" : "No encontramos los datos del pedido");
setCopy("missing-copy", english ? "Return to the menu to place an order." : "Vuelve al menú para realizar un pedido.");
setCopy("missing-menu-link", english ? "Back to menu" : "Volver al menú");

try {
  const saved = JSON.parse(sessionStorage.getItem("brasalandPendingOrder") || "null");
  savedOrder = saved;
  if (!saved?.orderId || saved.paymentStatus !== "PENDING") {
    pendingPanel.classList.add("hidden");
    missingPanel.classList.remove("hidden");
  } else {
    document.getElementById("pending-greeting").textContent = english ? `Thank you, ${saved.customerName}. We have sent your order to the restaurant.` : `Gracias, ${saved.customerName}. Hemos enviado tu pedido al restaurante.`;
    document.getElementById("pending-order-id").textContent = `${english ? "Order reference" : "Referencia del pedido"}: ${saved.orderId}`;
    document.getElementById("pending-email").textContent = english ? `We will contact you at ${saved.customerEmail} after checking the order.` : `Te contactaremos en ${saved.customerEmail} después de comprobar el pedido.`;
    document.getElementById("pending-total").textContent = new Intl.NumberFormat(saved.currency === "COP" ? "es-CO" : "en-US", {
      style: "currency", currency: saved.currency || "USD",
    }).format(Number(saved.total));
    document.querySelectorAll("[data-payment-preference]").forEach((button) => {
      button.addEventListener("click", async () => {
        const feedback = document.getElementById("payment-preference-feedback");
        document.querySelectorAll("[data-payment-preference]").forEach((choice) => { choice.disabled = true; });
          feedback.textContent = english ? "Saving your choice…" : "Guardando tu elección…";
        try {
          const response = await fetch("/api/ordering", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ orderId: savedOrder.orderId, email: savedOrder.customerEmail, paymentPreference: button.dataset.paymentPreference }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Could not save your choice.");
          savedOrder.paymentPreference = result.paymentPreference;
          sessionStorage.setItem("brasalandPendingOrder", JSON.stringify(savedOrder));
          button.classList.add("is-selected");
          button.setAttribute("aria-pressed", "true");
          document.querySelectorAll("[data-payment-preference]").forEach((choice) => {
            if (choice !== button) {
              choice.classList.remove("is-selected");
              choice.setAttribute("aria-pressed", "false");
            }
          });
          feedback.textContent = button.dataset.paymentPreference === "CASH"
            ? (english ? "Cash selected. Your order is on its way." : "Pago en efectivo seleccionado. Tu pedido está en camino.")
            : (english ? `Card selected. The restaurant will send a payment link to ${savedOrder.customerEmail} so you can pay and confirm your order.` : `Pago con tarjeta seleccionado. El restaurante enviará un enlace de pago a ${savedOrder.customerEmail} para que puedas pagar y confirmar tu pedido.`);
        } catch (error) {
          feedback.textContent = english ? `${error.message} Please contact the restaurant to confirm your preference.` : `${error.message} Contacta con el restaurante para confirmar tu preferencia.`;
        } finally {
          document.querySelectorAll("[data-payment-preference]").forEach((choice) => { choice.disabled = false; });
        }
      });
    });
  }
} catch {
  pendingPanel.classList.add("hidden");
  missingPanel.classList.remove("hidden");
}
