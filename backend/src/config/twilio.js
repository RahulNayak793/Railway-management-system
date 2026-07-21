const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const isMockTwilio = !accountSid || accountSid.includes('mock');

let client;
if (!isMockTwilio) {
  client = twilio(accountSid, authToken);
}

const sendSMS = async ({ to, body }) => {
  if (isMockTwilio) {
    console.log(`📱 [MOCK SMS SENT] To: ${to} | Message: ${body}`);
    return { mock: true, sid: 'mock-sms-sid-' + Date.now() };
  }
  try {
    const message = await client.messages.create({
      body,
      from: twilioNumber,
      to
    });
    return message;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    throw error;
  }
};

module.exports = {
  sendSMS,
  isMockTwilio
};
