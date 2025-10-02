// Mock dependencies before requiring messageHandler
const mockApiConnector = {
  getCustomerData: async () => [],
  sendVendorEmail: async () => true,
  sendDaywiseBookingEmail: async () => true
};

const mockAiService = {
  getAIResponse: async () => 'Mock AI response'
};

const mockGoogleSheetsManager = {
  appendBooking: async () => true
};

class MockCustomerGreetingHandler {
  async handleGreeting() {
    return false;
  }
}

const mockCustomerGreetingHandler = MockCustomerGreetingHandler;

const mockWhatsapp = {
  sendMessage: async () => true
};

const mockGroqService = {
  generateResponse: async () => 'Mock response'
};

const mockGeminiService = {
  generateResponse: async () => 'Mock response'
};

// Override requires
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === './apiConnector') return mockApiConnector;
  if (id === './aiService') return mockAiService;
  if (id === './googleSheetsManager') return mockGoogleSheetsManager;
  if (id === './customerGreetingHandler') return mockCustomerGreetingHandler;
  if (id === './whatsapp') return mockWhatsapp;
  if (id === './groqService') return mockGroqService;
  if (id === './geminiService') return mockGeminiService;
  if (id === './config') return { EXECUTIVE_PHONE: '1234567890' };
  return originalRequire.apply(this, arguments);
};

const MessageHandler = require('./messageHandler');
const conversationManager = require('./conversationManager');

// Simple test runner
async function runTests() {
  console.log('🚀 Starting Concurrent Message Handling Tests...\n');

  let testResults = { passed: 0, failed: 0, total: 0 };

  function assert(condition, message) {
    testResults.total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      testResults.passed++;
    } else {
      console.log(`❌ FAIL: ${message}`);
      testResults.failed++;
    }
  }

  try {
    // Test 1: Basic message processing
    console.log('📋 Test 1: Basic message processing');
    let messageHandler = new MessageHandler();
    conversationManager.conversations = {};

    const userId = 'testuser@c.us';
    const message = { from: userId, body: 'Hello', fromMe: false, timestamp: '1' };

    await messageHandler.handleIncomingMessage(message);

    const history = conversationManager.getConversationHistory(userId);
    assert(history.length === 2, 'Should have user message and bot response');
    assert(history[0].message === 'Hello', 'First message should be user message');
    assert(history[1].isBot === true, 'Second message should be bot response');

    // Test 2: Sequential processing for same user
    console.log('\n📋 Test 2: Sequential processing for same user');
    messageHandler = new MessageHandler();
    conversationManager.conversations = {};

    const seqUser = 'sequser@c.us';
    const seqMessages = [
      { from: seqUser, body: 'First', fromMe: false, timestamp: '1' },
      { from: seqUser, body: 'Second', fromMe: false, timestamp: '2' },
      { from: seqUser, body: 'Third', fromMe: false, timestamp: '3' }
    ];

    await Promise.all(seqMessages.map(msg => messageHandler.handleIncomingMessage(msg)));

    const seqHistory = conversationManager.getConversationHistory(seqUser);
    assert(seqHistory.length === 6, 'Should have 6 messages (3 user + 3 bot)');
    assert(seqHistory[0].message === 'First', 'Messages should be in order');
    assert(seqHistory[2].message === 'Second', 'Messages should be in order');
    assert(seqHistory[4].message === 'Third', 'Messages should be in order');

    // Test 3: Concurrent processing for different users
    console.log('\n📋 Test 3: Concurrent processing for different users');
    messageHandler = new MessageHandler();
    conversationManager.conversations = {};

    const user1 = 'user1@c.us';
    const user2 = 'user2@c.us';
    const user3 = 'user3@c.us';

    const concurrentMessages = [
      { from: user1, body: 'Hello from user 1', fromMe: false, timestamp: '1' },
      { from: user2, body: 'Hello from user 2', fromMe: false, timestamp: '1' },
      { from: user3, body: 'Hello from user 3', fromMe: false, timestamp: '1' }
    ];

    const startTime = Date.now();
    await Promise.all(concurrentMessages.map(msg => messageHandler.handleIncomingMessage(msg)));
    const endTime = Date.now();

    assert(endTime - startTime < 3000, 'Concurrent processing should complete within 3 seconds');
    assert(conversationManager.getConversationHistory(user1).length === 2, 'User1 should have conversation');
    assert(conversationManager.getConversationHistory(user2).length === 2, 'User2 should have conversation');
    assert(conversationManager.getConversationHistory(user3).length === 2, 'User3 should have conversation');

    // Test 4: Queue cleanup
    console.log('\n📋 Test 4: Queue cleanup');
    messageHandler = new MessageHandler();
    conversationManager.conversations = {};

    const cleanupUser = 'cleanup@c.us';
    await messageHandler.handleIncomingMessage({
      from: cleanupUser, body: 'Test', fromMe: false, timestamp: '1'
    });

    assert(!messageHandler.userMessageQueues.has(cleanupUser), 'Queue should be cleaned up');

    // Test 5: Multiple messages from same user
    console.log('\n📋 Test 5: Multiple messages from same user');
    messageHandler = new MessageHandler();
    conversationManager.conversations = {};

    const multiUser = 'multi@c.us';
    const multiMessages = Array.from({ length: 5 }, (_, i) => ({
      from: multiUser,
      body: `Message ${i + 1}`,
      fromMe: false,
      timestamp: (i + 1).toString()
    }));

    await Promise.all(multiMessages.map(msg => messageHandler.handleIncomingMessage(msg)));

    const multiHistory = conversationManager.getConversationHistory(multiUser);
    assert(multiHistory.length === 10, 'Should have 10 messages (5 user + 5 bot)');

    // Verify order
    for (let i = 0; i < 5; i++) {
      assert(multiHistory[i * 2].message === `Message ${i + 1}`, `Message ${i + 1} should be in correct position`);
      assert(multiHistory[i * 2 + 1].isBot === true, `Bot response ${i + 1} should be in correct position`);
    }

    console.log(`\n📊 Test Results: ${testResults.passed}/${testResults.total} passed, ${testResults.failed} failed`);

    if (testResults.failed === 0) {
      console.log('🎉 All concurrent message handling tests passed!');
      console.log('✅ The bot can now handle 2-3 simultaneous chats effectively.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the tests
runTests().catch(console.error);
