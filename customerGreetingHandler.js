const apiConnector = require('./apiConnector');
const config = require('./config');
const { sendMessage } = require('./whatsapp');

class CustomerGreetingHandler {
  constructor() {
  }

  async handleGreeting(msg) {
    if (msg.fromMe) return false;

    console.log(`Received message from ${msg.from}: ${msg.body}`);

    // Extract phone number for customer lookup
    const phoneNumber = msg.from.replace('@c.us', '');

    // Check if customer exists in backend
    const customerData = await apiConnector.getCustomerData(phoneNumber);

    // Check if message is a greeting
    if (this.isGreeting(msg.body)) {
      let greetingMessage = config.GREETING_MESSAGE;

      if (customerData && customerData.length > 0) {
        const customer = customerData[0];
        greetingMessage = `Hello ${customer.name}! Welcome back to Unravel Experience 🌍✨\n\n${config.GREETING_MESSAGE}`;
      }

      console.log(`🤖 Bot response to ${msg.from}: ${greetingMessage}`);
      await sendMessage(phoneNumber, greetingMessage);
      return true; // Greeting handled
    }

    return false; // Not a greeting, continue with normal flow
  }

  isGreeting(text) {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const lowerText = text.toLowerCase().trim();

    // Check if the message is only a greeting (or greeting with basic punctuation)
    return greetings.some(greet => {
      const greetPattern = new RegExp(`^\\s*${greet}\\s*[.!?]*\\s*$`, 'i');
      return greetPattern.test(lowerText);
    });
  }

  // Method to get customer data for use in other handlers
  async getCustomerData(phoneNumber) {
    return await apiConnector.getCustomerData(phoneNumber);
  }
}

module.exports = CustomerGreetingHandler;
