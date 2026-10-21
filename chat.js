const chatToggle = document.getElementById("chat-toggle");
const chatMenu = document.getElementById("chat-menu");
const chatWindow = document.getElementById("chat-window");
const chatClose = document.getElementById("chat-close");

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");


// ==========================================
// OPEN / CLOSE CHAT MENU
// ==========================================

chatToggle?.addEventListener("click", (event) => {
  event.stopPropagation();

  const isMenuVisible = !chatMenu.classList.contains("hidden");
  chatMenu.classList.toggle("hidden", isMenuVisible);
  chatToggle.setAttribute("aria-expanded", String(!isMenuVisible));

  if (!isMenuVisible) {
    chatWindow.classList.add("hidden");
  }
});

chatMenu?.querySelectorAll("[data-chat-action]").forEach((option) => {
  option.addEventListener("click", () => {
    chatMenu.classList.add("hidden");
    chatToggle.setAttribute("aria-expanded", "false");

    const action = option.dataset.chatAction;

    if (action === "chat") {
      chatWindow.classList.remove("hidden");
      return;
    }

    if (action === "whatsapp") {
      window.open(
        "https://wa.me/?text=Hola%20Brasaland%20quiero%20hacer%20una%20consulta",
        "_blank",
        "noopener,noreferrer"
      );
    }
  });
});

document.addEventListener("click", (event) => {
  if (!chatMenu?.contains(event.target) && !chatToggle?.contains(event.target)) {
    chatMenu?.classList.add("hidden");
    chatToggle?.setAttribute("aria-expanded", "false");
  }
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