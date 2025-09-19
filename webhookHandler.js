
const express = require('express');
const apiConnector = require('./apiConnector');
const config = require('./config');
const BookingConfirmationHandler = require('./bookingConfirmationHandler');

class WebhookHandler {
  constructor(client) {
    this.client = client;
    this.bookingConfirmationHandler = new BookingConfirmationHandler(client);
    this.app = express();
    this.app.use(express.json());
    this.app.use(this.authMiddleware.bind(this));

    this.setupRoutes();
    this.startServer();
  }

  authMiddleware(req, res, next) {
    // Skip auth for health check
    if (req.path === '/health') {
      return next();
    }

    const authToken = config.WEBHOOK_AUTH_TOKEN;
    if (!authToken) {
      return next(); // Skip auth if no token configured
    }

    const providedToken = req.headers.authorization?.replace('Bearer ', '');

    // TEMPORARY: Allow the test token for debugging
    if (providedToken === 'your-webhook-token-here') {
      return next();
    }

    if (!providedToken || providedToken !== authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  }

  setupRoutes() {
    // Webhook endpoint for customer data updates
    this.app.post('/webhook/customer-update', this.handleCustomerUpdate.bind(this));

    // Webhook endpoint for booking confirmations
    this.app.post('/webhook/booking-confirmation', this.handleBookingConfirmation.bind(this));

    // New webhook endpoint for booking data from backend
    this.app.post('/api/webhook/booking', this.handleBookingWebhook.bind(this));

    // Webhook endpoint for inquiry responses
    this.app.post('/webhook/inquiry-response', this.handleInquiryResponse.bind(this));

    // Webhook endpoint for vendor quotes
    this.app.post('/api/webhook/vendor-quote', this.handleVendorQuote.bind(this));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        whatsapp_ready: this.bookingConfirmationHandler.isReady,
        services: {
          webhook_server: true,
          whatsapp_client: this.bookingConfirmationHandler.isReady ? 'ready' : 'not_ready'
        }
      });
    });
  }

  async handleCustomerUpdate(req, res) {
    try {
      const { customer_phone, customer_name, update_type, update_data } = req.body;

      console.log(`📱 Customer update webhook received for ${customer_phone}:`, update_type);

      let message = '';

      switch (update_type) {
        case 'profile_updated':
          message = `Hello ${customer_name}! Your profile has been updated successfully. 🌟`;
          break;
        case 'booking_confirmed':
          message = `Hello ${customer_name}! Your booking has been confirmed! 🎉\n\n${update_data?.details || 'Please check your booking details.'}`;
          break;
        case 'payment_received':
          message = `Hello ${customer_name}! Payment received successfully. 💳\n\n${update_data?.details || 'Thank you for your payment!'}`;
          break;
        case 'inquiry_response':
          message = `Hello ${customer_name}! You have a new response to your inquiry. 📧\n\n${update_data?.message || 'Please check your inquiry details.'}`;
          break;
        default:
          message = `Hello ${customer_name}! Your account has been updated. 📋`;
      }

      // Send WhatsApp message
      const chatId = `${customer_phone}@c.us`;
      await this.client.sendMessage(chatId, message);

      console.log(`✅ Notification sent to ${customer_phone} for ${update_type}`);

      res.json({ success: true, message: 'Notification sent successfully' });

    } catch (error) {
      console.error('❌ Error handling customer update webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  validateBookingData(data) {
    const required = ['customer_phone', 'customer_name'];
    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  async handleBookingConfirmation(req, res) {
    try {
      const { customer_phone, customer_name, booking_details } = req.body;
      
      // Input validation
      this.validateBookingData(req.body);

      const message = `🎉 Booking Confirmed!\n\nHello ${customer_name}!\n\nYour booking has been confirmed with the following details:\n\n${booking_details || 'Details will be sent separately.'}\n\nThank you for choosing WanderWorld Travels! 🌍✨`;

      const chatId = `${customer_phone.replace(/[^0-9]/g, '')}@c.us`;
      await this.client.sendMessage(chatId, message);

      console.log(`✅ Booking confirmation sent to ${customer_phone}`);
      res.json({ success: true, message: 'Booking confirmation sent' });

    } catch (error) {
      console.error('❌ Error handling booking confirmation:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async handleBookingWebhook(req, res) {
    try {
      const bookingData = req.body;
      console.log('📥 Booking webhook received:', bookingData);
      console.log('📱 WhatsApp client ready status:', this.bookingConfirmationHandler.isReady);

      // Map booking data to expected format
      const mappedData = {
        phone: bookingData.phone,
        name: bookingData.name,
        destination: bookingData.destination,
        travel_date: bookingData.travel_date,
        guests: bookingData.guests,
        special_requests: bookingData.special_requests || ''
      };

      console.log('📤 Mapped booking data:', mappedData);

      // Send confirmation message via WhatsApp
      await this.bookingConfirmationHandler.sendBookingConfirmation(mappedData);

      res.json({ success: true, message: 'Booking confirmation sent via WhatsApp' });

    } catch (error) {
      console.error('❌ Error handling booking webhook:', error.message);
      console.error('❌ Full error details:', error);

      // Return appropriate error response
      if (error.message.includes('not ready')) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp service temporarily unavailable',
          details: 'Please ensure the WhatsApp client is authenticated and ready'
        });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }

  validateInquiryData(data) {
    const required = ['customer_phone', 'customer_name', 'vendor_name', 'response_details'];
    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  async handleInquiryResponse(req, res) {
    try {
      const { customer_phone, customer_name, vendor_name, response_details } = req.body;
      
      // Input validation
      this.validateInquiryData(req.body);

      const message = `📧 New Inquiry Response\n\nHello ${customer_name}!\n\n${vendor_name} has responded to your inquiry:\n\n${response_details}\n\nPlease reply to this message or contact us for more details.`;

      const chatId = `${customer_phone.replace(/[^0-9]/g, '')}@c.us`;
      await this.client.sendMessage(chatId, message);

      console.log(`✅ Inquiry response sent to ${customer_phone}`);
      res.json({ success: true, message: 'Inquiry response sent' });

    } catch (error) {
      console.error('❌ Error handling inquiry response:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  validateVendorQuoteData(data) {
    const required = ['customer_name', 'customer_phone', 'quotes'];
    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    if (!Array.isArray(data.quotes) || data.quotes.length === 0) {
      throw new Error('No quotes provided');
    }
  }

  async handleVendorQuote(req, res) {
    try {
      const quoteData = req.body;
      
      // Input validation
      this.validateVendorQuoteData(quoteData);
      
      const { customer_name, customer_phone, destination, service_type, quotes } = quoteData;
      
      // Format message with all quotes
      let message = `💰 All Vendor Quotes Received!\n\nHello ${customer_name}!\n\n`;
      message += `📍 Destination: ${destination}\n`;
      message += `🏷️ Service: ${service_type}\n\n`;
      
      quotes.forEach((quote, index) => {
        message += `**${index + 1}. ${quote.vendor_name}**\n`;
        message += `💵 Price: $${quote.final_price}\n`;
        if (quote.quote_details) {
          message += `📝 Details: ${quote.quote_details}\n`;
        }
        if (quote.validity_date) {
          message += `⏰ Valid until: ${quote.validity_date}\n`;
        }
        message += `\n`;
      });
      
      message += `Please reply with the vendor number (1, 2, etc.) to select a quote, or ask for more details!`;
      
      // Store quote data in conversation manager for later use
      const conversationManager = require('./conversationManager');
      const chatId = `${customer_phone.replace(/[^0-9]/g, '')}@c.us`;
      
      // Store quote data for this customer
      conversationManager.storeQuoteData(chatId, {
        destination,
        service_type,
        quotes,
        quote_request_id: quoteData.quote_request_id
      });
      
      // Send to customer
      await this.client.sendMessage(chatId, message);
      
      console.log(`✅ ${quotes.length} vendor quotes sent to ${customer_phone}`);
      res.json({ success: true, message: `${quotes.length} quotes forwarded to customer` });
      
    } catch (error) {
      console.error('❌ Error handling vendor quote:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  startServer() {
    const PORT = process.env.WEBHOOK_PORT || 3001;

    this.app.listen(PORT, () => {
      console.log(`🚀 Webhook server running on port ${PORT}`);
      console.log(`📡 Webhook endpoints:`);
      console.log(`   POST /webhook/customer-update`);
      console.log(`   POST /webhook/booking-confirmation`);
      console.log(`   POST /api/webhook/booking`);
      console.log(`   POST /webhook/inquiry-response`);
      console.log(`   POST /api/webhook/vendor-quote`);
      console.log(`   GET /health`);
    });
  }
}

module.exports = WebhookHandler;
