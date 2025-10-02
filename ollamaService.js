const axios = require('axios');
const config = require('./config');

class OllamaService {
  constructor() {
    this.model = config.OLLAMA_MODEL;
    this.host = config.OLLAMA_HOST;
  }

  async generateResponse(prompt) {
    try {
      console.log('🔄 Ollama Service: Received prompt, calling Ollama API...');
      const response = await axios.post(`${this.host}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false
      });

      if (response.data && response.data.response) {
        console.log('✅ Ollama Service: Successfully received response from API');
        return response.data.response.trim();
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      console.error('❌ Ollama Service: Error calling Ollama API:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.host}/api/tags`);
      return response.data.models && response.data.models.length > 0;
    } catch (error) {
      console.error('Ollama connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new OllamaService();
