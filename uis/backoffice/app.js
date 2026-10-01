const API_BASE_URL = "http://127.0.0.1:8000";

const table = document.getElementById("suppliers-table");
const message = document.getElementById("form-message");
const apiStatus = document.getElementById("api-status");

const countryFilter = document.getElementById("country-filter");
const categoryFilter = document.getElementById("category-filter");

const refreshButton = document.getElementById("refresh-button");
const supplierForm = document.getElementById("supplier-form");


async function checkApi() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);

        if (!response.ok) {
            throw new Error();
        }

        apiStatus.textContent = "API: online";
        apiStatus.classList.add("online");
    } catch {
        apiStatus.textContent = "API: offline";
        apiStatus.classList.remove("online");
    }
}


function showMessage(text, type = "") {
    message.textContent = text;
    message.className = `message ${type}`;
}


function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}


function createStatusBadge(status) {
    const badge = document.createElement("span");

    badge.className = `status-badge ${status}`;
    badge.textContent = status;

    return badge;
}


function createCategories(categories) {
    const container = document.createElement("div");

    container.className = "categories";

    categories.forEach(category => {
        const badge = document.createElement("span");

        badge.className = "category-badge";
        badge.textContent = category;

        container.appendChild(badge);
    });

    return container;
}


function renderSuppliers(suppliers) {
    table.innerHTML = "";

    if (suppliers.length === 0) {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td colspan="7">
                No suppliers found.
            </td>
        `;

        table.appendChild(row);

        return;
    }


    suppliers.forEach(supplier => {

        const row = document.createElement("tr");

        const supplierCell = document.createElement("td");
        supplierCell.innerHTML = `
            <strong>${supplier.name}</strong>
            <small>${supplier.contact_email || ""}</small>
        `;


        const countryCell = document.createElement("td");
        countryCell.textContent = supplier.country;


        const categoriesCell = document.createElement("td");
        categoriesCell.appendChild(
            createCategories(supplier.categories)
        );


        const rateCell = document.createElement("td");
        rateCell.textContent =
            `${supplier.rate_per_unit} ${supplier.currency}`;


        const statusCell = document.createElement("td");
        statusCell.appendChild(
            createStatusBadge(supplier.status)
        );


        const updatedCell = document.createElement("td");
        updatedCell.textContent =
            formatDate(supplier.updated_at);


        const actionsCell = document.createElement("td");

        actionsCell.className = "actions";

        const rateButton = document.createElement("button");

        rateButton.textContent = "Update rate";
        rateButton.className = "small-button";

        rateButton.addEventListener("click", () => {
            updateRate(supplier);
        });


        const statusButton = document.createElement("button");

        statusButton.textContent =
            supplier.status === "active"
                ? "Suspend"
                : "Activate";

        statusButton.className = "small-button";

        statusButton.addEventListener("click", () => {
            updateStatus(supplier);
        });


        actionsCell.appendChild(rateButton);
        actionsCell.appendChild(statusButton);


        row.appendChild(supplierCell);
        row.appendChild(countryCell);
        row.appendChild(categoriesCell);
        row.appendChild(rateCell);
        row.appendChild(statusCell);
        row.appendChild(updatedCell);
        row.appendChild(actionsCell);

        table.appendChild(row);
    });
}


async function loadSuppliers() {

    const params = new URLSearchParams();

    if (countryFilter.value) {
        params.set("country", countryFilter.value);
    }

    if (categoryFilter.value) {
        params.set("category", categoryFilter.value);
    }


    const queryString = params.toString();

    const url = queryString
        ? `${API_BASE_URL}/suppliers?${queryString}`
        : `${API_BASE_URL}/suppliers`;


    try {

        showMessage("Loading suppliers...");

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Could not load suppliers.");
        }

        const suppliers = await response.json();

        renderSuppliers(suppliers);

        showMessage(
            `${suppliers.length} supplier(s) found.`,
            "success"
        );

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );
    }
}


async function updateRate(supplier) {

    const newRate = prompt(
        `New rate per unit for ${supplier.name}:`,
        supplier.rate_per_unit
    );

    if (newRate === null) {
        return;
    }


    const rate = Number(newRate);

    if (!Number.isFinite(rate) || rate <= 0) {
        showMessage(
            "Rate must be greater than zero.",
            "error"
        );

        return;
    }


    try {

        const response = await fetch(
            `${API_BASE_URL}/suppliers/${supplier.id}/rate`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    rate_per_unit: rate
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.detail || "Could not update rate."
            );
        }


        showMessage(
            "Rate updated successfully.",
            "success"
        );

        await loadSuppliers();

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );
    }
}


async function updateStatus(supplier) {

    const newStatus =
        supplier.status === "active"
            ? "suspended"
            : "active";


    try {

        const response = await fetch(
            `${API_BASE_URL}/suppliers/${supplier.id}/status`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status: newStatus
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.detail || "Could not update status."
            );
        }


        showMessage(
            `Supplier ${newStatus}.`,
            "success"
        );

        await loadSuppliers();

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );
    }
}


supplierForm.addEventListener("submit", async event => {

    event.preventDefault();


    const categories =
        Array.from(
            document.getElementById("categories").selectedOptions
        ).map(option => option.value);


    const supplier = {
        name: document.getElementById("name").value.trim(),

        country:
            document.getElementById("country").value,

        categories,

        rate_per_unit:
            Number(
                document.getElementById("rate_per_unit").value
            ),

        currency:
            document.getElementById("currency").value,

        status:
            document.getElementById("status").value,

        contact_email:
            document.getElementById("contact_email").value.trim()
            || null,

        notes:
            document.getElementById("notes").value.trim()
            || null
    };


    try {

        const response = await fetch(
            `${API_BASE_URL}/suppliers`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(supplier)
            }
        );


        const data = await response.json();


        if (!response.ok) {

            const errorMessage =
                Array.isArray(data.detail)
                    ? data.detail
                        .map(error => error.msg)
                        .join(", ")
                    : data.detail || "Could not create supplier.";

            throw new Error(errorMessage);
        }


        showMessage(
            "Supplier registered successfully.",
            "success"
        );

        supplierForm.reset();

        await loadSuppliers();

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );
    }
});


countryFilter.addEventListener(
    "change",
    loadSuppliers
);

categoryFilter.addEventListener(
    "change",
    loadSuppliers
);

refreshButton.addEventListener(
    "click",
    loadSuppliers
);


checkApi();
loadSuppliers();

// ============================================================
// INCIDENT MANAGER
// ============================================================

const incidentsTable = document.getElementById("incidents-table");
const incidentListMessage =
    document.getElementById("incident-list-message");

const incidentForm =
    document.getElementById("incident-form");

const incidentFormMessage =
    document.getElementById("incident-form-message");

const incidentSubmitButton =
    document.getElementById("incident-submit-button");

const incidentStatusFilter =
    document.getElementById("incident-status-filter");

const incidentOriginFilter =
    document.getElementById("incident-origin-filter");

const incidentBranchFilter =
    document.getElementById("incident-branch-filter");

const incidentsRefreshButton =
    document.getElementById("incidents-refresh-button");

const incidentOrigin =
    document.getElementById("incident-origin");

const incidentBranchField =
    document.getElementById("incident-branch-field");

const incidentBranch =
    document.getElementById("incident-branch");


const branchLabels = {
    central: "Central",
    medellin_centro: "Medellín Centro",
    medellin_laureles: "Medellín Laureles",
    medellin_envigado: "Medellín Envigado",
    medellin_bello: "Medellín Bello",
    medellin_itagui: "Medellín Itagüí",
    bogota_chapinero: "Bogotá Chapinero",
    bogota_usaquen: "Bogotá Usaquén",
    cali_granada: "Cali Granada",
    barranquilla_norte: "Barranquilla Norte",
    miami_doral: "Miami Doral",
    miami_hialeah: "Miami Hialeah",
    miami_kendall: "Miami Kendall",
    orlando_international: "Orlando International Drive",
    fort_lauderdale: "Fort Lauderdale"
};


function formatIncidentStatus(status) {
    return status
        .replace("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}


function showIncidentMessage(text, type = "") {
    incidentListMessage.textContent = text;
    incidentListMessage.className = `message ${type}`;
}


function showIncidentFormMessage(text, type = "") {
    incidentFormMessage.textContent = text;
    incidentFormMessage.className = `message ${type}`;
}


function createIncidentStatusSelect(incident) {

    const select = document.createElement("select");

    select.className = "incident-status-select";

    const allowedTransitions = {
        open: ["in_progress", "discarded"],
        in_progress: ["resolved", "discarded"],
        resolved: [],
        discarded: []
    };

    const options = [
        incident.status,
        ...allowedTransitions[incident.status]
    ];

    [...new Set(options)].forEach(status => {

        const option = document.createElement("option");

        option.value = status;
        option.textContent = formatIncidentStatus(status);

        if (status === incident.status) {
            option.selected = true;
        }

        select.appendChild(option);
    });


    if (allowedTransitions[incident.status].length === 0) {
        select.disabled = true;
    }


    select.addEventListener("change", async () => {

        const previousStatus = incident.status;
        const newStatus = select.value;

        incident.status = newStatus;

        select.disabled = true;

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/incidents/${incident.id}/status?status=${newStatus}`,
                {
                    method: "PATCH"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail?.message ||
                    data.detail ||
                    "Could not update incident status."
                );
            }

            showIncidentMessage(
                "Incident status updated successfully.",
                "success"
            );

            await loadIncidents();
            await loadIncidentSummary();

        } catch (error) {

            incident.status = previousStatus;

            select.value = previousStatus;

            select.disabled = false;

            showIncidentMessage(
                error.message,
                "error"
            );
        }
    });


    return select;
}


function renderIncidents(incidents) {

    incidentsTable.innerHTML = "";


    if (incidents.length === 0) {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td colspan="8">
                No incidents found.
            </td>
        `;

        incidentsTable.appendChild(row);

        return;
    }


    incidents.forEach(incident => {

        const row = document.createElement("tr");


        const idCell = document.createElement("td");
        idCell.textContent = incident.id;


        const titleCell = document.createElement("td");

        titleCell.innerHTML = `
            <strong>${incident.title}</strong>
            <small>${incident.description}</small>
        `;


        const categoryCell = document.createElement("td");
        categoryCell.textContent =
            formatIncidentStatus(incident.category);


        const statusCell = document.createElement("td");
        statusCell.appendChild(
            createIncidentStatusSelect(incident)
        );


        const originCell = document.createElement("td");
        originCell.textContent =
            formatIncidentStatus(incident.origin);


        const branchCell = document.createElement("td");
        branchCell.textContent =
            branchLabels[incident.branch] || incident.branch;


        const createdCell = document.createElement("td");
        createdCell.textContent =
            formatDate(incident.created_at);


        const actionsCell = document.createElement("td");
        actionsCell.textContent = "—";


        row.appendChild(idCell);
        row.appendChild(titleCell);
        row.appendChild(categoryCell);
        row.appendChild(statusCell);
        row.appendChild(originCell);
        row.appendChild(branchCell);
        row.appendChild(createdCell);
        row.appendChild(actionsCell);

        incidentsTable.appendChild(row);
    });
}


async function loadIncidents() {

    const params = new URLSearchParams();


    if (incidentStatusFilter.value) {
        params.set(
            "status",
            incidentStatusFilter.value
        );
    }


    if (incidentOriginFilter.value) {
        params.set(
            "origin",
            incidentOriginFilter.value
        );
    }


    if (incidentBranchFilter.value) {
        params.set(
            "branch",
            incidentBranchFilter.value
        );
    }


    const queryString = params.toString();

    const url = queryString
        ? `${API_BASE_URL}/api/incidents?${queryString}`
        : `${API_BASE_URL}/api/incidents`;


    try {

        showIncidentMessage(
            "Loading incidents..."
        );


        const response = await fetch(url);


        if (!response.ok) {
            throw new Error(
                "Could not load incidents."
            );
        }


        const incidents = await response.json();

        renderIncidents(incidents);


        showIncidentMessage(
            `${incidents.length} incident(s) found.`,
            "success"
        );


    } catch (error) {

        incidentsTable.innerHTML = `
            <tr>
                <td colspan="8">
                    Could not load incidents.
                </td>
            </tr>
        `;


        showIncidentMessage(
            error.message,
            "error"
        );
    }
}


async function loadIncidentSummary() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/incidents/summary`
        );


        if (!response.ok) {
            throw new Error(
                "Could not load summary."
            );
        }


        const summary = await response.json();


        document.getElementById(
            "incident-total"
        ).textContent = summary.total;


        document.getElementById(
            "incident-open"
        ).textContent =
            summary.by_status.open || 0;


        document.getElementById(
            "incident-in-progress"
        ).textContent =
            summary.by_status.in_progress || 0;


        document.getElementById(
            "incident-resolved"
        ).textContent =
            summary.by_status.resolved || 0;


        document.getElementById(
            "incident-discarded"
        ).textContent =
            summary.by_status.discarded || 0;


    } catch {

        document.getElementById(
            "incident-total"
        ).textContent = "—";


        document.getElementById(
            "incident-open"
        ).textContent = "—";


        document.getElementById(
            "incident-in-progress"
        ).textContent = "—";


        document.getElementById(
            "incident-resolved"
        ).textContent = "—";


        document.getElementById(
            "incident-discarded"
        ).textContent = "—";
    }
}


incidentOrigin.addEventListener(
    "change",
    () => {

        incidentBranchField.classList.toggle(
            "branch-highlight",
            incidentOrigin.value === "branch"
        );

        incidentBranchField.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }
);


incidentForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        incidentSubmitButton.disabled = true;

        incidentSubmitButton.textContent =
            "Registering...";


        showIncidentFormMessage(
            "Registering incident..."
        );


        const incident = {

            title:
                document.getElementById(
                    "incident-title"
                ).value.trim(),

            description:
                document.getElementById(
                    "incident-description"
                ).value.trim(),

            category:
                document.getElementById(
                    "incident-category"
                ).value,

            origin:
                document.getElementById(
                    "incident-origin"
                ).value,

            branch:
                document.getElementById(
                    "incident-branch"
                ).value
        };


        try {

            const response = await fetch(
                `${API_BASE_URL}/api/incidents`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify(incident)
                }
            );


            const data = await response.json();


            if (!response.ok) {

                let errorMessage =
                    "Could not register incident.";


                if (data.errors) {

                    errorMessage =
                        data.errors
                            .map(error =>
                                `${error.field}: ${error.message}`
                            )
                            .join(" | ");

                } else if (data.detail) {

                    errorMessage =
                        typeof data.detail === "string"
                            ? data.detail
                            : data.detail.message ||
                              "Could not register incident.";
                }


                throw new Error(errorMessage);
            }


            showIncidentFormMessage(
                "Incident registered successfully.",
                "success"
            );


            incidentForm.reset();


            incidentBranchField.classList.remove(
                "branch-highlight"
            );


            await loadIncidents();
            await loadIncidentSummary();


        } catch (error) {

            showIncidentFormMessage(
                error.message,
                "error"
            );


        } finally {

            incidentSubmitButton.disabled = false;

            incidentSubmitButton.textContent =
                "Register incident";
        }
    }
);


incidentStatusFilter.addEventListener(
    "change",
    loadIncidents
);

incidentOriginFilter.addEventListener(
    "change",
    loadIncidents
);

incidentBranchFilter.addEventListener(
    "change",
    loadIncidents
);

incidentsRefreshButton.addEventListener(
    "click",
    async () => {
        await loadIncidents();
        await loadIncidentSummary();
    }
);


loadIncidents();
loadIncidentSummary();
