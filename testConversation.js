const AIService = require('./aiService.js');

// Test conversation flow
async function testConversationFlow() {
  console.log('🧪 Testing Conversation Flow...\n');

  const testScenarios = [
    {
      name: 'Complete Booking Flow',
      messages: [
        'hello',  // Should greet and ask for name
        'John Doe',  // Should extract name and ask for package
        'bali explorer',  // Should extract package and ask for start date
        '15/12/2024',  // Should extract start date and ask for end date
        '25/12/2024',  // Should extract end date and ask for guests
        '2'  // Should extract guests and offer finalization
      ]
    },
    {
      name: 'Out of Order Information',
      messages: [
        'I want to book bali explorer for 3 people from 10/01/2025 to 20/01/2025',
        'Sarah Johnson'
      ]
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log('='.repeat(50));

    let conversationHistory = '';

    for (let i = 0; i < scenario.messages.length; i++) {
      const userMessage = scenario.messages[i];
      console.log(`👤 User: ${userMessage}`);

      // Get AI response
      const aiResponse = await AIService.getAIResponse(userMessage, 'test-user-' + scenario.name, conversationHistory);
      console.log(`🤖 Bot: ${aiResponse}`);

      // Update conversation history
      conversationHistory += `User: ${userMessage}\nBot: ${aiResponse}\n`;

      console.log(''); // Empty line for readability
    }

    console.log('✅ Scenario completed\n');
  }
}

// Run the test
testConversationFlow().catch(console.error);
