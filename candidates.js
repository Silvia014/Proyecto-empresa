const API_URL =
  "https://playground.4geeks.com/tracker/api/v1";

const state = {
  candidates: [],
  filteredCandidates: [],
  loading: false,
  error: null
};

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const emptyState = document.getElementById("empty-state");
const tableContainer = document.getElementById("table-container");

const tableBody =
  document.getElementById("candidates-table-body");

const searchInput =
  document.getElementById("search");

const statusFilter =
  document.getElementById("status-filter");

const stageFilter =
  document.getElementById("stage-filter");

const clearFiltersButton =
  document.getElementById("clear-filters");

const retryButton =
  document.getElementById("retry-button");

const resultsCount =
  document.getElementById("results-count");

const resultsDescription =
  document.getElementById("results-description");


// -----------------------------------------------------
// API
// -----------------------------------------------------

async function getCandidates() {
  const response = await fetch(`${API_URL}/records`);

  if (!response.ok) {
    throw new Error(
      `La API respondió con el estado ${response.status}.`
    );
  }

  const data = await response.json();

  /*
   * La API puede devolver directamente un array
   * o un objeto que contiene los registros.
   */
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.records)) {
    return data.records;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}


// -----------------------------------------------------
// Carga inicial
// -----------------------------------------------------

async function loadCandidates() {
  setLoadingState();

  try {
    const candidates = await getCandidates();

    state.candidates = candidates;
    state.error = null;

    populateFilters(candidates);

    applyFilters();

  } catch (error) {

    console.error("Error cargando candidaturas:", error);

    state.error =
      error instanceof Error
        ? error.message
        : "Ha ocurrido un error inesperado.";

    showErrorState();

  }
}


// -----------------------------------------------------
// Estados de UI
// -----------------------------------------------------

function setLoadingState() {
  loadingState.classList.remove("hidden");

  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");
  tableContainer.classList.add("hidden");

  resultsCount.textContent = "Candidaturas";
  resultsDescription.textContent = "Cargando...";
}


function showErrorState() {
  loadingState.classList.add("hidden");

  errorState.classList.remove("hidden");
  emptyState.classList.add("hidden");
  tableContainer.classList.add("hidden");

  document.getElementById("error-message").textContent =
    state.error;
}


function showEmptyState() {
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");

  emptyState.classList.remove("hidden");
  tableContainer.classList.add("hidden");
}


function showTableState() {
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");

  tableContainer.classList.remove("hidden");
}


// -----------------------------------------------------
// Filtros
// -----------------------------------------------------

function populateFilters(candidates) {
  const statuses = new Set();
  const stages = new Set();

  candidates.forEach((candidate) => {

    const status = getStatus(candidate);
    const stage = getStage(candidate);

    if (status) {
      statuses.add(status);
    }

    if (stage) {
      stages.add(stage);
    }
  });

  const currentStatus = statusFilter.value;
  const currentStage = stageFilter.value;

  statusFilter.innerHTML =
    '<option value="">Todos los estados</option>';

  stageFilter.innerHTML =
    '<option value="">Todas las etapas</option>';

  [...statuses]
    .sort()
    .forEach((status) => {

      const option = document.createElement("option");

      option.value = status;
      option.textContent = formatValue(status);

      statusFilter.appendChild(option);
    });

  [...stages]
    .sort()
    .forEach((stage) => {

      const option = document.createElement("option");

      option.value = stage;
      option.textContent = formatValue(stage);

      stageFilter.appendChild(option);
    });

  statusFilter.value = currentStatus;
  stageFilter.value = currentStage;
}


function applyFilters() {
  const search = searchInput.value
    .trim()
    .toLowerCase();

  const selectedStatus =
    statusFilter.value;

  const selectedStage =
    stageFilter.value;

  state.filteredCandidates =
    state.candidates.filter((candidate) => {

      const name =
        getName(candidate).toLowerCase();

      const email =
        String(candidate.email || "")
          .toLowerCase();

      const status =
        getStatus(candidate);

      const stage =
        getStage(candidate);

      const matchesSearch =
        !search ||
        name.includes(search) ||
        email.includes(search);

      const matchesStatus =
        !selectedStatus ||
        status === selectedStatus;

      const matchesStage =
        !selectedStage ||
        stage === selectedStage;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStage
      );
    });

  renderCandidates();
}


// -----------------------------------------------------
// Render
// -----------------------------------------------------

function renderCandidates() {

  const candidates =
    state.filteredCandidates;

  if (candidates.length === 0) {
    showEmptyState();

    resultsCount.textContent =
      "0 candidaturas";

    resultsDescription.textContent =
      "No hay resultados para los filtros seleccionados.";

    return;
  }

  showTableState();

  resultsCount.textContent =
    `${candidates.length} ${
      candidates.length === 1
        ? "candidatura"
        : "candidaturas"
    }`;

  if (candidates.length === state.candidates.length) {
    resultsDescription.textContent =
      "Mostrando todas las candidaturas.";
  } else {
    resultsDescription.textContent =
      `Mostrando ${candidates.length} de ${state.candidates.length}.`;
  }

  tableBody.innerHTML = "";

  candidates.forEach((candidate) => {

    const row =
      document.createElement("tr");

    const id =
      candidate.id;

    row.innerHTML = `
      <td>
        <div class="candidate-name">
          ${escapeHtml(getName(candidate))}
        </div>

        <div class="candidate-email">
          ${escapeHtml(candidate.email || "Sin email")}
        </div>
      </td>

      <td>
        <span class="job-title">
          ${escapeHtml(
            getJobTitle(candidate)
          )}
        </span>
      </td>

      <td>
        <span class="badge badge-status">
          ${escapeHtml(
            formatValue(getStatus(candidate) || "Sin estado")
          )}
        </span>
      </td>

      <td>
        <span class="badge badge-stage">
          ${escapeHtml(
            formatValue(getStage(candidate) || "Sin etapa")
          )}
        </span>
      </td>

      <td>
        <a
          class="view-link"
          href="candidate-detail.html?id=${encodeURIComponent(id)}"
        >
          Ver detalle →
        </a>
      </td>
    `;

    tableBody.appendChild(row);
  });
}


// -----------------------------------------------------
// Normalización de datos
// -----------------------------------------------------

function getName(candidate) {

  if (candidate.name) {
    return candidate.name;
  }

  const fullName = [
    candidate.first_name,
    candidate.last_name
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || "Candidato sin nombre";
}


function getJobTitle(candidate) {

  return (
    candidate.position ||
    candidate.job_title ||
    candidate.job ||
    candidate.role ||
    "Sin puesto"
  );
}


function getStatus(candidate) {

  if (typeof candidate.status === "string") {
    return candidate.status;
  }

  if (
    candidate.status &&
    typeof candidate.status === "object"
  ) {
    return (
      candidate.status.name ||
      candidate.status.value ||
      candidate.status.label ||
      ""
    );
  }

  return "";
}


function getStage(candidate) {

  if (typeof candidate.stage === "string") {
    return candidate.stage;
  }

  if (
    candidate.stage &&
    typeof candidate.stage === "object"
  ) {
    return (
      candidate.stage.name ||
      candidate.stage.value ||
      candidate.stage.label ||
      ""
    );
  }

  return "";
}


function formatValue(value) {

  if (!value) {
    return "";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


// -----------------------------------------------------
// Seguridad al insertar datos de la API
// -----------------------------------------------------

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// -----------------------------------------------------
// Eventos
// -----------------------------------------------------

searchInput.addEventListener(
  "input",
  applyFilters
);

statusFilter.addEventListener(
  "change",
  applyFilters
);

stageFilter.addEventListener(
  "change",
  applyFilters
);

clearFiltersButton.addEventListener(
  "click",
  () => {

    searchInput.value = "";
    statusFilter.value = "";
    stageFilter.value = "";

    applyFilters();
  }
);

retryButton.addEventListener(
  "click",
  loadCandidates
);


// -----------------------------------------------------
// Inicio
// -----------------------------------------------------

loadCandidates();