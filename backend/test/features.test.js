const test = require('node:test');
const assert = require('node:assert/strict');

const { getTreatmentPricing, buildAppointmentEmail, buildReminderSms, normalizeAppointmentTime, isClinicTimeAvailable, getAppointmentTimeSlots, buildPasswordResetOtpEmail } = require('../features');

test('treatment pricing returns a positive value for known treatment', () => {
  assert.ok(getTreatmentPricing('Teeth Cleaning / Scaling') > 0);
});

test('email confirmation message includes patient name, date and clinic details', () => {
  const email = buildAppointmentEmail({ name: 'John', treatment: 'Root Canal Treatment', doctor: 'Dr. Rao', date: '2026-10-01', time: '10:30' });
  assert.match(email.subject, /Appointment Request Received/i);
  assert.match(email.body, /John/i);
  assert.match(email.body, /Root Canal Treatment/i);
  assert.match(email.body, /2026-10-01/i);
  assert.match(email.body, /10:30/i);
  assert.match(email.body, /Dr\. Rao/i);
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

test('appointment times normalize to 24-hour clinic slots', () => {
  assert.equal(normalizeAppointmentTime('9:00 AM'), '09:00');
  assert.equal(normalizeAppointmentTime('7:00 PM'), '19:00');
  assert.equal(normalizeAppointmentTime('15:30'), '15:30');
  assert.equal(isClinicTimeAvailable('09:00'), true);
  assert.equal(isClinicTimeAvailable('19:00'), true);
  assert.equal(isClinicTimeAvailable('08:30 AM'), false);
  assert.equal(isClinicTimeAvailable('07:30 PM'), false);
});

test('doctor schedule slots include valid half-hour times within the shift', () => {
  assert.deepEqual(getAppointmentTimeSlots('10:00', '11:00'), ['10:00', '10:30', '11:00']);
  assert.deepEqual(getAppointmentTimeSlots('08:30', '10:00'), []);
  assert.deepEqual(getAppointmentTimeSlots('11:00', '10:00'), []);
});

test('password reset OTP email includes the code and expiry instructions', () => {
  const email = buildPasswordResetOtpEmail({ name: 'John', otp: '004218', expiresInMinutes: 10 });
  assert.match(email.subject, /password reset code/i);
  assert.match(email.text, /004218/);
  assert.match(email.text, /10 minutes/);
  assert.match(email.text, /John/);
});
