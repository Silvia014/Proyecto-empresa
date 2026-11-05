// ==========================================================
// main.js — comportamiento de la landing page (menú móvil, etc.)
// ==========================================================

function setupMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu-movil");
  const iconOpen = document.getElementById("icon-open");
  const iconClose = document.getElementById("icon-close");

  if (!toggle || !menu) return;

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Cerrar menú");
  backdrop.className = "mobile-menu-backdrop hidden";
  document.body.appendChild(backdrop);

  function openMenu() {
    menu.classList.remove("hidden");
    menu.classList.add("flex");
    backdrop.classList.remove("hidden");
    backdrop.classList.add("block");
    document.body.classList.add("overflow-hidden");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú de navegación");
    if (iconOpen) iconOpen.classList.add("hidden");
    if (iconClose) iconClose.classList.remove("hidden");
  }

  function closeMenu() {
    menu.classList.add("hidden");
    menu.classList.remove("flex");
    backdrop.classList.add("hidden");
    backdrop.classList.remove("block");
    document.body.classList.remove("overflow-hidden");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    if (iconOpen) iconOpen.classList.remove("hidden");
    if (iconClose) iconClose.classList.add("hidden");
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  // Cierra el menú al elegir un enlace, para no dejarlo abierto tapando la página
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  backdrop.addEventListener("click", closeMenu);

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

function setupCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const target = Number(el.dataset.target || 0);
        const suffix = el.dataset.suffix || "";
        const duration = Number(el.dataset.duration || 1400);
        const start = performance.now();

        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = Math.round(target * eased);

          el.textContent = `${value}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            el.textContent = `${target}${suffix}`;
          }
        };

        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((counter) => observer.observe(counter));
}

function setupFaqAccordion() {
  const items = document.querySelectorAll(".faq-item");
  if (!items.length) return;

  items.forEach((item) => {
    const button = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    if (!button || !answer) return;

    const setState = (isOpen) => {
      item.classList.toggle("open", isOpen);
      button.setAttribute("aria-expanded", String(isOpen));
      answer.hidden = !isOpen;
    };

    if (item.classList.contains("open")) {
      setState(true);
    }

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";

      items.forEach((faqItem) => {
        const faqButton = faqItem.querySelector(".faq-question");
        const faqAnswer = faqItem.querySelector(".faq-answer");

        if (!faqButton || !faqAnswer) return;

        faqItem.classList.remove("open");
        faqButton.setAttribute("aria-expanded", "false");
        faqAnswer.hidden = true;
      });

      if (!isOpen) {
        setState(true);
      }
    });
  });
}

function setupParallax() {
  const elements = document.querySelectorAll(".landing-parallax");
  if (!elements.length) return;

  const onScroll = () => {
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const speed = Number(element.dataset.speed || 0.15);
      const offset = (window.innerHeight - rect.top) * speed;
      const translateY = Math.min(offset * 0.7, 80);
      element.style.transform = `scale(1.08) translate3d(0, ${translateY * -0.6}px, 0)`;
    });
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupAboutCarousel() {
  const carousels = document.querySelectorAll(".about-carousel");

  carousels.forEach((carousel) => {
    const track = carousel.querySelector(".about-carousel-track");
    const prev = carousel.querySelector(".about-carousel-prev");
    const next = carousel.querySelector(".about-carousel-next");

    if (!track || !prev || !next) return;

    const getScrollAmount = () => {
      const firstSlide = track.querySelector(".about-carousel-slide");
      if (!firstSlide) return 320;
      return firstSlide.getBoundingClientRect().width + 14;
    };

    const getMaxScroll = () => Math.max(track.scrollWidth - track.clientWidth, 0);

    prev.addEventListener("click", () => {
      if (track.scrollLeft <= 1) {
        track.scrollTo({ left: getMaxScroll(), behavior: "smooth" });
        return;
      }

      track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
    });

    next.addEventListener("click", () => {
      if (track.scrollLeft + 2 >= getMaxScroll()) {
        track.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
    });
  });
}

// if (btnEs) {
//   btnEs.addEventListener("click", () => setLanguage("es"));
// }

// if (btnEn) {
//   btnEn.addEventListener("click", () => setLanguage("en"));
// }

// if (typeof setLanguage === "function") {
//   setLanguage("es");
// }

document.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  setCurrentYear();
  setupScrollReveal();
  setupFaqAccordion();
  setupCounters();
  setupParallax();
  setupAboutCarousel();

  const idiomaGuardado = localStorage.getItem("language") || "es";

  if (typeof setLanguage === "function") {
    setLanguage(idiomaGuardado);
  }

  const selector = document.getElementById("language-selector");

  if (selector) {
    selector.value = idiomaGuardado;

    selector.addEventListener("change", (e) => {
      setLanguage(e.target.value);
    });
  }
});