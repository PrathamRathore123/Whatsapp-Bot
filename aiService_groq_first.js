const GeminiService = require('./geminiService.js');
const OllamaService = require('./ollamaService.js');
const GroqService = require('./groqService.js');
const fs = require('fs');
const config = require('./config.js');

class AIService {
  constructor() {
    this.geminiService = GeminiService;
    this.groqService = GroqService;
    this.ollamaService = OllamaService;
    this.packagesData = this.loadPackagesData();
    this.lastResponseSentForUser = {}; // Track last response per user to prevent duplicates

    // Clean up duplicate tracking every 5 minutes to prevent memory leaks
    setInterval(() => {
      this.lastResponseSentForUser = {};
    }, 5 * 60 * 1000);
  }

  loadPackagesData() {
    try {
      const data = fs.readFileSync(config.TRAVEL_PACKAGES_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading packages data:', error);
      return { packages: [] };
    }
  }

  async getAIResponse(userMessage, userId, conversationHistory = '') {
    const packagesContext = this.packagesData.packages.map(pkg =>
      `Package ${pkg.id}: ${pkg.name} - ${pkg.destination} - ${pkg.duration}  - ${pkg.description}`
    ).join('\n');

    const hasConversationHistory = conversationHistory && conversationHistory.trim().length > 0;

    // Extract current booking data from conversation
    const currentBookingData = this.extractCurrentBookingData(conversationHistory, userMessage);
    const dataStatus = this.getDataCollectionStatus(currentBookingData);

    const prompt = `
Your role is to help customers choose from our travel packages, collect their details, and guide them toward booking.

${hasConversationHistory ? 'The customer has already been greeted. Do not send greeting messages.' : ''}

These are the ONLY available packages:
${packagesContext}

${conversationHistory ? `Conversation history:\n${conversationHistory}\n` : ''}

Customer message: "${userMessage}"

🎯 CURRENT BOOKING DATA STATUS:
${dataStatus}

🎯 Goals

Give clear, short, and friendly answers about available travel packages.

Encourage the customer to book a package.

Collect all required details (name, travel dates, number of guests, preferences).

Once details are collected, guide them to send 'finalize' for prices, then 'book my trip' to complete booking.

📝 Rules

Tone & Style

Speak directly to the customer (no narrating like "Bot Response:").

Be friendly, professional, and human-like.

Keep replies short, simple, and clear.

Use emojis naturally to make the chat engaging.

Packages

ONLY mention packages from the list above by name and ID.

Do NOT mention or suggest any packages not listed above.

If a package is not available, reply:

"Sorry, that package isn't available ❌."
Then suggest an available package from the list.

NEVER make up or invent new packages.

Do not share links, personal, or company info.

Only talk about our travel packages.

Booking Process

First collect:

Name 🙋

Start date 📅(dd/mm/yyyy)


Number of guests 👨‍👩‍👧‍👦

Preferences 🌍

Do not ask for budget.

After collecting all details, say:

"okay send 'finalize' to get prices and check availability. Thank you 🙏 Please wait while I check the availability and finalize the price. I'll get back to you shortly ⏳."

If the customer asks about booking or pricing, reply:

"To get prices and check availability, send 'finalize' 💰. After seeing the quotes, if you want to book, send 'book my trip' 📋✈️"

Conversation Handling

${hasConversationHistory ? 'Continue the existing conversation naturally.' : 'This is a new conversation.'}

Don't continue old numbering or lists unnecessarily.

✅ Example Replies

Customer asks about a package:
"The Bali Explorer (P001) 🏖️ is a 5D/4N trip full of beaches and culture! Would you like me to check availability for your dates?"

Package not available:
"Sorry, that package isn't available ❌. But we do have the Bali Explorer (P001) 🏖️, a perfect relaxing getaway!"

After collecting details:
"Thank you 🙏 Please wait while I check the availability and finalize the price. I'll get back to you shortly ⏳."

When booking is confirmed:
"To get prices and check availability, send 'finalize' 💰. After seeing the quotes, if you want to book, send 'book my trip' 📋✈️"

`;

    try {
      console.log(`🤖 Sending prompt to Groq AI for user ${userId}:`, prompt.substring(0, 200) + '...');
      const response = await this.groqService.generateResponse(prompt);
      console.log(`🤖 Received response from Groq AI for user ${userId}:`, response.substring(0, 200) + '...');
      return response;
    } catch (groqError) {
      console.error('Groq AI error:', groqError.message);
      console.log('Attempting to use Gemini as fallback...');

      try {
        console.log(`🤖 Sending prompt to Gemini for user ${userId}:`, prompt.substring(0, 200) + '...');
        const geminiResponse = await this.geminiService.generateResponse(prompt);
        console.log(`🤖 Received response from Gemini for user ${userId}:`, geminiResponse.substring(0, 200) + '...');
        return geminiResponse;
      } catch (geminiError) {
        console.error('Gemini fallback also failed:', geminiError.message);
        console.log('Attempting to use Ollama as final fallback...');

        try {
          console.log(`🤖 Sending prompt to Ollama AI for user ${userId}:`, prompt.substring(0, 200) + '...');
          const ollamaResponse = await this.ollamaService.generateResponse(prompt);
          console.log(`🤖 Received response from Ollama AI for user ${userId}:`, ollamaResponse.substring(0, 200) + '...');
          return ollamaResponse;
        } catch (ollamaError) {
          console.error('Ollama fallback also failed:', ollamaError.message);
          console.error('Full Ollama error:', ollamaError);
          // Prevent duplicate responses by returning only once
          if (this.lastResponseSentForUser[userId]) {
            console.log(`Duplicate response prevented for user ${userId}`);
            return '';
          }
          this.lastResponseSentForUser[userId] = true;
          return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
        }
      }
    }
  }

  // Extract current booking data from conversation history and current message
  extractCurrentBookingData(conversationHistory, currentMessage) {
    const bookingData = {
      customerName: '',
      package: '',
      destination: '',
      startDate: '',
      endDate: '',
      numberOfPeople: '',
      preferences: '',
      hasCompleteInfo: false
    };

    // Combine conversation history with current message
    const allText = (conversationHistory + ' ' + currentMessage).toLowerCase();

    // Extract customer name (look for patterns like "my name is", "I am", etc.)
    const namePatterns = [
      /(?:my name is|i am|this is|name:?)\s+([a-zA-Z\s]+)/i,
      /(?:hi|hello),?\s+(?:my name is|i am)\s+([a-zA-Z\s]+)/i
    ];

    for (const pattern of namePatterns) {
      const nameMatch = allText.match(pattern);
      if (nameMatch && nameMatch[1]) {
        bookingData.customerName = nameMatch[1].trim();
        break;
      }
    }

    // Extract package information
    if (allText.includes('bali') || allText.includes('p001') || allText.includes('explorer')) {
      bookingData.package = 'Bali Explorer (P001)';
      bookingData.destination = 'Bali, Indonesia';
    }

    // Extract number of people
    const peoplePatterns = [
      /(\d+)\s*(person|people|pax|traveller|traveler|adult|guest)/i,
      /(we are|there are)\s+(\d+)/i,
      /(party of|group of)\s+(\d+)/i
    ];

    for (const pattern of peoplePatterns) {
      const peopleMatch = allText.match(pattern);
      if (peopleMatch) {
        const num = peopleMatch[1] || peopleMatch[2];
        if (num && parseInt(num) > 0 && parseInt(num) <= 20) {
          bookingData.numberOfPeople = num;
          break;
        }
      }
    }

    // Extract dates
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi
    ];

    const extractedDates = [];
    for (const pattern of datePatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        extractedDates.push(...matches);
      }
    }

    if (extractedDates.length >= 2) {
      bookingData.startDate = extractedDates[0];
      bookingData.endDate = extractedDates[1];
    } else if (extractedDates.length === 1) {
      bookingData.startDate = extractedDates[0];
    }

    // Extract preferences/special requests
    const preferenceKeywords = ['beach', 'culture', 'adventure', 'relaxation', 'food', 'shopping', 'spa', 'temple', 'volcano', 'rice terrace'];
    const foundPreferences = preferenceKeywords.filter(keyword => allText.includes(keyword));
    if (foundPreferences.length > 0) {
      bookingData.preferences = foundPreferences.join(', ');
    }

    return bookingData;
  }

  // Generate a status summary of collected data
  getDataCollectionStatus(bookingData) {
    const requiredFields = ['customerName', 'package', 'startDate', 'endDate', 'numberOfPeople'];
    const collectedFields = requiredFields.filter(field => bookingData[field] && bookingData[field].trim() !== '');
    const missingFields = requiredFields.filter(field => !bookingData[field] || bookingData[field].trim() === '');

    let status = `✅ Collected (${collectedFields.length}/${requiredFields.length}): `;
    status += collectedFields.map(field => {
      switch(field) {
        case 'customerName': return `Name: ${bookingData.customerName}`;
        case 'package': return `Package: ${bookingData.package}`;
        case 'startDate': return `Start: ${bookingData.startDate}`;
        case 'endDate': return `End: ${bookingData.endDate}`;
        case 'numberOfPeople': return `Guests: ${bookingData.numberOfPeople}`;
        default: return field;
      }
    }).join(', ');

    if (missingFields.length > 0) {
      status += `\n❌ Still needed: ${missingFields.map(field => {
        switch(field) {
          case 'customerName': return 'Name';
          case 'package': return 'Package choice';
          case 'startDate': return 'Start date';
          case 'endDate': return 'End date';
          case 'numberOfPeople': return 'Number of guests';
          default: return field;
        }
      }).join(', ')}`;
    } else {
      status += '\n🎉 All required information collected! Ready for finalization.';
    }

    if (bookingData.preferences) {
      status += `\n🌍 Preferences: ${bookingData.preferences}`;
    }

    return status;
  }
}

module.exports = new AIService();
