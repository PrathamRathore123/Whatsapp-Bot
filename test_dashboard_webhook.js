const axios = require('axios');

async function testDashboardWebhook() {
  const webhookUrl = 'http://localhost:3001/api/webhook/booking';
  const authToken = process.env.WEBHOOK_AUTH_TOKEN || 'your-webhook-token-here';

  const testBookingData = {
    customer_phone: '917770974354', // Replace with a test phone number
    customer_name: 'Test Customer',
    destination: 'Bali',
    travel_date: '2026-08-15',
    guests: 2,
    special_requests: 'Test booking from dashboard'
  };

  try {
    console.log('🧪 Testing dashboard webhook...');
    console.log('📡 Sending to:', webhookUrl);
    console.log('📦 Data:', JSON.stringify(testBookingData, null, 2));

    const response = await axios.post(webhookUrl, testBookingData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 10000
    });

    console.log('✅ Webhook response:', response.status, response.data);

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testDashboardWebhook();
