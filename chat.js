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
    } catch (parseError) {
      console.error("Chat API parse error:", {
        status: response.status,
        rawResponse,
        error: parseError,
      });

      throw new Error(
        "The assistant could not process the response. Please try again."
      );
    }

    if (!response.ok) {
      console.error("Chat API error:", {
        status: response.status,
        response: result,
      });

      throw new Error(
        "Something went wrong while getting a response. Please try again."
      );
    }

    addMessage(result.answer, "assistant");

  } catch (error) {
    console.error("Chat error:", error);

    addMessage(
      "Something went wrong while getting a response. Please try again.",
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