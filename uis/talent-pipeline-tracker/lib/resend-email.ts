type ResendMessage = { to: string; subject: string; html: string; text: string };

export async function sendResendEmail(message: ResendMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(`Resend email not sent; missing ${[
      !apiKey ? "RESEND_API_KEY" : null,
      !from ? "RESEND_FROM_EMAIL" : null,
    ].filter(Boolean).join(" and ")}.`);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error(`Resend returned HTTP ${response.status}.`);
    return response.ok;
  } catch (error) {
    console.error("Resend request failed:", error instanceof Error ? error.name : "request error");
    return false;
  }
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}
