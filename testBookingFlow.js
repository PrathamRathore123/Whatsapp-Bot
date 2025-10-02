// Simple test for booking flow logic without API calls
const AIService = require('./aiService.js');

// Mock the AI services to avoid API calls
AIService.geminiService = {
  generateResponse: async () => "Mock response"
};
AIService.groqService = {
  generateResponse: async () => "Mock response"
};
AIService.ollamaService = {
  generateResponse: async () => "Mock response"
};

async function testBookingFlow() {
  console.log('🧪 Testing booking flow logic...\n');

  const userId = 'test-user-123';

  // Test 1: Initial message - should ask for name
  let history = '';
  let response = await AIService.getAIResponse('Hi, I want to book a trip', userId, history);
  console.log('Test 1 - Initial:', response);
  history += `User: Hi, I want to book a trip\nBot: ${response}\n`;

  // Test 2: Provide name
  response = await AIService.getAIResponse('John Doe', userId, history);
  console.log('Test 2 - Name:', response);
  history += `User: John Doe\nBot: ${response}\n`;

  // Test 3: Provide package
  response = await AIService.getAIResponse('Bali Explorer', userId, history);
  console.log('Test 3 - Package:', response);
  history += `User: Bali Explorer\nBot: ${response}\n`;

  // Test 4: Provide dates
  response = await AIService.getAIResponse('15/01/2025 to 20/01/2025', userId, history);
  console.log('Test 4 - Dates:', response);
  history += `User: 15/01/2025 to 20/01/2025\nBot: ${response}\n`;

  // Test 5: Provide number of people
  response = await AIService.getAIResponse('3 people', userId, history);
  console.log('Test 5 - People:', response);
  history += `User: 3 people\nBot: ${response}\n`;

  // Test 6: Confirm booking (should trigger JSON generation)
  response = await AIService.getAIResponse('yes', userId, history);
  console.log('Test 6 - Confirmation:', response);

  console.log('\n✅ Booking flow test completed!');
  console.log('Check BOT_new/bookings.json for stored booking data.');
}

testBookingFlow().catch(console.error);
