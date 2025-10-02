const aiService = require('./aiService_updated');
const apiConnector = require('./apiConnector');
const conversationManager = require('./conversationManager_updated');
const googleSheetsManager = require('./googleSheetsManager');
const customerGreetingHandler = require('./customerGreetingHandler');
const config = require('./config');
const { sendMessage } = require('./whatsapp');

class MessageHandler {
  constructor() {
    this.customerGreetingHandler = new customerGreetingHandler();
  }

  async handleIncomingMessage(msg) {
    if (msg.fromMe) return;

    console.log(`Received message from ${msg.from}: ${msg.body}`);

    // Extract phone number for customer lookup
    const phoneNumber = msg.from.replace('@c.us', '');

    // Check if customer exists in backend
    const customerData = await apiConnector.getCustomerData(phoneNumber);

    // Handle customer greeting using the dedicated handler
    const greetingHandled = await this.customerGreetingHandler.handleGreeting(msg);
    if (greetingHandled) {
      return; // Greeting was handled, exit
    }

    // Handle price inquiry
    if (this.isPriceInquiry(msg.body)) {
      await this.handlePriceInquiry(msg, customerData);
      return;
    }

    // Check if message is "Finalize" command
    if (this.isFinalizeCommand(msg.body)) {
      await this.handleFinalizeCommand(msg, customerData);
      return;
    }

    // Check if message is "Book My Trip" command
    if (this.isBookMyTripCommand(msg.body)) {
      await this.handleBookMyTripCommand(msg, customerData);
      return;
    }

    // Check if message contains booking information
    if (this.containsBookingInfo(msg.body)) {
      // Do not send confirmation message after saving booking info
      await this.handleBookingInfo(msg, customerData);
    }

    // Use AI service to generate response with conversation history
    const conversationHistory = conversationManager.getConversationContext(msg.from);
    const aiReply = await aiService.getAIResponse(msg.body, msg.from, conversationHistory);

    // Save user message and bot reply to conversation history
    conversationManager.addMessage(msg.from, msg.body, false);
    conversationManager.addMessage(msg.from, aiReply, true);

    console.log(`🤖 Bot response to ${msg.from}: ${aiReply}`);
    const phoneNumberForSend = msg.from.replace('@c.us', '');
    await sendMessage(phoneNumberForSend, aiReply);
  }

  // Method to handle vendor quoteNaN return date.getFullYear() == year &&
           date.getMonth() + 1 == parseInt(month) &&
           date.getDate() == parseInt(day) &&
           year >= 2024 && year <= 2030; // Reasonable year range
  }

  // Helper function to convert date to backend format (YYYY-MM-DD)
  convertToBackendDateFormat(dateString) {
    // Input format: dd/mm/yyyy or dd-mm-yyyy
    // Output format: yyyy-mm-dd
    const dateRegex = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) return dateString; // Return original if format doesn't match

    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  formatExecutiveMessage(customerInfo) {
    const timestamp = new Date().toLocaleString();

    let message = `🚨 NEW BOOKING REQUEST\n`;
    message += `⏰ Time: ${timestamp}\n\n`;
    message += `👤 CUSTOMER DETAILS:\n`;
    message += `📱 Phone: ${customerInfo.phone}\n`;

    if (customerInfo.name) {
      message += `👤 Name: ${customerInfo.name}\n`;
    }

    message += `\n🎯 TRIP DETAILS:\n`;

    if (customerInfo.package) {
      message += `📦 Package: ${customerInfo.package}\n`;
    }

    if (customerInfo.destination) {
      message += `📍 Destination: ${customerInfo.destination}\n`;
    }

    if (customerInfo.numberOfPeople) {
      message += `👥 Travelers: ${customerInfo.numberOfPeople} person(s)\n`;
    }

    if (customerInfo.dates) {
      message += `📅 Dates: ${customerInfo.dates}\n`;
    }

    if (customerInfo.budget) {
      message += `💰 Budget: ${customerInfo.budget}\n`;
    }

    // Add vendor quotes if available
    if (customerInfo.vendorQuotes && customerInfo.vendorQuotes.length > 0) {
      message += `\n💰 VENDOR QUOTES RECEIVED:\n`;
      customerInfo.vendorQuotes.forEach((quote, index) => {
        message += `${index + 1}. ${quote.vendor_name}: $${quote.final_price}\n`;
        if (quote.quote_details) {
          message += `   Details: ${quote.quote_details.substring(0, 100)}...\n`;
        }
      });
    }

    message += `\n💬 CONVERSATION SUMMARY:\n`;
    message += `${customerInfo.conversationSummary.substring(0, 500)}${customerInfo.conversationSummary.length > 500 ? '...' : ''}\n\n`;
    message += `⚡ ACTION REQUIRED: Please contact this customer to finalize booking details and payment.`;

    return message;
  }
}

module.exports = MessageHandler;
