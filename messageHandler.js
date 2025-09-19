const aiService = require('./aiService');
const apiConnector = require('./apiConnector');
const conversationManager = require('./conversationManager');
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
    await sendMessage(msg.from, aiReply);
  }

  // Method to handle vendor quotes received from backend webhook
  async handleVendorQuotes(quoteData) {
    try {
      console.log('💰 Processing vendor quotes:', quoteData);

      const customerPhone = quoteData.customer_phone;
      const customerChatId = `${customerPhone}@c.us`;

      // Store quote data in conversation manager for later use
      conversationManager.storeQuoteData(customerChatId, quoteData);

      // Format and send quote message to customer
      const quoteMessage = this.formatQuoteMessage(quoteData);

      console.log(`💰 Sending quotes to customer ${customerPhone}`);
      await sendMessage(customerChatId, quoteMessage);

      // Save bot message to conversation history
      conversationManager.addMessage(customerChatId, quoteMessage, true);

    } catch (error) {
      console.error('Error handling vendor quotes:', error);
    }
  }

  // Format quote message for customer
  formatQuoteMessage(quoteData) {
    let message = '💰 **TRAVEL QUOTES RECEIVED!**\n\n';
    message += `📍 **Destination:** ${quoteData.destination}\n`;
    message += `🎯 **Service:** ${quoteData.service_type}\n\n`;

    message += '🏪 **Available Options:**\n\n';

    quoteData.quotes.forEach((quote, index) => {
      message += `${index + 1}. **${quote.vendor_name}**\n`;
      message += `   💵 **Price:** $${quote.final_price}\n`;
      if (quote.quote_details) {
        message += `   📝 **Details:** ${quote.quote_details}\n`;
      }
      if (quote.validity_date) {
        message += `   📅 **Valid until:** ${quote.validity_date}\n`;
      }
      message += '\n';
    });

    message += '✅ **Next Steps:**\n';
    message += '• Reply with the vendor number (1, 2, 3...) to select your preferred option\n';
    message += '• Or type "finalize" to proceed with booking\n';
    message += '• Our executive will contact you to complete the booking process\n\n';

    message += '🌟 Thank you for choosing **WanderWorld Travels**!';

    return message;
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

  isPriceInquiry(text) {
    const priceKeywords = ['price', 'cost', 'rate', 'quote', 'inquiry', 'budget'];
    const lowerText = text.toLowerCase();
    return priceKeywords.some(keyword => lowerText.includes(keyword));
  }

  async handlePriceInquiry(msg, customerData) {
    try {
      const inquiryData = {
        customer_phone: msg.from.replace('@c.us', ''),
        inquiry_text: msg.body,
        customer_data: customerData || null
      };

      const result = await apiConnector.sendVendorEmail(inquiryData);

      if (result) {
        const message = "Thank you for your inquiry! Our team will get back to you with pricing details soon.";
        console.log(`🤖 Bot response to ${msg.from}: ${message}`);
        await sendMessage(msg.from, message);
      } else {
        const message = "Sorry, there was an issue processing your inquiry. Please try again later.";
        console.log(`🤖 Bot response to ${msg.from}: ${message}`);
        await sendMessage(msg.from, message);
      }
    } catch (error) {
      console.error('Error handling price inquiry:', error);
      const message = "Sorry, there was an error processing your request. Please try again.";
      console.log(`🤖 Bot response to ${msg.from}: ${message}`);
      await sendMessage(msg.from, message);
    }
  }

  containsBookingInfo(text) {
    const bookingKeywords = [
      'book', 'booking', 'reserve', 'travel', 'trip', 'package',
      'p001', 'bali', 'person', 'people', 'pax',
      'date', 'when', 'from', 'to', 'start', 'end'
    ];
    const lowerText = text.toLowerCase();
    return bookingKeywords.some(keyword => lowerText.includes(keyword));
  }

  isFinalizeCommand(text) {
    const lowerText = text.toLowerCase().trim();
    return lowerText === 'finalize' || lowerText === 'finalize';
  }

  isBookMyTripCommand(text) {
    const lowerText = text.toLowerCase().trim();
    return lowerText === 'book my trip' || lowerText === 'book trip' || lowerText === 'book';
  }

  async handleFinalizeCommand(msg, customerData) {
    try {
      console.log(`🎯 FINALIZE command received from ${msg.from} - Processing booking...`);

      // Get conversation history to extract booking information
      const conversationHistory = conversationManager.getConversationHistory(msg.from);

      // Extract booking information from conversation history
      const bookingInfo = this.extractBookingFromConversation(conversationHistory, msg.from);

      // Add customer name if available
      if (customerData && customerData.length > 0) {
        bookingInfo.customerName = customerData[0].name;
      }

      // Fix package ID to match backend data
      if (bookingInfo.package === 'Bali Explorer (P001)') {
        bookingInfo.package = 'P001';
      }

      console.log('📋 Finalizing booking with extracted info:', bookingInfo);

      // Ensure required fields have values to prevent 400 Bad Request
      if (!bookingInfo.customerName || bookingInfo.customerName.trim() === '') {
        bookingInfo.customerName = 'Customer';
        console.log('⚠️ Using default customer name');
      }

      if (!bookingInfo.numberOfPeople || bookingInfo.numberOfPeople.trim() === '') {
        bookingInfo.numberOfPeople = '1';
        console.log('⚠️ Using default number of people: 1');
      }

      if (!bookingInfo.startDate || bookingInfo.startDate.trim() === '') {
        console.error('❌ No start date found in conversation - cannot proceed with booking');
        const errorMessage = "❌ **BOOKING ERROR**\n\n" +
          "I couldn't find your travel dates in our conversation.\n" +
          "Please provide your preferred travel dates (start and end) and try again.\n\n" +
          "📅 Example: 15/08/2026 to 20/08/2026";
        await sendMessage(msg.from, errorMessage);
        return;
      }

      if (!bookingInfo.endDate || bookingInfo.endDate.trim() === '') {
        // Use start date + 3 days as default
        const startDate = new Date(bookingInfo.startDate);
        startDate.setDate(startDate.getDate() + 3);
        bookingInfo.endDate = startDate.toISOString().split('T')[0];
        console.log('⚠️ Using default end date:', bookingInfo.endDate);
      }

      // Ensure notes contain destination for backend extraction
      if (!bookingInfo.notes.toLowerCase().includes('bali') &&
          !bookingInfo.notes.toLowerCase().includes('paris') &&
          !bookingInfo.notes.toLowerCase().includes('london')) {
        bookingInfo.notes += ' Bali trip';
        console.log('⚠️ Added default destination to notes');
      }

      console.log('📋 Finalized booking info with defaults:', {
        customerName: bookingInfo.customerName,
        customerPhone: bookingInfo.customerPhone,
        startDate: bookingInfo.startDate,
        endDate: bookingInfo.endDate,
        numberOfPeople: bookingInfo.numberOfPeople,
        notes: bookingInfo.notes.substring(0, 100) + '...'
      });

      // Send booking data to backend for day-wise vendor price analysis
      const emailSent = await apiConnector.sendDaywiseBookingEmail(bookingInfo);

      if (emailSent) {
        console.log('📧 Booking data sent to backend for vendor price analysis:', msg.from);

        // HARDCODED MESSAGE - No AI processing for finalize command
        const hardcodedMessage = "🎉 **BOOKING FINALIZED!**\n\n" +
          "✅ Your booking request has been successfully submitted!\n" +
          "📧 Our team will review your details and send you the final pricing within 24 hours.\n" +
          "📞 Our executive will contact you soon to confirm availability and process payment.\n\n" +
          "Thank you for choosing **WanderWorld Travels**! 🌍✨\n\n" +
          "*Please keep this chat open for updates.*";

        console.log(`🤖 HARDCODED Bot response to ${msg.from}: ${hardcodedMessage}`);
        await sendMessage(msg.from, hardcodedMessage);

        // Save the finalize command and hardcoded response to conversation history
        conversationManager.addMessage(msg.from, msg.body, false); // User message
        conversationManager.addMessage(msg.from, hardcodedMessage, true); // Bot response

      } else {
        console.error('❌ Failed to send booking data to backend');

        // HARDCODED ERROR MESSAGE - No AI processing
        const errorMessage = "❌ **BOOKING ERROR**\n\n" +
          "Sorry, there was an issue processing your booking request.\n" +
          "Please try again in a few minutes or contact our support team.\n\n" +
          "📞 Support: +91-XXXXXXXXXX";

        console.log(`🤖 HARDCODED Error response to ${msg.from}: ${errorMessage}`);
        await sendMessage(msg.from, errorMessage);

        // Save error to conversation history
        conversationManager.addMessage(msg.from, msg.body, false);
        conversationManager.addMessage(msg.from, errorMessage, true);
      }
    } catch (error) {
      console.error('Error handling finalize command:', error);

      // HARDCODED ERROR MESSAGE - No AI processing
      const errorMessage = "❌ **SYSTEM ERROR**\n\n" +
        "Sorry, there was an error processing your finalize request.\n" +
        "Please try again or contact our support team.\n\n" +
        "📞 Support: +91-XXXXXXXXXX";

      console.log(`🤖 HARDCODED Error response to ${msg.from}: ${errorMessage}`);
      await sendMessage(msg.from, errorMessage);

      // Save error to conversation history
      conversationManager.addMessage(msg.from, msg.body, false);
      conversationManager.addMessage(msg.from, errorMessage, true);
    }
  }

  async handleBookingInfo(msg, customerData) {
    try {
      // Extract booking information from the message
      const bookingInfo = this.extractBookingInfo(msg.body, msg.from);

      // Add customer name if available
      if (customerData && customerData.length > 0) {
        bookingInfo.customerName = customerData[0].name;
      }

      // Save to Google Sheets
      const saved = await googleSheetsManager.appendBooking(bookingInfo);

      if (saved) {
        console.log('📊 Booking information saved to Google Sheets for:', msg.from);
      } else {
        console.error('❌ Failed to save booking information to Google Sheets');
        await sendMessage(msg.from, "❌ Sorry, there was an issue saving your booking information. Please try again.");
      }
    } catch (error) {
      console.error('Error handling booking info:', error);
    }
  }

  extractBookingInfo(message, userId) {
    // This function will extract booking information from user messages
    const bookingInfo = {
      customerPhone: userId.replace('@c.us', ''),
      customerName: '',
      package: '',
      destination: '',
      startDate: '',
      endDate: '',
      numberOfPeople: '',
      totalPrice: '',
      status: 'Pending',
      notes: message
    };

    const lowerMessage = message.toLowerCase();

    // Extract customer name with improved patterns
    const namePatterns = [
      // "my name is John Doe" or "I am John Doe"
      /(?:my name is|i am|this is|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // "John Doe here" or "John Doe booking"
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      // "booking for John Doe" or "for John Doe"
      /(?:booking for|for|traveling as)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    ];

    for (const pattern of namePatterns) {
      const nameMatch = message.match(pattern);
      if (nameMatch) {
        const extractedName = nameMatch[1].trim();
        // Validate that it's likely a name (contains at least one space or is a common name)
        if (extractedName.length >= 2 && extractedName.length <= 50) {
          bookingInfo.customerName = extractedName;
          break;
        }
      }
    }

    // Extract package information with improved pattern matching
    if (lowerMessage.includes('bali') || lowerMessage.includes('p001') || lowerMessage.includes('explorer')) {
      bookingInfo.package = 'Bali Explorer (P001)';
      bookingInfo.destination = 'Bali';
    }

    // Extract number of people with improved patterns
    const peoplePatterns = [
      /(\d+)\s*(person|people|pax|traveller|traveler|adult|guest)/i,
      /(\d+)\s*(of us|travellers|travelers)/i,
      /(we are|there are)\s+(\d+)/i,
      /(party of|group of)\s+(\d+)/i
    ];

    for (const pattern of peoplePatterns) {
      const peopleMatch = message.match(pattern);
      if (peopleMatch) {
        const num = peopleMatch[1] || peopleMatch[2];
        if (num && parseInt(num) > 0 && parseInt(num) <= 20) {
          bookingInfo.numberOfPeople = num;
          break;
        }
      }
    }

    // Extract dates with improved pattern matching
    const datePatterns = [
      // dd/mm/yyyy or dd-mm-yyyy
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g,
      // dd month yyyy (e.g., 15 Aug 2026)
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi,
      // month dd, yyyy
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi
    ];

    const extractedDates = [];
    for (const pattern of datePatterns) {
      const matches = message.match(pattern);
      if (matches) {
        extractedDates.push(...matches);
      }
    }

    // Normalize and validate dates
    const normalizedDates = this.normalizeDates(extractedDates);
    if (normalizedDates.length >= 2) {
      bookingInfo.startDate = normalizedDates[0];
      bookingInfo.endDate = normalizedDates[1];
    } else if (normalizedDates.length === 1) {
      bookingInfo.startDate = normalizedDates[0];
    }

    // Extract price/budget information
    const pricePatterns = [
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(rs|rupees|usd|dollars|\$|₹)/i,
      /(?:budget|price|cost|rate).{0,20}(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per person|total|for all)/i
    ];

    for (const pattern of pricePatterns) {
      const priceMatch = message.match(pattern);
      if (priceMatch) {
        const price = priceMatch[1] || priceMatch[2];
        if (price) {
          bookingInfo.totalPrice = price.replace(/,/g, '');
          break;
        }
      }
    }

    return bookingInfo;
  }

  extractBookingFromConversation(conversationHistory, userId) {
    // Extract booking information from the entire conversation history
    const bookingInfo = {
      customerPhone: userId.replace('@c.us', ''),
      customerName: '',
      package: '',
      destination: '',
      startDate: '',
      endDate: '',
      numberOfPeople: '',
      totalPrice: '',
      status: 'Pending',
      notes: ''
    };

    // Combine all messages (both user and bot) to extract information
    const allMessages = conversationHistory
      .map(msg => msg.message)
      .join(' ');

    const lowerCombinedMessage = allMessages.toLowerCase();
    bookingInfo.notes = allMessages;

    // Extract customer name from entire conversation with improved patterns
    const namePatterns = [
      // "my name is John Doe" or "I am John Doe"
      /(?:my name is|i am|this is|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // "John Doe here" or "John Doe booking"
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      // "booking for John Doe" or "for John Doe"
      /(?:booking for|for|traveling as)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // Bot responses like "Hello John Doe" or "Thank you John"
      /(?:hello|hi|thank you|welcome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // "Customer: John Doe" or "Name: John Doe"
      /(?:customer|name|passenger|traveler)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      // "Test Customer" from backend data
      /(test customer)/i
    ];

    for (const pattern of namePatterns) {
      const nameMatch = allMessages.match(pattern);
      if (nameMatch) {
        const extractedName = nameMatch[1].trim();
        // Validate that it's likely a name (contains at least one space or is a common name)
        if (extractedName.length >= 2 && extractedName.length <= 50) {
          bookingInfo.customerName = extractedName;
          break;
        }
      }
    }

    // Extract package information with improved detection
    if (lowerCombinedMessage.includes('bali explorer') || lowerCombinedMessage.includes('p001') || lowerCombinedMessage.includes('bali')) {
      bookingInfo.package = 'P001'; // Send just the package ID to backend
      bookingInfo.destination = 'Bali';
    }

    // Extract number of people with comprehensive patterns
    const peoplePatterns = [
      /(\d+)\s*(person|people|pax|traveller|traveler|adult|guest)/i,
      /(\d+)\s*(of us|travellers|travelers)/i,
      /(we are|there are|party of|group of)\s+(\d+)/i,
      /(?:for|with)\s+(\d+)\s+(?:person|people|guest|traveler)/i,
      // Specific patterns from logs: "3 guests", "3 people"
      /(\d+)\s+guests?/i,
      // Ordinal numbers: "3rd person", but extract the number
      /(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+(?:person|people|guest|traveler)/i
    ];

    for (const pattern of peoplePatterns) {
      const peopleMatch = allMessages.match(pattern);
      if (peopleMatch) {
        const num = peopleMatch[1] || peopleMatch[2];
        if (num && parseInt(num) > 0 && parseInt(num) <= 20) {
          bookingInfo.numberOfPeople = num;
          break;
        }
      }
    }

    // Extract dates with comprehensive pattern matching
    const datePatterns = [
      // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
      /(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/g,
      // dd month yyyy (e.g., 15 Aug 2026, 12th May 2026)
      /(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi,
      // month dd, yyyy (e.g., Aug 15, 2026)
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi,
      // yyyy-mm-dd format
      /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g
    ];

    const extractedDates = [];
    for (const pattern of datePatterns) {
      const matches = allMessages.match(pattern);
      if (matches) {
        extractedDates.push(...matches);
      }
    }

    // Normalize and validate dates using existing helper function
    const normalizedDates = this.normalizeDates(extractedDates);
    if (normalizedDates.length >= 2) {
      // Convert to YYYY-MM-DD format for backend
      bookingInfo.startDate = this.convertToBackendDateFormat(normalizedDates[0]);
      bookingInfo.endDate = this.convertToBackendDateFormat(normalizedDates[1]);
    } else if (normalizedDates.length === 1) {
      bookingInfo.startDate = this.convertToBackendDateFormat(normalizedDates[0]);
    }

    // Extract price/budget information
    const pricePatterns = [
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(rs|rupees|usd|dollars|\$|₹)/i,
      /(?:budget|price|cost|rate).{0,20}(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per person|total|for all)/i,
      // Look for numbers that might be prices in context
      /(?:rs|rupees|usd|dollars|\$|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
    ];

    for (const pattern of pricePatterns) {
      const priceMatch = allMessages.match(pattern);
      if (priceMatch) {
        const price = priceMatch[1] || priceMatch[2];
        if (price) {
          bookingInfo.totalPrice = price.replace(/,/g, '');
          break;
        }
      }
    }

    // Debug logging
    console.log('📋 Extracted booking info:', {
      name: bookingInfo.customerName,
      package: bookingInfo.package,
      destination: bookingInfo.destination,
      people: bookingInfo.numberOfPeople,
      startDate: bookingInfo.startDate,
      endDate: bookingInfo.endDate,
      price: bookingInfo.totalPrice
    });

    return bookingInfo;
  }

  async handleBookMyTripCommand(msg, customerData) {
    try {
      const executivePhone = config.EXECUTIVE_PHONE;

      if (!executivePhone) {
        console.error('❌ Executive phone number not configured');
        await sendMessage(msg.from, "Sorry, our booking system is temporarily unavailable. Please try again later.");
        return;
      }

      // Get conversation history to extract all customer details
      const conversationHistory = conversationManager.getConversationHistory(msg.from);
      const customerPhone = msg.from.replace('@c.us', '');

      // Extract comprehensive customer information
      const customerInfo = this.extractCustomerInfo(conversationHistory, customerPhone, customerData);

      // Format message for executive
      const executiveMessage = this.formatExecutiveMessage(customerInfo);

      // Send to executive
      const executiveChatId = `${executivePhone}@c.us`;
      await sendMessage(executiveChatId, executiveMessage);

      // Confirm to customer
      const customerConfirmation = "✅ Great! Your booking request has been forwarded to our executive team. They will contact you shortly to finalize your trip details and payment. Thank you for choosing WanderWorld Travels!";
        await sendMessage(msg.from, customerConfirmation);

      console.log(`📞 Booking request forwarded to executive ${executivePhone} for customer ${customerPhone}`);

    } catch (error) {
      console.error('Error handling book my trip command:', error);
      const errorMessage = "Sorry, there was an error processing your booking request. Please try again or contact our support team.";
      await sendMessage(msg.from, errorMessage);
    }
  }

  extractCustomerInfo(conversationHistory, customerPhone, customerData) {
    // Combine all messages to extract comprehensive info
    const allMessages = conversationHistory.map(msg => msg.message).join(' ');
    const lowerMessages = allMessages.toLowerCase();

    // Get quote data from backend if available
    const quoteData = conversationManager.getQuoteData(`${customerPhone}@c.us`);

    const customerInfo = {
      phone: customerPhone,
      name: '',
      package: '',
      destination: '',
      numberOfPeople: '',
      dates: '',
      budget: '',
      specialRequests: '',
      conversationSummary: allMessages,
      vendorQuotes: quoteData ? quoteData.quotes : null
    };

    // Get name from backend data if available
    if (customerData && customerData.length > 0) {
      customerInfo.name = customerData[0].name;
    }

    // Extract package and destination
    if (lowerMessages.includes('bali') || lowerMessages.includes('p001')) {
      customerInfo.package = 'Bali Explorer (P001)';
      customerInfo.destination = 'Bali, Indonesia';

    }

    // Extract number of people
    const peopleMatch = allMessages.match(/(\d+)\s*(person|people|pax|traveller|adult)/i);
    if (peopleMatch) {
      customerInfo.numberOfPeople = peopleMatch[1];
    }

    // Extract dates
    const dateMatch = allMessages.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g);
    if (dateMatch) {
      customerInfo.dates = dateMatch.join(' to ');
    }

    // Extract budget/price mentions
    const budgetMatch = allMessages.match(/(\d+)\s*(rs|rupees|usd|dollars|\$|budget)/i);
    if (budgetMatch) {
      customerInfo.budget = budgetMatch[0];
    }

    return customerInfo;
  }

  // Helper function to normalize and validate dates
  normalizeDates(extractedDates) {
    const monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
      'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
      'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    const normalizedDates = [];

    for (const dateStr of extractedDates) {
      let normalized = dateStr;

      // Handle "dd month yyyy" format (e.g., "15 Aug 2026")
      const monthDateYearMatch = dateStr.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
      if (monthDateYearMatch) {
        const [, day, month, year] = monthDateYearMatch;
        const monthNum = monthMap[month.toLowerCase()];
        normalized = `${day.padStart(2, '0')}/${monthNum}/${year}`;
      }

      // Handle "month dd, yyyy" format (e.g., "Aug 15, 2026")
      const monthDayYearMatch = dateStr.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i);
      if (monthDayYearMatch) {
        const [, month, day, year] = monthDayYearMatch;
        const monthNum = monthMap[month.toLowerCase()];
        normalized = `${day.padStart(2, '0')}/${monthNum}/${year}`;
      }

      // Validate the normalized date
      if (this.isValidDate(normalized)) {
        normalizedDates.push(normalized);
      }
    }

    // Sort dates chronologically and return unique values
    return [...new Set(normalizedDates)].sort((a, b) => new Date(a) - new Date(b));
  }

  // Helper function to validate date format
  isValidDate(dateString) {
    const dateRegex = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) return false;

    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

    return date.getFullYear() == year &&
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
