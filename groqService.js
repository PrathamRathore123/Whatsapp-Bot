const Groq = require("groq-sdk");

class GroqService {
  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    this.model = "gemma2-9b-it"; // Updated to current available model
  }

  async generateResponse(prompt) {
    try {
      console.log("🔄 Groq Service: Received prompt, calling Groq API...");
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });

      if (
        response.choices &&
        response.choices.length > 0 &&
        response.choices[0].message.content
      ) {
        const text = response.choices[0].message.content.trim();
        console.log("✅ Groq Service: Successfully received response from API");
        return text;
      } else {
        throw new Error("Empty response from Groq");
      }
    } catch (error) {
      console.error("❌ Groq Service: Error calling Groq API:", error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const testPrompt =
        'Hello, can you respond with just "Groq is working" if you can read this?';
      const response = await this.generateResponse(testPrompt);
      return response.includes("Groq is working") || response.length > 0;
    } catch (error) {
      console.error("Groq connection test failed:", error.message);
      return false;
    }
  }
}

module.exports = new GroqService();
