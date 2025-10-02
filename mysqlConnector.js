const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL connection pool
let dbPool = null;

function getDBPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.eff.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'travel',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return dbPool;
}

class MySQLConnector {
  constructor() {
    this.pool = getDBPool();
  }

  // Test database connection
  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ MySQL database connected successfully');
      connection.release();
      return true;
    } catch (error) {
      console.error('❌ MySQL connection failed:', error.message);
      return false;
    }
  }

  // Create a booking directly in MySQL
  async createBooking(bookingData) {
    try {
      const {
        name,
        destination,
        travel_date,
        end_date,
        guests,
        special_requests,
        user_id,
        email = ''
      } = bookingData;

      const query = `
        INSERT INTO travel_booking
        (name, destination, travel_date, end_date, guests, special_requests, user_id, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const values = [
        name,
        destination,
        travel_date,
        end_date,
        parseInt(guests),
        special_requests || '',
        user_id,
        email
      ];

      const [result] = await this.pool.execute(query, values);
      console.log(`✅ Booking created in MySQL with ID: ${result.insertId}`);
      return { id: result.insertId, ...bookingData };
    } catch (error) {
      console.error('❌ Error creating booking in MySQL:', error.message);
      return null;
    }
  }

  // Get booking by ID
  async getBooking(bookingId) {
    try {
      const query = 'SELECT * FROM travel_booking WHERE id = ?';
      const [rows] = await this.pool.execute(query, [bookingId]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching booking:', error.message);
      return null;
    }
  }

  // Get bookings by user ID
  async getBookingsByUser(userId) {
    try {
      const query = 'SELECT * FROM travel_booking WHERE user_id = ? ORDER BY created_at DESC';
      const [rows] = await this.pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      console.error('❌ Error fetching user bookings:', error.message);
      return [];
    }
  }

  // Update booking status
  async updateBookingStatus(bookingId, status) {
    try {
      const query = 'UPDATE travel_booking SET status = ?, updated_at = NOW() WHERE id = ?';
      const [result] = await this.pool.execute(query, [status, bookingId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error updating booking status:', error.message);
      return false;
    }
  }

  // Close the connection pool (call this when shutting down the app)
  async close() {
    if (dbPool) {
      await dbPool.end();
      dbPool = null;
      console.log('🔌 MySQL connection pool closed');
    }
  }
}

module.exports = new MySQLConnector();
