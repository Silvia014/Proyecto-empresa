// ==========================================================
// main.js — comportamiento de la landing page (menú móvil, etc.)
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  setCurrentYear();
  setupScrollReveal();
});

function setupMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu-movil");
  const iconOpen = document.getElementById("icon-open");
  const iconClose = document.getElementById("icon-close");

  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.remove("hidden");
    menu.classList.add("flex");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú de navegación");
    iconOpen.classList.add("hidden");
    iconClose.classList.remove("hidden");
  }

  function closeMenu() {
    menu.classList.add("hidden");
    menu.classList.remove("flex");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    iconOpen.classList.remove("hidden");
    iconClose.classList.add("hidden");
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  // Cierra el menú al elegir un enlace, para no dejarlo abierto tapando la página
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Cierra con Escape, por accesibilidad de teclado
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      toggle.focus();
    }
  });
}

function setCurrentYear() {
  const el = document.getElementById("anio-actual");
  if (el) el.textContent = String(new Date().getFullYear());
}

function setupScrollReveal() {
  const elements = document.querySelectorAll(".fade-up");
  if (elements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.15 }
  );

  elements.forEach((el) => observer.observe(el));
}
