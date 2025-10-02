require('dotenv').config({ path: './BOT_new/.env' });

console.log('Environment Variables Check:');
console.log('WHATSAPP_TOKEN:', process.env.WHATSAPP_TOKEN ? 'SET' : 'NOT SET');
console.log('PHONE_NUMBER_ID:', process.env.PHONE_NUMBER_ID ? 'SET' : 'NOT SET');
console.log('WEBHOOK_AUTH_TOKEN:', process.env.WEBHOOK_AUTH_TOKEN ? 'SET' : 'NOT SET');
console.log('EXECUTIVE_PHONE:', process.env.EXECUTIVE_PHONE ? 'SET' : 'NOT SET');
console.log('WEBHOOK_PORT:', process.env.WEBHOOK_PORT ? 'SET' : 'NOT SET');

console.log('\nActual values:');
console.log('WHATSAPP_TOKEN:', process.env.WHATSAPP_TOKEN);
console.log('PHONE_NUMBER_ID:', process.env.PHONE_NUMBER_ID);
console.log('WEBHOOK_AUTH_TOKEN:', process.env.WEBHOOK_AUTH_TOKEN);
console.log('EXECUTIVE_PHONE:', process.env.EXECUTIVE_PHONE);
console.log('WEBHOOK_PORT:', process.env.WEBHOOK_PORT);
