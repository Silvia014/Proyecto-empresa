const INVENTORY_API_URL = "http://127.0.0.1:8000";

const supabase = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
);

async function getToken() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        window.location.href = "../login";
        return null;
    }

    return data.session.access_token;
}

async function inventoryRequest(path, options = {}) {
    const token = await getToken();

    if (!token) {
        throw new Error("You must be logged in.");
    }

    const response = await fetch(
        `${INVENTORY_API_URL}${path}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        let message = "Something went wrong.";

        if (data?.detail) {
            message =
                typeof data.detail === "string"
                    ? data.detail
                    : data.detail.message || message;
        }

        if (data?.errors) {
            message = data.errors
                .map(error => `${error.field}: ${error.message}`)
                .join(" | ");
        }

        throw new Error(message);
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