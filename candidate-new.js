const API_URL = "https://playground.4geeks.com/tracker/api/v1";

const form = document.getElementById("candidate-form");
const submitButton = document.getElementById("submit-button");

const successState = document.getElementById("success-state");
const errorState = document.getElementById("submit-error-state");

const errorMessage = document.getElementById("submit-error-message");
const retryButton = document.getElementById("submit-retry-button");
const addAnotherButton = document.getElementById("add-another-button");

async function createCandidate(candidate) {
  const response = await fetch(`${API_URL}/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(candidate)
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo crear la candidatura. Código: ${response.status}`
    );
  }

  return await response.json();
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);

  const candidate = {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    position: formData.get("position"),
    linkedin_url: formData.get("linkedin_url") || undefined,
    cv_url: formData.get("cv_url") || undefined,
    experience_years:
      formData.get("experience_years")
        ? Number(formData.get("experience_years"))
        : undefined
  };

  try {
    submitButton.disabled = true;

    const result = await createCandidate(candidate);

    console.log("Candidatura creada:", result);

    form.classList.add("hidden");
    errorState.classList.add("hidden");
    successState.classList.remove("hidden");

  } catch (error) {

    console.error("Error creando candidatura:", error);

    errorMessage.textContent =
      error instanceof Error
        ? error.message
        : "Ha ocurrido un error al crear la candidatura.";

    errorState.classList.remove("hidden");

  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);

retryButton.addEventListener("click", () => {
  errorState.classList.add("hidden");
});

addAnotherButton.addEventListener("click", () => {
  form.reset();

  successState.classList.add("hidden");
  errorState.classList.add("hidden");
  form.classList.remove("hidden");
});