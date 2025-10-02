const assert = require('assert');
const MessageHandler = require('./messageHandler');

// Mock dependencies
const mockSendMessage = jest.fn();
const mockAiService = {
  getAIResponse: jest.fn()
};
const mockApiConnector = {
  getCustomerData: jest.fn(),
  sendVendorEmail: jest.fn(),
  sendDaywiseBookingEmail: jest.fn()
};
const mockConversationManager = {
  getConversationContext: jest.fn(),
  getConversationHistory: jest.fn(),
  addMessage: jest.fn(),
  storeQuoteData: jest.fn(),
  getQuoteData: jest.fn()
};
const mockGoogleSheetsManager = {
  appendBooking: jest.fn()
};
const mockCustomerGreetingHandler = {
  handleGreeting: jest.fn()
};
const mockConfig = {
  EXECUTIVE_PHONE: '1234567890'
};

// Mock the whatsapp module
jest.mock('./whatsapp', () => ({
  sendMessage: mockSendMessage
}));

// Mock other dependencies
jest.mock('./aiService', () => mockAiService);
jest.mock('./apiConnector', () => mockApiConnector);
jest.mock('./conversationManager', () => mockConversationManager);
jest.mock('./googleSheetsManager', () => mockGoogleSheetsManager);
jest.mock('./customerGreetingHandler', () => mockCustomerGreetingHandler);
jest.mock('./config', () => mockConfig);

describe('MessageHandler', () => {
  let messageHandler;
  let mockMsg;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create message handler instance
    messageHandler = new MessageHandler();

    // Mock message object
    mockMsg = {
      from: '1234567890@c.us',
      fromMe: false,
      body: 'Hello',
      type: 'text'
    };
  });

  describe('handleIncomingMessage', () => {
    test('should skip processing if message is from self', async () => {
      mockMsg.fromMe = true;

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockCustomerGreetingHandler.handleGreeting).not.toHaveBeenCalled();
    });

    test('should handle greeting messages', async () => {
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(true);
      mockApiConnector.getCustomerData.mockResolvedValue([]);

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockCustomerGreetingHandler.handleGreeting).toHaveBeenCalledWith(mockMsg);
      expect(mockApiConnector.getCustomerData).toHaveBeenCalledWith('1234567890');
    });

    test('should handle price inquiry messages', async () => {
      mockMsg.body = 'What is the price for Bali?';
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(false);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockApiConnector.sendVendorEmail.mockResolvedValue(true);

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockApiConnector.sendVendorEmail).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "Thank you for your inquiry! Our team will get back to you with pricing details soon."
      );
    });

    test('should handle finalize command', async () => {
      mockMsg.body = 'finalize';
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(false);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockConversationManager.getConversationHistory.mockReturnValue([]);
      mockApiConnector.sendDaywiseBookingEmail.mockResolvedValue(true);

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockConversationManager.getConversationHistory).toHaveBeenCalled();
      expect(mockApiConnector.sendDaywiseBookingEmail).toHaveBeenCalled();
    });

    test('should handle book my trip command', async () => {
      mockMsg.body = 'book my trip';
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(false);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockConversationManager.getConversationHistory.mockReturnValue([]);

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "✅ Great! Your booking request has been forwarded to our executive team. They will contact you shortly to finalize your trip details and payment. Thank you for choosing Unravel Experience!"
      );
    });

    test('should handle booking info messages', async () => {
      mockMsg.body = 'I want to book Bali for 2 people from 15/08/2026 to 20/08/2026';
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(false);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockGoogleSheetsManager.appendBooking.mockResolvedValue(true);

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockGoogleSheetsManager.appendBooking).toHaveBeenCalled();
    });

    test('should use AI service for regular messages', async () => {
      mockMsg.body = 'Tell me about travel packages';
      mockCustomerGreetingHandler.handleGreeting.mockResolvedValue(false);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockConversationManager.getConversationContext.mockReturnValue([]);
      mockAiService.getAIResponse.mockResolvedValue('Here are our travel packages...');

      await messageHandler.handleIncomingMessage(mockMsg);

      expect(mockAiService.getAIResponse).toHaveBeenCalledWith('Tell me about travel packages', '1234567890@c.us', []);
      expect(mockSendMessage).toHaveBeenCalledWith('1234567890@c.us', 'Here are our travel packages...');
    });
  });

  describe('isGreeting', () => {
    test('should identify greeting messages', () => {
      expect(messageHandler.isGreeting('hello')).toBe(true);
      expect(messageHandler.isGreeting('Hi there!')).toBe(true);
      expect(messageHandler.isGreeting('Good morning')).toBe(true);
      expect(messageHandler.isGreeting('How are you?')).toBe(false);
    });
  });

  describe('isPriceInquiry', () => {
    test('should identify price inquiry messages', () => {
      expect(messageHandler.isPriceInquiry('What is the price?')).toBe(true);
      expect(messageHandler.isPriceInquiry('How much does it cost?')).toBe(true);
      expect(messageHandler.isPriceInquiry('Tell me about packages')).toBe(false);
    });
  });

  describe('isFinalizeCommand', () => {
    test('should identify finalize commands', () => {
      expect(messageHandler.isFinalizeCommand('finalize')).toBe(true);
      expect(messageHandler.isFinalizeCommand('Finalize')).toBe(true);
      expect(messageHandler.isFinalizeCommand('final')).toBe(false);
    });
  });

  describe('isBookMyTripCommand', () => {
    test('should identify book my trip commands', () => {
      expect(messageHandler.isBookMyTripCommand('book my trip')).toBe(true);
      expect(messageHandler.isBookMyTripCommand('Book Trip')).toBe(true);
      expect(messageHandler.isBookMyTripCommand('book')).toBe(true);
      expect(messageHandler.isBookMyTripCommand('booking')).toBe(false);
    });
  });

  describe('containsBookingInfo', () => {
    test('should identify messages containing booking information', () => {
      expect(messageHandler.containsBookingInfo('I want to book Bali')).toBe(true);
      expect(messageHandler.containsBookingInfo('Travel to Paris for 3 people')).toBe(true);
      expect(messageHandler.containsBookingInfo('What is the weather?')).toBe(false);
    });
  });

  describe('extractBookingInfo', () => {
    test('should extract booking information from messages', () => {
      const message = 'I want to book Bali Explorer P001 for 2 people from 15/08/2026 to 20/08/2026 for $1500';
      const result = messageHandler.extractBookingInfo(message, '1234567890@c.us');

      expect(result.customerPhone).toBe('1234567890');
      expect(result.package).toBe('Bali Explorer (P001)');
      expect(result.destination).toBe('Bali');
      expect(result.numberOfPeople).toBe('2');
      expect(result.startDate).toBe('15/08/2026');
      expect(result.endDate).toBe('20/08/2026');
      expect(result.totalPrice).toBe('1500');
    });

    test('should handle messages with partial booking information', () => {
      const message = 'Book Bali for 3 people';
      const result = messageHandler.extractBookingInfo(message, '1234567890@c.us');

      expect(result.customerPhone).toBe('1234567890');
      expect(result.package).toBe('Bali Explorer (P001)');
      expect(result.numberOfPeople).toBe('3');
    });
  });

  describe('extractBookingFromConversation', () => {
    test('should extract booking information from conversation history', () => {
      const conversationHistory = [
        { message: 'I want to book Bali', isBot: false },
        { message: 'For 2 people', isBot: false },
        { message: 'From 15/08/2026 to 20/08/2026', isBot: false }
      ];

      const result = messageHandler.extractBookingFromConversation(conversationHistory, '1234567890@c.us');

      expect(result.customerPhone).toBe('1234567890');
      expect(result.package).toBe('P001');
      expect(result.destination).toBe('Bali');
      expect(result.numberOfPeople).toBe('2');
      expect(result.startDate).toBe('2026-08-15');
      expect(result.endDate).toBe('2026-08-20');
    });
  });

  describe('normalizeDates', () => {
    test('should normalize various date formats', () => {
      const dates = ['15/08/2026', '20 Aug 2026', '25-08-2026'];
      const result = messageHandler.normalizeDates(dates);

      expect(result).toEqual(['15/08/2026', '20/08/2026', '25/08/2026']);
    });

    test('should handle invalid dates', () => {
      const dates = ['invalid date', '15/08/2026'];
      const result = messageHandler.normalizeDates(dates);

      expect(result).toEqual(['15/08/2026']);
    });
  });

  describe('isValidDate', () => {
    test('should validate date formats', () => {
      expect(messageHandler.isValidDate('15/08/2026')).toBe(true);
      expect(messageHandler.isValidDate('32/08/2026')).toBe(false);
      expect(messageHandler.isValidDate('15/13/2026')).toBe(false);
      expect(messageHandler.isValidDate('15/08/2020')).toBe(false); // Year too old
    });
  });

  describe('convertToBackendDateFormat', () => {
    test('should convert dates to YYYY-MM-DD format', () => {
      expect(messageHandler.convertToBackendDateFormat('15/08/2026')).toBe('2026-08-15');
      expect(messageHandler.convertToBackendDateFormat('20-08-2026')).toBe('2026-08-15');
    });
  });

  describe('handleVendorQuotes', () => {
    test('should process vendor quotes and send formatted message', async () => {
      const quoteData = {
        customer_phone: '1234567890',
        destination: 'Bali',
        service_type: 'Hotel',
        quotes: [
          { vendor_name: 'Hotel A', final_price: 150, quote_details: 'Luxury hotel' },
          { vendor_name: 'Hotel B', final_price: 120, quote_details: 'Budget hotel' }
        ]
      };

      await messageHandler.handleVendorQuotes(quoteData);

      expect(mockConversationManager.storeQuoteData).toHaveBeenCalledWith('1234567890@c.us', quoteData);
      expect(mockSendMessage).toHaveBeenCalled();
      expect(mockConversationManager.addMessage).toHaveBeenCalled();
    });
  });

  describe('formatQuoteMessage', () => {
    test('should format quote data into readable message', () => {
      const quoteData = {
        destination: 'Bali',
        service_type: 'Hotel',
        quotes: [
          { vendor_name: 'Hotel A', final_price: 150, quote_details: 'Luxury hotel', validity_date: '2026-08-20' },
          { vendor_name: 'Hotel B', final_price: 120, quote_details: 'Budget hotel' }
        ]
      };

      const result = messageHandler.formatQuoteMessage(quoteData);

      expect(result).toContain('TRAVEL QUOTES RECEIVED!');
      expect(result).toContain('Bali');
      expect(result).toContain('Hotel A');
      expect(result).toContain('$150');
      expect(result).toContain('Hotel B');
      expect(result).toContain('$120');
    });
  });

  describe('extractCustomerInfo', () => {
    test('should extract customer information from conversation', () => {
      const conversationHistory = [
        { message: 'My name is John Doe', isBot: false },
        { message: 'Book Bali for 2 people', isBot: false },
        { message: 'From 15/08/2026 to 20/08/2026', isBot: false }
      ];

      const result = messageHandler.extractCustomerInfo(conversationHistory, '1234567890', []);

      expect(result.phone).toBe('1234567890');
      expect(result.package).toBe('Bali Explorer (P001)');
      expect(result.numberOfPeople).toBe('2');
      expect(result.dates).toBe('15/08/2026 to 20/08/2026');
    });
  });

  describe('formatExecutiveMessage', () => {
    test('should format customer info for executive', () => {
      const customerInfo = {
        phone: '1234567890',
        name: 'John Doe',
        package: 'Bali Explorer (P001)',
        destination: 'Bali, Indonesia',
        numberOfPeople: '2',
        dates: '15/08/2026 to 20/08/2026',
        budget: '$1500',
        conversationSummary: 'Customer wants to book Bali package'
      };

      const result = messageHandler.formatExecutiveMessage(customerInfo);

      expect(result).toContain('NEW BOOKING REQUEST');
      expect(result).toContain('John Doe');
      expect(result).toContain('1234567890');
      expect(result).toContain('Bali Explorer (P001)');
      expect(result).toContain('2 person(s)');
      expect(result).toContain('15/08/2026 to 20/08/2026');
      expect(result).toContain('$1500');
    });
  });

  describe('handleFinalizeCommand', () => {
    test('should process finalize command successfully', async () => {
      mockConversationManager.getConversationHistory.mockReturnValue([
        { message: 'Book Bali for 2 people from 15/08/2026 to 20/08/2026', isBot: false }
      ]);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockApiConnector.sendDaywiseBookingEmail.mockResolvedValue(true);

      await messageHandler.handleFinalizeCommand(mockMsg, []);

      expect(mockApiConnector.sendDaywiseBookingEmail).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        expect.stringContaining('BOOKING FINALIZED!')
      );
    });

    test('should handle finalize command with missing dates', async () => {
      mockConversationManager.getConversationHistory.mockReturnValue([
        { message: 'Book Bali for 2 people', isBot: false }
      ]);
      mockApiConnector.getCustomerData.mockResolvedValue([]);

      await messageHandler.handleFinalizeCommand(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        expect.stringContaining("I couldn't find your travel dates")
      );
    });

    test('should handle finalize command with backend error', async () => {
      mockConversationManager.getConversationHistory.mockReturnValue([
        { message: 'Book Bali for 2 people from 15/08/2026 to 20/08/2026', isBot: false }
      ]);
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockApiConnector.sendDaywiseBookingEmail.mockResolvedValue(false);

      await messageHandler.handleFinalizeCommand(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        expect.stringContaining('BOOKING ERROR')
      );
    });
  });

  describe('handleBookMyTripCommand', () => {
    test('should forward booking request to executive', async () => {
      mockConversationManager.getConversationHistory.mockReturnValue([
        { message: 'Book Bali for 2 people', isBot: false }
      ]);
      mockApiConnector.getCustomerData.mockResolvedValue([]);

      await messageHandler.handleBookMyTripCommand(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledTimes(2); // One to executive, one to customer
    });

    test('should handle missing executive phone', async () => {
      // Temporarily change config
      mockConfig.EXECUTIVE_PHONE = null;

      await messageHandler.handleBookMyTripCommand(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "Sorry, our booking system is temporarily unavailable. Please try again later."
      );

      // Restore config
      mockConfig.EXECUTIVE_PHONE = '1234567890';
    });
  });

  describe('handleBookingInfo', () => {
    test('should save booking information to Google Sheets', async () => {
      mockMsg.body = 'Book Bali for 2 people';
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockGoogleSheetsManager.appendBooking.mockResolvedValue(true);

      await messageHandler.handleBookingInfo(mockMsg, []);

      expect(mockGoogleSheetsManager.appendBooking).toHaveBeenCalled();
    });

    test('should handle Google Sheets save failure', async () => {
      mockMsg.body = 'Book Bali for 2 people';
      mockApiConnector.getCustomerData.mockResolvedValue([]);
      mockGoogleSheetsManager.appendBooking.mockResolvedValue(false);

      await messageHandler.handleBookingInfo(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "❌ Sorry, there was an issue saving your booking information. Please try again."
      );
    });
  });

  describe('handlePriceInquiry', () => {
    test('should process price inquiry successfully', async () => {
      mockApiConnector.sendVendorEmail.mockResolvedValue(true);

      await messageHandler.handlePriceInquiry(mockMsg, []);

      expect(mockApiConnector.sendVendorEmail).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "Thank you for your inquiry! Our team will get back to you with pricing details soon."
      );
    });

    test('should handle price inquiry failure', async () => {
      mockApiConnector.sendVendorEmail.mockResolvedValue(false);

      await messageHandler.handlePriceInquiry(mockMsg, []);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '1234567890@c.us',
        "Sorry, there was an issue processing your inquiry. Please try again later."
      );
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running MessageHandler tests...');

  // Simple test runner
  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test greeting detection
  try {
    assert.strictEqual(messageHandler.isGreeting('hello'), true);
    assert.strictEqual(messageHandler.isGreeting('How are you?'), false);
    testResults.passed++;
    console.log('✅ Greeting detection test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Greeting detection: ' + error.message);
    console.log('❌ Greeting detection test failed:', error.message);
  }

  // Test price inquiry detection
  try {
    assert.strictEqual(messageHandler.isPriceInquiry('What is the price?'), true);
    assert.strictEqual(messageHandler.isPriceInquiry('Tell me about packages'), false);
    testResults.passed++;
    console.log('✅ Price inquiry detection test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Price inquiry detection: ' + error.message);
    console.log('❌ Price inquiry detection test failed:', error.message);
  }

  // Test command detection
  try {
    assert.strictEqual(messageHandler.isFinalizeCommand('finalize'), true);
    assert.strictEqual(messageHandler.isBookMyTripCommand('book my trip'), true);
    testResults.passed++;
    console.log('✅ Command detection test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Command detection: ' + error.message);
    console.log('❌ Command detection test failed:', error.message);
  }

  // Test date validation
  try {
    assert.strictEqual(messageHandler.isValidDate('15/08/2026'), true);
    assert.strictEqual(messageHandler.isValidDate('32/08/2026'), false);
    testResults.passed++;
    console.log('✅ Date validation test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Date validation: ' + error.message);
    console.log('❌ Date validation test failed:', error.message);
  }

  // Test date conversion
  try {
    assert.strictEqual(messageHandler.convertToBackendDateFormat('15/08/2026'), '2026-08-15');
    testResults.passed++;
    console.log('✅ Date conversion test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Date conversion: ' + error.message);
    console.log('❌ Date conversion test failed:', error.message);
  }

  // Test booking info extraction
  try {
    const bookingInfo = messageHandler.extractBookingInfo('Book Bali for 2 people from 15/08/2026 to 20/08/2026', '123@c.us');
    assert.strictEqual(bookingInfo.package, 'Bali Explorer (P001)');
    assert.strictEqual(bookingInfo.numberOfPeople, '2');
    assert.strictEqual(bookingInfo.startDate, '15/08/2026');
    assert.strictEqual(bookingInfo.endDate, '20/08/2026');
    testResults.passed++;
    console.log('✅ Booking info extraction test passed');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push('Booking info extraction: ' + error.message);
    console.log('❌ Booking info extraction test failed:', error.message);
  }

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  if (testResults.errors.length > 0) {
    console.log('\nErrors:');
    testResults.errors.forEach(error => console.log(`- ${error}`));
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! The MessageHandler is working correctly.');
  } else {
    console.log(`\n⚠️ ${testResults.failed} test(s) failed. Please review the implementation.`);
  }
}
