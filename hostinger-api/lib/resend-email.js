function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("Email not sent: RESEND_API_KEY or RESEND_FROM_EMAIL is missing.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`Resend email request failed with HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend email request failed:", error instanceof Error ? error.name : "request error");
    return false;
  }
}

module.exports = { escapeHtml, sendResendEmail };
