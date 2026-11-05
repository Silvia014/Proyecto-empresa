(() => {
  let session;
  try { session = JSON.parse(localStorage.getItem("brasaland_session") || "null"); } catch { session = null; }
  if (!session?.access_token) return;
  const links = [document.getElementById("reservation-account-link"), document.getElementById("reservation-account-link-mobile")].filter(Boolean);
  let memberName = "";

  function updateLinks() {
    const english = localStorage.getItem("language") === "en";
    const text = english ? "My profile" : "Mi perfil";
    links.forEach((link) => { link.textContent = memberName ? `${text} · ${memberName}` : text; });
  }

  updateLinks();
  window.addEventListener("languagechange", updateLinks);

  const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
  fetch(apiUrl, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account unavailable");
      memberName = result.member.name || "";
      updateLinks();
      const [firstName, ...lastName] = String(result.member.name || "").split(/\s+/);
      const first = document.getElementById("nombre");
      const last = document.getElementById("apellidos");
      const email = document.getElementById("email");
      const phone = document.getElementById("telefono");
      if (first && !first.value) first.value = firstName || "";
      if (last && !last.value) last.value = lastName.join(" ");
      if (email && !email.value) email.value = result.member.email || "";
      if (phone && !phone.value) phone.value = result.member.phone || "";
    })
    .catch(() => {});
})();
