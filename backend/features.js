const treatmentPricing = {
  "General consultation": 350,
  "Teeth Cleaning / Scaling": 1200,
  "Tooth Filling": 1800,
  "Tooth Extraction": 1500,
  "Orthodontic Treatment": 4500,
  "Root Canal Treatment": 3200,
  "Dental Implants": 28000,
  "Smile Design": 12000,
  "Other": 0
};

function getTreatmentPricing(treatmentName) {
  const name = String(treatmentName || "").trim();
  return treatmentPricing[name] ?? 0;
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

const CLINIC_NAME = "Dental Pro";

function buildAppointmentEmail({ name, treatment, date, time, price, status = "pending" }) {
  const formattedPrice = formatCurrency(price || getTreatmentPricing(treatment));
  const subject = status === "pending"
    ? `Appointment Request Received - ${CLINIC_NAME}`
    : `Appointment ${status} - ${CLINIC_NAME}`;

  const statusMessage = status === "pending"
    ? "Your appointment request has been received successfully."
    : `Your appointment status is now: ${status}.`;

  return {
    subject,
    body: `Hello ${name || "Patient"},\n\nThank you for choosing ${CLINIC_NAME}.\n\n${statusMessage}\n\nOur clinic team will confirm your appointment shortly. If you have any questions or need to make changes, please contact the clinic directly.\n\nAppointment Details:\n- Treatment: ${treatment}\n- Date: ${date}\n- Time: ${time}\n- Estimated Cost: ${formattedPrice}\n\nPlease arrive 30 minutes before your scheduled appointment.\n\nThank you for trusting ${CLINIC_NAME} with your dental care.\n\nRegards,\n${CLINIC_NAME} Team`
  };
}

function buildReminderSms({ name, date, time }) {
  return `Hi ${name || "Patient"}, this is a reminder from ${CLINIC_NAME} for your appointment on ${date} at ${time}. Please arrive 30 minutes early.`;
}

function buildAppointmentStatusMessage({ name, date, time, status }) {
  return `Hi ${name || "Patient"}, your ${CLINIC_NAME} appointment on ${date} at ${time} is now ${status}. Please contact the clinic if you have questions.`;
}

module.exports = {
  treatmentPricing,
  getTreatmentPricing,
  formatCurrency,
  buildAppointmentEmail,
  buildReminderSms,
  buildAppointmentStatusMessage
};
