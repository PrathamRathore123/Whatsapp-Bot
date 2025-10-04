const axios = require('axios');
const config = require('./config');

class APIConnector {
  constructor() {
    this.baseURL = config.BACKEND_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Get customer data from backend (customers who filled forms on frontend)
  async getCustomerData(phoneNumber) {
    try {
      const response = await this.client.get(`/api/customers/?phone=${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error('Backend not available - customer lookup skipped');
      return null;
    }
  }

  // Send vendor email for price inquiry
  async sendVendorEmail(inquiryData) {
    try {
      const response = await this.client.post('/api/send-vendor-email/', inquiryData);
      return response.data;
    } catch (error) {
      console.error('Error sending vendor email:', error);
      return null;
    }
  }

  // Send booking confirmation email to vendors with retry mechanism
  async sendBookingEmail(bookingData, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📧 Attempting to send booking email (attempt ${attempt}/${maxRetries})...`);

        // Use longer timeout for booking emails (15 seconds)
        const response = await axios.post(`${this.baseURL}/api/send-booking-email/`, bookingData, {
          timeout: 15000, // 15 seconds
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`✅ Booking email sent successfully on attempt ${attempt}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Booking email attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          console.error('❌ All booking email attempts failed');
          return null;
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Send day-wise booking email to vendors based on their working days
  async sendDaywiseBookingEmail(bookingData, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📧 Attempting to send day-wise booking email (attempt ${attempt}/${maxRetries})...`);

        // Use longer timeout for day-wise booking emails (30 seconds)
        const response = await axios.post(`${this.baseURL}/api/send-daywise-booking-emails/`, bookingData, {
          timeout: 30000, // 30 seconds for day-wise processing
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`✅ Day-wise booking email sent successfully on attempt ${attempt}`);
        return response.data;
      } catch (error) {
        console.error(`❌ Day-wise booking email attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          console.error('❌ All day-wise booking email attempts failed');
          return null;
        }

        // Wait before retry (exponential backoff with longer max)
        const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async createBooking(bookingData) {
    try {
      const response = await this.client.post('/api/bookings/', bookingData);
      return response.data;
    } catch (error) {
      console.error('Error creating booking:', error);
      return null;
    }
  }
}

module.exports = new APIConnector();
