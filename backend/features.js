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

function buildAppointmentEmail({ name, treatment, date, time, price }) {
  const formattedPrice = formatCurrency(price || getTreatmentPricing(treatment));
  return {
    subject: "Appointment Confirmation - Sakthi Dental Clinic",
    body: `Hello ${name || "Patient"},\n\nYour appointment request has been received at Sakthi Dental Clinic.\n\nTreatment: ${treatment}\nDate: ${date}\nTime: ${time}\nEstimated Cost: ${formattedPrice}\n\nOur clinic team will confirm the booking shortly.\n\nThank you.\nSakthi Dental Clinic`
  };
}

function buildReminderSms({ name, date, time }) {
  return `Hi ${name || "Patient"}, this is a reminder from Sakthi Dental Clinic for your appointment on ${date} at ${time}. Please arrive 10 minutes early.`;
}

module.exports = {
  treatmentPricing,
  getTreatmentPricing,
  formatCurrency,
  buildAppointmentEmail,
  buildReminderSms
};
