const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateResponse(prompt) {
    try {
      console.log('🔄 Gemini Service: Received prompt, calling Gemini API...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim()) {
        console.log('✅ Gemini Service: Successfully received response from API');
        return text.trim();
      } else {
        throw new Error('Empty response from Gemini');
      }
    } catch (error) {
      console.error('❌ Gemini Service: Error calling Gemini API:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const testPrompt = 'Hello, can you respond with just "Gemini is working" if you can read this?';
      const response = await this.generateResponse(testPrompt);
      return response.includes('Gemini is working') || response.length > 0;
    } catch (error) {
      console.error('Gemini connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new GeminiService();
