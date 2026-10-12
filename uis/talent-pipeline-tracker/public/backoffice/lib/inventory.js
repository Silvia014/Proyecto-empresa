const INVENTORY_API_URL = "http://127.0.0.1:8000";

let crmAccessToken = null;
let resolveTokenReady;

const tokenReady = new Promise((resolve) => {
    resolveTokenReady = resolve;
});

window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== "CRM_ACCESS_TOKEN") return;
    if (typeof event.data.token !== "string") return;

    crmAccessToken = event.data.token;
    resolveTokenReady(crmAccessToken);
});

async function getToken() {
    if (crmAccessToken) return crmAccessToken;

    const token = await Promise.race([
        tokenReady,
        new Promise((_, reject) =>
            setTimeout(
                () => reject(new Error("No se recibió la sesión del CRM.")),
                10000
            )
        ),
    ]);

    if (!token) throw new Error("Inicia sesión en el CRM.");
    return token;
}

async function inventoryRequest(path, options = {}) {
    const token = await getToken();

    const response = await fetch(`${INVENTORY_API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        // La respuesta puede no contener JSON.
    }

    if (!response.ok) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : `Error de la API (${response.status}).`
        );
    }

    return data;
}

async function getProducts() {
    return inventoryRequest("/inventory/products");
}

async function createInbound(data) {
    return inventoryRequest("/inventory/orders/inbound", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

async function createOutbound(data) {
    return inventoryRequest("/inventory/orders/outbound", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

async function getOrders() {
    return inventoryRequest("/inventory/orders");
}

window.getProducts = getProducts;
window.createInbound = createInbound;
window.createOutbound = createOutbound;
window.getOrders = getOrders;
