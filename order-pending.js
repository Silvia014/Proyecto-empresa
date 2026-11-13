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
setCopy("confirm-payment-preference", english ? "Send payment choice" : "Enviar forma de pago");
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
    document.getElementById("pending-greeting").textContent = english
      ? `Thank you, ${saved.customerName}. We received your order. The restaurant will contact you with an estimated arrival time.`
      : `Gracias, ${saved.customerName}. Hemos recibido tu pedido. El restaurante se pondrá en contacto contigo con una hora estimada de llegada.`;
    document.getElementById("pending-order-id").textContent = `${english ? "Order reference" : "Referencia del pedido"}: ${saved.orderId}`;
    document.getElementById("pending-email").textContent = saved.confirmationEmailSent === true
      ? (english ? `Order receipt emailed to ${saved.customerEmail}.` : `Enviamos el recibo del pedido a ${saved.customerEmail}.`)
      : saved.confirmationEmailSent === false
        ? (english ? `We could not email the receipt to ${saved.customerEmail}. Please contact the restaurant if you need a copy.` : `No pudimos enviar el recibo a ${saved.customerEmail}. Contacta con el restaurante si necesitas una copia.`)
        : (english ? `Order email status is unavailable. Please check ${saved.customerEmail}.` : `No pudimos comprobar el estado del email del pedido. Revisa ${saved.customerEmail}.`);
    document.getElementById("pending-total").textContent = new Intl.NumberFormat(saved.currency === "COP" ? "es-CO" : "en-US", {
      style: "currency", currency: saved.currency || "USD",
    }).format(Number(saved.total));
    const paymentChoices = [...document.querySelectorAll("[data-payment-preference]")];
    const confirmChoiceButton = document.getElementById("confirm-payment-preference");
    const feedback = document.getElementById("payment-preference-feedback");
    let selectedPreference = null;
    let preferenceLocked = Boolean(saved.paymentPreference);

    const lockPaymentChoice = (preference) => {
      selectedPreference = preference;
      preferenceLocked = true;
      paymentChoices.forEach((choice) => {
        choice.disabled = true;
        const isSelected = choice.dataset.paymentPreference === preference;
        choice.classList.toggle("is-selected", isSelected);
        choice.setAttribute("aria-pressed", String(isSelected));
      });
      confirmChoiceButton.disabled = true;
      confirmChoiceButton.classList.add("hidden");
    };

    if (saved.paymentPreference) {
      lockPaymentChoice(saved.paymentPreference);
      feedback.textContent = english
        ? "Your payment choice has already been sent to the restaurant."
        : "Tu forma de pago ya se ha enviado al restaurante.";
    } else if (saved.restaurantNotificationSent === false) {
      feedback.textContent = english
        ? "The order is saved, but the restaurant email could not be sent. Please contact the restaurant after choosing a payment method."
        : "El pedido está guardado, pero no pudimos enviar el email al restaurante. Contacta con el restaurante después de elegir la forma de pago.";
    }

    paymentChoices.forEach((button) => {
      button.addEventListener("click", () => {
        if (preferenceLocked) return;
        selectedPreference = button.dataset.paymentPreference;
        paymentChoices.forEach((choice) => {
          const isSelected = choice === button;
          choice.classList.toggle("is-selected", isSelected);
          choice.setAttribute("aria-pressed", String(isSelected));
        });
        confirmChoiceButton.disabled = false;
        feedback.textContent = english
          ? `Selected: ${button.dataset.paymentPreference === "CASH" ? "cash" : "card"}. Press “Send payment choice” to confirm; you cannot change it afterwards.`
          : `Has elegido ${button.dataset.paymentPreference === "CASH" ? "efectivo" : "tarjeta"}. Pulsa «Enviar forma de pago» para confirmar; después no podrás cambiarla.`;
      });
    });

    confirmChoiceButton.addEventListener("click", async () => {
      if (!selectedPreference || preferenceLocked) return;
      confirmChoiceButton.disabled = true;
      paymentChoices.forEach((choice) => { choice.disabled = true; });
      feedback.textContent = english ? "Sending your choice to the restaurant…" : "Enviando tu elección al restaurante…";
      try {
        const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/ordering") : "/api/ordering";
        const response = await fetch(apiUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ orderId: savedOrder.orderId, email: savedOrder.customerEmail, paymentPreference: selectedPreference }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || result.error || "Could not save your choice.");
        savedOrder.paymentPreference = result.paymentPreference;
        savedOrder.paymentPreferenceEmailSent = result.notificationEmailSent;
        sessionStorage.setItem("brasalandPendingOrder", JSON.stringify(savedOrder));
        lockPaymentChoice(result.paymentPreference);
        const chosenCash = result.paymentPreference === "CASH";
        feedback.textContent = result.notificationEmailSent === false
          ? (english
            ? "Your choice is saved, but we could not email the restaurant. Please call them to confirm it."
            : "Tu elección está guardada, pero no pudimos enviar el email al restaurante. Llámanos para confirmarla.")
          : (chosenCash
            ? (english ? "Cash selected and sent to the restaurant. Your order is awaiting restaurant confirmation." : "Pago en efectivo enviado al restaurante. Tu pedido está pendiente de confirmación.")
            : (english ? `Card selected and sent to the restaurant. The restaurant will email ${savedOrder.customerEmail} a payment link to complete and confirm the order.` : `Pago con tarjeta enviado al restaurante. El restaurante enviará un enlace de pago a ${savedOrder.customerEmail} para completar y confirmar el pedido.`));
      } catch (error) {
        paymentChoices.forEach((choice) => { choice.disabled = false; });
        confirmChoiceButton.disabled = !selectedPreference;
        feedback.textContent = english
          ? `${error.message} Your choice was not confirmed; you can retry.`
          : `${error.message} No se ha confirmado la elección; puedes volver a intentarlo.`;
      }
    });
  }
} catch {
  pendingPanel.classList.add("hidden");
  missingPanel.classList.remove("hidden");
}
