const MessageHandler = require('./messageHandler');
const conversationManager = require('./conversationManager');

// Mock dependencies to avoid actual API calls and external services
jest.mock('./apiConnector', () => ({
  getCustomerData: jest.fn().mockResolvedValue([]),
  sendVendorEmail: jest.fn().mockResolvedValue(true),
  sendDaywiseBookingEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('./aiService', () => ({
  getAIResponse: jest.fn().mockResolvedValue('Mock AI response')
}));

jest.mock('./googleSheetsManager', () => ({
  appendBooking: jest.fn().mockResolvedValue(true)
}));

jest.mock('./customerGreetingHandler', () => ({
  handleGreeting: jest.fn().mockResolvedValue(false)
}));

jest.mock('./whatsapp', () => ({
  sendMessage: jest.fn().mockResolvedValue(true)
}));

jest.mock('./config', () => ({
  EXECUTIVE_PHONE: '1234567890'
}));

describe('MessageHandler Concurrent Processing Tests', () => {
  let messageHandler;

  beforeEach(() => {
    messageHandler = new MessageHandler();
    // Clear conversation history
    conversationManager.conversations = {};
    conversationManager.saveConversations();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should process messages sequentially for the same user', async () => {
    const userId = 'user1@c.us';

    const messages = [
      { from: userId, body: 'Hello', fromMe: false, timestamp: '1' },
      { from: userId, body: 'I want to book a trip', fromMe: false, timestamp: '2' },
      { from: userId, body: 'For 2 people', fromMe: false, timestamp: '3' }
    ];

    // Start all message processing simultaneously
    const promises = messages.map(msg => messageHandler.handleIncomingMessage(msg));

    // Wait for all to complete
    await Promise.all(promises);

    // Verify conversation history has all messages in order
    const history = conversationManager.getConversationHistory(userId);
    expect(history).toHaveLength(6); // 3 user messages + 3 bot responses

    // Verify messages are in correct order
    expect(history[0].message).toBe('Hello');
    expect(history[1].isBot).toBe(true);
    expect(history[2].message).toBe('I want to book a trip');
    expect(history[3].isBot).toBe(true);
    expect(history[4].message).toBe('For 2 people');
    expect(history[5].isBot).toBe(true);
  });

  test('should process messages concurrently for different users', async () => {
    const user1 = 'user1@c.us';
    const user2 = 'user2@c.us';
    const user3 = 'user3@c.us';

    const messages = [
      { from: user1, body: 'Hello from user 1', fromMe: false, timestamp: '1' },
      { from: user2, body: 'Hello from user 2', fromMe: false, timestamp: '1' },
      { from: user3, body: 'Hello from user 3', fromMe: false, timestamp: '1' },
      { from: user1, body: 'Second message user 1', fromMe: false, timestamp: '2' },
      { from: user2, body: 'Second message user 2', fromMe: false, timestamp: '2' }
    ];

    const startTime = Date.now();

    // Process all messages concurrently
    await Promise.all(messages.map(msg => messageHandler.handleIncomingMessage(msg)));

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete relatively quickly (under 2 seconds for concurrent processing)
    expect(duration).toBeLessThan(2000);

    // Verify all conversations were created
    expect(conversationManager.getConversationHistory(user1)).toHaveLength(4); // 2 user + 2 bot
    expect(conversationManager.getConversationHistory(user2)).toHaveLength(4); // 2 user + 2 bot
    expect(conversationManager.getConversationHistory(user3)).toHaveLength(2); // 1 user + 1 bot
  });

  test('should handle rapid successive messages from same user', async () => {
    const userId = 'rapiduser@c.us';

    // Create 10 rapid messages
    const messages = Array.from({ length: 10 }, (_, i) => ({
      from: userId,
      body: `Message ${i + 1}`,
      fromMe: false,
      timestamp: (i + 1).toString()
    }));

    const startTime = Date.now();

    // Process all messages simultaneously
    await Promise.all(messages.map(msg => messageHandler.handleIncomingMessage(msg)));

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should take some time due to sequential processing per user
    expect(duration).toBeGreaterThan(100); // At least some processing time

    // All messages should be processed in order
    const history = conversationManager.getConversationHistory(userId);
    expect(history).toHaveLength(20); // 10 user + 10 bot

    // Verify order
    for (let i = 0; i < 10; i++) {
      expect(history[i * 2].message).toBe(`Message ${i + 1}`);
      expect(history[i * 2 + 1].isBot).toBe(true);
    }
  });

  test('should handle errors gracefully without blocking other users', async () => {
    const goodUser = 'gooduser@c.us';
    const errorUser = 'erroruser@c.us';

    // Mock AI service to throw error for errorUser
    const aiService = require('./aiService');
    aiService.getAIResponse.mockImplementation((msg, user) => {
      if (user === errorUser) {
        throw new Error('AI Service Error');
      }
      return Promise.resolve('Normal response');
    });

    const messages = [
      { from: goodUser, body: 'Hello', fromMe: false, timestamp: '1' },
      { from: errorUser, body: 'Hello', fromMe: false, timestamp: '1' },
      { from: goodUser, body: 'How are you?', fromMe: false, timestamp: '2' }
    ];

    // Process messages - error user should not block good user
    await Promise.all(messages.map(msg => messageHandler.handleIncomingMessage(msg)));

    // Good user should have complete conversation
    const goodHistory = conversationManager.getConversationHistory(goodUser);
    expect(goodHistory).toHaveLength(4); // 2 user + 2 bot

    // Error user should have user message but no bot response due to error
    const errorHistory = conversationManager.getConversationHistory(errorUser);
    expect(errorHistory).toHaveLength(1); // 1 user message, bot response failed
  });

  test('should clean up message queues after processing', async () => {
    const userId = 'cleanupuser@c.us';

    const message = { from: userId, body: 'Test message', fromMe: false, timestamp: '1' };

    // Process message
    await messageHandler.handleIncomingMessage(message);

    // Queue should be cleaned up
    expect(messageHandler.userMessageQueues.has(userId)).toBe(false);
  });

  test('should handle booking commands concurrently', async () => {
    const user1 = 'booker1@c.us';
    const user2 = 'booker2@c.us';

    const messages = [
      { from: user1, body: 'book my trip', fromMe: false, timestamp: '1' },
      { from: user2, body: 'finalize', fromMe: false, timestamp: '1' }
    ];

    // Process booking commands concurrently
    await Promise.all(messages.map(msg => messageHandler.handleIncomingMessage(msg)));

    // Both users should have responses
    expect(conversationManager.getConversationHistory(user1)).toHaveLength(2);
    expect(conversationManager.getConversationHistory(user2)).toHaveLength(2);
  });

  test('should handle mixed message types concurrently', async () => {
    const user1 = 'mixed1@c.us';
    const user2 = 'mixed2@c.us';
    const user3 = 'mixed3@c.us';

    const messages = [
      { from: user1, body: 'Hello', fromMe: false, timestamp: '1' }, // Greeting
      { from: user2, body: 'What is the price?', fromMe: false, timestamp: '1' }, // Price inquiry
      { from: user3, body: 'I want to book Bali for 2 people', fromMe: false, timestamp: '1' }, // Booking info
      { from: user1, body: 'book my trip', fromMe: false, timestamp: '2' }, // Booking command
    ];

    await Promise.all(messages.map(msg => messageHandler.handleIncomingMessage(msg)));

    // All users should have appropriate responses
    expect(conversationManager.getConversationHistory(user1)).toHaveLength(4); // greeting + command + responses
    expect(conversationManager.getConversationHistory(user2)).toHaveLength(2); // inquiry + response
    expect(conversationManager.getConversationHistory(user3)).toHaveLength(2); // booking info + response
  });
});

describe('MessageHandler Queue Management', () => {
  let messageHandler;

  beforeEach(() => {
    messageHandler = new MessageHandler();
  });

  test('should maintain separate queues for different users', () => {
    const user1 = 'user1@c.us';
    const user2 = 'user2@c.us';

    // Initially no queues
    expect(messageHandler.userMessageQueues.size).toBe(0);

    // Add processing for user1
    const promise1 = messageHandler.handleIncomingMessage({
      from: user1, body: 'Hello', fromMe: false, timestamp: '1'
    });

    expect(messageHandler.userMessageQueues.size).toBe(1);
    expect(messageHandler.userMessageQueues.has(user1)).toBe(true);

    // Add processing for user2
    const promise2 = messageHandler.handleIncomingMessage({
      from: user2, body: 'Hi', fromMe: false, timestamp: '1'
    });

    expect(messageHandler.userMessageQueues.size).toBe(2);
    expect(messageHandler.userMessageQueues.has(user1)).toBe(true);
    expect(messageHandler.userMessageQueues.has(user2)).toBe(true);

    // Wait for completion
    return Promise.all([promise1, promise2]).then(() => {
      expect(messageHandler.userMessageQueues.size).toBe(0);
    });
  });
});
