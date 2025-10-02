const GeminiService = require('./geminiService.js');
const OllamaService = require('./ollamaService.js');
const GroqService = require('./groqService.js');
const APIConnector = require('./apiConnector.js');
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
    // Extract current booking data from conversation
    const currentBookingData = this.extractCurrentBookingData(conversationHistory, userMessage);

    console.log(`🤖 DEBUG - User ${userId} - Conversation History: "${conversationHistory}"`);
    console.log(`🤖 DEBUG - User ${userId} - Current Message: "${userMessage}"`);

    // Only collect: name, start date, number of people
    const requiredFields = ['customerName', 'startDate', 'numberOfPeople'];
    const allCollected = requiredFields.every(field => currentBookingData[field] && currentBookingData[field].trim() !== '');

    let response = '';

    if (allCollected) {
      // All info collected - send confirmation and ask for "finalize"
      // Calculate end date as start date + 5 days
      let endDate = currentBookingData.endDate;
      if (currentBookingData.startDate && !endDate) {
        try {
          const startDateObj = new Date(currentBookingData.startDate);
          if (!isNaN(startDateObj.getTime())) {
            const endDateObj = new Date(startDateObj);
            endDateObj.setDate(startDateObj.getDate() + 5);
            endDate = endDateObj.toISOString().split('T')[0];
          }
        } catch (dateError) {
          console.error('Error calculating end date:', dateError);
          endDate = currentBookingData.startDate; // fallback
        }
      }

      response = `📋 **BOOKING SUMMARY**\n\n` +
        `👤 Name: ${currentBookingData.customerName}\n` +
        `📅 Start Date: ${currentBookingData.startDate}\n` +
        `📅 End Date: ${endDate}\n` +
        `👥 Travelers: ${currentBookingData.numberOfPeople}\n\n` +
        `✅ All details collected!\n\n` +
        `Please send **"finalize"** to get quotes from our vendors.`;
    } else {
      // Sequential collection flow
      if (!currentBookingData.customerName) {
        response = "👋 Hello! Can I have your full name for the booking?";
      } else if (!currentBookingData.startDate) {
        response = `Hi ${currentBookingData.customerName}! When would you like your trip to start? (Please provide date in DD/MM/YYYY format)`;
      } else if (!currentBookingData.numberOfPeople) {
        response = `Great! How many people will be traveling?`;
      }
    }

    prompt = `
You are a friendly travel booking assistant.
Help the customer understand travel packages and collect their booking details.

AVAILABLE PACKAGES:
${packagesContext}

${conversationHistory ? 'CONVERSATION HISTORY:\n' + conversationHistory + '\n' : ''}

CUSTOMER MESSAGE: "${userMessage}"

CURRENT BOOKING STATUS:
${dataStatus}

Your job:
- If user ask for correction, re-extract and confirm again.
- Ask one detail at a time if missing (name, package, dates, number of people, email).
- Answer naturally in a conversational way.

- Keep your answers concise, using 20 to 25 words if asking questions maximum.
- If some booking details are missing (name, package, dates, number of people, email), politely ask for them.
- If all details are collected, confirm the booking.
- Be friendly, clear, and creative in your explanations.`;
    try {
      console.log(`🤖 Sending prompt to Gemini AI for user ${userId}:`, prompt.substring(0, 200) + '...');
      const aiResponse = await this.geminiService.generateResponse(prompt);
      console.log(`🤖 Received response from Gemini AI for user ${userId}:`, aiResponse.substring(0, 200) + '...');
      return aiResponse;
    } catch (geminiError) {
      console.error('Gemini AI error:', geminiError.message);
      console.log('Attempting to use Groq as fallback...');

      try {
        console.log(`🤖 Sending prompt to Groq for user ${userId}:`, prompt.substring(0, 200) + '...');
        const groqResponse = await this.groqService.generateResponse(prompt);
        console.log(`🤖 Received response from Groq for user ${userId}:`, groqResponse.substring(0, 200) + '...');
        return groqResponse;
      } catch (groqError) {
        console.error('Groq fallback also failed:', groqError.message);
        console.error('Full Groq error:', groqError);
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
      email: '',
      preferences: '',
      hasCompleteInfo: false
    };

    // Helper function to title case for name detection
    function titleCase(str) {
      return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }).replace(/\s+/g, ' ').trim();
    }

    // Check if current message is responding to a specific question
    // Look for the last bot message in the conversation history
    const historyLines = conversationHistory.trim().split('\n');

    // Combine conversation history with current message, but filter out bot messages for name extraction
    const userMessagesOriginal = historyLines
      .filter(line => line.startsWith('User:'))
      .map(line => line.substring(5).trim()) // Remove "User:" prefix
      .join(' ') + ' ' + currentMessage;
    const originalText = conversationHistory + ' ' + currentMessage;
    const allText = originalText.toLowerCase();
    const userMessagesTitleCased = titleCase(userMessagesOriginal);
    const lastBotMessage = historyLines.filter(line => line.startsWith('Bot:')).pop();

    const isRespondingToNameQuestion = lastBotMessage && (
      lastBotMessage.toLowerCase().includes('full name') || lastBotMessage.toLowerCase().includes('name?')
    );
    const isRespondingToPackageQuestion = lastBotMessage && lastBotMessage.toLowerCase().includes('package');
    const isRespondingToGuestsQuestion = lastBotMessage && (
      lastBotMessage.toLowerCase().includes('how many') && lastBotMessage.toLowerCase().includes('people') ||
      lastBotMessage.toLowerCase().includes('people will be traveling') ||
      lastBotMessage.toLowerCase().includes('people will be travelling')
    );
    const isRespondingToEmailQuestion = lastBotMessage && (
      lastBotMessage.toLowerCase().includes('email') || lastBotMessage.toLowerCase().includes('e-mail')
    );
    // Extract customer name - prioritize based on context
    if (isRespondingToNameQuestion) {
      bookingData.customerName = titleCase(currentMessage.trim());
    } else {
      // General name extraction from all user text
      const namePatterns = [
        // Full name patterns
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
        // Phrases like "my name is"
        /my name is\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)/i,
        /i am\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)/i,
        /i'm\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)/i
      ];

      let nameCandidate = null;
      for (const pattern of namePatterns) {
        const matches = userMessagesOriginal.match(pattern);
        if (matches) {
          // Take the first reasonable match
          const potentialName = titleCase(matches[1] || matches[0]);
          // Basic validation: at least two words for full name
          if (potentialName.split(' ').length >= 2) {
            nameCandidate = potentialName;
            break;
          }
        }
      }

      if (nameCandidate && !bookingData.customerName) {
        bookingData.customerName = nameCandidate;
      }
    }

    // Extract package information - prioritize based on context
    if (isRespondingToPackageQuestion) {
      // If responding to package question, treat current message as package choice
      const lowerMessage = currentMessage.toLowerCase();
      if (lowerMessage.includes('bali') || lowerMessage.includes('p001') || lowerMessage.includes('explorer')) {
        bookingData.package = 'Bali Explorer (P001)';
        bookingData.destination = 'Bali, Indonesia';
      }
    } else {
      // Otherwise, use existing package extraction logic
      if (allText.includes('bali') || allText.includes('p001') || allText.includes('explorer')) {
        bookingData.package = 'Bali Explorer (P001)';
        bookingData.destination = 'Bali, Indonesia';
      }
    }

    // Extract number of people - prioritize based on context
    let numberFound = false;
    if (isRespondingToGuestsQuestion) {
      // If responding to guests question, treat current message as number
      const numberMatch = currentMessage.match(/\b(\d{1,2})\b/);
      if (numberMatch) {
        const parsedNum = parseInt(numberMatch[1]);
        if (parsedNum > 0 && parsedNum <= 20) {
          bookingData.numberOfPeople = parsedNum.toString();
          numberFound = true;
        }
      }
    } else {
      // Otherwise, use existing people extraction logic
      const peoplePatterns = [
        // Explicit patterns with guest/traveler words
        /(\d+)\s*(person|people|pax|traveller|traveler|adult|guest|passenger)/i,
        /(we are|there are|party of|group of)\s+(\d+)/i,
        /(?:for|booking for)\s+(\d+)\s*(person|people|pax|traveller|traveler|adult|guest)?/i,
        // Numbers after travel-related questions
        /(?:how many|number of)\s+(?:person|people|pax|traveller|traveler|adult|guest|passenger)s?\s*(?:are|will|do|would)?\s*(?:you|we|there)?\s*(?:be)?\s*(\d+)/i,
        // Numbers in booking context (more restrictive standalone)
        /\b(\d{1,2})\b(?=\s*(?:person|people|pax|traveller|traveler|adult|guest|passenger|traveler|tourist))/i
      ];

      let allPeopleMatches = [];
      for (const pattern of peoplePatterns) {
        const matches = allText.match(new RegExp(pattern.source, pattern.flags + 'g'));
        if (matches) {
          for (const match of matches) {
            const numMatch = match.match(/(\d+)/);
            if (numMatch) {
              const parsedNum = parseInt(numMatch[1]);
              if (parsedNum > 0 && parsedNum <= 20) {
                // Additional validation: don't extract from dates or prices
                const matchIndex = allText.indexOf(match);
                const beforeContext = allText.substring(Math.max(0, matchIndex - 10), matchIndex);
                const afterContext = allText.substring(matchIndex + match.length, matchIndex + match.length + 10);

                // Skip if it's part of a date (like 10/03/2026)
                if (/\d\/\d/.test(beforeContext + match + afterContext)) continue;
                // Skip if it's part of a price or currency
                if (/\b(rs|rupees|usd|dollars|\$|₹|€|£)\b/i.test(beforeContext + afterContext)) continue;
                // Skip if it's part of a time (like 10:30)
                if (/:\d/.test(beforeContext + match + afterContext)) continue;

                allPeopleMatches.push(parsedNum);
              }
            }
          }
        }
      }
      if (allPeopleMatches.length > 0) {
        bookingData.numberOfPeople = allPeopleMatches[allPeopleMatches.length - 1].toString();
        numberFound = true;
      }

      // Fallback: if no pattern match, extract the last standalone number from recent user messages (last 5 user messages)
      if (!numberFound && !bookingData.numberOfPeople) {
        const recentUserMessages = historyLines
          .filter(line => line.startsWith('User:'))
          .slice(-5)  // Last 5 user messages
          .map(line => line.substring(5).trim())
          .join(' ');

        const lastNumberMatch = recentUserMessages.match(/\b(\d{1,2})\b(?!\/|\.|:)/g);  // Standalone number, not part of date/time
        if (lastNumberMatch && lastNumberMatch.length > 0) {
          const lastNum = parseInt(lastNumberMatch[lastNumberMatch.length - 1]);
          if (lastNum > 0 && lastNum <= 20) {
            // Quick check: not part of a date pattern in recent context
            const recentLower = recentUserMessages.toLowerCase();
            if (!recentLower.match(/\d{1,2}\/\d{1,2}/) || !recentLower.includes('date')) {
              bookingData.numberOfPeople = lastNum.toString();
            }
          }
        }
      }
    }

    // Extract email - prioritize based on context
    if (isRespondingToEmailQuestion) {
      // If responding to email question, treat current message as email
      const emailMatch = currentMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        bookingData.email = emailMatch[0];
      }
    } else {
      // General email extraction from all user text
      const emailPatterns = [
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      ];

      for (const pattern of emailPatterns) {
        const matches = userMessagesOriginal.match(pattern);
        if (matches && matches.length > 0) {
          bookingData.email = matches[0]; // Take the first email found
          break;
        }
      }
    }

  // Extract dates - search in full conversation but prioritize current message for context
  const datePatterns = [
    /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g, // YYYY-MM-DD or YYYY/MM/DD
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g,
    /(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi
  ];


    // Extract all dates from full conversation history
    const allDates = [];
    for (const pattern of datePatterns) {
      const matches = originalText.match(pattern);
      if (matches) {
        allDates.push(...matches);
      }
    }

    // Helper function to parse and normalize dates
    function parseAndNormalizeDate(dateStr) {
      const monthMap = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };

      // Try to parse "12th of September 2026" format
      const ordinalMatch = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(\w+)\s+(\d{4})/i);
      if (ordinalMatch) {
        const day = ordinalMatch[1].padStart(2, '0');
        const month = monthMap[ordinalMatch[2].toLowerCase()];
        const year = ordinalMatch[3];
        if (month) return `${year}-${month}-${day}`;
      }

      // Try to parse "12 September 2026" format
      const spaceMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (spaceMatch) {
        const day = spaceMatch[1].padStart(2, '0');
        const month = monthMap[spaceMatch[2].toLowerCase()];
        const year = spaceMatch[3];
        if (month) return `${year}-${month}-${day}`;
      }

      // Try to parse "09/12/2026" or "12-09-2026" assuming MM/DD/YYYY or DD-MM-YYYY
      const slashMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (slashMatch) {
        const part1 = slashMatch[1].padStart(2, '0');
        const part2 = slashMatch[2].padStart(2, '0');
        const year = slashMatch[3];
        // Assume MM/DD/YYYY if month <=12 and day <=31
        if (parseInt(part1) <= 12 && parseInt(part2) <= 31) {
          return `${year}-${part1}-${part2}`;
        } else if (parseInt(part2) <= 12 && parseInt(part1) <= 31) {
          return `${year}-${part2}-${part1}`;
        }
      }

      // Return original if can't parse
      return dateStr;
    }

    // Assign dates: always extract from full conversation history to retain previous dates
    if (allDates.length >= 1) {
      const parsedDates = allDates.map(dateStr => ({
        original: dateStr,
        parsed: parseAndNormalizeDate(dateStr),
        dateObj: new Date(parseAndNormalizeDate(dateStr))
      })).filter(d => !isNaN(d.dateObj.getTime()));

      const sortedDates = parsedDates.sort((a, b) => a.dateObj - b.dateObj);

      // Assign earliest as start date, latest as end date
      if (sortedDates.length >= 1) {
        bookingData.startDate = sortedDates[0].parsed;
        // Calculate end date as 5 days after start date
        if (bookingData.startDate) {
          const startDateObj = new Date(bookingData.startDate);
          if (!isNaN(startDateObj.getTime())) {
            const endDateObj = new Date(startDateObj);
            endDateObj.setDate(startDateObj.getDate() + 5);
            bookingData.endDate = endDateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          }
        }
      }
      if (sortedDates.length >= 2) {
        // If multiple dates provided, still override with calculated end date
      } else if (sortedDates.length === 1 && !bookingData.endDate) {
        // If only one date and no end date set, check context
        const lowerCurrentMessage = currentMessage.toLowerCase();
        if (lowerCurrentMessage.includes('end') || lowerCurrentMessage.includes('to') || lowerCurrentMessage.includes('return')) {
          bookingData.endDate = sortedDates[0].parsed;
        }
      }
    }

    // Handle corrections like "no for 3 people" or "no, 4 people"
    const lowerCurrentMessage = currentMessage.toLowerCase().trim();
    if (lowerCurrentMessage.startsWith('no') && bookingData.customerName && bookingData.package && bookingData.startDate && bookingData.endDate && bookingData.numberOfPeople) {
      // Extract new number from correction
      const correctionNumberMatch = lowerCurrentMessage.match(/(\d+)\s*(?:people?|person|guest|pax|traveler|traveller)/i) ||
        lowerCurrentMessage.match(/\b(\d{1,2})\b/);
      if (correctionNumberMatch) {
        const newNum = parseInt(correctionNumberMatch[1]);
        if (newNum > 0 && newNum <= 20) {
          bookingData.numberOfPeople = newNum.toString();
        }
      }
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
      switch (field) {
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
        switch (field) {
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
