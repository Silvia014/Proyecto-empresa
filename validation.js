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
// NOTA: todavía no hay backend conectado (Supabase u otro). La función
// enviarReserva() de más abajo simula el envío. Cuando conectes tu API:
//
//   const res = await fetch("https://TU-API/api/crm/orders", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(datos),
//   });
//   if (!res.ok) throw new Error("Fallo al guardar la reserva");
//
// y desde ahí el backend dispara el email al cliente y la notificación
// interna al restaurante.
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
});

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

// Una función de validación por campo. Cada una devuelve un mensaje de
// error específico (string) si algo está mal, o null si el valor es válido.
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
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return "Escribe un email válido, ej. nombre@dominio.com.";
    return null;
  },
  telefono: (value) => {
    if (!value.trim()) return "Escribe tu teléfono.";
    const digits = value.replace(/[\s()-]/g, "");
    // Acepta prefijo internacional opcional (+34...) y 9-12 dígitos
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
    const limite = new Date(hoy);
    limite.setMonth(limite.getMonth() + 3);
    if (fecha > limite) return "Solo aceptamos reservas con hasta 3 meses de antelación.";
    return null;
  },
  hora: (value, form) => {
    if (!value) return "Elige una hora para la reserva.";
    const diaValue = form.dia.value;
    if (!diaValue) return null; // el error de "día" ya se muestra en ese campo
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
  if (!form) return; // esta página no tiene el formulario, no hacemos nada más

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
      tocados.clear();
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

  // Botón secundario "Limpiar campos": borra valores, errores y avisos
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      limpiarFormularioCompleto(form);
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

async function enviarReserva(datos) {
  console.log("Reserva a enviar (todavía sin backend conectado):", datos);
  return new Promise((resolve) => setTimeout(resolve, 600));
}
