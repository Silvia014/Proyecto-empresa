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

async function getTelemetryContext(itemId) {
    const product = (await getProducts()).find(
        item => item.id === Number(itemId)
    );

    let userId = null;

    try {
        const { data } = await supabaseClient.auth.getSession();
        userId = data?.session?.user?.id ?? null;
    } catch (error) {
        console.warn("[Telemetry] Could not read user ID:", error);
    }

    return { product, userId };
}

function trackInventoryEvent(eventType, product, quantity, reason, userId) {
    if (!window.TelemetryService || !product) return;

    window.TelemetryService.track(eventType, {
        location_id: product.location_id,
        country: product.country ?? null,
        product_id: product.id,
        product_category: product.category ?? null,
        quantity,
        unit: product.unit_of_measure ?? null,
        currency: product.currency ?? null,
        ...(reason ? { reason } : {}),
        ...(userId ? { userId } : {}),
    });
}

async function createInbound(data) {
    const result = await inventoryRequest("/inventory/orders/inbound", {
        method: "POST",
        body: JSON.stringify(data),
    });

    try {
        const { product, userId } = await getTelemetryContext(data.item_id);
        trackInventoryEvent(
            "inbound_order_created",
            product,
            data.quantity,
            data.reason,
            userId
        );
    } catch (error) {
        console.warn("[Telemetry] Could not record inbound order:", error);
    }

    return result;
}

async function createOutbound(data) {
    const result = await inventoryRequest("/inventory/orders/outbound", {
        method: "POST",
        body: JSON.stringify(data),
    });

    try {
        const { product, userId } = await getTelemetryContext(data.item_id);
        trackInventoryEvent(
            "outbound_order_created",
            product,
            data.quantity,
            data.reason,
            userId
        );
    } catch (error) {
        console.warn("[Telemetry] Could not record outbound order:", error);
    }

    return result;
}

async function getOrders() {
    return inventoryRequest("/inventory/orders");
}

window.getProducts = getProducts;
window.createInbound = createInbound;
window.createOutbound = createOutbound;
window.getOrders = getOrders;
