const API_URL =
  "https://playground.4geeks.com/tracker/api/v1";


// =====================================================
// ID DEL CANDIDATO
// =====================================================

const params =
  new URLSearchParams(window.location.search);

const candidateId =
  params.get("id");


// =====================================================
// ELEMENTOS
// =====================================================

const loading =
  document.getElementById("detail-loading");

const error =
  document.getElementById("detail-error");

const errorMessage =
  document.getElementById("detail-error-message");

const detail =
  document.getElementById("candidate-detail");

const candidateName =
  document.getElementById("candidate-name");

const candidatePosition =
  document.getElementById("candidate-position");

const candidateEmail =
  document.getElementById("candidate-email");

const candidatePhone =
  document.getElementById("candidate-phone");

const candidateLinkedin =
  document.getElementById("candidate-linkedin");

const candidateCv =
  document.getElementById("candidate-cv");

const candidateExperience =
  document.getElementById("candidate-experience");

const candidateApplied =
  document.getElementById("candidate-applied");

const statusSelect =
  document.getElementById("candidate-status");

const stageSelect =
  document.getElementById("candidate-stage");

const updateMessage =
  document.getElementById("update-message");

const notesList =
  document.getElementById("notes-list");

const notesCount =
  document.getElementById("notes-count");

const noteForm =
  document.getElementById("note-form");

const noteContent =
  document.getElementById("note-content");

const addNoteButton =
  document.getElementById("add-note-button");


// =====================================================
// CARGAR CANDIDATO
// =====================================================

async function loadCandidate() {

  if (!candidateId) {

    showError(
      "No se ha encontrado el identificador de la candidatura."
    );

    return;
  }


  try {

    const response =
      await fetch(
        `${API_URL}/records/${encodeURIComponent(candidateId)}`
      );


    if (!response.ok) {

      throw new Error(
        `La API ha respondido con ${response.status}.`
      );
    }


    const candidate =
      await response.json();


    renderCandidate(candidate);

    loadNotes();

  } catch (err) {

    console.error(err);

    showError(
      err.message ||
      "No se ha podido cargar la candidatura."
    );
  }
}


// =====================================================
// MOSTRAR CANDIDATO
// =====================================================

function renderCandidate(candidate) {

  loading.classList.add("hidden");

  error.classList.add("hidden");

  detail.classList.remove("hidden");


  candidateName.textContent =
    candidate.full_name || "Sin nombre";


  candidatePosition.textContent =
    candidate.position || "Sin puesto";


  candidateEmail.textContent =
    candidate.email || "Sin email";

  candidateEmail.href =
    candidate.email
      ? `mailto:${candidate.email}`
      : "#";


  candidatePhone.textContent =
    candidate.phone || "Sin teléfono";

  candidatePhone.href =
    candidate.phone
      ? `tel:${candidate.phone}`
      : "#";


  candidateExperience.textContent =
    candidate.experience_years != null
      ? `${candidate.experience_years} años`
      : "No indicado";


  candidateApplied.textContent =
    formatDate(candidate.applied_at);


  statusSelect.value =
    candidate.status || "";


  stageSelect.value =
    candidate.stage || "";


  if (candidate.linkedin_url) {

    candidateLinkedin.textContent =
      candidate.linkedin_url;

    candidateLinkedin.href =
      normalizeUrl(candidate.linkedin_url);

  } else {

    candidateLinkedin.textContent =
      "No disponible";

    candidateLinkedin.removeAttribute("href");
  }


  if (candidate.cv_url) {

    candidateCv.href =
      normalizeUrl(candidate.cv_url);

  } else {

    candidateCv.textContent =
      "CV no disponible";

    candidateCv.removeAttribute("href");
  }


  document.title =
    `${candidate.full_name || "Candidatura"} | Brasaland`;
}


// =====================================================
// ACTUALIZAR ESTADO / ETAPA
// =====================================================

async function updateCandidate(fields) {

  setSaving(true);

  hideUpdateMessage();


  try {

    const response =
      await fetch(
        `${API_URL}/records/${encodeURIComponent(candidateId)}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(fields)
        }
      );


    if (!response.ok) {

      const message =
        await getApiError(response);

      throw new Error(message);
    }


    showUpdateMessage(
      "Cambios guardados correctamente.",
      "success"
    );


  } catch (err) {

    console.error(err);

    showUpdateMessage(
      err.message ||
      "No se han podido guardar los cambios.",
      "error"
    );

  } finally {

    setSaving(false);
  }
}


statusSelect.addEventListener(
  "change",
  () => {

    updateCandidate({
      status: statusSelect.value
    });

  }
);


stageSelect.addEventListener(
  "change",
  () => {

    updateCandidate({
      stage: stageSelect.value
    });

  }
);


// =====================================================
// NOTAS
// =====================================================

async function loadNotes() {

  notesList.innerHTML = `
    <p class="text-sm text-walnut/60">
      Cargando notas...
    </p>
  `;


  try {

    const response =
      await fetch(
        `${API_URL}/records/${encodeURIComponent(candidateId)}/notes`
      );


    if (!response.ok) {

      throw new Error(
        `No se pudieron cargar las notas (${response.status}).`
      );
    }


    const notes =
      await response.json();


    renderNotes(
      Array.isArray(notes)
        ? notes
        : notes.data || []
    );


  } catch (err) {

    console.error(err);

    notesList.innerHTML = `
      <p class="text-sm text-wine">
        ${escapeHtml(err.message)}
      </p>
    `;
  }
}


function renderNotes(notes) {

  notesList.innerHTML = "";

  notesCount.textContent =
    `${notes.length} ${
      notes.length === 1
        ? "nota"
        : "notas"
    }`;


  if (notes.length === 0) {

    notesList.innerHTML = `
      <p class="py-4 text-sm text-walnut/60">
        Todavía no hay notas internas.
      </p>
    `;

    return;
  }


  notes.forEach((note) => {

    const article =
      document.createElement("article");

    article.className =
      "candidate-note";


    article.innerHTML = `

      <div class="flex items-start justify-between gap-4">

        <div class="min-w-0 flex-1">

          <p class="candidate-note-content">
            ${escapeHtml(note.content || "")}
          </p>

          <p class="candidate-note-date mt-3">
            ${formatDate(note.created_at)}
          </p>

        </div>

        <button
          type="button"
          class="candidate-note-delete"
          data-note-id="${escapeHtml(note.id)}"
        >
          Eliminar
        </button>

      </div>
    `;


    notesList.appendChild(article);
  });
}


noteForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const content =
      noteContent.value.trim();


    if (!content) {
      return;
    }


    setNoteSaving(true);


    try {

      const response =
        await fetch(
          `${API_URL}/records/${encodeURIComponent(candidateId)}/notes`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              content
            })
          }
        );


      if (!response.ok) {

        const message =
          await getApiError(response);

        throw new Error(message);
      }


      noteContent.value = "";

      await loadNotes();


    } catch (err) {

      console.error(err);

      showUpdateMessage(
        err.message ||
        "No se ha podido añadir la nota.",
        "error"
      );

    } finally {

      setNoteSaving(false);
    }
  }
);


// =====================================================
// ELIMINAR NOTA
// =====================================================

notesList.addEventListener(
  "click",
  async (event) => {

    const button =
      event.target.closest(
        ".candidate-note-delete"
      );


    if (!button) {
      return;
    }


    const noteId =
      button.dataset.noteId;


    if (!noteId) {
      return;
    }


    const confirmed =
      window.confirm(
        "¿Quieres eliminar esta nota?"
      );


    if (!confirmed) {
      return;
    }


    button.disabled = true;


    try {

      const response =
        await fetch(
          `${API_URL}/records/${encodeURIComponent(candidateId)}/notes/${encodeURIComponent(noteId)}`,
          {
            method: "DELETE"
          }
        );


      if (!response.ok) {

        const message =
          await getApiError(response);

        throw new Error(message);
      }


      await loadNotes();


    } catch (err) {

      console.error(err);

      button.disabled = false;

      showUpdateMessage(
        err.message ||
        "No se ha podido eliminar la nota.",
        "error"
      );
    }
  }
);


// =====================================================
// ESTADOS VISUALES
// =====================================================

function setSaving(isSaving) {

  statusSelect.disabled =
    isSaving;

  stageSelect.disabled =
    isSaving;

  if (isSaving) {

    statusSelect.classList.add(
      "candidate-saving"
    );

    stageSelect.classList.add(
      "candidate-saving"
    );

  } else {

    statusSelect.classList.remove(
      "candidate-saving"
    );

    stageSelect.classList.remove(
      "candidate-saving"
    );
  }
}


function setNoteSaving(isSaving) {

  addNoteButton.disabled =
    isSaving;

  noteContent.disabled =
    isSaving;


  if (isSaving) {

    addNoteButton.textContent =
      "Guardando...";

  } else {

    addNoteButton.textContent =
      "Añadir nota";
  }
}


function showUpdateMessage(
  message,
  type
) {

  updateMessage.textContent =
    message;

  updateMessage.classList.remove(
    "hidden"
  );


  if (type === "success") {

    updateMessage.className =
      "mb-6 rounded-lg border border-green-700/20 bg-green-700/5 p-4 text-sm text-green-800";

  } else {

    updateMessage.className =
      "mb-6 rounded-lg border border-wine/20 bg-wine/5 p-4 text-sm text-wine";
  }
}


function hideUpdateMessage() {

  updateMessage.classList.add(
    "hidden"
  );
}


function showError(message) {

  loading.classList.add(
    "hidden"
  );

  detail.classList.add(
    "hidden"
  );

  error.classList.remove(
    "hidden"
  );

  errorMessage.textContent =
    message;
}


// =====================================================
// UTILIDADES
// =====================================================

function formatDate(value) {

  if (!value) {
    return "No disponible";
  }


  const date =
    new Date(value);


  if (Number.isNaN(date.getTime())) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "es-ES",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}


function normalizeUrl(url) {

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `https://${url}`;
}


async function getApiError(response) {

  try {

    const data =
      await response.json();

    if (data.detail) {
      return data.detail;
    }

    if (data.message) {
      return data.message;
    }

  } catch {
    // La respuesta no contiene JSON.
  }


  return `La API ha respondido con ${response.status}.`;
}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// INICIO
// =====================================================

loadCandidate();