const axios = require('axios');
require('dotenv').config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function sendTextMessage(to, text) {
  try {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: {
        body: text
      }
    };
    const headers = {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(url, data, { headers });
    console.log('Text message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending text message:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function sendTemplateMessage(to, templateName, languageCode = 'en_US') {
  try {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };
    const headers = {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(url, data, { headers });
    console.log('Template message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending template message:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Backward compatibility - keep the old function name
async function sendMessage(to, text) {
  return await sendTextMessage(to, text);
}

function handleWebhook(req, res) {
  const body = req.body;

  // Check if this is a webhook verification request
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WEBHOOK_AUTH_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
    return;
  }

  // Process incoming messages
  if (body.object === 'whatsapp_business_account') {
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'messages') {
          change.value.messages.forEach(message => {
            console.log('Received message:', message);
            // Here you can add logic to respond to messages
            // For example, echo back the message
            // sendMessage(message.from, `Echo: ${message.text.body}`);
          });
        }
      });
    });
  }

  res.status(200).send('OK');
}

module.exports = {
  sendMessage,
  handleWebhook
};
