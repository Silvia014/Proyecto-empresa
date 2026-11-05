const authView = document.getElementById("account-auth-view");
const portal = document.getElementById("account-portal");
const registerView = document.getElementById("register-view");
const loginView = document.getElementById("login-view");
const portalError = document.getElementById("portal-error");
const portalFeedback = document.getElementById("portal-feedback");
const isEnglish = () => document.documentElement.lang === "en";
const copy = (spanish, english) => isEnglish() ? english : spanish;

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("brasaland_session") || "null");
  } catch {
    localStorage.removeItem("brasaland_session");
    return null;
  }
}

function showPortalError(message) {
  portalError.textContent = message;
  portalError.classList.remove("hidden");
}

function showPortalFeedback(message) {
  portalFeedback.textContent = message;
  portalFeedback.classList.remove("hidden");
  window.setTimeout(() => portalFeedback.classList.add("hidden"), 3500);
}

function setPortalView() {
  authView.classList.add("hidden");
  portal.classList.remove("hidden");
  document.getElementById("account-logout")?.classList.remove("hidden");
  document.getElementById("account-logout-mobile")?.classList.remove("hidden");
}

async function accountRequest(payload, session) {
  const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
  const response = await fetch(apiUrl, {
    method: payload ? "POST" : "GET",
    headers: {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
  });
  const text = await response.text();
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch { /* provide a readable server error below */ }
  if (!response.ok) {
    const error = new Error(result?.error || copy("No pudimos conectar con tu cuenta. Inténtalo de nuevo.", "We could not connect to your account. Please try again."));
    error.status = response.status;
    throw error;
  }
  if (!result) throw new Error(copy("El servidor devolvió una respuesta vacía. Revisa la terminal de Vercel Dev.", "The server returned an empty response. Check the Vercel Dev terminal."));
  return result;
}

function showAuthMessage(message) {
  let feedback = document.getElementById("account-auth-feedback");
  if (!feedback) {
    feedback = document.createElement("p");
    feedback.id = "account-auth-feedback";
    feedback.className = "portal-error";
    feedback.setAttribute("role", "alert");
    authView.prepend(feedback);
  }
  feedback.textContent = message;
  feedback.classList.remove("hidden");
}

function showExistingAccount(email) {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
  document.getElementById("login-email").value = email;
  showAuthMessage(copy(
    "Ya existe una cuenta con este correo. Bienvenido de nuevo. Inicia sesión para acceder a tu Brasaclub.",
    "A user with this email address has already been registered. Welcome back. Sign in to access your Brasaclub."
  ));
}

function authErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials|invalid email or password|email not confirmed/i.test(message)) {
    return copy("El correo o la contraseña no son correctos. Comprueba tus datos e inténtalo de nuevo.", "The email or password is incorrect. Check your details and try again.");
  }
  return message;
}

function redirectToCheckoutIfRequested() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next === "checkout.html") {
    window.location.replace("checkout.html?member=1");
    return true;
  }
  if (window.location.pathname.endsWith("/account.html") || window.location.pathname === "account.html") {
    window.location.replace("account-dashboard.html");
    return true;
  }
  return false;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value == null || value === "" ? "—" : String(value);
}

function addRecord(parent, title, details, value, status) {
  const card = document.createElement("article");
  card.className = "portal-record";
  const content = document.createElement("div");
  const heading = document.createElement("p");
  heading.className = "portal-record-title";
  heading.textContent = title;
  const meta = document.createElement("p");
  meta.className = "portal-record-meta";
  meta.textContent = details;
  content.append(heading, meta);
  if (status) {
    const badge = document.createElement("span");
    badge.className = "portal-status";
    badge.textContent = status;
    content.append(badge);
  }
  card.append(content);
  if (value) {
    const amount = document.createElement("p");
    amount.className = "portal-record-value";
    amount.textContent = value;
    card.append(amount);
  }
  parent.append(card);
}

function emptyRecord(parent, message) {
  const element = document.createElement("p");
  element.className = "portal-empty";
  element.textContent = message;
  parent.append(element);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(isEnglish() ? "en-US" : "es-CO", { dateStyle: "medium" }).format(date);
}

function formatOrderStatus(order) {
  const status = String(order.paymentStatus || order.status || "").toUpperCase();
  const labels = {
    PENDING: copy("Pendiente de pago", "Payment pending"),
    PAID: copy("Pagado", "Paid"),
    RECEIVED: copy("Recibido", "Received"),
    PREPARING: copy("En preparación", "Preparing"),
    COMPLETED: copy("Completado", "Completed"),
    CANCELLED: copy("Cancelado", "Cancelled"),
    NEW: copy("Pendiente de confirmación", "Awaiting confirmation"),
    CONFIRMED: copy("Confirmada", "Confirmed"),
  };
  return labels[status] || status.toLowerCase().replaceAll("_", " ");
}

function renderPortal(data) {
  const member = data.member || {};
  const balance = Math.max(0, Number(member.brasapoints) || 0);
  const progress = Math.min(balance, 100);
  setText("portal-welcome", copy(`Qué gusto verte, ${member.name || ""}. Aquí tienes tu actividad Brasaclub.`, `Good to see you, ${member.name || ""}. Here is your Brasaclub activity.`));
  setText("portal-name", member.name);
  setText("portal-email", member.email);
  document.getElementById("portal-phone").value = member.phone || "";
  document.getElementById("portal-preferences").value = member.preferences || "";
  document.getElementById("portal-name").value = member.name || "";
  document.getElementById("portal-email").value = member.email || "";
  setText("portal-points", balance);
  const fill = document.getElementById("portal-progress-fill");
  fill.style.width = `${progress}%`;
  fill.parentElement.setAttribute("aria-valuenow", String(progress));
  setText("portal-progress-copy", balance >= 100
    ? copy("Ya alcanzaste 100 puntos. El canje se activará cuando el ERP conecte el descuento al checkout.", "You have reached 100 points. Redemption will activate when the ERP connects the discount to checkout.")
    : copy(`Te faltan ${100 - progress} puntos para desbloquear un 10% de descuento. La acumulación automática se activará al conectar las reglas del ERP; los pedidos pendientes no suman.`, `${100 - progress} points to go until you unlock 10% off. Automatic earning will start once the ERP rules are connected; pending orders do not count.`));

  renderOrders(data.orders || []);
  renderReservations(data.reservations || []);
  renderTransactions(member.transactions || []);
  renderSuggestions(data.orders || []);
}

function renderOrders(orders) {
  const list = document.getElementById("portal-orders");
  list.replaceChildren();
  if (!orders.length) {
    emptyRecord(list, copy("Aún no hay pedidos vinculados a tu cuenta. Cuando compres online con este correo, aparecerán aquí.", "No orders are linked to your account yet. Online orders placed with this email will appear here."));
    return;
  }
  orders.forEach((order) => {
    const lines = (order.items || []).map((item) => `${item.quantity} × ${item.dishName}`).join(" · ");
    const money = new Intl.NumberFormat(order.currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency: order.currency || "USD" }).format(Number(order.total) || 0);
    addRecord(list, `${copy("Pedido", "Order")} · ${formatDate(order.createdAt)}`, lines || copy("Detalles del pedido", "Order details"), money, formatOrderStatus(order));
  });
}

function renderReservations(reservations) {
  const list = document.getElementById("portal-reservations");
  list.replaceChildren();
  if (!reservations.length) {
    emptyRecord(list, copy("Aún no tienes reservas vinculadas a esta cuenta.", "No reservations are linked to your account yet."));
    return;
  }
  reservations.forEach((reservation) => {
    const time = String(reservation.reservation_time || "").slice(0, 5);
    const details = `${time} · ${reservation.party_size} ${copy("personas", "guests")} · ${reservation.city || ""}`;
    addRecord(list, formatDate(`${reservation.reservation_date}T00:00:00`), details, "", formatOrderStatus({ status: reservation.status }));
  });
}

function renderTransactions(transactions) {
  const list = document.getElementById("portal-transactions");
  list.replaceChildren();
  if (!transactions.length) {
    emptyRecord(list, copy("Todavía no hay movimientos de puntos. Los puntos se registrarán después de confirmar y completar un pedido elegible.", "There is no points activity yet. Points will be recorded after an eligible order is confirmed and completed."));
    return;
  }
  [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20).forEach((item) => {
    const earned = Number(item.points) >= 0;
    const title = item.description || (item.type === "REDEMPTION" ? copy("Canje Brasapuntos", "Brasapoints redemption") : copy("Puntos ganados", "Points earned"));
    addRecord(list, title, formatDate(item.createdAt), `${earned ? "+" : ""}${item.points} ${copy("puntos", "points")}`);
  });
}

function renderSuggestions(orders) {
  const list = document.getElementById("portal-recommendations");
  list.replaceChildren();
  const favorites = [...new Set(orders.flatMap((order) => (order.items || []).map((item) => item.dishName).filter(Boolean)))].slice(0, 3);
  if (!favorites.length) {
    emptyRecord(list, copy("Tus sugerencias aparecerán después de tu primer pedido online.", "Your suggestions will appear after your first online order."));
    return;
  }
  favorites.forEach((dish) => addRecord(list, dish, copy("Ya lo disfrutaste antes.", "You have enjoyed this before."), ""));
  const link = document.createElement("a");
  link.href = "order.html";
  link.className = "portal-text-link";
  link.textContent = copy("Explorar el menú", "Explore the menu");
  list.append(link);
}

async function loadPortal() {
  const session = readSession();
  if (!session?.access_token) {
    authView.classList.remove("hidden");
    portal.classList.add("hidden");
    return;
  }
  if (redirectToCheckoutIfRequested()) return;
  setPortalView();
  portalError.classList.add("hidden");
  try {
    const data = await accountRequest(null, session);
    renderPortal(data);
  } catch (error) {
    showPortalError(error.message);
    if (/401|Inicia sesión|sign in/i.test(error.message)) {
      localStorage.removeItem("brasaland_session");
      authView.classList.remove("hidden");
      portal.classList.add("hidden");
    }
  }
}

async function finishAuthentication(result) {
  if (!result.session?.access_token) throw new Error(copy("La sesión no se inició. Vuelve a iniciar sesión.", "No session was created. Please sign in again."));
  localStorage.setItem("brasaland_session", JSON.stringify(result.session));
  if (redirectToCheckoutIfRequested()) return;
  window.location.replace("account-dashboard.html");
}

document.getElementById("show-login")?.addEventListener("click", () => {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

document.getElementById("show-register")?.addEventListener("click", () => {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", copy(visible ? "Ocultar contraseña" : "Mostrar contraseña", visible ? "Hide password" : "Show password"));
    button.querySelector(".password-toggle-show")?.classList.toggle("hidden", visible);
    button.querySelector(".password-toggle-hide")?.classList.toggle("hidden", !visible);
  });
});

document.getElementById("register-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await accountRequest({
      action: "register",
      name: document.getElementById("register-name").value.trim(),
      email: document.getElementById("register-email").value.trim(),
      phone: document.getElementById("register-phone").value.trim(),
      password: document.getElementById("register-password").value,
    });
    await finishAuthentication(result);
  } catch (error) {
    if (/already registered|already been registered|user exists/i.test(error.message)) {
      showExistingAccount(document.getElementById("register-email").value.trim());
    } else showAuthMessage(authErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("login-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await accountRequest({
      action: "login",
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value,
    });
    await finishAuthentication(result);
  } catch (error) {
    showAuthMessage(authErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("forgot-password")?.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) return showAuthMessage(copy("Escribe tu correo primero.", "Enter your email address first."));
  try {
    await accountRequest({ action: "reset-password", email });
    showAuthMessage(copy("Te enviamos un correo para cambiar la contraseña.", "We sent you a password reset email."));
  } catch (error) {
    showAuthMessage(error.message);
  }
});

document.getElementById("portal-profile-form")?.addEventListener("input", (event) => {
  event.currentTarget.dataset.dirty = "true";
});

document.getElementById("portal-profile-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = readSession();
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await accountRequest({
      action: "update-profile",
      name: document.getElementById("portal-name").value,
      email: document.getElementById("portal-email").value,
      phone: document.getElementById("portal-phone").value,
      preferences: document.getElementById("portal-preferences").value,
    }, session);
    event.currentTarget.dataset.dirty = "false";
    showPortalFeedback(copy("Tus preferencias se guardaron.", "Your preferences have been saved."));
    await loadPortal();
  } catch (error) {
    showPortalError(error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("portal-refresh")?.addEventListener("click", () => void loadPortal());

function signOut() {
  localStorage.removeItem("brasaland_session");
  window.location.replace("account.html");
}
document.getElementById("account-logout")?.addEventListener("click", signOut);
document.getElementById("account-logout-mobile")?.addEventListener("click", signOut);

document.addEventListener("languagechange", () => {
  const session = readSession();
  const profileForm = document.getElementById("portal-profile-form");
  if (session?.access_token && !portal.classList.contains("hidden") && profileForm?.dataset.dirty !== "true") void loadPortal();
});

window.setInterval(() => {
  const profileForm = document.getElementById("portal-profile-form");
  if (document.visibilityState === "visible" && readSession()?.access_token && !portal.classList.contains("hidden") && profileForm?.dataset.dirty !== "true") {
    void loadPortal();
  }
}, 30_000);

async function initializeAccountRoute() {
  const initialSession = readSession();
  if (!initialSession?.access_token) return;
  try {
    const data = await accountRequest(null, initialSession);
    if (redirectToCheckoutIfRequested()) return;
    setPortalView();
    renderPortal(data);
  } catch (error) {
    if (error.status === 401 || error.status === 403) localStorage.removeItem("brasaland_session");
    authView.classList.remove("hidden");
    portal.classList.add("hidden");
    showAuthMessage(error.status === 401
      ? copy("Tu sesión ha caducado. Inicia sesión de nuevo.", "Your session has expired. Please sign in again.")
      : error.message);
  }
}

void initializeAccountRoute();
