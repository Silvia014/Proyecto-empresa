(function () {
  "use strict";

  const ENDPOINT =
    window.TELEMETRY_ENDPOINT ||
    "http://127.0.0.1:8000/telemetry/events";

  const FLUSH_INTERVAL = 10_000;
  const MAX_BATCH_SIZE = 20;
  const MAX_RETRIES = 5;

  const VALID_EVENTS = new Set([
    "inbound_order_created",
    "outbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "direct_stock_edit_rejected",
    "ingredient_price_variance_detected",
  ]);

  let queue = [];
  let retryTimer = null;
  let retryCount = 0;
  let flushing = false;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getSessionId() {
    const key = "brasaland_telemetry_session";

    try {
      let sessionId = sessionStorage.getItem(key);

      if (!sessionId) {
        sessionId = createId();
        sessionStorage.setItem(key, sessionId);
      }

      return sessionId;
    } catch {
      return createId();
    }
  }

  function createEvent(eventType, properties) {
    return {
      eventId: createId(),
      sessionId: getSessionId(),
      userId: properties.userId ?? null,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      schemaVersion: "1.0",
      requestId: createId(),
      properties: { ...properties },
    };
  }

  async function sendBatch(events) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`Telemetry HTTP ${response.status}`);
    }

    return response.json();
  }

  function scheduleRetry() {
    if (retryTimer || retryCount >= MAX_RETRIES) {
      if (retryCount >= MAX_RETRIES) {
        console.error(
          "[Telemetry] Maximum retries reached. Events remain queued."
        );
      }
      return;
    }

    const delay = Math.min(1000 * 2 ** retryCount, 30_000);
    retryCount += 1;

    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      flush();
    }, delay);
  }

  async function flush() {
    if (flushing || queue.length === 0) {
      return;
    }

    flushing = true;

    const batch = queue.splice(0, MAX_BATCH_SIZE);

    try {
      await sendBatch(batch);
      retryCount = 0;

      if (queue.length >= MAX_BATCH_SIZE) {
        await flush();
      }
    } catch (error) {
      // Restore failed events at the front of the queue.
      queue = batch.concat(queue);
      console.error("[Telemetry] Batch delivery failed:", error);
      scheduleRetry();
    } finally {
      flushing = false;
    }
  }

  function sendPendingWithBeacon() {
    if (queue.length === 0 || !navigator.sendBeacon) {
      return;
    }

    const batch = queue.splice(0, MAX_BATCH_SIZE);
    const body = new Blob(
      [JSON.stringify({ events: batch })],
      { type: "application/json" }
    );

    const accepted = navigator.sendBeacon(ENDPOINT, body);

    if (!accepted) {
      queue = batch.concat(queue);
    }
  }

  function track(eventType, properties) {
    if (!VALID_EVENTS.has(eventType)) {
      console.error("[Telemetry] Unknown event type:", eventType);
      return;
    }

    if (
      !properties ||
      typeof properties !== "object" ||
      Array.isArray(properties)
    ) {
      console.error("[Telemetry] Event properties must be an object.");
      return;
    }

    queue.push(createEvent(eventType, properties));

    if (queue.length >= MAX_BATCH_SIZE) {
      flush();
    }
  }

  window.TelemetryService = Object.freeze({ track });

  window.setInterval(() => {
    flush();
  }, FLUSH_INTERVAL);

  window.addEventListener("pagehide", sendPendingWithBeacon);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      sendPendingWithBeacon();
    }
  });
})();
