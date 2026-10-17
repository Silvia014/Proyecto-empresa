const INVENTORY_API_URL = "";

const supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
);

async function getToken() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        throw new Error(`Could not read the CRM session: ${error.message}`);
    }

    if (!data.session) {
        throw new Error(
            "No active CRM session. Sign in through the existing CRM login."
        );
    }

    return data.session.access_token;
}

async function inventoryRequest(path, options = {}) {
    const token = await getToken();

    if (!token) {
        throw new Error("Please log in to access inventory.");
    }

    const response = await fetch(`${INVENTORY_API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (response.status === 401) {
        localStorage.removeItem("inventory_access_token");
        window.location.href = "../login.html";
        throw new Error("Your session expired. Please log in again.");
    }

    if (!response.ok) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : "Request failed. Please try again."
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
