const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = Unravel123 || 'test_token';

// ✅ Webhook Verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log('🔍 Verification request received:');
  console.log('Mode:', mode);
  console.log('Token:', token);
  console.log('Expected token:', VERIFY_TOKEN);

  if (mode && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ✅ Handle Incoming Messages (POST)
app.post("/webhook", (req, res) => {
  console.log("🔄 Webhook received:", JSON.stringify(req.body, null, 2));

  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from; // sender's phone number
    const text = message.text?.body; // user message

    console.log(`📩 Message from ${from}: ${text}`);
  }

  res.sendStatus(200);
});

// Start server
const PORT = 3001; // Different port to test
app.listen(PORT, () => console.log(`🚀 Test webhook server running on port ${PORT}`));
