const MySQLConnector = require('./mysqlConnector.js');

async function testMySQLConnection() {
  console.log('🧪 Testing MySQL Connection...\n');

  // Test connection
  const connected = await MySQLConnector.testConnection();
  if (!connected) {
    console.log('❌ MySQL connection failed. Please check your database configuration.');
    return;
  }

  console.log('✅ MySQL connection successful!');

  // Test creating a booking
  const testBookingData = {
    name: 'Test User',
    destination: 'Bali, Indonesia',
    travel_date: '2026-06-23',
    end_date: '2026-07-23',
    guests: 3,
    special_requests: 'Test booking',
    user_id: 'test-user-123',
    email: 'test@example.com'
  };

  console.log('📝 Testing booking creation...');
  const bookingResult = await MySQLConnector.createBooking(testBookingData);

  if (bookingResult) {
    console.log('✅ Booking created successfully:', bookingResult);

    // Test fetching the booking
    console.log('🔍 Testing booking retrieval...');
    const fetchedBooking = await MySQLConnector.getBooking(bookingResult.id);
    if (fetchedBooking) {
      console.log('✅ Booking retrieved successfully:', fetchedBooking);
    } else {
      console.log('❌ Failed to retrieve booking');
    }

    // Test fetching bookings by user
    console.log('👤 Testing user bookings retrieval...');
    const userBookings = await MySQLConnector.getBookingsByUser('test-user-123');
    console.log(`✅ Found ${userBookings.length} bookings for user`);
  } else {
    console.log('❌ Failed to create booking');
  }

  console.log('\n🎉 MySQL tests completed!');
}

// Run the test
testMySQLConnection().catch(console.error);
