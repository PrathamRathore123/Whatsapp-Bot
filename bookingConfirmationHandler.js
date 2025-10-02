const { sendMessage } = require('./whatsapp');

class BookingConfirmationHandler {
  constructor() {
    this.isReady = true; // Since using API, assume ready if tokens are set
  }

  async sendBookingConfirmation(bookingData) {
    try {
      const { phone, name, destination, travel_date, guests } = bookingData;

      // Validate required fields
      if (!phone || !name) {
        throw new Error('Missing required booking data: phone and name are required');
      }

      // Format phone number for Meta API (no + sign, just 91 + number)
      let formattedPhone = phone.toString().trim();

      console.log('🔢 Original phone format:', formattedPhone);

      // Remove non-digits
      formattedPhone = formattedPhone.replace(/\D/g, '');

      console.log('🧹 After cleaning (digits only):', formattedPhone);
      console.log('📏 After cleaning length:', formattedPhone.length);

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
      console.log('📏 Final length:', formattedPhone.length);

      const message = `🎉 Booking Confirmed!\n\nHello ${name}!\n\nYour booking for ${destination || 'your selected destination'} on ${travel_date || 'your selected date'} for ${guests || 1} guest(s) has been confirmed.\n\nThank you for choosing Unravel Experience! 🌍✨\n\nPlease contact us if you need any assistance.`;

      console.log(`📤 Sending booking confirmation to ${formattedPhone} (original: ${phone})...`);

      // Try to send the message with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let messageId = null;

      while (retryCount < maxRetries) {
        try {
          const sendResult = await this.sendMessageWithId(formattedPhone, message);
          messageId = sendResult.messageId;
          console.log(`✅ Booking confirmation sent successfully to ${formattedPhone}`);
          console.log(`📨 Message ID: ${messageId}`);
          break; // Success, exit loop
        } catch (sendError) {
          retryCount++;
          console.error(`❌ Attempt ${retryCount} failed:`, sendError.message);

          if (retryCount < maxRetries) {
            console.log(`⏳ Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            throw sendError; // Re-throw after max retries
          }
        }
      }

      // Return message details for status tracking
      return {
        success: true,
        messageId: messageId,
        recipient: formattedPhone,
        status: 'sent'
      };

    } catch (error) {
      console.error('❌ Error sending booking confirmation message:', error.message);

      // Log additional context for debugging
      if (error.message.includes('not registered')) {
        console.error('💡 This might mean the phone number is not registered on WhatsApp');
      } else if (error.message.includes('authentication')) {
        console.error('💡 Meta API authentication issue. Please check your tokens.');
      }

      throw error; // Re-throw to let webhook handler know it failed
    }
  }

  // New method to send message and return message ID
  async sendMessageWithId(to, text) {
    const { sendTextMessage } = require('./whatsapp');
    const response = await sendTextMessage(to, text);
    return {
      messageId: response.messages[0].id,
      status: 'sent'
    };
  }

  // Method to check message delivery status
  async checkMessageStatus(messageId) {
    try {
      const axios = require('axios');
      const config = require('./config');

      const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`📊 Message ${messageId} status:`, response.data.status);
      return {
        messageId: messageId,
        status: response.data.status,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('❌ Error checking message status:', error.message);
      throw error;
    }
  }
}

module.exports = BookingConfirmationHandler;
