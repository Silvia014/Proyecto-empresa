// ==========================================================
// validation.js — validación del formulario de reserva
//
// Responsabilidades:
//   - Validar cada campo con reglas específicas (formato, rango, fecha/hora)
//   - Marcar visualmente el campo con error (borde, color, aria-invalid)
//   - Mostrar un mensaje de error específico bajo cada campo
//   - Validar en tiempo real (mientras el usuario escribe, no solo al salir)
//   - Bloquear el envío si hay cualquier error
//   - Mostrar confirmación de éxito al enviar correctamente
//   - Limpiar el formulario (valores + errores + confirmación) con el
//     botón secundario "Limpiar campos"
//

//   if (!res.ok) throw new Error("Fallo al guardar la reserva");
//
// y desde ahí el backend dispara el email al cliente y la notificación
// interna al restaurante.
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
});
// Traducción de mensajes de error y textos fijos (i18n)
function t(key) {
  const lang = document.documentElement.lang || "es";

  return key.split(".").reduce((obj, k) => obj?.[k], translations[lang]);
}

// Horario de servicio, usado para validar la hora elegida según el día
const HORARIO = {
  // 0 = domingo ... 6 = sábado
  0: { abre: "11:00", cierra: "22:00" },
  1: { abre: "11:00", cierra: "22:00" },
  2: { abre: "11:00", cierra: "22:00" },
  3: { abre: "11:00", cierra: "22:00" },
  4: { abre: "11:00", cierra: "22:00" },
  5: { abre: "11:00", cierra: "22:00" },
  6: { abre: "11:00", cierra: "22:00" },
};

const COUNTRY_CITY_OPTIONS = {
  colombia: ["Medellin", "Bogota", "Cali"],
  usa: ["Miami", "Orlando"],
};

function timeToMinutes(value) {
  if (typeof value !== "string") return Number.NaN;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

// Una función de validación por campo. Cada una devuelve un mensaje de
// error específico (string) si algo está mal, o null si el valor es válido.
const VALIDATORS = {
  acepta_terminos: (value, form) => {
    if (!form.acepta_terminos?.checked) return t("reserva.errors.termsRequired");
    return null;
  },
  acepta_ofertas: () => null,
  nombre: (value) => {
    if (!value.trim()) return t ("reserva.errors.nombreRequired");
    if (value.trim().length < 2) return t("reserva.errors.nombreShort");
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return t("reserva.errors.nombreLetters");
    return null;
  },
  apellidos: (value) => {
    if (!value.trim()) return t("reserva.errors.apellidosRequired");
    if (value.trim().length < 2) return t("reserva.errors.apellidosShort");
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return t("reserva.errors.apellidosLetters");
    return null;
  },
  email: (value) => {
    if (!value.trim()) return t("reserva.errors.emailRequired");
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return t("reserva.errors.emailInvalid");
    return null;
  },
  telefono: (value) => {
    if (!value.trim()) return t("reserva.errors.telefonoRequired");
    const digits = value.replace(/[\s()-]/g, "");
    // Acepta prefijo internacional opcional (+34...) y 9-12 dígitos
    const re = /^(\+?\d{1,3})?\d{9,12}$/;
    if (!re.test(digits)) return t("reserva.errors.telefonoInvalid");
    return null;
  },
  personas: (value) => {
    if (!value) return t("reserva.errors.personasRequired");
    const n = Number(value);
    if (!Number.isInteger(n)) return t("reserva.errors.personasInteger");
    if (n < 1) return t("reserva.errors.personasMin");
    if (n > 20) return t("reserva.errors.personasMax");
    return null;
  },
  dia: (value) => {
    if (!value) return t("reserva.errors.diaRequired");
    const fecha = new Date(`${value}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fecha < hoy) return t("reserva.errors.diaPast");
    const limite = new Date(hoy);
    limite.setMonth(limite.getMonth() + 3);
    if (fecha > limite) return t("reserva.errors.diaTooFar");
    return null;
  },
  hora: (value, form) => {
    if (!value) return t("reserva.errors.horaRequired");
    const diaValue = form.dia.value;
    if (!diaValue) return null; // el error de "día" ya se muestra en ese campo
    const dia = new Date(`${diaValue}T00:00:00`).getDay();
    const horario = HORARIO[dia];
    if (!horario) return null; // lunes: ya se marca error en el campo día
    const selectedMinutes = timeToMinutes(value);
    const openMinutes = timeToMinutes(horario.abre);
    const closeMinutes = timeToMinutes(horario.cierra);
    if (!Number.isFinite(selectedMinutes) || selectedMinutes < openMinutes || selectedMinutes > closeMinutes) {
      return t("reserva.errors.horaRange").replace("{abre}", horario.abre).replace("{cierra}", horario.cierra);
    }
    return null;
  },
};

function setupForm() {
  const form = document.getElementById("form-reserva");
  if (!form) return; // esta página no tiene el formulario, no hacemos nada más

  setupCountryCityAutofill(form);

  const resumen = document.getElementById("resumen-errores");
  const listaErrores = document.getElementById("lista-errores");
  const confirmacion = document.getElementById("confirmacion");
  const btnEnviar = document.getElementById("btn-enviar");
  const btnLimpiar = document.getElementById("btn-limpiar");

  // Registra qué campos ha "tocado" ya el usuario, para no bombardearlo
  // con errores en campos que todavía no ha rellenado la primera vez.
  const tocados = new Set();

  Object.keys(VALIDATORS).forEach((campo) => {
    const input = form[campo];
    if (!input) return;

    // Primer contacto con el campo -> a partir de aquí, tiempo real
    input.addEventListener("blur", () => {
      tocados.add(campo);
      validarCampo(form, campo);
    });

    // Validación en tiempo real: mientras escribe, si el campo ya fue tocado
    input.addEventListener("input", () => {
      if (tocados.has(campo)) validarCampo(form, campo);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultar(confirmacion);

    // Al intentar enviar, se marcan todos los campos como tocados
    Object.keys(VALIDATORS).forEach((c) => tocados.add(c));
    const errores = validarFormularioCompleto(form);

    if (Object.keys(errores).length > 0) {
      mostrarResumenErrores(errores, resumen, listaErrores);
      const primerCampo = Object.keys(errores)[0];
      form[primerCampo]?.focus();
      return; // bloquea el envío si hay errores
    }

    ocultar(resumen);

    const datos = {
      nombre: form.nombre.value.trim(),
      apellidos: form.apellidos.value.trim(),
      email: form.email.value.trim(),
      telefono: form.telefono.value.trim(),
      pais: form.pais?.value || "colombia",
      ciudad: form.ciudad?.value || "",
      personas: Number(form.personas.value),
      dia: form.dia.value,
      hora: form.hora.value,
      notas: form.preferencias?.value.trim() || "",
      ubicacion: form.ubicacion?.value || "sin_preferencia",
      comoNosConociste: form.como_nos_conociste?.value || "",
      acepta_terminos: form.acepta_terminos?.checked || false,
      acepta_ofertas: form.acepta_ofertas?.checked || false,
      idioma: document.documentElement.lang === "en" ? "en" : "es",
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = t("reserva.buttons.submitting") || "Enviando...";

    try {
      const resultado = await enviarReserva(datos);
      const confirmationText = document.querySelector('[data-i18n="reserva.confirmationText"]');
      if (confirmationText) {
        const messageKey = resultado.confirmationEmailSent ? "reserva.confirmationText" : "reserva.confirmationEmailFailed";
        confirmationText.textContent = t(messageKey) || confirmationText.textContent;
      }
      mostrar(confirmacion);
      confirmacion.scrollIntoView({ behavior: "smooth", block: "center" });
      limpiarFormularioCompleto(form);
      syncCityWithCountry(form);
      tocados.clear();
    } catch (err) {
      console.error("Error completo:", err);

      mostrarResumenErrores(
        { general: err.message },
        resumen,
        listaErrores
      );
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = t("reserva.buttons.submit") || "Confirmar reserva";
    }
  });

  // Botón secundario "Limpiar campos": borra valores, errores y avisos
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      limpiarFormularioCompleto(form);
      syncCityWithCountry(form);
      tocados.clear();
      ocultar(resumen);
      ocultar(confirmacion);
      form.nombre?.focus();
    });
  }
}

function validarCampo(form, campo) {
  const mensaje = VALIDATORS[campo](form[campo].value, form);
  pintarErrorCampo(form, campo, mensaje);
  return mensaje;
}

function validarFormularioCompleto(form) {
  const errores = {};
  Object.keys(VALIDATORS).forEach((campo) => {
    const mensaje = validarCampo(form, campo);
    if (mensaje) errores[campo] = mensaje;
  });
  return errores;
}

// Marca visualmente el campo (borde y anillo rojo + aria-invalid) y
// muestra/oculta su mensaje de error específico.
function pintarErrorCampo(form, campo, mensaje) {
  const input = form[campo];
  const errorEl = document.getElementById(`error-${campo}`);
  if (!input || !errorEl) return;

  if (mensaje) {
    errorEl.textContent = mensaje;
    errorEl.classList.remove("hidden");
    input.setAttribute("aria-invalid", "true");
    input.classList.add("border-wine", "ring-2", "ring-wine/30");
  } else {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
    input.removeAttribute("aria-invalid");
    input.classList.remove("border-wine", "ring-2", "ring-wine/30");
  }
}

function mostrarResumenErrores(errores, resumen, listaErrores) {
  listaErrores.innerHTML = "";
  Object.values(errores).forEach((mensaje) => {
    const li = document.createElement("li");
    li.textContent = mensaje;
    listaErrores.appendChild(li);
  });
  mostrar(resumen);
  resumen.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Limpia valores, mensajes de error y estados visuales de todos los
// campos. A diferencia de form.reset(), que solo vacía los valores,
// esto también borra los mensajes de error y el aria-invalid.
function limpiarFormularioCompleto(form) {
  form.reset();
  Object.keys(VALIDATORS).forEach((campo) => {
    pintarErrorCampo(form, campo, null);
  });
}

function mostrar(el) {
  el?.classList.remove("hidden");
}

function ocultar(el) {
  el?.classList.add("hidden");
}

function setupCountryCityAutofill(form) {
  const countryField = form.pais;
  if (!countryField) return;

  countryField.addEventListener("change", () => {
    syncCityWithCountry(form);
  });

  syncCityWithCountry(form);
}

function syncCityWithCountry(form) {
  const countryField = form.pais;
  const cityField = form.ciudad;
  if (!countryField || !cityField) return;

  const options = COUNTRY_CITY_OPTIONS[countryField.value] || [];
  cityField.innerHTML = "";

  if (!options.length) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona una ciudad";
    cityField.appendChild(placeholder);
    cityField.value = "";
    return;
  }

  options.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityField.appendChild(option);
  });

  const currentValue = cityField.dataset.value || options[0];
  const nextValue = options.includes(currentValue) ? currentValue : options[0];
  cityField.value = nextValue;
  cityField.dataset.value = nextValue;
}

async function enviarReserva(datos) {
  // Permite probar el flujo en local abriendo el HTML directamente (file://)
  // cuando no hay backend disponible en /api/reservas.
  if (window.location.protocol === "file:") {
    return { ok: true, local: true, reserva: datos };
  }

  let respuesta;
  try {
    respuesta = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  } catch {
    throw new Error("No se pudo conectar con el servicio de reservas. Si estás probando en local, inicia el proyecto con `npx vercel dev`.");
  }

  const contentType = respuesta.headers.get("content-type") || "";
  const responseText = await respuesta.text();
  let resultado = null;
  if (responseText && contentType.includes("application/json")) {
    try {
      resultado = JSON.parse(responseText);
    } catch {
      resultado = null;
    }
  }

  if (!respuesta.ok) {
    if (respuesta.status === 405) {
      throw new Error("El servidor devolvió HTTP 405 para /api/reservas. Detén Live Server, ejecuta `npx vercel dev` en la raíz del proyecto y abre la URL que imprime Vercel Dev.");
    }
    if (resultado?.error) throw new Error(resultado.error);
    if (respuesta.status >= 500) {
      throw new Error(`El backend local falló (HTTP ${respuesta.status}). Revisa el terminal donde ejecutaste \`npx vercel dev\`; si faltan paquetes, ejecuta \`npm install\` en la raíz del proyecto y reinícialo.`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error(`El servicio de reservas no está disponible (HTTP ${respuesta.status}). Comprueba que el sitio se abrió desde Vercel Dev y que /api/reservas está activo.`);
    }
    throw new Error("No se pudo guardar la reserva. Inténtalo de nuevo.");
  }

  if (!resultado) {
    throw new Error("El servicio de reservas devolvió una respuesta vacía o no válida. Comprueba que estás usando el servidor del proyecto.");
  }
  return resultado;
}

