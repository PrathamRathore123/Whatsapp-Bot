const axios = require('axios');
require('dotenv').config({ path: './BOT_new/.env' });

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN;

console.log('🔧 Testing WhatsApp Webhook Configuration:');
console.log('   WHATSAPP_TOKEN:', WHATSAPP_TOKEN ? 'Set' : 'NOT SET');
console.log('   PHONE_NUMBER_ID:', PHONE_NUMBER_ID ? 'Set' : 'NOT SET');
console.log('   WEBHOOK_AUTH_TOKEN:', WEBHOOK_AUTH_TOKEN ? 'Set' : 'NOT SET');

// Test webhook verification
async function testWebhookVerification() {
  console.log('\n🔍 Testing Webhook Verification...');

  const testUrl = 'http://localhost:3000/webhook';
  const testParams = {
    'hub.mode': 'subscribe',
    'hub.verify_token': WEBHOOK_AUTH_TOKEN,
    'hub.challenge': 'test_challenge_123'
  };

  try {
    const response = await axios.get(testUrl, { params: testParams });
    console.log('✅ Webhook verification successful:', response.data);
  } catch (error) {
    console.error('❌ Webhook verification failed:', error.response ? error.response.data : error.message);
  }
}

// Test sending a message to yourself (if you have a test phone number)
async function testSendMessage() {
  console.log('\n📤 Testing Message Send...');

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ Missing WhatsApp credentials');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
    const data = {
      messaging_product: 'whatsapp',
      to: '917770974354', // Replace with your test phone number
      type: 'text',
      text: {
        body: 'Test message from bot webhook test'
      }
    };
    const headers = {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(url, data, { headers });
    console.log('✅ Message sent successfully:', response.data);
  } catch (error) {
    console.error('❌ Message send failed:', error.response ? error.response.data : error.message);
  }
}

// Test webhook endpoint directly
async function testWebhookEndpoint() {
  console.log('\n🌐 Testing Webhook Endpoint...');

  const testWebhookData = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'test_business_id',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: PHONE_NUMBER_ID,
            phone_number_id: PHONE_NUMBER_ID
          },
          contacts: [{
            profile: { name: 'Test User' },
            wa_id: '917770974354'
          }],
          messages: [{
            id: 'test_message_id',
            from: '917770974354',
            timestamp: Date.now().toString(),
            text: { body: 'Hello bot!' },
            type: 'text'
          }]
        }
      }]
    }]
  };

  try {
    const response = await axios.post('http://localhost:3000/webhook', testWebhookData, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Webhook endpoint responded:', response.status);
  } catch (error) {
    console.error('❌ Webhook endpoint failed:', error.response ? error.response.data : error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting WhatsApp Webhook Tests...\n');

  await testWebhookVerification();
  await testSendMessage();
  await testWebhookEndpoint();

  console.log('\n📋 Next Steps:');
  console.log('1. Make sure your Meta WhatsApp webhook URL is set to: https://43ae9a76eaae.ngrok-free.app/webhook');
  console.log('2. Make sure the Verify Token is set to:', WEBHOOK_AUTH_TOKEN);
  console.log('3. Make sure webhook is subscribed to "messages" events');
  console.log('4. Test sending a message from WhatsApp to your business number');
  console.log('5. Check the bot terminal for logs like "🔗 WEBHOOK RECEIVED" and "📨 MESSAGE HANDLER"');
}

runTests().catch(console.error);
