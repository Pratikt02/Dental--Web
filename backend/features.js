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

function normalizeAppointmentTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const meridiemMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (meridiemMatch) {
    let [, hourText, minuteText, period] = meridiemMatch;
    let hour = Number(hourText);
    const minute = Number(minuteText);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (period.toLowerCase() === "am") {
      if (hour === 12) hour = 0;
    } else if (period.toLowerCase() === "pm") {
      if (hour !== 12) hour += 12;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHourMatch) return null;

  const hour = Number(twentyFourHourMatch[1]);
  const minute = Number(twentyFourHourMatch[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isClinicTimeAvailable(value) {
  const normalized = normalizeAppointmentTime(value);
  if (!normalized) return false;
  const [hourText, minuteText] = normalized.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const totalMinutes = (hour * 60) + minute;
  const openingMinutes = 9 * 60;
  const closingMinutes = 19 * 60;
  return totalMinutes >= openingMinutes && totalMinutes <= closingMinutes && (minute === 0 || minute === 30);
}

function buildAppointmentTimeOptions() {
  const options = [];
  const startMinutes = 9 * 60;
  const endMinutes = 19 * 60;

  for (let totalMinutes = startMinutes; totalMinutes <= endMinutes; totalMinutes += 30) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const isPm = hour >= 12;
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const meridiem = isPm ? "PM" : "AM";
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const label = `${displayHour}:${String(minute).padStart(2, "0")} ${meridiem}`;
    options.push({ value, label });
  }

  return options;
}

function getAppointmentTimeSlots(startTime, endTime) {
  const start = normalizeAppointmentTime(startTime);
  const end = normalizeAppointmentTime(endTime);
  if (!start || !end || !isClinicTimeAvailable(start) || !isClinicTimeAvailable(end)) return [];

  return buildAppointmentTimeOptions()
    .filter(option => option.value >= start && option.value <= end)
    .map(option => option.value);
}

const CLINIC_NAME = "Dental Pro";

function buildAppointmentEmail({ name, treatment, date, time, price, doctor, status = "pending" }) {
  const formattedPrice = formatCurrency(price || getTreatmentPricing(treatment));
  const subject = status === "pending"
    ? `Appointment Request Received - ${CLINIC_NAME}`
    : `Appointment ${status} - ${CLINIC_NAME}`;

  const statusMessage = status === "pending"
    ? "Your appointment request has been received successfully."
    : `Your appointment status is now: ${status}.`;

  return {
    subject,
    body: `Hello ${name || "Patient"},\n\nThank you for choosing ${CLINIC_NAME}.\n\n${statusMessage}\n\nOur clinic team will confirm your appointment shortly. If you have any questions or need to make changes, please contact the clinic directly.\n\nAppointment Details:\n- Treatment: ${treatment}\n${doctor ? `- Dentist: ${doctor}\n` : ""}- Date: ${date}\n- Time: ${time}\n- Estimated Cost: ${formattedPrice}\n\nPlease arrive 30 minutes before your scheduled appointment.\n\nThank you for trusting ${CLINIC_NAME} with your dental care.\n\nRegards,\n${CLINIC_NAME} Team`
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
  normalizeAppointmentTime,
  isClinicTimeAvailable,
  buildAppointmentTimeOptions,
  getAppointmentTimeSlots,
  buildAppointmentEmail,
  buildReminderSms,
  buildAppointmentStatusMessage
};
