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
  let actionError = "";

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
      <td><select class="candidate-input" aria-label="${text("Estado de candidatura", "Application status")}" data-status-id="${escapeHtml(item.id)}">${[["RECEIVED", "Received"], ["IN_PROGRESS", "In progress"], ["SELECTED", "Selected"], ["DISCARDED", "Discarded"]].map(([value, label]) => `<option value="${value}" ${String(item.status).toUpperCase() === value ? "selected" : ""}>${text(label === "Received" ? "Recibida" : label === "In progress" ? "En proceso" : label === "Selected" ? "Seleccionada" : "Descartada", label)}</option>`).join("")}</select></td>
      <td><span class="candidate-badge candidate-badge-stage">${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</span></td>
      <td class="text-right">${item.cvUrl ? `<a class="candidate-view-link" href="${escapeHtml(item.cvUrl)}" target="_blank" rel="noopener noreferrer">${text("Abrir CV →", "Open CV →")}</a>` : `<span class="text-sm text-gray-500">${text("CV no disponible", "CV unavailable")}</span>`}<button type="button" class="candidate-note-delete" data-delete-id="${escapeHtml(item.id)}">${text("Eliminar", "Delete")}</button></td>
    </tr>`).join("");
    rows.querySelectorAll("[data-status-id]").forEach((select) => select.addEventListener("change", () => void updateStatus(select.dataset.statusId, select.value)));
    rows.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", () => void deleteCandidate(button.dataset.deleteId)));
    if (actionError) { errorMessage.textContent = actionError; show(errorState); }
  }

  async function updateStatus(id, status) {
    try {
      const response = await fetch(`/api/staff/candidates/${encodeURIComponent(id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || text("No se pudo actualizar el estado.", "Could not update status."));
      candidates = candidates.map((candidate) => candidate.id === id ? { ...candidate, status: result.candidate.status } : candidate);
      actionError = ""; render();
    } catch (error) { actionError = error instanceof Error ? error.message : text("No se pudo actualizar el estado.", "Could not update status."); render(); }
  }

  async function deleteCandidate(id) {
    if (!window.confirm(text("¿Eliminar permanentemente la candidatura y su CV?", "Permanently delete this application and its CV?"))) return;
    try {
      const response = await fetch(`/api/staff/candidates/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || text("No se pudo eliminar la candidatura.", "Could not delete application."));
      candidates = candidates.filter((candidate) => candidate.id !== id); actionError = ""; render();
    } catch (error) { actionError = error instanceof Error ? error.message : text("No se pudo eliminar la candidatura.", "Could not delete application."); render(); }
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
      actionError = "";
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
