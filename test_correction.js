const AIService = require('./aiService.js');

// Test correction flow
async function testCorrectionFlow() {
  console.log('🧪 Testing Correction Flow...\n');

  const userId = 'test-user-correction';
  let conversationHistory = '';

  const messages = [
    'Pratham Rathore',
    'bali explorer',
    '23/06/2026',
    '23/07/2026',
    '8',
    'no for 3 people',
    'no i want some changes'
  ];

  for (const userMessage of messages) {
    console.log(`👤 User: ${userMessage}`);

    // Get AI response
    const aiResponse = await AIService.getAIResponse(userMessage, userId, conversationHistory);
    console.log(`🤖 Bot: ${aiResponse}`);

    // Update conversation history
    conversationHistory += `User: ${userMessage}\nBot: ${aiResponse}\n`;

    console.log(''); // Empty line for readability
  }

  console.log('✅ Correction test completed\n');
}

// Run the test
testCorrectionFlow().catch(console.error);
