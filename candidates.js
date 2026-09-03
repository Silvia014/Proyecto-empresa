const API_URL =
  "https://playground.4geeks.com/tracker/api/v1";

const state = {
  candidates: [],
  filteredCandidates: [],
  loading: false,
  error: null
};


// =====================================================
// ELEMENTOS DEL DOM
// =====================================================

const loadingState =
  document.getElementById("loading-state");

const errorState =
  document.getElementById("error-state");

const emptyState =
  document.getElementById("empty-state");

const tableContainer =
  document.getElementById("table-container");

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


// =====================================================
// API
// =====================================================

async function getCandidates() {

  const response = await fetch(
    `${API_URL}/records`
  );

  if (!response.ok) {

    throw new Error(
      `No se pudieron cargar las candidaturas. Código: ${response.status}`
    );
  }

  const result = await response.json();

  /*
   * La API devuelve:
   *
   * {
   *   total: 2,
   *   page: 1,
   *   limit: 20,
   *   data: [...]
   * }
   */

  return result.data || [];
}


// =====================================================
// CARGAR CANDIDATURAS
// =====================================================

async function loadCandidates() {

  setLoadingState();

  try {

    const candidates =
      await getCandidates();

    state.candidates = candidates;

    state.filteredCandidates =
      candidates;

    state.error = null;

    populateFilters(candidates);

    applyFilters();

  } catch (error) {

    console.error(
      "Error cargando candidaturas:",
      error
    );

    state.error =
      error instanceof Error
        ? error.message
        : "Ha ocurrido un error inesperado.";

    showErrorState();
  }
}


// =====================================================
// ESTADOS DE LA INTERFAZ
// =====================================================

function setLoadingState() {

  loadingState.classList.remove("hidden");

  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");
  tableContainer.classList.add("hidden");

  resultsCount.textContent =
    "Candidaturas";

  resultsDescription.textContent =
    "Cargando...";
}


function showErrorState() {

  loadingState.classList.add("hidden");

  errorState.classList.remove("hidden");
  emptyState.classList.add("hidden");
  tableContainer.classList.add("hidden");

  const errorMessage =
    document.getElementById("error-message");

  errorMessage.textContent =
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


// =====================================================
// FILTROS
// =====================================================

function populateFilters(candidates) {

  const currentLanguage =
    localStorage.getItem("language") || "es";

  const statuses =
    new Set();

  const stages =
    new Set();

  candidates.forEach((candidate) => {

    if (candidate.status) {
      statuses.add(candidate.status);
    }

    if (candidate.stage) {
      stages.add(candidate.stage);
    }
  });


  const currentStatus =
    statusFilter.value;

  const currentStage =
    stageFilter.value;


  statusFilter.innerHTML = `
    <option value="">
      ${currentLanguage === "en" ? "All statuses" : "Todos los estados"}
    </option>
  `;

  stageFilter.innerHTML = `
    <option value="">
      ${currentLanguage === "en" ? "All stages" : "Todas las etapas"}
    </option>
  `;


  [...statuses]
    .sort()
    .forEach((status) => {

      const option =
        document.createElement("option");

      option.value = status;

      option.textContent =
        formatValue(status);

      statusFilter.appendChild(option);
    });


  [...stages]
    .sort()
    .forEach((stage) => {

      const option =
        document.createElement("option");

      option.value = stage;

      option.textContent =
        formatValue(stage);

      stageFilter.appendChild(option);
    });


  statusFilter.value =
    currentStatus;

  stageFilter.value =
    currentStage;
}


function applyFilters() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedStatus =
    statusFilter.value;

  const selectedStage =
    stageFilter.value;


  state.filteredCandidates =
    state.candidates.filter((candidate) => {

      const name =
        String(candidate.full_name || "")
          .toLowerCase();

      const email =
        String(candidate.email || "")
          .toLowerCase();


      const matchesSearch =
        !search ||
        name.includes(search) ||
        email.includes(search);


      const matchesStatus =
        !selectedStatus ||
        candidate.status === selectedStatus;


      const matchesStage =
        !selectedStage ||
        candidate.stage === selectedStage;


      return (
        matchesSearch &&
        matchesStatus &&
        matchesStage
      );
    });


  renderCandidates();
}


// =====================================================
// RENDER DE LA TABLA
// =====================================================

function renderCandidates() {

  const candidates =
    state.filteredCandidates;

  const lang =
    localStorage.getItem("language") || "es";


  if (candidates.length === 0) {

    showEmptyState();

    resultsCount.textContent =
      lang === "en"
        ? "0 applications"
        : "0 candidaturas";

    resultsDescription.textContent =
      lang === "en"
        ? "No results for the selected filters."
        : "No hay resultados para los filtros seleccionados.";

    return;
  }


  showTableState();


  resultsCount.textContent =
    `${candidates.length} ${
      candidates.length === 1
        ? (lang === "en" ? "application" : "candidatura")
        : (lang === "en" ? "applications" : "candidaturas")
    }`;


  if (
    candidates.length ===
    state.candidates.length
  ) {

    resultsDescription.textContent =
      lang === "en"
        ? "Showing all applications."
        : "Mostrando todas las candidaturas.";

  } else {

    resultsDescription.textContent =
      lang === "en"
        ? `Showing ${candidates.length} of ${state.candidates.length}.`
        : `Mostrando ${candidates.length} de ${state.candidates.length}.`;
  }

  console.log("tableBody:", tableBody);
  tableBody.innerHTML = "";

  const currentLanguage =
    localStorage.getItem("language") || "es";

  const viewDetailLabel =
    currentLanguage === "en"
      ? "View detail →"
      : "Ver detalle →";


  candidates.forEach((candidate) => {

    const row =
      document.createElement("tr");


    row.innerHTML = `
      <td>

        <div class="candidate-name">
          ${escapeHtml(
            candidate.full_name || "Sin nombre"
          )}
        </div>

        <div class="candidate-email">
          ${escapeHtml(
            candidate.email || "Sin email"
          )}
        </div>

      </td>


      <td>

        <span class="candidate-job">
          ${escapeHtml(
            candidate.position || "Sin puesto"
          )}
        </span>

      </td>


      <td>

        <span class="candidate-badge candidate-badge-status">
          ${escapeHtml(
            formatValue(
              candidate.status || "Sin estado"
            )
          )}
        </span>

      </td>


      <td>

        <span class="candidate-badge candidate-badge-stage">
          ${escapeHtml(
            formatValue(
              candidate.stage || "Sin etapa"
            )
          )}
        </span>

      </td>


      <td class="text-right">

        <a
          class="candidate-view-link"
          href="candidate-detail.html?id=${encodeURIComponent(candidate.id)}"
          data-i18n="candidateDetail.viewDetail"
        >
          ${viewDetailLabel}
        </a>

      </td>
    `;


    tableBody.appendChild(row);
  });
}


// =====================================================
// FORMATO
// =====================================================

function formatValue(value) {

  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
}


// =====================================================
// SEGURIDAD
// =====================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// EVENTOS
// =====================================================

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


// =====================================================
// INICIO
// =====================================================

loadCandidates();