const form = document.getElementById("application-form");
const submitButton = document.getElementById("submit-button");
const successState = document.getElementById("success-state");
const submitErrorState = document.getElementById("submit-error-state");
const submitErrorMessage = document.getElementById("submit-error-message");
const submitRetryButton = document.getElementById("submit-retry-button");
const applicationConfirmationMessage = document.getElementById("application-confirmation-message");
const MAX_CV_SIZE = 3 * 1024 * 1024;
const allowedExtensions = [".pdf", ".doc", ".docx"];

function validateForm() {
  const errors = {};
  ["full_name", "email", "phone", "position"].forEach((name) => {
    if (!form.elements[name].value.trim()) errors[name] = "Este campo es obligatorio.";
  });
  if (form.elements.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())) errors.email = "Escribe un email válido.";
  const file = form.elements.cv_file.files[0];
  const extension = file?.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!file) errors.cv_file = "Adjunta tu CV para continuar.";
  else if (!allowedExtensions.includes(extension)) errors.cv_file = "El CV debe estar en formato PDF, DOC o DOCX.";
  else if (file.size > MAX_CV_SIZE) errors.cv_file = "El CV debe ocupar menos de 3 MB.";
  const experience = form.elements.experience_years.value;
  if (experience && (!Number.isInteger(Number(experience)) || Number(experience) < 0)) errors.experience_years = "Introduce un número entero igual o mayor que cero.";
  return errors;
}

function renderFieldErrors(errors) {
  ["full_name", "email", "phone", "position", "cv_file", "experience_years"].forEach((field) => {
    const input = form.elements[field];
    const errorElement = document.getElementById(`error-${field}`);
    if (!errorElement) return;
    errorElement.textContent = errors[field] || "";
    errorElement.classList.toggle("hidden", !errors[field]);
    if (errors[field]) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No pudimos leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  submitErrorState.classList.add("hidden");
  const errors = validateForm();
  renderFieldErrors(errors);
  if (Object.keys(errors).length) {
    form.elements[Object.keys(errors)[0]].focus();
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = "Enviando…";
  try {
    const file = form.elements.cv_file.files[0];
    const inferredType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const response = await fetch("/api/candidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.elements.full_name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        position: form.elements.position.value.trim(),
        linkedin_url: form.elements.linkedin_url.value.trim(),
        experience_years: Number(form.elements.experience_years.value || 0),
        language: document.documentElement.lang === "en" ? "en" : "es",
        cv_filename: file.name,
        cv_type: inferredType,
        cv_base64: await readFileAsBase64(file),
      }),
    });
    const responseText = await response.text();
    let result = null;
    try { result = responseText ? JSON.parse(responseText) : null; } catch { /* handled below */ }
    if (response.status === 405) throw new Error("El servidor rechazó /api/candidate (HTTP 405). Detén Live Server, inicia `npx vercel dev` en la raíz del proyecto y abre la URL que imprime Vercel.");
    if (!result) throw new Error(`El servidor devolvió una respuesta vacía o no válida (HTTP ${response.status}). Comprueba el terminal de Vercel Dev.`);
    if (!response.ok) throw new Error(result.error || "No se pudo enviar tu candidatura.");
    if (applicationConfirmationMessage) {
      const emailAddress = form.elements.email.value.trim();
      const english = document.documentElement.lang === "en";
      applicationConfirmationMessage.textContent = result.confirmationEmailSent
        ? (english
          ? `We sent a receipt confirmation to ${emailAddress}. Our team will review your application and contact you if your profile matches an open position.`
          : `Enviamos la confirmación de recibo a ${emailAddress}. Nuestro equipo revisará tu candidatura y te contactará si tu perfil encaja con una vacante.`)
        : (english
          ? "We received your application, but could not send the confirmation email. Please check your email address or contact Brasaland."
          : "Recibimos tu candidatura, pero no pudimos enviar el email de confirmación. Revisa tu dirección o contacta con Brasaland.");
    }
    form.classList.add("hidden");
    successState.classList.remove("hidden");
  } catch (error) {
    submitErrorState.classList.remove("hidden");
    submitErrorMessage.textContent = error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar candidatura";
  }
}

form?.addEventListener("submit", handleSubmit);
submitRetryButton?.addEventListener("click", () => submitErrorState.classList.add("hidden"));
