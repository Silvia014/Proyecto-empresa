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
