const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendMessage, sendTextMessage, sendTemplateMessage, handleWebhook } = require('./whatsapp');
const MessageHandler = require('./messageHandler');
const WebhookHandler = require('./webhookHandler');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for requests from localhost:3000 (dashboard frontend)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize MessageHandler globally for webhook processing
global.messageHandler = new MessageHandler();

// Initialize WebhookHandler for backend webhooks
const webhookHandler = new WebhookHandler();

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

// Test endpoint to send a text message
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

// Test endpoint to send a template message (matches your curl command)
app.post('/send-template', async (req, res) => {
  const { to, template, language } = req.body;

  if (!to || !template) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['to', 'template'],
      optional: ['language']
    });
  }

  try {
    const response = await sendTemplateMessage(to, template, language || 'en_US');
    res.status(200).json(response);
  } catch (error) {
    console.error('Template message error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Failed to send template message',
      details: error.response ? error.response.data : error.message
    });
  }
});

// Test endpoint to send hello_world template (exactly like your curl command)
app.post('/test-hello-world', async (req, res) => {
  const to = req.body.to || '917770974354'; // Default from your curl command

  if (!to) {
    return res.status(400).json({ error: 'Missing "to" parameter' });
  }

  try {
    const response = await sendTemplateMessage(to, 'hello_world', 'en_US');
    res.status(200).json({
      message: 'Template message sent successfully',
      response: response
    });
  } catch (error) {
    console.error('Hello world template error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Failed to send hello_world template',
      details: error.response ? error.response.data : error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
