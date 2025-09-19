const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const MessageHandler = require('./messageHandler');
const WebhookHandler = require('./webhookHandler');

class WhatsAppClient {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });
    this.messageHandler = new MessageHandler(this.client);
    this.webhookHandler = new WebhookHandler(this.client);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on("qr", (qr) => {
      console.log("Scan this QR code with your WhatsApp app:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      console.log("WhatsApp client is ready!");
    });

    this.client.on("message", async (msg) => {
      await this.messageHandler.handleIncomingMessage(msg);
    });

    this.client.on("auth_failure", (msg) => {
      console.error("Authentication failure:", msg);
    });

    this.client.on("disconnected", (reason) => {
      console.log("WhatsApp client disconnected:", reason);
    });
  }

  initialize() {
    this.client.initialize();
  }
}

module.exports = WhatsAppClient;
