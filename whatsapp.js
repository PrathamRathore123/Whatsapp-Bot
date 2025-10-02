const axios = require('axios');
require('dotenv').config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Debug: Check if environment variables are loaded
console.log('🔧 WhatsApp API Config Check:');
console.log('   WHATSAPP_TOKEN:', WHATSAPP_TOKEN ? 'Set (length: ' + WHATSAPP_TOKEN.length + ')' : 'NOT SET');
console.log('   PHONE_NUMBER_ID:', PHONE_NUMBER_ID ? 'Set (' + PHONE_NUMBER_ID + ')' : 'NOT SET');

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.error('❌ Missing required environment variables for WhatsApp API');
}

async function sendTextMessage(to, text) {
  // Validate environment variables
  if (!WHATSAPP_TOKEN) {
    throw new Error('WHATSAPP_TOKEN environment variable is not set');
  }
  if (!PHONE_NUMBER_ID) {
    throw new Error('PHONE_NUMBER_ID environment variable is not set');
  }

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
    return response.data;
  } catch (error) {
    console.error('❌ Error sending text message:', error.response ? error.response.data : error.message);
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

async function handleWebhook(req, res) {
  const body = req.body;

  console.log('🔗 WEBHOOK RECEIVED - Method:', req.method, 'Body keys:', body ? Object.keys(body) : 'null');
  console.log('🔗 Full webhook body:', JSON.stringify(body, null, 2));

  // Check if this is a webhook verification request
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WEBHOOK_AUTH_TOKEN) {
    console.log('✅ WEBHOOK VERIFICATION REQUEST - Token matches');
    res.status(200).send(req.query['hub.challenge']);
    return;
  }

  // Check if this is a backend webhook notification (quote data, etc.)
  if (body && typeof body === 'object' && !body.object) {
    // This is likely a backend webhook notification
    console.log('Received backend webhook notification:', JSON.stringify(body, null, 2));

    // Handle different types of backend notifications
    if (body.quote_request_id && body.quotes) {
      // This is a vendor quotes notification
      if (global.messageHandler) {
        try {
          await global.messageHandler.handleVendorQuotes(body);
        } catch (error) {
          console.error('Error processing vendor quotes webhook:', error);
        }
      }
    } else {
      console.log('Unknown backend webhook type:', Object.keys(body));
    }

    res.status(200).send('OK');
    return;
  }

  // Process incoming WhatsApp messages
  if (body.object === 'whatsapp_business_account') {
    if (!body.entry || !Array.isArray(body.entry)) {
      console.log('Invalid WhatsApp webhook structure: missing or invalid entry array');
      res.status(400).send('Invalid webhook structure');
      return;
    }

    body.entry.forEach(entry => {
      if (!entry.changes || !Array.isArray(entry.changes)) {
        console.log('Invalid WhatsApp webhook structure: missing or invalid changes array for entry:', entry);
        return;
      }

      entry.changes.forEach(change => {
        console.log('Processing change with field:', change.field);

        if (change.field === 'messages') {
          console.log('📨 Processing messages field, value keys:', change.value ? Object.keys(change.value) : 'null');

          // Check if this contains actual messages
          if (change.value && change.value.messages && Array.isArray(change.value.messages)) {
            console.log(`📨 Found ${change.value.messages.length} messages in webhook`);

            change.value.messages.forEach(async (message) => {
              console.log('📨 Raw message from Meta API:', JSON.stringify(message, null, 2));

              // Handle different message types
              let messageBody = '';
              if (message.text && message.text.body) {
                messageBody = message.text.body;
              } else if (message.text) {
                messageBody = message.text;
              } else if (message.type === 'text' && message.text) {
                messageBody = message.text.body || message.text;
              } else {
                console.log('📨 Non-text message type:', message.type, 'skipping...');
                return; // Skip non-text messages for now
              }

              // Convert Meta API message format to Web.js-like format for compatibility
              const convertedMessage = {
                from: message.from, // Phone number (e.g., "1234567890")
                body: messageBody,
                fromMe: false,
                timestamp: message.timestamp,
                id: message.id
              };

              console.log('🔄 Converted message for processing:', JSON.stringify(convertedMessage, null, 2));

              // Process the message using the message handler
              if (global.messageHandler) {
                try {
                  console.log(`🤖 Calling messageHandler.handleIncomingMessage for message: "${convertedMessage.body}"`);
                  await global.messageHandler.handleIncomingMessage(convertedMessage);
                  console.log(`✅ Message processing completed successfully`);
                } catch (error) {
                  console.error('❌ Error processing message:', error);
                  console.error('❌ Error stack:', error.stack);
                }
              } else {
                console.error('❌ Message handler not initialized - global.messageHandler is undefined');
              }
            });
          }
          // Check if this contains status updates (sometimes sent under 'messages' field)
          else if (change.value && change.value.statuses && Array.isArray(change.value.statuses)) {
            console.log('Received status updates:', change.value.statuses.length, 'statuses');
            // Status updates can be logged but don't need processing like messages
            // Example: message sent, delivered, read statuses
          }
          // Neither messages nor statuses - log and skip
          else {
            console.log('Skipping messages field event - no messages or statuses array:', change.value);
          }
        } else {
          // Handle other event types (contacts, etc.) gracefully
          console.log(`Received non-message event type: ${change.field}`, change.value || 'No value');
        }
      });
    });
  }

  res.status(200).send('OK');
}

module.exports = {
  sendMessage,
  sendTextMessage,
  sendTemplateMessage,
  handleWebhook
};
