
require('dotenv').config();

module.exports = {
  GREETING_MESSAGE: process.env.GREETING_MESSAGE || 'Welcome to Unravel Experience!',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  TRAVEL_PACKAGES_FILE: process.env.TRAVEL_PACKAGES_FILE || './travelPackages.json',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
  CONVERSATIONS_FILE: process.env.CONVERSATIONS_FILE || './conversations.json',
  GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './google-service-account.json',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama2',
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  WEBHOOK_PORT: process.env.WEBHOOK_PORT || 3001,
  WEBHOOK_AUTH_TOKEN: process.env.WEBHOOK_AUTH_TOKEN,
  EXECUTIVE_PHONE: process.env.EXECUTIVE_PHONE
};
