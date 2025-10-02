const { google } = require('googleapis');
const config = require('./config');

class GoogleSheetsManager {
  constructor() {
    this.sheetId = config.GOOGLE_SHEETS_ID;
    this.auth = new google.auth.GoogleAuth({
      keyFile: config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async appendBooking(bookingData) {
    try {
      const values = [
        [
          new Date().toISOString(),
          bookingData.customerPhone || '',
          bookingData.customerName || '',
          bookingData.package || '',
          bookingData.destination || '',
          bookingData.startDate || '',
          bookingData.endDate || '',
          bookingData.numberOfPeople || '',
          bookingData.totalPrice || '',
          bookingData.status || 'Pending',
          bookingData.notes || ''
        ]
      ];

      const resource = {
        values,
      };

      const result = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        resource,
      });

      console.log('✅ Booking appended to Google Sheets:', result.data.updates.updatedRange);
      return true;
    } catch (error) {
      console.error('Error appending booking to Google Sheets:', error);
      return false;
    }
  }
}

module.exports = new GoogleSheetsManager();
