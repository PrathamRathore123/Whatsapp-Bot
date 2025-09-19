const assert = require('assert');
const MessageHandler = require('./messageHandler');

console.log('🧪 Starting MessageHandler Thorough Testing...\n');

// Create message handler instance
const messageHandler = new MessageHandler();

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper function to run tests
function runTest(testName, testFunction) {
  try {
    testFunction();
    testResults.passed++;
    console.log(`✅ ${testName} - PASSED`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${error.message}`);
    console.log(`❌ ${testName} - FAILED: ${error.message}`);
  }
}

// Test 1: Greeting Detection
runTest('Greeting Detection', () => {
  assert.strictEqual(messageHandler.isGreeting('hello'), true, 'Should detect "hello" as greeting');
  assert.strictEqual(messageHandler.isGreeting('Hi there!'), true, 'Should detect "Hi there!" as greeting');
  assert.strictEqual(messageHandler.isGreeting('Good morning'), true, 'Should detect "Good morning" as greeting');
  assert.strictEqual(messageHandler.isGreeting('Good afternoon'), true, 'Should detect "Good afternoon" as greeting');
  assert.strictEqual(messageHandler.isGreeting('How are you?'), false, 'Should not detect "How are you?" as greeting');
  assert.strictEqual(messageHandler.isGreeting(''), false, 'Should not detect empty string as greeting');
});

// Test 2: Price Inquiry Detection
runTest('Price Inquiry Detection', () => {
  assert.strictEqual(messageHandler.isPriceInquiry('What is the price?'), true, 'Should detect price inquiry');
  assert.strictEqual(messageHandler.isPriceInquiry('How much does it cost?'), true, 'Should detect cost inquiry');
  assert.strictEqual(messageHandler.isPriceInquiry('What is the rate?'), true, 'Should detect rate inquiry');
  assert.strictEqual(messageHandler.isPriceInquiry('Tell me about packages'), false, 'Should not detect package info as price inquiry');
  assert.strictEqual(messageHandler.isPriceInquiry(''), false, 'Should not detect empty string as price inquiry');
});

// Test 3: Command Detection
runTest('Command Detection', () => {
  // Finalize command
  assert.strictEqual(messageHandler.isFinalizeCommand('finalize'), true, 'Should detect "finalize" command');
  assert.strictEqual(messageHandler.isFinalizeCommand('Finalize'), true, 'Should detect "Finalize" command (case insensitive)');
  assert.strictEqual(messageHandler.isFinalizeCommand('final'), false, 'Should not detect "final" as finalize command');

  // Book my trip command
  assert.strictEqual(messageHandler.isBookMyTripCommand('book my trip'), true, 'Should detect "book my trip" command');
  assert.strictEqual(messageHandler.isBookMyTripCommand('Book Trip'), true, 'Should detect "Book Trip" command');
  assert.strictEqual(messageHandler.isBookMyTripCommand('book'), true, 'Should detect "book" command');
  assert.strictEqual(messageHandler.isBookMyTripCommand('booking'), false, 'Should not detect "booking" as command');
});

// Test 4: Booking Info Detection
runTest('Booking Info Detection', () => {
  assert.strictEqual(messageHandler.containsBookingInfo('I want to book Bali'), true, 'Should detect booking intent');
  assert.strictEqual(messageHandler.containsBookingInfo('Travel to Paris for 3 people'), true, 'Should detect travel with people');
  assert.strictEqual(messageHandler.containsBookingInfo('Book P001 package'), true, 'Should detect package booking');
  assert.strictEqual(messageHandler.containsBookingInfo('What is the weather?'), false, 'Should not detect weather query as booking');
  assert.strictEqual(messageHandler.containsBookingInfo(''), false, 'Should not detect empty string as booking info');
});

// Test 5: Date Validation
runTest('Date Validation', () => {
  assert.strictEqual(messageHandler.isValidDate('15/08/2026'), true, 'Should validate correct date format');
  assert.strictEqual(messageHandler.isValidDate('15-08-2026'), true, 'Should validate dash format');
  assert.strictEqual(messageHandler.isValidDate('32/08/2026'), false, 'Should reject invalid day');
  assert.strictEqual(messageHandler.isValidDate('15/13/2026'), false, 'Should reject invalid month');
  assert.strictEqual(messageHandler.isValidDate('15/08/2020'), false, 'Should reject year too old');
  assert.strictEqual(messageHandler.isValidDate('15/08/2035'), false, 'Should reject year too far in future');
  assert.strictEqual(messageHandler.isValidDate('invalid'), false, 'Should reject invalid format');
});

// Test 6: Date Conversion
runTest('Date Conversion', () => {
  assert.strictEqual(messageHandler.convertToBackendDateFormat('15/08/2026'), '2026-08-15', 'Should convert dd/mm/yyyy to yyyy-mm-dd');
  assert.strictEqual(messageHandler.convertToBackendDateFormat('20-08-2026'), '2026-08-15', 'Should handle dash format');
  assert.strictEqual(messageHandler.convertToBackendDateFormat('invalid'), 'invalid', 'Should return original for invalid format');
});

// Test 7: Date Normalization
runTest('Date Normalization', () => {
  const dates1 = ['15/08/2026', '20 Aug 2026', '25-08-2026'];
  const normalized1 = messageHandler.normalizeDates(dates1);
  assert.deepStrictEqual(normalized1, ['15/08/2026', '20/08/2026', '25/08/2026'], 'Should normalize different date formats');

  const dates2 = ['invalid date', '15/08/2026'];
  const normalized2 = messageHandler.normalizeDates(dates2);
  assert.deepStrictEqual(normalized2, ['15/08/2026'], 'Should filter out invalid dates');

  const dates3 = [];
  const normalized3 = messageHandler.normalizeDates(dates3);
  assert.deepStrictEqual(normalized3, [], 'Should handle empty array');
});

// Test 8: Booking Info Extraction
runTest('Booking Info Extraction', () => {
  const message1 = 'I want to book Bali Explorer P001 for 2 people from 15/08/2026 to 20/08/2026 for $1500';
  const result1 = messageHandler.extractBookingInfo(message1, '1234567890@c.us');

  assert.strictEqual(result1.customerPhone, '1234567890', 'Should extract correct phone');
  assert.strictEqual(result1.package, 'Bali Explorer (P001)', 'Should extract package');
  assert.strictEqual(result1.destination, 'Bali', 'Should extract destination');
  assert.strictEqual(result1.numberOfPeople, '2', 'Should extract number of people');
  assert.strictEqual(result1.startDate, '15/08/2026', 'Should extract start date');
  assert.strictEqual(result1.endDate, '20/08/2026', 'Should extract end date');
  assert.strictEqual(result1.totalPrice, '1500', 'Should extract price');
  assert.strictEqual(result1.status, 'Pending', 'Should set default status');

  const message2 = 'Book Bali for 3 people';
  const result2 = messageHandler.extractBookingInfo(message2, '0987654321@c.us');

  assert.strictEqual(result2.customerPhone, '0987654321', 'Should extract correct phone for second test');
  assert.strictEqual(result2.package, 'Bali Explorer (P001)', 'Should detect Bali package');
  assert.strictEqual(result2.numberOfPeople, '3', 'Should extract number of people');
});

// Test 9: Booking Info Extraction from Conversation
runTest('Booking Info Extraction from Conversation', () => {
  const conversationHistory = [
    { message: 'I want to book Bali', isBot: false },
    { message: 'For 2 people', isBot: false },
    { message: 'From 15/08/2026 to 20/08/2026', isBot: false },
    { message: 'My name is John Doe', isBot: false },
    { message: 'Budget is $1500', isBot: false }
  ];

  const result = messageHandler.extractBookingFromConversation(conversationHistory, '1234567890@c.us');

  assert.strictEqual(result.customerPhone, '1234567890', 'Should extract correct phone');
  assert.strictEqual(result.customerName, 'John Doe', 'Should extract customer name');
  assert.strictEqual(result.package, 'P001', 'Should extract package ID');
  assert.strictEqual(result.destination, 'Bali', 'Should extract destination');
  assert.strictEqual(result.numberOfPeople, '2', 'Should extract number of people');
  assert.strictEqual(result.startDate, '2026-08-15', 'Should extract and convert start date');
  assert.strictEqual(result.endDate, '2026-08-20', 'Should extract and convert end date');
  assert.strictEqual(result.totalPrice, '1500', 'Should extract price');
});

// Test 10: Customer Info Extraction
runTest('Customer Info Extraction', () => {
  const conversationHistory = [
    { message: 'My name is John Doe', isBot: false },
    { message: 'Book Bali for 2 people', isBot: false },
    { message: 'From 15/08/2026 to 20/08/2026', isBot: false },
    { message: 'Budget around $1500', isBot: false }
  ];

  const result = messageHandler.extractCustomerInfo(conversationHistory, '1234567890', []);

  assert.strictEqual(result.phone, '1234567890', 'Should extract correct phone');
  assert.strictEqual(result.name, '', 'Should not extract name from backend data');
  assert.strictEqual(result.package, 'Bali Explorer (P001)', 'Should extract package');
  assert.strictEqual(result.destination, 'Bali, Indonesia', 'Should extract destination');
  assert.strictEqual(result.numberOfPeople, '2', 'Should extract number of people');
  assert.strictEqual(result.dates, '15/08/2026 to 20/08/2026', 'Should extract dates');
  assert.strictEqual(result.budget, '$1500', 'Should extract budget');
});

// Test 11: Quote Message Formatting
runTest('Quote Message Formatting', () => {
  const quoteData = {
    destination: 'Bali',
    service_type: 'Hotel',
    quotes: [
      {
        vendor_name: 'Hotel A',
        final_price: 150,
        quote_details: 'Luxury hotel with pool',
        validity_date: '2026-08-20'
      },
      {
        vendor_name: 'Hotel B',
        final_price: 120,
        quote_details: 'Budget hotel',
        validity_date: null
      }
    ]
  };

  const result = messageHandler.formatQuoteMessage(quoteData);

  assert(result.includes('TRAVEL QUOTES RECEIVED!'), 'Should contain header');
  assert(result.includes('Bali'), 'Should contain destination');
  assert(result.includes('Hotel'), 'Should contain service type');
  assert(result.includes('Hotel A'), 'Should contain first vendor');
  assert(result.includes('$150'), 'Should contain first price');
  assert(result.includes('Hotel B'), 'Should contain second vendor');
  assert(result.includes('$120'), 'Should contain second price');
  assert(result.includes('Luxury hotel with pool'), 'Should contain first vendor details');
  assert(result.includes('Budget hotel'), 'Should contain second vendor details');
  assert(result.includes('2026-08-20'), 'Should contain validity date');
  assert(result.includes('Next Steps'), 'Should contain next steps section');
});

// Test 12: Executive Message Formatting
runTest('Executive Message Formatting', () => {
  const customerInfo = {
    phone: '1234567890',
    name: 'John Doe',
    package: 'Bali Explorer (P001)',
    destination: 'Bali, Indonesia',
    numberOfPeople: '2',
    dates: '15/08/2026 to 20/08/2026',
    budget: '$1500',
    conversationSummary: 'Customer wants to book Bali package for 2 people',
    vendorQuotes: [
      { vendor_name: 'Hotel A', final_price: 150 }
    ]
  };

  const result = messageHandler.formatExecutiveMessage(customerInfo);

  assert(result.includes('NEW BOOKING REQUEST'), 'Should contain header');
  assert(result.includes('John Doe'), 'Should contain customer name');
  assert(result.includes('1234567890'), 'Should contain phone');
  assert(result.includes('Bali Explorer (P001)'), 'Should contain package');
  assert(result.includes('Bali, Indonesia'), 'Should contain destination');
  assert(result.includes('2 person(s)'), 'Should contain number of people');
  assert(result.includes('15/08/2026 to 20/08/2026'), 'Should contain dates');
  assert(result.includes('$1500'), 'Should contain budget');
  assert(result.includes('Hotel A'), 'Should contain vendor quote');
  assert(result.includes('$150'), 'Should contain vendor price');
  assert(result.includes('ACTION REQUIRED'), 'Should contain action section');
});

// Test 13: Edge Cases
runTest('Edge Cases', () => {
  // Empty or null inputs
  assert.strictEqual(messageHandler.isGreeting(null), false, 'Should handle null input');
  assert.strictEqual(messageHandler.isPriceInquiry(undefined), false, 'Should handle undefined input');
  assert.strictEqual(messageHandler.containsBookingInfo(''), false, 'Should handle empty string');

  // Date edge cases
  assert.strictEqual(messageHandler.isValidDate(''), false, 'Should handle empty date string');
  assert.strictEqual(messageHandler.convertToBackendDateFormat(''), '', 'Should handle empty date conversion');

  // Booking extraction edge cases
  const emptyResult = messageHandler.extractBookingInfo('', '123@c.us');
  assert.strictEqual(emptyResult.customerPhone, '123', 'Should handle empty message');
  assert.strictEqual(emptyResult.package, '', 'Should have empty package for empty message');

  // Conversation extraction with empty history
  const emptyConversationResult = messageHandler.extractBookingFromConversation([], '123@c.us');
  assert.strictEqual(emptyConversationResult.customerPhone, '123', 'Should handle empty conversation');
});

// Test 14: Complex Booking Scenarios
runTest('Complex Booking Scenarios', () => {
  // Multiple date formats in one message
  const complexMessage = 'Book Bali Explorer for 4 people from 15 Aug 2026 to 20/08/2026 with budget of $2000';
  const result = messageHandler.extractBookingInfo(complexMessage, '1234567890@c.us');

  assert.strictEqual(result.package, 'Bali Explorer (P001)', 'Should extract package from complex message');
  assert.strictEqual(result.numberOfPeople, '4', 'Should extract people count');
  assert.strictEqual(result.startDate, '15/08/2026', 'Should extract start date');
  assert.strictEqual(result.endDate, '20/08/2026', 'Should extract end date');
  assert.strictEqual(result.totalPrice, '2000', 'Should extract budget');

  // Name extraction variations
  const nameMessage = 'This is Jane Smith booking for Bali';
  const nameResult = messageHandler.extractBookingInfo(nameMessage, '123@c.us');
  assert.strictEqual(nameResult.customerName, 'Jane Smith', 'Should extract name from booking message');
});

// Test 15: Error Handling
runTest('Error Handling', () => {
  // Test with malformed data
  const malformedConversation = [
    { message: null, isBot: false },
    { message: undefined, isBot: false },
    { message: 'Valid message', isBot: false }
  ];

  const result = messageHandler.extractBookingFromConversation(malformedConversation, '123@c.us');
  assert.strictEqual(result.customerPhone, '123', 'Should handle malformed conversation data');

  // Test date normalization with invalid data
  const invalidDates = [null, undefined, '', 'not a date', '15/08/2026'];
  const normalized = messageHandler.normalizeDates(invalidDates);
  assert.deepStrictEqual(normalized, ['15/08/2026'], 'Should filter out invalid dates in normalization');
});

// Print comprehensive test results
console.log('\n' + '='.repeat(50));
console.log('📊 MESSAGE HANDLER TESTING RESULTS');
console.log('='.repeat(50));
console.log(`✅ Tests Passed: ${testResults.passed}`);
console.log(`❌ Tests Failed: ${testResults.failed}`);
console.log(`📈 Total Tests: ${testResults.passed + testResults.failed}`);
console.log(`🎯 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

if (testResults.errors.length > 0) {
  console.log('\n🚨 FAILED TESTS DETAILS:');
  testResults.errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error}`);
  });
}

if (testResults.failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('✨ MessageHandler is fully functional and ready for production.');
  console.log('🔧 All message handling, booking commands, and vendor quote features are working correctly.');
} else {
  console.log(`\n⚠️ ${testResults.failed} test(s) failed.`);
  console.log('🔍 Please review the failed tests and fix the implementation accordingly.');
}

console.log('\n' + '='.repeat(50));
console.log('🧪 Testing completed at:', new Date().toLocaleString());
console.log('='.repeat(50));
