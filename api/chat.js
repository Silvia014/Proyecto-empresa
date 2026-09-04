module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },

        body: JSON.stringify({
          model: "gpt-4.1-mini",

          instructions: `
You are the Brasaland virtual assistant.

You help customers with general questions about Brasaland.

You can help with:
- Restaurant locations
- Reservations
- Menu information
- Online orders
- Brasapoints loyalty program
- Account questions
- General customer support

Rules:
- Always answer in the same language as the customer.
- Be friendly and concise.
- Do not invent information.
- If you do not know something, clearly say that you do not have that information.
- Do not claim that you checked reservations, accounts, points, orders, or live availability.
- For questions requiring personal account information, explain that this feature is not available yet.
          `,

          input: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OPENAI ERROR:", data);

      return res.status(response.status).json({
        error: data.error?.message || "OpenAI request failed",
      });
    }

    return res.status(200).json({
      answer: data.output_text,
    });

  } catch (error) {
    console.error("CHAT ERROR:", error);

    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};