(() => {
  let session;
  try { session = JSON.parse(localStorage.getItem("brasaland_session") || "null"); } catch { session = null; }
  if (!session?.access_token) return;

  const links = [document.getElementById("order-account-link"), document.getElementById("order-account-link-mobile")].filter(Boolean);
  let memberName = "";

  function updateLinks() {
    const english = localStorage.getItem("language") === "en";
    const text = english ? "My profile" : "Mi perfil";
    links.forEach((link) => {
      link.textContent = memberName ? `${text} · ${memberName}` : text;
    });
  }

  updateLinks();
  window.addEventListener("languagechange", updateLinks);

  const apiUrl = window.brasalandApiUrl ? window.brasalandApiUrl("/api/account") : "/api/account";
  fetch(apiUrl, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Account unavailable");
      memberName = payload.member.name || "";
      updateLinks();
    })
    .catch(() => {
      // Keep the account link available if profile data is temporarily offline.
    });
})();
