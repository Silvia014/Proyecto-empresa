const API_URL =
  "https://playground.4geeks.com/tracker/api/v1";


// =====================================================
// ELEMENTOS DEL DOM
// =====================================================

const form =
  document.getElementById("application-form");

const submitButton =
  document.getElementById("submit-button");

const successState =
  document.getElementById("success-state");

const submitErrorState =
  document.getElementById("submit-error-state");

const submitErrorMessage =
  document.getElementById("submit-error-message");

const submitRetryButton =
  document.getElementById("submit-retry-button");


// =====================================================
// VALIDACIÓN
// =====================================================

const VALIDATORS = {
  full_name: (value) => {
    if (!value.trim()) return "Escribe tu nombre completo.";
    return null;
  },
  email: (value) => {
    if (!value.trim()) return "Escribe tu email.";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return "Escribe un email válido.";
    return null;
  },
  phone: (value) => {
    if (!value.trim()) return "Escribe un teléfono de contacto.";
    return null;
  },
  position: (value) => {
    if (!value.trim()) return "Indica el puesto al que aplicas.";
    return null;
  },
  cv_url: (value) => {
    if (!value.trim()) return "Necesitamos un enlace a tu CV.";
    return null;
  },
  experience_years: (value) => {
    if (!value) return null; // opcional
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      return "Los años de experiencia deben ser un número entero mayor o igual a 0.";
    }
    return null;
  },
};

function validateForm() {

  const errors = {};

  Object.keys(VALIDATORS).forEach((field) => {

    const input =
      form.elements[field];

    const message =
      VALIDATORS[field](input.value);

    if (message) {
      errors[field] = message;
    }
  });

  return errors;
}

function renderFieldErrors(errors) {

  Object.keys(VALIDATORS).forEach((field) => {

    const input =
      form.elements[field];

    const errorElement =
      document.getElementById(`error-${field}`);

    if (!errorElement) return;

    const message =
      errors[field];

    if (message) {
      errorElement.textContent = message;
      errorElement.classList.remove("hidden");
      input.setAttribute("aria-invalid", "true");
    } else {
      errorElement.textContent = "";
      errorElement.classList.add("hidden");
      input.removeAttribute("aria-invalid");
    }
  });
}


// =====================================================
// ESTADOS DE LA INTERFAZ
// =====================================================

function showForm() {

  form.classList.remove("hidden");

  successState.classList.add("hidden");
  submitErrorState.classList.add("hidden");
}

function showSuccess() {

  form.classList.add("hidden");

  submitErrorState.classList.add("hidden");
  successState.classList.remove("hidden");
}

function showSubmitError(message) {

  submitErrorState.classList.remove("hidden");

  submitErrorMessage.textContent =
    message;
}


// =====================================================
// ENVÍO DEL FORMULARIO
// =====================================================

function buildPayload() {

  const formData =
    new FormData(form);

  return {
    full_name: formData.get("full_name").trim(),
    email: formData.get("email").trim(),
    phone: formData.get("phone").trim(),
    position: formData.get("position").trim(),
    linkedin_url: formData.get("linkedin_url").trim(),
    cv_url: formData.get("cv_url").trim(),
    experience_years: formData.get("experience_years")
      ? Number(formData.get("experience_years"))
      : 0,
  };
}

async function submitApplication(payload) {

  const response =
    await fetch(`${API_URL}/records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  if (!response.ok) {

    const body =
      await response.text().catch(() => "");

    throw new Error(
      `No se pudo enviar tu candidatura. Código: ${response.status}${
        body ? ` — ${body}` : ""
      }`
    );
  }

  return response.json();
}

async function handleSubmit(event) {

  event.preventDefault();

  const errors =
    validateForm();

  renderFieldErrors(errors);

  if (Object.keys(errors).length > 0) {

    const firstField =
      Object.keys(errors)[0];

    form.elements[firstField].focus();

    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  try {

    const payload =
      buildPayload();

    await submitApplication(payload);

    showSuccess();

  } catch (error) {

    console.error(
      "Error enviando candidatura:",
      error
    );

    showSubmitError(
      error instanceof Error
        ? error.message
        : "Ha ocurrido un error inesperado."
    );

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = "Enviar candidatura";
  }
}


// =====================================================
// EVENTOS
// =====================================================

form.addEventListener(
  "submit",
  handleSubmit
);

submitRetryButton.addEventListener(
  "click",
  () => {
    submitErrorState.classList.add("hidden");
  }
);