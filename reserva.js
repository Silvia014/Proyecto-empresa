// ==========================================================
// reserva.js — validación de formulario y envío de reserva
//
// IMPORTANTE: todavía no hay backend conectado (Supabase u otro).
// La función enviarReserva() de más abajo es donde, en el siguiente
// paso, se conectará la llamada real (fetch a tu API central que ya
// existe en /api/crm/orders, o a un servicio de email) para:
//   1) enviar copia de la confirmación al cliente
//   2) notificar internamente al restaurante
// Por ahora simula el envío para que puedas probar toda la UX.
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  setCurrentYear();
  setupForm();
});

function setCurrentYear() {
  const el = document.getElementById("anio-actual");
  if (el) el.textContent = String(new Date().getFullYear());
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

const VALIDATORS = {
  nombre: (value) => {
    if (!value.trim()) return "Escribe tu nombre.";
    if (value.trim().length < 2) return "El nombre es demasiado corto.";
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return "El nombre solo puede contener letras.";
    return null;
  },
  apellidos: (value) => {
    if (!value.trim()) return "Escribe tus apellidos.";
    if (value.trim().length < 2) return "Los apellidos son demasiado cortos.";
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/.test(value)) return "Los apellidos solo pueden contener letras.";
    return null;
  },
  email: (value) => {
    if (!value.trim()) return "Escribe tu email.";
    // Validación de formato razonable, no exhaustiva de RFC 5322
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return "Escribe un email válido, ej. nombre@dominio.com.";
    return null;
  },
  telefono: (value) => {
    if (!value.trim()) return "Escribe tu teléfono.";
    const digits = value.replace(/[\s()-]/g, "");
    // Acepta prefijo +34 opcional y 9 dígitos (formato español), o formato internacional genérico de 9-15 dígitos
    const re = /^(\+?\d{1,3})?\d{9,12}$/;
    if (!re.test(digits)) return "Escribe un teléfono válido (ej. 600 000 000).";
    return null;
  },
  personas: (value) => {
    if (!value) return "Indica el número de personas.";
    const n = Number(value);
    if (!Number.isInteger(n)) return "El número de personas debe ser un número entero.";
    if (n < 1) return "Debe ser al menos 1 persona.";
    if (n > 20) return "Para grupos de más de 20 personas, contáctanos por teléfono.";
    return null;
  },
  dia: (value) => {
    if (!value) return "Elige un día para la reserva.";
    const fecha = new Date(`${value}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fecha < hoy) return "La fecha no puede ser anterior a hoy.";
    if (fecha.getDay() === 1) return "Los lunes estamos cerrados. Elige otro día.";
    // No permitir reservas con más de 3 meses de antelación
    const limite = new Date(hoy);
    limite.setMonth(limite.getMonth() + 3);
    if (fecha > limite) return "Solo aceptamos reservas con hasta 3 meses de antelación.";
    return null;
  },
  hora: (value, form) => {
    if (!value) return "Elige una hora para la reserva.";
    const diaValue = form.dia.value;
    if (!diaValue) return null; // el error de "día" ya se muestra por separado
    const dia = new Date(`${diaValue}T00:00:00`).getDay();
    const horario = HORARIO[dia];
    if (!horario) return null; // lunes: ya se marca error en el campo día
    if (value < horario.abre || value > horario.cierra) {
      return `Ese día servimos de ${horario.abre} a ${horario.cierra}.`;
    }
    return null;
  },
};

function setupForm() {
  const form = document.getElementById("form-reserva");
  if (!form) return;

  const resumen = document.getElementById("resumen-errores");
  const listaErrores = document.getElementById("lista-errores");
  const confirmacion = document.getElementById("confirmacion");
  const btnEnviar = document.getElementById("btn-enviar");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    confirmacion.classList.add("hidden");
    const errores = validarFormulario(form);
    pintarErrores(form, errores);

    if (Object.keys(errores).length > 0) {
      mostrarResumenErrores(errores, resumen, listaErrores);
      // Lleva el foco al primer campo con error, para teclado y lectores de pantalla
      const primerCampo = Object.keys(errores)[0];
      form[primerCampo]?.focus();
      return;
    }

    resumen.classList.add("hidden");

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

// Rellenar el resumen
document.getElementById("nombre-cliente").textContent = datos.nombre;
document.getElementById("res-nombre").textContent =
  `${datos.nombre} ${datos.apellidos}`;
document.getElementById("res-fecha").textContent = datos.dia;
document.getElementById("res-hora").textContent = datos.hora;
document.getElementById("res-personas").textContent =
  `${datos.personas} persona${datos.personas > 1 ? "s" : ""}`;

// Ocultar el formulario
form.classList.add("hidden");

// Mostrar el mensaje
confirmacion.classList.remove("hidden");
confirmacion.scrollIntoView({
  behavior: "smooth",
  block: "center",
});

      form.reset();
    } catch (err) {
      mostrarResumenErrores(
        { general: "No se pudo enviar la reserva. Inténtalo de nuevo o llámanos por teléfono." },
        resumen,
        listaErrores
      );
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Confirmar reserva";
    }
  });

  // Valida un campo en cuanto el usuario sale de él, para dar feedback antes de enviar
  Object.keys(VALIDATORS).forEach((campo) => {
    form[campo]?.addEventListener("blur", () => {
      const error = VALIDATORS[campo](form[campo].value, form);
      pintarErrorCampo(form, campo, error);
    });
  });
}

function validarFormulario(form) {
  const errores = {};
  Object.keys(VALIDATORS).forEach((campo) => {
    const error = VALIDATORS[campo](form[campo].value, form);
    if (error) errores[campo] = error;
  });
  return errores;
}

function pintarErrores(form, errores) {
  Object.keys(VALIDATORS).forEach((campo) => {
    pintarErrorCampo(form, campo, errores[campo] || null);
  });
}

function pintarErrorCampo(form, campo, mensaje) {
  const input = form[campo];
  const errorEl = document.getElementById(`error-${campo}`);
  if (!input || !errorEl) return;

  if (mensaje) {
    errorEl.textContent = mensaje;
    errorEl.classList.remove("hidden");
    input.setAttribute("aria-invalid", "true");
    input.classList.add("border-wine");
  } else {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
    input.removeAttribute("aria-invalid");
    input.classList.remove("border-wine");
  }
}

function mostrarResumenErrores(errores, resumen, listaErrores) {
  listaErrores.innerHTML = "";
  Object.values(errores).forEach((mensaje) => {
    const li = document.createElement("li");
    li.textContent = mensaje;
    listaErrores.appendChild(li);
  });
  resumen.classList.remove("hidden");
  resumen.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Punto de conexión con el backend. Todavía no hay servicio de email ni
 * Supabase conectado, así que por ahora solo registra en consola y resuelve
 * como si el envío hubiera funcionado. Cuando conectes el backend:
 *
 *   const res = await fetch("https://TU-API/api/crm/orders", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(datos),
 *   });
 *   if (!res.ok) throw new Error("Fallo al guardar la reserva");
 *
 * y ahí mismo, en el backend, dispara el email al cliente y la notificación
 * interna al restaurante.
 */
async function enviarReserva(datos) {
  console.log("Reserva a enviar (todavía sin backend conectado):", datos);
  return new Promise((resolve) => setTimeout(resolve, 600));
}
