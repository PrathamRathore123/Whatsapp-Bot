const fs = require('fs');
const config = require('./config');

class ConversationManager {
  constructor() {
    this.conversations = this.loadConversations();
  }

  loadConversations() {
    try {
      if (fs.existsSync(config.CONVERSATIONS_FILE)) {
        const data = fs.readFileSync(config.CONVERSATIONS_FILE, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading conversations:', error);
      return {};
    }
  }

  saveConversations() {
    try {
      fs.writeFileSync(config.CONVERSATIONS_FILE, JSON.stringify(this.conversations, null, 2));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  }

  addMessage(userId, message, isBot = false) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }

    this.conversations[userId].push({
      timestamp: new Date().toISOString(),
      message: message,
      isBot: isBot
    });

    // Keep only last 50 messages per user to prevent file from growing too large
    if (this.conversations[userId].length > 50) {
      this.conversations[userId] = this.conversations[userId].slice(-50);
    }

    this.saveConversations();
  }

  getConversationHistory(userId, limit = 10) {
    if (!this.conversations[userId]) {
      return [];
    }

    return this.conversations[userId].slice(-limit);
  }

  getConversationContext(userId) {
    const history = this.getConversationHistory(userId, 20);
    return history.map(msg => `${msg.isBot ? 'Bot' : 'User'}: ${msg.message}`).join('\n');
  }

  storeQuoteData(userId, quoteData) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }

    // Store quote data as a special message type
    this.conversations[userId].push({
      timestamp: new Date().toISOString(),
      type: 'quote_data',
      data: quoteData,
      isBot: true
    });

    this.saveConversations();
  }

  getQuoteData(userId) {
    if (!this.conversations[userId]) {
      return null;
    }

    // Find the most recent quote data
    const quoteEntry = this.conversations[userId]
      .slice()
      .reverse()
      .find(msg => msg.type === 'quote_data');

    return quoteEntry ? quoteEntry.data : null;
  }

  deleteConversation(userId) {
    if (this.conversations[userId]) {
      delete this.conversations[userId];
      this.saveConversations();
      console.log(`Conversation deleted for user: ${userId}`);
    }
  }
}

module.exports = new ConversationManager();
