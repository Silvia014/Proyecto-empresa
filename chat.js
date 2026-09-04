const chatToggle = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const chatClose = document.getElementById("chat-close");

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");


// ==========================================
// OPEN / CLOSE CHAT
// ==========================================

chatToggle?.addEventListener("click", () => {
  chatWindow.classList.toggle("hidden");
});

chatClose?.addEventListener("click", () => {
  chatWindow.classList.add("hidden");
});


// ==========================================
// SEND MESSAGE
// ==========================================

chatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = chatInput.value.trim();

  if (!message) return;

  addMessage(message, "user");

  chatInput.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });

    const rawResponse = await response.text();

    console.log("Chat API status:", response.status);
    console.log("Chat API raw response:", rawResponse);

    let result;

    try {
      result = JSON.parse(rawResponse);
    } catch {
      throw new Error(
        `Server returned status ${response.status}: ${rawResponse}`
      );
    }

    if (!response.ok) {
      throw new Error(result.error || "Something went wrong");
    }

    addMessage(result.answer, "assistant");

  } catch (error) {
    console.error("Chat error:", error);

    addMessage(
      "Error: " + error.message,
      "assistant"
    );
  }
});


// ==========================================
// ADD MESSAGE TO CHAT
// ==========================================

function addMessage(text, sender) {
  const messageElement = document.createElement("div");

  messageElement.classList.add(
    "chat-message",
    sender
  );

  messageElement.textContent = text;

  chatMessages.appendChild(messageElement);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}