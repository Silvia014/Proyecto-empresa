const pendingPanel = document.getElementById("pending-order");
const missingPanel = document.getElementById("missing-order");
let savedOrder = null;

try {
  const saved = JSON.parse(sessionStorage.getItem("brasalandPendingOrder") || "null");
  savedOrder = saved;
  if (!saved?.orderId || saved.paymentStatus !== "PENDING") {
    pendingPanel.classList.add("hidden");
    missingPanel.classList.remove("hidden");
  } else {
    document.getElementById("pending-greeting").textContent = `Thank you, ${saved.customerName}. The restaurant received your order.`;
    document.getElementById("pending-order-id").textContent = `Order reference: ${saved.orderId}`;
    document.getElementById("pending-email").textContent = `The payment link will be sent to ${saved.customerEmail} after the restaurant confirms availability.`;
    document.getElementById("pending-total").textContent = new Intl.NumberFormat(saved.currency === "COP" ? "es-CO" : "en-US", {
      style: "currency", currency: saved.currency || "USD",
    }).format(Number(saved.total));
    document.querySelectorAll("[data-payment-preference]").forEach((button) => {
      button.addEventListener("click", async () => {
        const feedback = document.getElementById("payment-preference-feedback");
        document.querySelectorAll("[data-payment-preference]").forEach((choice) => { choice.disabled = true; });
        feedback.textContent = "Saving your choice…";
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
          feedback.textContent = `Preference saved: ${button.textContent}. The restaurant still needs to confirm your order.`;
        } catch (error) {
          feedback.textContent = `${error.message} Please contact the restaurant to confirm your preference.`;
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
