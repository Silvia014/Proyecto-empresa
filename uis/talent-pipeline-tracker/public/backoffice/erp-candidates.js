(() => {
  const rows = document.getElementById("candidates-table-body");
  const loading = document.getElementById("loading-state");
  const errorState = document.getElementById("error-state");
  const empty = document.getElementById("empty-state");
  const table = document.getElementById("table-container");
  const errorMessage = document.getElementById("error-message");
  const retry = document.getElementById("retry-button");
  const search = document.getElementById("search");
  const statusFilter = document.getElementById("status-filter");
  const stageFilter = document.getElementById("stage-filter");
  const clear = document.getElementById("clear-filters");
  const count = document.getElementById("results-count");
  const description = document.getElementById("results-description");
  let token = "";
  let candidates = [];

  const language = () => document.documentElement.lang === "en" ? "en" : "es";
  const text = (es, en) => language() === "en" ? en : es;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function show(state) {
    [loading, errorState, empty, table].forEach((element) => element?.classList.add("hidden"));
    state?.classList.remove("hidden");
  }

  function populateStatuses(items) {
    const current = statusFilter.value;
    const statuses = [...new Set(items.map((item) => item.status).filter(Boolean))].sort();
    statusFilter.innerHTML = `<option value="">${text("Todos los estados", "All statuses")}</option>`;
    statuses.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.replaceAll("_", " ");
      statusFilter.appendChild(option);
    });
    statusFilter.value = current;
    stageFilter?.closest("div")?.classList.add("hidden");
  }

  function render() {
    const needle = search.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const filtered = candidates.filter((item) => {
      const matchesSearch = !needle || `${item.name} ${item.email}`.toLowerCase().includes(needle);
      return matchesSearch && (!selectedStatus || item.status === selectedStatus);
    });

    count.textContent = text(`${filtered.length} candidaturas`, `${filtered.length} applications`);
    description.textContent = filtered.length === candidates.length
      ? text("Mostrando todas las candidaturas.", "Showing all applications.")
      : text(`Mostrando ${filtered.length} de ${candidates.length}.`, `Showing ${filtered.length} of ${candidates.length}.`);

    if (!filtered.length) return show(empty);
    show(table);
    rows.innerHTML = filtered.map((item) => `<tr>
      <td><div class="candidate-name">${escapeHtml(item.name || text("Sin nombre", "No name"))}</div><div class="candidate-email">${escapeHtml(item.email)}</div><div class="candidate-email">${escapeHtml(item.phone)}</div></td>
      <td><span class="candidate-job">${escapeHtml(item.position)}</span><div class="candidate-email">${escapeHtml(item.experienceYears)} ${text("años de experiencia", "years experience")}</div></td>
      <td><span class="candidate-badge candidate-badge-status">${escapeHtml((item.status || "received").replaceAll("_", " "))}</span></td>
      <td><span class="candidate-badge candidate-badge-stage">${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</span></td>
      <td class="text-right">${item.cvUrl ? `<a class="candidate-view-link" href="${escapeHtml(item.cvUrl)}" target="_blank" rel="noopener noreferrer">${text("Abrir CV →", "Open CV →")}</a>` : `<span class="text-sm text-gray-500">${text("CV no disponible", "CV unavailable")}</span>`}</td>
    </tr>`).join("");
  }

  async function load() {
    if (!token) return;
    show(loading);
    try {
      const response = await fetch("/api/intake?view=candidates", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || text("No se pudieron cargar las candidaturas.", "Could not load applications."));
      candidates = result.candidates || [];
      populateStatuses(candidates);
      render();
    } catch (error) {
      errorMessage.textContent = error instanceof Error ? error.message : text("Error al cargar candidaturas.", "Could not load applications.");
      show(errorState);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "CRM_ACCESS_TOKEN" || typeof event.data.token !== "string") return;
    token = event.data.token;
    void load();
  });
  retry?.addEventListener("click", () => void load());
  search?.addEventListener("input", render);
  statusFilter?.addEventListener("change", render);
  clear?.addEventListener("click", () => { search.value = ""; statusFilter.value = ""; render(); });
})();
