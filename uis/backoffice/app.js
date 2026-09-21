const API_BASE_URL = "http://127.0.0.1:8000";

const uploadForm = document.getElementById("upload-form");
const csvFile = document.getElementById("csv-file");
const analyzeButton = document.getElementById("analyze-button");

const message = document.getElementById("message");
const resultsSection = document.getElementById("results");

const apiStatus = document.getElementById("api-status");

const totalRecords = document.getElementById("total-records");
const validRecords = document.getElementById("valid-records");
const invalidRecords = document.getElementById("invalid-records");
const satisfactionAverage = document.getElementById(
    "satisfaction-average"
);

const categoriesContainer = document.getElementById("categories");
const statusesContainer = document.getElementById("statuses");
const invalidBreakdownContainer = document.getElementById(
    "invalid-breakdown"
);
const satisfactionScoresContainer = document.getElementById(
    "satisfaction-scores"
);

const downloadButton = document.getElementById("download-button");


async function checkApi() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);

        if (!response.ok) {
            throw new Error("API unavailable");
        }

        apiStatus.textContent = "API: online";
    } catch (error) {
        apiStatus.textContent = "API: offline";
    }
}


function renderRows(container, data) {
    container.innerHTML = "";

    Object.entries(data).forEach(([key, value]) => {

        const row = document.createElement("div");

        row.className = "result-row";

        row.innerHTML = `
            <span>${key.replaceAll("_", " ")}</span>
            <span class="result-value">${value}</span>
        `;

        container.appendChild(row);
    });
}


function renderResults(data) {

    totalRecords.textContent = data.total;
    validRecords.textContent = data.valid;
    invalidRecords.textContent = data.invalid;

    satisfactionAverage.textContent =
        Number(data.satisfaction_average).toFixed(2);

    renderRows(
        categoriesContainer,
        data.categories
    );

    renderRows(
        statusesContainer,
        data.statuses
    );

    renderRows(
        invalidBreakdownContainer,
        data.invalid_counts
    );

    renderRows(
        satisfactionScoresContainer,
        data.satisfaction_scores
    );

    resultsSection.classList.remove("hidden");
}


uploadForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const file = csvFile.files[0];

    if (!file) {
        message.textContent = "Please select a CSV file.";
        return;
    }

    analyzeButton.disabled = true;
    message.textContent = "Analyzing incidents...";

    const formData = new FormData();

    formData.append("file", file);

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/incidents/analyze`,
            {
                method: "POST",
                body: formData,
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Analysis failed."
            );
        }

        renderResults(data);

        message.textContent =
            "Analysis completed successfully.";

    } catch (error) {

        message.textContent =
            `Error: ${error.message}`;

    } finally {

        analyzeButton.disabled = false;
    }
});


downloadButton.addEventListener("click", () => {

    window.open(
        `${API_BASE_URL}/api/incidents/results/export`,
        "_blank"
    );
});


checkApi();
