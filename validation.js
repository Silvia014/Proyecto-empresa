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
  0: { abre: "13:00", cierra: "23:00" },
  2: { abre: "13:00", cierra: "23:00" },
  3: { abre: "13:00", cierra: "23:00" },
  4: { abre: "13:00", cierra: "23:00" },
  5: { abre: "13:00", cierra: "23:59" }, // viernes: hasta medianoche
  6: { abre: "13:00", cierra: "23:59" }, // sábado: hasta medianoche
  // 1 = lunes: cerrado (no aparece en el objeto)
};

const COUNTRY_CITY_MAP = {
  colombia: "Bogotá",
  usa: "Orlando",
};

// Una función de validación por campo. Cada una devuelve un mensaje de
// error específico (string) si algo está mal, o null si el valor es válido.
const VALIDATORS = {
  nombre: (value) => {
    if (!value.trim()) return t ("reserva.errors.nombreRequired");
    if (value.trim().length < 2) return t("reserva.errors.nombreShort");
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return t("reserva.errors.nombreInvalid");
    return null;
  },
  apellidos: (value) => {
    if (!value.trim()) return t("reserva.errors.apellidosRequired");
    if (value.trim().length < 2) return t("reserva.errors.apellidosShort");
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return t("reserva.errors.apellidosInvalid");
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
    if (fecha.getDay() === 1) return t("reserva.errors.diaClosed");
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
    if (value < horario.abre || value > horario.cierra) {
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
      personas: Number(form.personas.value),
      dia: form.dia.value,
      hora: form.hora.value,
      notas: form.notas.value.trim(),
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";

    try {
      await enviarReserva(datos);
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
      btnEnviar.textContent = "Confirmar reserva";
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

  const city = COUNTRY_CITY_MAP[countryField.value] || "";
  cityField.value = city;
}

async function enviarReserva(datos) {
  const respuesta = await fetch("/api/reservas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || "Error al enviar la reserva");
  }

  return await respuesta.json();
}

