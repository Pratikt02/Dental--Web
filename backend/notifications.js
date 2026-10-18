const nodemailer = require("nodemailer");

let smtpTransporter;

function getSmtpTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM.");
  }
  if (Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must both be configured, or both be omitted.");
  }
  if (!Number.isInteger(Number(SMTP_PORT)) || Number(SMTP_PORT) < 1 || Number(SMTP_PORT) > 65535) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
  }
  return { transporter: smtpTransporter, from: SMTP_FROM };
}

async function sendEmail({ to, subject, text }) {
  const { transporter, from } = getSmtpTransporter();
  await transporter.sendMail({ from, to, subject, text });
}

module.exports = { sendEmail };
