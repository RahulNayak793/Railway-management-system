const nodemailer = require('nodemailer');

const isMockSmtp = process.env.SMTP_USER === 'mock_user@ethereal.email' || !process.env.SMTP_HOST;

let transporter;

if (!isMockSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const sendEmail = async ({ to, subject, html, text }) => {
  if (isMockSmtp) {
    console.log(`📧 [MOCK EMAIL SENT] To: ${to} | Subject: ${subject}`);
    console.log(`Body:\n${text || html}\n----------------------`);
    return { mock: true, messageId: 'mock-id-' + Date.now() };
  }
  try {
    const info = await transporter.sendMail({
      from: `"RailControl Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (error) {
    console.error('Error sending email via nodemailer:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  isMockSmtp
};
