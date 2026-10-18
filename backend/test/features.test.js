const test = require('node:test');
const assert = require('node:assert/strict');

const { getTreatmentPricing, buildAppointmentEmail, buildReminderSms } = require('../features');

test('treatment pricing returns a positive value for known treatment', () => {
  assert.ok(getTreatmentPricing('Teeth Cleaning / Scaling') > 0);
});

test('email confirmation message includes patient name, date and clinic details', () => {
  const email = buildAppointmentEmail({ name: 'John', treatment: 'Root Canal Treatment', date: '2026-10-01', time: '10:30' });
  assert.match(email.subject, /Appointment Request Received/i);
  assert.match(email.body, /John/i);
  assert.match(email.body, /Root Canal Treatment/i);
  assert.match(email.body, /2026-10-01/i);
  assert.match(email.body, /10:30/i);
  assert.match(email.body, /30 minutes/i);
  assert.match(email.body, /Dental Pro/i);
});

test('sms reminder includes clinic name and appointment time', () => {
  const sms = buildReminderSms({ name: 'John', date: '2026-10-01', time: '10:30' });
  assert.match(sms, /John/i);
  assert.match(sms, /10:30/i);
  assert.match(sms, /Dental Pro/i);
  assert.match(sms, /30 minutes/i);
});
