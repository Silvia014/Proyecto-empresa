const session = JSON.parse(localStorage.getItem("brasaland_session") || "null");
const errorElement = document.getElementById("account-error");
const profileForm = document.getElementById("member-profile-form");
const dashboardProfileTitle = document.getElementById("dashboard-profile-title");
const logoutButton = document.getElementById("logout-button");

let dashboardMemberName = "";
let dashboardData = { reservations: [], orders: [] };

function isDashboardEnglish() {
  return localStorage.getItem("language") === "en";
}

function formatDashboardDate(dateValue) {
  const locale = isDashboardEnglish() ? "en-US" : "es-CO";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function formatReservationStatus(status) {
  const english = isDashboardEnglish();
  const normalized = String(status || "").toUpperCase();
  const map = {
    NEW: english ? "Awaiting confirmation" : "Pendiente de confirmación",
    PENDING: english ? "Pending" : "Pendiente",
    CONFIRMED: english ? "Confirmed" : "Confirmada",
    CANCELLED: english ? "Cancelled" : "Cancelada",
  };
  return map[normalized] || (english ? status || "Status" : status || "Estado");
}

function formatOrderStatus(status, paymentStatus) {
  const english = isDashboardEnglish();
  const normalized = String(status || "").toUpperCase();
  const paymentNormalized = String(paymentStatus || "").toUpperCase();
  const statusMap = {
    PENDING: english ? "Pending" : "Pendiente",
    PAID: english ? "Paid" : "Pagado",
    RECEIVED: english ? "Received" : "Recibido",
    PREPARING: english ? "Preparing" : "En preparación",
    COMPLETED: english ? "Completed" : "Completado",
    CANCELLED: english ? "Cancelled" : "Cancelado",
    NEW: english ? "Awaiting confirmation" : "Pendiente de confirmación",
    CONFIRMED: english ? "Confirmed" : "Confirmada",
  };
  const paymentMap = {
    PENDING: english ? "Payment pending" : "Pago pendiente",
    PAID: english ? "Paid" : "Pagado",
    REFUNDED: english ? "Refunded" : "Reembolsado",
  };
  const statusLabel = statusMap[normalized] || (english ? String(status || "Status") : String(status || "Estado"));
  const paymentLabel = paymentMap[paymentNormalized] || (english ? String(paymentStatus || "Payment") : String(paymentStatus || "Pago"));
  return `${statusLabel} · ${english ? "Payment:" : "Pago:"} ${paymentLabel}`;
}

function renderReservations(reservations) {
  const list = document.getElementById("reservations-list");
  if (!list) return;
  list.innerHTML = "";
  if (!reservations.length) {
    const empty = document.getElementById("reservations-empty");
    if (empty) empty.classList.remove("hidden");
    return;
  }
  const empty = document.getElementById("reservations-empty");
  if (empty) empty.classList.add("hidden");
  reservations.forEach((reservation) => {
    const card = document.createElement("article");
    card.className = "rounded-xl bg-cream p-4";
    const title = document.createElement("h3");
    title.className = "font-semibold text-wine";
    title.textContent = formatDashboardDate(`${reservation.reservation_date}T00:00:00`);
    const details = document.createElement("p");
    details.className = "mt-2 text-sm text-walnut/70";
    const partyCount = Number(reservation.party_size || 0);
    const peopleText = isDashboardEnglish()
      ? `${partyCount === 1 ? "person" : "people"}`
      : `${partyCount === 1 ? "persona" : "personas"}`;
    details.textContent = `${String(reservation.reservation_time || "").slice(0, 5)} · ${partyCount} ${peopleText} · ${reservation.city || ""}`;
    const status = document.createElement("p");
    status.className = "mt-2 text-xs font-semibold uppercase tracking-wide text-wine";
    status.textContent = formatReservationStatus(reservation.status);
    card.append(title, details, status);
    list.append(card);
  });
}

function renderOrders(orders) {
  const list = document.getElementById("orders-list");
  if (!list) return;
  list.innerHTML = "";
  if (!orders.length) {
    const empty = document.getElementById("orders-empty");
    if (empty) empty.classList.remove("hidden");
    return;
  }
  const empty = document.getElementById("orders-empty");
  if (empty) empty.classList.add("hidden");
  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = "rounded-xl bg-cream p-4";
    const title = document.createElement("h3");
    title.className = "font-semibold text-wine";
    const dateLabel = isDashboardEnglish() ? "Order" : "Pedido";
    title.textContent = `${dateLabel} · ${formatDashboardDate(order.createdAt)}`;
    const lines = document.createElement("p");
    lines.className = "mt-2 text-sm text-walnut/70";
    lines.textContent = (order.items || []).map((item) => `${item.quantity} × ${item.dishName}`).join(" · ");
    const money = new Intl.NumberFormat(order.currency === "COP" ? "es-CO" : "en-US", { style: "currency", currency: order.currency || "USD" }).format(Number(order.total) || 0);
    const status = document.createElement("p");
    status.className = "mt-2 text-xs font-semibold uppercase tracking-wide text-wine";
    status.textContent = `${money} · ${formatOrderStatus(order.status, order.paymentStatus)}`;
    card.append(title, lines, status);
    const existingFeedback = order.feedback;
    if (String(order.status).toUpperCase() === "COMPLETED" && String(order.paymentStatus).toUpperCase() === "PAID") {
      const form = document.createElement("form");
      form.className = "portal-review-form";
      form.dataset.orderId = order.id;
      const heading = document.createElement("h4");
      heading.className = "portal-review-title";
      heading.textContent = isDashboardEnglish() ? "How was the value for money?" : "¿Qué te pareció la relación calidad-precio?";
      const ratingLabel = document.createElement("label");
      ratingLabel.className = "portal-review-label";
      ratingLabel.textContent = isDashboardEnglish() ? "Rating" : "Valoración";
      const rating = document.createElement("select");
      rating.name = "rating";
      rating.required = true;
      rating.className = "portal-review-input";
      [
        [5, isDashboardEnglish() ? "Excellent" : "Excelente"],
        [4, isDashboardEnglish() ? "Good" : "Buena"],
        [3, isDashboardEnglish() ? "Fair" : "Normal"],
        [2, isDashboardEnglish() ? "Poor" : "Mala"],
        [1, isDashboardEnglish() ? "Very poor" : "Muy mala"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value} · ${label}`;
        rating.append(option);
      });
      if (existingFeedback?.value_for_money_rating) rating.value = String(existingFeedback.value_for_money_rating);
      ratingLabel.append(rating);
      const commentLabel = document.createElement("label");
      commentLabel.className = "portal-review-label";
      commentLabel.textContent = isDashboardEnglish() ? "Comment (optional)" : "Comentario (opcional)";
      const comment = document.createElement("textarea");
      comment.name = "comment";
      comment.rows = 3;
      comment.maxLength = 1000;
      comment.className = "portal-review-input";
      comment.value = existingFeedback?.comment || "";
      comment.placeholder = isDashboardEnglish() ? "Tell us about your experience" : "Cuéntanos cómo fue tu experiencia";
      commentLabel.append(comment);
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "portal-save";
      submit.textContent = existingFeedback
        ? (isDashboardEnglish() ? "Update feedback" : "Actualizar valoración")
        : (isDashboardEnglish() ? "Send feedback" : "Enviar valoración");
      const result = document.createElement("p");
      result.className = "portal-review-result";
      result.setAttribute("role", "status");
      form.append(heading, ratingLabel, commentLabel, submit, result);
      card.append(form);
    }
    list.append(card);
  });
}

function applyDashboardLanguage() {
  const english = localStorage.getItem("language") === "en";
  const selector = document.getElementById("language-selector");
  if (selector) {
    selector.value = localStorage.getItem("language") || "es";
  }

  const copy = english ? {
    profileTitle: "My profile",
    logout: "Log out",
    welcome: "Welcome back…",
    balanceLabel: "Your Brasapoints",
    balanceHint: "Points are added when you complete eligible orders.",
    accountLabel: "Account",
    profileEyebrow: "YOUR PROFILE",
    profileSectionTitle: "Your details",
    nameLabel: "Name",
    emailLabel: "Email",
    phoneLabel: "Phone",
    preferencesLabel: "Preferences and allergies",
    saveButton: "Save changes",
    passwordEyebrow: "ACCOUNT SECURITY",
    passwordTitle: "Change password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordSave: "Update password",
    deleteEyebrow: "ACCOUNT DELETION",
    deleteTitle: "Delete my account",
    deleteCopy: "Your sign-in will be removed and personal profile data anonymized. Orders will be retained for accounting; delivery addresses and personal notes will be removed. Active orders and upcoming reservations must be completed or cancelled first.",
    deleteConfirmLabel: "Type DELETE to confirm",
    deleteButton: "Delete my account",
    historyEyebrow: "HISTORY",
    reservationsTitle: "Your reservations",
    reserveButton: "Book a table",
    reservationsEmpty: "You do not have any reservations linked to this account yet.",
    ordersTitle: "Your online orders",
    orderButton: "Order online",
    ordersEmpty: "You do not have any online orders linked to this account yet.",
    branding: "BRASACLUB"
  } : {
    profileTitle: "Mi perfil",
    logout: "Cerrar sesión",
    welcome: "Bienvenido de nuevo…",
    balanceLabel: "Tus Brasapuntos",
    balanceHint: "Los puntos se suman cuando completas pedidos elegibles.",
    accountLabel: "Cuenta",
    profileEyebrow: "TU PERFIL",
    profileSectionTitle: "Tus datos",
    nameLabel: "Nombre",
    emailLabel: "Email",
    phoneLabel: "Teléfono",
    preferencesLabel: "Preferencias y alergias",
    saveButton: "Guardar cambios",
    passwordEyebrow: "SEGURIDAD DE LA CUENTA",
    passwordTitle: "Cambiar contraseña",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    passwordSave: "Actualizar contraseña",
    deleteEyebrow: "ELIMINACIÓN DE CUENTA",
    deleteTitle: "Eliminar mi cuenta",
    deleteCopy: "Se eliminará tu acceso y se anonimizarán tus datos personales. Conservaremos pedidos para contabilidad; se borrarán direcciones y notas personales. Los pedidos activos y las reservas futuras deben resolverse antes.",
    deleteConfirmLabel: "Escribe DELETE para confirmar",
    deleteButton: "Eliminar mi cuenta",
    historyEyebrow: "HISTORIAL",
    reservationsTitle: "Tus reservas",
    reserveButton: "Reservar mesa",
    reservationsEmpty: "Todavía no tienes reservas asociadas a esta cuenta.",
    ordersTitle: "Tus pedidos online",
    orderButton: "Pedir online",
    ordersEmpty: "Todavía no tienes pedidos online asociados a esta cuenta.",
    branding: "BRASACLUB"
  };

  if (dashboardProfileTitle) {
    dashboardProfileTitle.textContent = copy.profileTitle;
  }

  if (logoutButton) {
    logoutButton.textContent = copy.logout;
  }

  const welcome = document.getElementById("account-welcome");
  if (welcome) {
    welcome.textContent = dashboardMemberName
      ? english
        ? `Welcome back, @${dashboardMemberName}.`
        : `¡Bienvenido de nuevo, @${dashboardMemberName}!`
      : copy.welcome;
  }

  const branding = document.getElementById("dashboard-branding");
  if (branding) branding.textContent = copy.branding;
  const balanceLabel = document.getElementById("dashboard-balance-label");
  if (balanceLabel) balanceLabel.textContent = copy.balanceLabel;
  const balanceHint = document.getElementById("dashboard-balance-hint");
  if (balanceHint) balanceHint.textContent = copy.balanceHint;
  const accountLabel = document.getElementById("dashboard-account-label");
  if (accountLabel) accountLabel.textContent = copy.accountLabel;
  const profileEyebrow = document.getElementById("dashboard-profile-eyebrow");
  if (profileEyebrow) profileEyebrow.textContent = copy.profileEyebrow;
  const profileSectionTitle = document.getElementById("dashboard-profile-section-title");
  if (profileSectionTitle) profileSectionTitle.textContent = copy.profileSectionTitle;
  const nameLabel = document.getElementById("member-name-label");
  if (nameLabel) nameLabel.childNodes[0].textContent = copy.nameLabel;
  const emailLabel = document.getElementById("member-email-label");
  if (emailLabel) emailLabel.childNodes[0].textContent = copy.emailLabel;
  const phoneLabel = document.getElementById("member-phone-label");
  if (phoneLabel) phoneLabel.childNodes[0].textContent = copy.phoneLabel;
  const preferencesLabel = document.getElementById("member-preferences-label");
  if (preferencesLabel) preferencesLabel.childNodes[0].textContent = copy.preferencesLabel;
  const saveButton = document.getElementById("member-profile-save");
  if (saveButton) saveButton.textContent = copy.saveButton;
  const passwordEyebrow = document.getElementById("password-eyebrow");
  if (passwordEyebrow) passwordEyebrow.textContent = copy.passwordEyebrow;
  const passwordTitle = document.getElementById("password-title");
  if (passwordTitle) passwordTitle.textContent = copy.passwordTitle;
  const passwordLabels = document.querySelectorAll("#password-change-form label");
  if (passwordLabels[0]) passwordLabels[0].childNodes[0].textContent = copy.newPassword;
  if (passwordLabels[1]) passwordLabels[1].childNodes[0].textContent = copy.confirmPassword;
  const passwordSave = document.getElementById("password-save");
  if (passwordSave) passwordSave.textContent = copy.passwordSave;
  const deleteEyebrow = document.getElementById("delete-account-eyebrow");
  if (deleteEyebrow) deleteEyebrow.textContent = copy.deleteEyebrow;
  const deleteTitle = document.getElementById("delete-account-title");
  if (deleteTitle) deleteTitle.textContent = copy.deleteTitle;
  const deleteCopy = document.getElementById("delete-account-copy");
  if (deleteCopy) deleteCopy.textContent = copy.deleteCopy;
  const deleteLabel = document.getElementById("delete-account-confirm-label");
  if (deleteLabel) deleteLabel.childNodes[0].textContent = copy.deleteConfirmLabel;
  const deleteButton = document.getElementById("delete-account-button");
  if (deleteButton) deleteButton.textContent = copy.deleteButton;
  const historyEyebrow = document.getElementById("dashboard-history-eyebrow");
  if (historyEyebrow) historyEyebrow.textContent = copy.historyEyebrow;
  const reservationsTitle = document.getElementById("dashboard-reservations-title");
  if (reservationsTitle) reservationsTitle.textContent = copy.reservationsTitle;
  const reservationsButton = document.getElementById("dashboard-reservations-button");
  if (reservationsButton) reservationsButton.textContent = copy.reserveButton;
  const reservationsEmpty = document.getElementById("reservations-empty");
  if (reservationsEmpty) reservationsEmpty.textContent = copy.reservationsEmpty;
  const ordersEyebrow = document.getElementById("dashboard-orders-eyebrow");
  if (ordersEyebrow) ordersEyebrow.textContent = copy.historyEyebrow;
  const ordersTitle = document.getElementById("dashboard-orders-title");
  if (ordersTitle) ordersTitle.textContent = copy.ordersTitle;
  const ordersButton = document.getElementById("dashboard-orders-button");
  if (ordersButton) ordersButton.textContent = copy.orderButton;
  const ordersEmpty = document.getElementById("orders-empty");
  if (ordersEmpty) ordersEmpty.textContent = copy.ordersEmpty;

  if (dashboardData.reservations?.length || dashboardData.orders?.length) {
    renderReservations(dashboardData.reservations || []);
    renderOrders(dashboardData.orders || []);
  }

  document.title = english ? "My profile | Brasaland" : "Mi perfil | Brasaland";
}

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("brasaland_session");
  window.location.href = "account.html";
});

function showError(message) {
  errorElement.textContent = message;
  errorElement.classList.remove("hidden");
}


async function loadAccount() {
  if (!session?.access_token) {
    window.location.replace("account.html");
    return;
  }
  try {
    const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
    const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No pudimos cargar tu cuenta.");
    dashboardMemberName = result.member.name || "";
    dashboardData = {
      reservations: result.reservations || [],
      orders: result.orders || [],
    };
    const english = localStorage.getItem("language") === "en";
    document.getElementById("account-welcome").textContent = english ? `Welcome back, @${result.member.name}.` : `¡Bienvenido de nuevo, @${result.member.name}!`;
    document.getElementById("member-name").textContent = result.member.name;
    document.getElementById("member-email").textContent = result.member.email;
    document.getElementById("member-name-input").value = result.member.name || "";
    document.getElementById("member-email-input").value = result.member.email || "";
    document.getElementById("member-phone-input").value = result.member.phone || "";
    document.getElementById("member-preferences-input").value = result.member.preferences || "";
    document.getElementById("brasapoints-balance").textContent = String(result.member.brasapoints);
    renderReservations(dashboardData.reservations);
    renderOrders(dashboardData.orders);
  } catch (error) {
    showError(error.message);
  }
}

document.addEventListener("languagechange", applyDashboardLanguage);
applyDashboardLanguage();
loadAccount();

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("member-profile-save");
  const feedback = document.getElementById("profile-feedback");
  button.disabled = true;
  feedback.classList.add("hidden");
  try {
    const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        action: "update-profile",
        name: document.getElementById("member-name-input").value.trim(),
        email: document.getElementById("member-email-input").value.trim(),
        phone: document.getElementById("member-phone-input").value.trim(),
        preferences: document.getElementById("member-preferences-input").value.trim(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No pudimos guardar tus datos.");
    feedback.textContent = localStorage.getItem("language") === "en" ? "Your profile was saved." : "Tus datos se guardaron correctamente.";
    feedback.classList.remove("hidden", "text-red-700");
    feedback.classList.add("text-green-800");
    await loadAccount();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove("hidden", "text-green-800");
    feedback.classList.add("text-red-700");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("password-change-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = document.getElementById("new-password").value;
  const confirmation = document.getElementById("confirm-new-password").value;
  const feedback = document.getElementById("password-feedback");
  const button = document.getElementById("password-save");
  feedback.classList.add("hidden");
  if (password.length < 8) {
    feedback.textContent = isDashboardEnglish() ? "Use at least 8 characters." : "Usa al menos 8 caracteres.";
    feedback.classList.remove("hidden");
    return;
  }
  if (password !== confirmation) {
    feedback.textContent = isDashboardEnglish() ? "The passwords do not match." : "Las contraseñas no coinciden.";
    feedback.classList.remove("hidden");
    return;
  }
  button.disabled = true;
  try {
    const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "change-password", newPassword: password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || (isDashboardEnglish() ? "The password could not be changed." : "No se pudo cambiar la contraseña."));
    feedback.textContent = isDashboardEnglish() ? "Your password has been changed." : "Tu contraseña se ha cambiado.";
    feedback.classList.remove("hidden", "text-red-700");
    feedback.classList.add("text-green-800");
    form.reset();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove("hidden", "text-green-800");
    feedback.classList.add("text-red-700");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("delete-account-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const confirmation = document.getElementById("delete-account-confirmation").value.trim();
  const feedback = document.getElementById("delete-account-feedback");
  const button = document.getElementById("delete-account-button");
  if (confirmation !== "DELETE") {
    feedback.textContent = isDashboardEnglish() ? "Type DELETE exactly to continue." : "Escribe DELETE exactamente para continuar.";
    feedback.classList.remove("hidden", "text-green-800");
    feedback.classList.add("text-red-700");
    return;
  }
  button.disabled = true;
  feedback.classList.add("hidden");
  try {
    const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "delete-account", confirmation }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || (isDashboardEnglish() ? "Your account could not be deleted." : "No se pudo eliminar la cuenta."));
    localStorage.removeItem("brasaland_session");
    window.location.replace("index.html?account=deleted");
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove("hidden", "text-green-800");
    feedback.classList.add("text-red-700");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("orders-list")?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".portal-review-form");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  const result = form.querySelector(".portal-review-result");
  button.disabled = true;
  result.textContent = "";
  try {
    const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        action: "submit-feedback",
        orderId: form.dataset.orderId,
        rating: Number(form.elements.rating.value),
        comment: form.elements.comment.value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No pudimos guardar tu valoración.");
    result.textContent = isDashboardEnglish() ? "Thank you. Your feedback was saved." : "Gracias. Tu valoración se ha guardado.";
    await loadAccount();
  } catch (error) {
    result.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
