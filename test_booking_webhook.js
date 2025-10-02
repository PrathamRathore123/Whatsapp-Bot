const axios = require('axios');

async function testBookingWebhook() {
  try {
    const bookingData = {
      phone: '7770974354', // Sample Indian phone number
      name: 'Test Customer',
      destination: 'Bali',
      travel_date: '2025-12-01',
      guests: 2,
      special_requests: 'Vegetarian meals preferred'
    };

    console.log('🧪 Testing booking webhook with data:', JSON.stringify(bookingData, null, 2));

    const response = await axios.post('http://localhost:3001/api/webhook/booking', bookingData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-webhook-token-here' // Using the test token
      },
      timeout: 10000
    });

    console.log('✅ Webhook test successful:', response.status, response.data);

  } catch (error) {
    console.error('❌ Webhook test failed:', error.response ? error.response.status : error.code);
    console.error('Error details:', error.response ? error.response.data : error.message);
  }
}

// Run the test
testBookingWebhook();
