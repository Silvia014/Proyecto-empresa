const session = JSON.parse(localStorage.getItem("brasaland_session") || "null");
const errorElement = document.getElementById("account-error");

document.getElementById("logout-button").addEventListener("click", () => {
  localStorage.removeItem("brasaland_session");
  window.location.href = "account.html";
});

function showError(message) {
  errorElement.textContent = message;
  errorElement.classList.remove("hidden");
}

function addReservation(reservation) {
  const card = document.createElement("article");
  card.className = "rounded-xl bg-cream p-4";
  const title = document.createElement("h3");
  title.className = "font-semibold text-wine";
  title.textContent = new Date(`${reservation.reservation_date}T00:00:00`).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const details = document.createElement("p");
  details.className = "mt-2 text-sm text-walnut/70";
  details.textContent = `${reservation.reservation_time.slice(0, 5)} · ${reservation.party_size} personas · ${reservation.city}`;
  const status = document.createElement("p");
  status.className = "mt-2 text-xs font-semibold uppercase tracking-wide text-wine";
  status.textContent = reservation.status === "NEW" ? "Pendiente de confirmación" : reservation.status;
  card.append(title, details, status);
  document.getElementById("reservations-list").append(card);
}

function addOrder(order) {
  const card = document.createElement("article");
  card.className = "rounded-xl bg-cream p-4";
  const title = document.createElement("h3");
  title.className = "font-semibold text-wine";
  title.textContent = `Pedido · ${new Date(order.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`;
  const lines = document.createElement("p");
  lines.className = "mt-2 text-sm text-walnut/70";
  lines.textContent = order.items.map((item) => `${item.quantity} × ${item.dishName}`).join(" · ");
  const money = new Intl.NumberFormat(order.currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency: order.currency }).format(order.total);
  const status = document.createElement("p");
  status.className = "mt-2 text-xs font-semibold uppercase tracking-wide text-wine";
  status.textContent = `${money} · ${order.status} · Pago: ${order.paymentStatus}`;
  card.append(title, lines, status);
  document.getElementById("orders-list").append(card);
}

async function loadAccount() {
  if (!session?.access_token) {
    window.location.replace("account.html");
    return;
  }
  try {
    const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No pudimos cargar tu cuenta.");
    document.getElementById("account-welcome").textContent = `Hola, ${result.member.name}. Aquí puedes consultar tu membresía, reservas y pedidos.`;
    document.getElementById("member-name").textContent = result.member.name;
    document.getElementById("member-email").textContent = result.member.email;
    document.getElementById("brasapoints-balance").textContent = String(result.member.brasapoints);
    if (!result.reservations.length) document.getElementById("reservations-empty").classList.remove("hidden");
    else result.reservations.forEach(addReservation);
    if (!result.orders.length) document.getElementById("orders-empty").classList.remove("hidden");
    else result.orders.forEach(addOrder);
  } catch (error) {
    showError(error.message);
  }
}

loadAccount();
