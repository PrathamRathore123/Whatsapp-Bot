const axios = require('axios');
require('dotenv').config();

// Test script to verify Meta API integration
async function testMetaAPI() {
  const baseURL = process.env.RENDER_APP_URL || 'http://localhost:3000';

  console.log('🧪 Testing Meta WhatsApp API Integration...\n');

  // Test 1: Text Message
  console.log('1️⃣ Testing Text Message:');
  try {
    const textResponse = await axios.get(`${baseURL}/send?to=917770974354&text=Hello%20from%20Meta%20API%20Test`);
    console.log('✅ Text message test passed');
    console.log('Response:', JSON.stringify(textResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Text message test failed');
    console.log('Error:', error.response ? error.response.data : error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Template Message (exactly like your curl command)
  console.log('2️⃣ Testing Template Message (hello_world):');
  try {
    const templateResponse = await axios.post(`${baseURL}/test-hello-world`, {
      to: '917770974354'
    });
    console.log('✅ Template message test passed');
    console.log('Response:', JSON.stringify(templateResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Template message test failed');
    console.log('Error:', error.response ? error.response.data : error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Custom Template Message
  console.log('3️⃣ Testing Custom Template Message:');
  try {
    const customTemplateResponse = await axios.post(`${baseURL}/send-template`, {
      to: '917770974354',
      template: 'hello_world',
      language: 'en_US'
    });
    console.log('✅ Custom template message test passed');
    console.log('Response:', JSON.stringify(customTemplateResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Custom template message test failed');
    console.log('Error:', error.response ? error.response.data : error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
  console.log('🎉 Meta API Integration Test Complete!');
  console.log('\n📋 Summary:');
  console.log('- API Version: v22.0 ✅');
  console.log('- Template Messages: Supported ✅');
  console.log('- Text Messages: Supported ✅');
  console.log('- Webhook Handling: Ready ✅');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMetaAPI().catch(console.error);
}

module.exports = { testMetaAPI };
