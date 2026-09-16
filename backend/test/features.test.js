const test = require('node:test');
const assert = require('node:assert/strict');

const { getTreatmentPricing, buildAppointmentEmail, buildReminderSms } = require('../features');

test('treatment pricing returns a positive value for known treatment', () => {
  assert.ok(getTreatmentPricing('Teeth Cleaning / Scaling') > 0);
});

test('email confirmation message includes patient name and date', () => {
  const email = buildAppointmentEmail({ name: 'John', treatment: 'Root Canal Treatment', date: '2026-10-01', time: '10:30' });
  assert.match(email.subject, /Appointment Confirmation/i);
  assert.match(email.body, /John/i);
  assert.match(email.body, /Root Canal Treatment/i);
});

test('sms reminder includes clinic name and appointment time', () => {
  const sms = buildReminderSms({ name: 'John', date: '2026-10-01', time: '10:30' });
  assert.match(sms, /John/i);
  assert.match(sms, /10:30/i);
  assert.match(sms, /Sakthi Dental Clinic/i);
});
