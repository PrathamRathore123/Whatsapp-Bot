class BookingConfirmationHandler {
  constructor(client) {
    this.client = client;
    this.isReady = false;

    // Listen for client ready event
    this.client.on('ready', () => {
      console.log('📱 WhatsApp client is ready for sending messages');
      this.isReady = true;
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.isReady = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    // Listen for message acknowledgements to confirm delivery
    this.client.on('message_ack', (msg, ack) => {
      if (ack === 3) { // Message delivered to recipient
        console.log(`✅ Message delivered to ${msg.to}`);
      }
    });
  }

  async sendBookingConfirmation(bookingData) {
    try {
      // Check if client is ready
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready. Please ensure QR code is scanned and client is authenticated.');
      }

      const { phone, name, destination, travel_date, guests } = bookingData;

      // Validate required fields
      if (!phone || !name) {
        throw new Error('Missing required booking data: phone and name are required');
      }

      // Format phone number for WhatsApp Web.js (no + sign, just 91 + number)
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

      const chatId = `${formattedPhone}@c.us`;
      const message = `🎉 Booking Confirmed!\n\nHello ${name}!\n\nYour booking for ${destination || 'your selected destination'} on ${travel_date || 'your selected date'} for ${guests || 1} guest(s) has been confirmed.\n\nThank you for choosing WanderWorld Travels! 🌍✨\n\nPlease contact us if you need any assistance.`;

      console.log(`📤 Sending booking confirmation to ${formattedPhone} (original: ${phone})...`);

      // Add a small delay to ensure WhatsApp Web is fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if the chat exists before sending
      try {
        const chat = await this.client.getChatById(chatId);
        if (!chat) {
          throw new Error(`Chat not found for ${formattedPhone}. The number may not be registered on WhatsApp.`);
        }
        console.log(`✅ Chat found for ${formattedPhone}`);
      } catch (chatError) {
        console.error('❌ Error checking chat:', chatError.message);
        throw new Error(`Cannot send message: ${chatError.message}`);
      }

      // Try to send the message with retry logic
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          await this.client.sendMessage(chatId, message);
          console.log(`✅ Booking confirmation sent successfully to ${formattedPhone}`);
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

    } catch (error) {
      console.error('❌ Error sending booking confirmation message:', error.message);

      // Log additional context for debugging
      if (error.message.includes('chat not found')) {
        console.error('💡 This might mean the phone number is not registered on WhatsApp or not in contacts');
      } else if (error.message.includes('not authenticated')) {
        console.error('💡 WhatsApp client needs to be authenticated. Please scan the QR code.');
      }

      throw error; // Re-throw to let webhook handler know it failed
    }
  }
}

module.exports = BookingConfirmationHandler;
