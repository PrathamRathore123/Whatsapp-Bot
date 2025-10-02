
const express = require('express');
const apiConnector = require('./apiConnector');
const config = require('./config');
const BookingConfirmationHandler = require('./bookingConfirmationHandler');
const { sendMessage } = require('./whatsapp');

class WebhookHandler {
  constructor() {
    this.bookingConfirmationHandler = new BookingConfirmationHandler();
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

    // Endpoint to check message delivery status
    this.app.get('/api/message-status/:messageId', this.checkMessageStatus.bind(this));

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

      // Format phone number for Meta API
      let formattedPhone = customer_phone.toString().trim();
      formattedPhone = formattedPhone.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }

      // Send WhatsApp message
      await sendMessage(formattedPhone, message);

      console.log(`✅ Notification sent to ${customer_phone} (formatted: ${formattedPhone}) for ${update_type}`);

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
      const bookingData = req.body;

      // Extract customer data (support both field formats)
      const customerPhone = bookingData.customer_phone || bookingData.phone;
      const customerName = bookingData.customer_name || bookingData.name;

      // Input validation
      if (!customerPhone || !customerName) {
        throw new Error('Missing required fields: customer_phone/customer_name or phone/name');
      }

      // Compose message with Bali Explorer as the tour name
      const travelDate = bookingData.travel_date || '';
      const guests = bookingData.guests || '';
      const companyName = 'Unravel Experience';

      let message = `🎉 Booking Confirmed!\n\nHello ${customerName}!\n\n`;
      message += `Your booking for Bali Explorer on ${travelDate} for ${guests} guest(s) has been confirmed.\n\n`;
      message += `Thank you for choosing ${companyName}! 🌍✨\n\n`;
      message += `Great! Send 'finalize' to get prices and check availability. 💰`;

      // Format phone number for Meta API (same logic as bookingConfirmationHandler)
      let formattedPhone = customerPhone.toString().trim();
      console.log('🔢 Original phone format:', formattedPhone);

      // Remove non-digits
      formattedPhone = formattedPhone.replace(/\D/g, '');
      console.log('🧹 After cleaning (digits only):', formattedPhone);

      // If 10 digits, prepend 91
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
        console.log('🏁 10-digit number, prepended 91:', formattedPhone);
      } else if (formattedPhone.length === 12 && formattedPhone.startsWith('91')) {
        console.log('🏁 Already 12 digits with 91:', formattedPhone);
      } else {
        console.log('🏁 Other format, using as is:', formattedPhone);
      }

      console.log('✅ Final formatted phone:', formattedPhone);
      console.log('📨 Sending booking confirmation message...');

      await sendMessage(formattedPhone, message);

      console.log(`✅ Booking confirmation sent to ${customerPhone} (formatted: ${formattedPhone})`);
      res.json({
        success: true,
        message: 'Booking confirmation sent',
        customer: customerName,
        phone: customerPhone
      });

    } catch (error) {
      console.error('❌ Error handling booking confirmation:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async handleBookingWebhook(req, res) {
    try {
      const bookingData = req.body;
      console.log('📥 Booking webhook received:', JSON.stringify(bookingData, null, 2));
      console.log('📱 WhatsApp client ready status:', this.bookingConfirmationHandler.isReady);

      // Validate incoming booking data
      if (!bookingData || typeof bookingData !== 'object') {
        throw new Error('Invalid booking data: expected an object');
      }

      // Map booking data to expected format (from backend fields)
      const mappedData = {
        phone: bookingData.customer_phone || bookingData.phone,
        name: bookingData.customer_name || bookingData.name,
        destination: bookingData.destination,
        travel_date: bookingData.travel_date,
        guests: bookingData.guests,
        special_requests: bookingData.special_requests || ''
      };

      console.log('📤 Mapped booking data:', JSON.stringify(mappedData, null, 2));

      // Validate mapped data
      if (!mappedData.phone || !mappedData.name) {
        throw new Error(`Missing required fields: phone=${mappedData.phone}, name=${mappedData.name}`);
      }

      // Validate phone format (basic check)
      const phoneStr = String(mappedData.phone).replace(/\D/g, '');
      if (phoneStr.length < 10 || phoneStr.length > 15) {
        throw new Error(`Invalid phone number format: ${mappedData.phone}`);
      }

      console.log('✅ Validation passed, sending booking confirmation...');

      // Send confirmation message via WhatsApp
      let messageResult;
      try {
        messageResult = await this.bookingConfirmationHandler.sendBookingConfirmation(mappedData);
        console.log('✅ Booking confirmation sent successfully');
        console.log('📊 Message tracking info:', messageResult);
      } catch (sendError) {
        console.error('❌ Failed to send booking confirmation:', sendError.message);
        console.error('❌ Send error stack:', sendError.stack);
        throw new Error(`WhatsApp send failed: ${sendError.message}`);
      }

      res.json({
        success: true,
        message: 'Booking confirmation sent via WhatsApp',
        messageId: messageResult.messageId,
        recipient: messageResult.recipient,
        status: messageResult.status
      });

    } catch (error) {
      console.error('❌ Error handling booking webhook:', error.message);
      console.error('❌ Full error details:', error.stack);
      console.error('❌ Request body:', JSON.stringify(req.body, null, 2));

      // Return appropriate error response
      if (error.message.includes('not ready')) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp service temporarily unavailable',
          details: 'Please ensure the WhatsApp client is authenticated and ready'
        });
      } else if (error.message.includes('Missing required fields') || error.message.includes('Invalid')) {
        res.status(400).json({ success: false, error: error.message });
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

      // Format phone number for Meta API
      let formattedPhone = customer_phone.toString().trim();
      formattedPhone = formattedPhone.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }

      await sendMessage(formattedPhone, message);

      console.log(`✅ Inquiry response sent to ${customer_phone} (formatted: ${formattedPhone})`);
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
      const phoneNumber = customer_phone.replace(/[^0-9]/g, '');

      // Store quote data for this customer
      conversationManager.storeQuoteData(`${phoneNumber}@c.us`, {
        destination,
        service_type,
        quotes,
        quote_request_id: quoteData.quote_request_id
      });

      // Send to customer
      await sendMessage(phoneNumber, message);
      
      console.log(`✅ ${quotes.length} vendor quotes sent to ${customer_phone}`);
      res.json({ success: true, message: `${quotes.length} quotes forwarded to customer` });
      
    } catch (error) {
      console.error('❌ Error handling vendor quote:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // Check message delivery status
  async checkMessageStatus(req, res) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({ success: false, error: 'Message ID is required' });
      }

      console.log(`📊 Checking status for message ID: ${messageId}`);

      const statusResult = await this.bookingConfirmationHandler.checkMessageStatus(messageId);

      res.json({
        success: true,
        messageId: statusResult.messageId,
        status: statusResult.status,
        timestamp: statusResult.timestamp
      });

    } catch (error) {
      console.error('❌ Error checking message status:', error.message);
      res.status(500).json({ success: false, error: error.message });
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
      console.log(`   GET /api/message-status/:messageId`);
      console.log(`   GET /health`);
    });
  }
}

module.exports = WebhookHandler;
