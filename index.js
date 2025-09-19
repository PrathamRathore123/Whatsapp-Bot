const express = require('express');
const bodyParser = require('body-parser');
const { sendMessage, handleWebhook } = require('./whatsapp');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Webhook endpoint for WhatsApp Cloud API
app.post('/webhook', handleWebhook);

// Verification endpoint for webhook setup
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_AUTH_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Test endpoint to send a message
app.get('/send', async (req, res) => {
  const to = req.query.to;
  const text = req.query.text || 'Hello from WhatsApp Cloud API!';

  if (!to) {
    return res.status(400).send('Missing "to" query parameter');
  }

  try {
    const response = await sendMessage(to, text);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).send('Failed to send message');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
