require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { getDatabase, closeDatabase } = require("./db");
const {
  getTreatmentPricing,
  normalizeAppointmentTime,
  isClinicTimeAvailable,
  buildAppointmentTimeOptions,
  getAppointmentTimeSlots,
  buildAppointmentEmail,
  buildReminderSms,
  buildAppointmentStatusMessage,
  buildPasswordResetOtpEmail
} = require("./features");
const { sendEmail } = require("./notifications");

const PORT = Number(process.env.PORT) || 3000;
const SITE_ROOT = path.join(__dirname, "..", "docs");
const MAX_BODY_SIZE = 10 * 1024;
const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_OTP_RESEND_DELAY_MS = 60 * 1000;
const sessions = new Map();
const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) reject(new Error("Request body is too large."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateAppointment(input) {
  const rawTime = clean(input.appointmentTime, 20);
  const normalizedTime = normalizeAppointmentTime(rawTime);
  const appointment = {
    name: clean(input.name, 100), email: clean(input.email, 160).toLowerCase(), phone: clean(input.phone, 30),
    appointmentDate: clean(input.appointmentDate, 10), appointmentTime: normalizedTime || rawTime,
    treatment: clean(input.treatment, 100), doctor: clean(input.doctor, 100), message: clean(input.message, 1000),
    notificationPreferences: { email: true, sms: false, whatsapp: false },
    price: Number(input.price) || getTreatmentPricing(input.treatment)
  };
  const errors = [];
  if (!appointment.name) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email)) errors.push("A valid email is required.");
  if (!appointment.phone) errors.push("Phone number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appointmentDate)) errors.push("A valid appointment date is required.");
  if (!normalizedTime || !isClinicTimeAvailable(normalizedTime)) {
    errors.push("Appointments are available from 9:00 AM to 7:00 PM only.");
  } else {
    appointment.appointmentTime = normalizedTime;
  }
  if (!appointment.treatment) errors.push("Please select a treatment.");
  if (!appointment.price || appointment.price < 0) appointment.price = getTreatmentPricing(appointment.treatment);
  return { appointment, errors };
}

async function notifyAppointment(database, appointmentId, appointment, event, onlyChannels) {
  const status = appointment.status || "pending";
  const email = buildAppointmentEmail({
    name: appointment.name,
    treatment: appointment.treatment,
    date: appointment.appointmentDate,
    time: appointment.appointmentTime,
    doctor: appointment.doctor,
    price: appointment.price,
    status
  });
  if (event.startsWith("reminder")) email.subject = "Appointment Reminder - Dental Pro";
  const text = event === "request"
    ? `Hi ${appointment.name || "Patient"}, your appointment request for ${appointment.treatment} on ${appointment.appointmentDate} at ${appointment.appointmentTime} has been received. Our clinic will confirm it shortly.`
    : event === "status"
      ? buildAppointmentStatusMessage({
        name: appointment.name,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime,
        status
      })
      : buildReminderSms({
        name: appointment.name,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime
      });
  const preferences = appointment.notificationPreferences || { email: true, sms: false, whatsapp: false };
  const channels = [
    { name: "email", enabled: preferences.email !== false, send: () => sendEmail({ to: appointment.email, subject: email.subject, text: event.startsWith("reminder") ? text : email.body }) }
  ];

  await Promise.all(channels.filter(channel =>
    channel.enabled && (!onlyChannels || onlyChannels.includes(channel.name))
  ).map(async channel => {
    const previous = appointment.notificationDelivery?.[event]?.[channel.name];
    const attemptCount = (previous?.attemptCount || 0) + 1;
    const attemptedAt = new Date();
    let delivery;
    try {
      await channel.send();
      delivery = { status: "sent", sentAt: new Date(), attemptCount };
    } catch (error) {
      console.error(`Appointment ${event} ${channel.name} notification failed:`, error);
      delivery = {
        status: "failed",
        attemptedAt,
        attemptCount,
        ...(attemptCount < 5 ? { retryAt: new Date(attemptedAt.getTime() + 5 * 60 * 1000) } : {}),
        error: String(error.message || error).slice(0, 500)
      };
    }
    try {
      const update = { [`notificationDelivery.${event}.${channel.name}`]: delivery };
      if (event === "request" && channel.name === "email") update.emailSent = delivery.status === "sent";
      await database.collection("appointments").updateOne({ _id: appointmentId }, { $set: update });
    } catch (error) {
      console.error(`Unable to record ${event} ${channel.name} notification delivery:`, error);
    }
  }));
}

async function retryFailedNotifications(database, now) {
  const retryable = ["request", "status"].flatMap(event =>
    ["email"].map(channel => ({
      [`notificationDelivery.${event}.${channel}.status`]: "failed",
      [`notificationDelivery.${event}.${channel}.attemptCount`]: { $lt: 5 },
      [`notificationDelivery.${event}.${channel}.retryAt`]: { $lte: now }
    }))
  );
  const appointments = await database.collection("appointments").find({ $or: retryable }).limit(100).toArray();
  for (const appointment of appointments) {
    for (const event of ["request", "status"]) {
      const dueChannels = ["email"].filter(channel => {
        const delivery = appointment.notificationDelivery?.[event]?.[channel];
        return delivery?.status === "failed" && delivery.attemptCount < 5 &&
          delivery.retryAt && new Date(delivery.retryAt) <= now;
      });
      if (dueChannels.length) await notifyAppointment(database, appointment._id, appointment, event, dueChannels);
    }
  }
}

function clinicDateString(date) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function appointmentTimestamp(appointment) {
  const [year, month, day] = appointment.appointmentDate.split("-").map(Number);
  const [hour, minute] = appointment.appointmentTime.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 60 * 60 * 1000);
}

function appointmentWeekday(date) {
  const [year, month, day] = date.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

let reminderCheckRunning = false;
async function checkAppointmentReminders() {
  if (reminderCheckRunning) return;
  reminderCheckRunning = true;
  try {
    const database = await getDatabase();
    const now = new Date();
    const today = clinicDateString(now);
    const tomorrow = clinicDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const upcoming = await database.collection("appointments").find({
      status: "confirmed",
      appointmentDate: { $gte: today, $lte: tomorrow }
    }).toArray();

    for (const appointment of upcoming) {
      const timeUntilAppointment = appointmentTimestamp(appointment).getTime() - now.getTime();
      if (timeUntilAppointment <= 0) continue;
      for (const [event, leadTime] of [["reminder24h", 24], ["reminder2h", 2]]) {
        if (timeUntilAppointment > leadTime * 60 * 60 * 1000) continue;
        const preferences = appointment.notificationPreferences || { email: true, sms: false, whatsapp: false };
        const delivery = appointment.notificationDelivery?.[event] || {};
        const enabled = [["email", preferences.email !== false]].filter(([, isEnabled]) => isEnabled);
        const needsDelivery = enabled.some(([channel]) => {
          const previous = delivery[channel];
          return previous?.status !== "sent" && (previous?.attemptCount || 0) < 5 &&
            (!previous?.attemptedAt || now.getTime() - new Date(previous.attemptedAt).getTime() >= 5 * 60 * 1000);
        });
        if (needsDelivery) await notifyAppointment(database, appointment._id, appointment, event);
      }
    }
    await retryFailedNotifications(database, now);
  } catch (error) {
    console.error("Appointment reminder check failed:", error);
  } finally {
    reminderCheckRunning = false;
  }
}

function getSession(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}

function requireRole(request, response, role) {
  if (getSession(request)?.role === role) return true;
  sendJson(response, 401, { success: false, errors: [`${role === "admin" ? "Admin" : "Patient"} login is required.`] });
  return false;
}

function requirePatient(request, response) {
  if (getSession(request)?.role === "patient") return true;
  sendJson(response, 401, { success: false, errors: ["Patient login is required."] });
  return false;
}

function serveStatic(response, pathname) {
  let requestedPath;
  try { requestedPath = decodeURIComponent(pathname); } catch { response.writeHead(400); response.end("Invalid path"); return; }
  requestedPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.resolve(SITE_ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(SITE_ROOT + path.sep)) { response.writeHead(403); response.end("Forbidden"); return; }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function handleApi(request, response, url) {
  const database = await getDatabase();
  const appointments = database.collection("appointments");

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const admin = await database.collection("admins").findOne({ username: clean(input.username, 80) });
    if (!admin || !(await bcrypt.compare(String(input.password || ""), admin.passwordHash))) {
      sendJson(response, 401, { success: false, errors: ["Invalid username or password."] });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { username: admin.username, role: "admin", expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    sendJson(response, 200, { success: true, token, username: admin.username, role: "admin" });
    return;
  }

  if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const email = clean(input.email, 160).toLowerCase();
    const genericMessage = "If that account exists, a password reset code has been sent.";
    const users = database.collection("users");
    const user = await users.findOne({ email });
    if (!user || (user.resetOtpLastSentAt &&
        Date.now() - new Date(user.resetOtpLastSentAt).getTime() < PASSWORD_RESET_OTP_RESEND_DELAY_MS)) {
      sendJson(response, 200, { success: true, message: genericMessage });
      return;
    }
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS);
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetOtpHash: otpHash,
          resetOtpExpiresAt: expiresAt,
          resetOtpAttempts: 0,
          resetOtpLastSentAt: new Date(),
          updatedAt: new Date()
        },
        $unset: { resetToken: "", resetTokenExpiresAt: "" }
      }
    );
    try {
      const emailContent = buildPasswordResetOtpEmail({
        name: user.name,
        otp,
        expiresInMinutes: PASSWORD_RESET_OTP_TTL_MS / 60_000
      });
      await sendEmail({ to: user.email, ...emailContent });
    } catch (error) {
      await users.updateOne(
        { _id: user._id, resetOtpHash: otpHash },
        { $unset: { resetOtpHash: "", resetOtpExpiresAt: "", resetOtpAttempts: "", resetOtpLastSentAt: "" } }
      );
      console.error("Password reset OTP email failed:", error);
      sendJson(response, 503, { success: false, errors: ["Unable to send the verification code right now. Please try again later."] });
      return;
    }
    sendJson(response, 200, { success: true, message: genericMessage });
    return;
  }

  if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const email = clean(input.email, 160).toLowerCase();
    const otp = typeof input.otp === "string" ? input.otp.trim() : "";
    const newPassword = String(input.newPassword || "");
    if (!/^\d{6}$/.test(otp)) {
      sendJson(response, 400, { success: false, errors: ["Enter the six-digit verification code from your email."] });
      return;
    }
    if (newPassword.length < 8) {
      sendJson(response, 400, { success: false, errors: ["New password must be at least 8 characters long."] });
      return;
    }
    const users = database.collection("users");
    const user = await users.findOne({ email });
    if (!user?.resetOtpHash || !user.resetOtpExpiresAt ||
        new Date(user.resetOtpExpiresAt) <= new Date()) {
      sendJson(response, 400, { success: false, errors: ["The verification code is invalid or expired. Request a new code and try again."] });
      return;
    }
    if ((user.resetOtpAttempts || 0) >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      sendJson(response, 429, { success: false, errors: ["Too many incorrect codes. Request a new code to continue."] });
      return;
    }
    if (!(await bcrypt.compare(otp, user.resetOtpHash))) {
      const attempt = await users.updateOne(
        {
          _id: user._id,
          resetOtpHash: user.resetOtpHash,
          resetOtpExpiresAt: { $gt: new Date() },
          resetOtpAttempts: { $lt: PASSWORD_RESET_OTP_MAX_ATTEMPTS }
        },
        { $inc: { resetOtpAttempts: 1 } }
      );
      if (!attempt.matchedCount || (user.resetOtpAttempts || 0) + 1 >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
        sendJson(response, 429, { success: false, errors: ["Too many incorrect codes. Request a new code to continue."] });
        return;
      }
      sendJson(response, 400, { success: false, errors: ["The verification code is incorrect. Please check the code and try again."] });
      return;
    }
    const result = await users.updateOne(
      {
        _id: user._id,
        resetOtpHash: user.resetOtpHash,
        resetOtpExpiresAt: { $gt: new Date() },
        resetOtpAttempts: { $lt: PASSWORD_RESET_OTP_MAX_ATTEMPTS }
      },
      {
        $set: { passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() },
        $unset: {
          resetOtpHash: "",
          resetOtpExpiresAt: "",
          resetOtpAttempts: "",
          resetOtpLastSentAt: "",
          resetToken: "",
          resetTokenExpiresAt: ""
        }
      }
    );
    if (!result.matchedCount) {
      sendJson(response, 400, { success: false, errors: ["The verification code is invalid or expired. Request a new code and try again."] });
      return;
    }
    sendJson(response, 200, { success: true, message: "Password updated successfully." });
    return;
  }

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const name = clean(input.name, 100);
    const email = clean(input.email, 160).toLowerCase();
    const phone = clean(input.phone, 30);
    const password = String(input.password || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || password.length < 8) {
      sendJson(response, 400, { success: false, errors: ["Name, valid email, phone, and a password of at least 8 characters are required."] });
      return;
    }
    const users = database.collection("users");
    if (await users.findOne({ email })) {
      sendJson(response, 409, { success: false, errors: ["An account with this email already exists."] });
      return;
    }
    await users.insertOne({ name, email, phone, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() });
    sendJson(response, 201, { success: true, message: "Account created. You can now sign in." });
    return;
  }

  if (url.pathname === "/api/auth/patient-login" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const email = clean(input.email, 160).toLowerCase();
    const user = await database.collection("users").findOne({ email });
    if (!user || !(await bcrypt.compare(String(input.password || ""), user.passwordHash))) {
      sendJson(response, 401, { success: false, errors: ["Invalid email or password."] });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user._id.toString(), role: "patient", name: user.name, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    sendJson(response, 200, { success: true, token, name: user.name, role: "patient" });
    return;
  }

  if (url.pathname === "/api/appointments" && request.method === "POST") {
    const { appointment, errors } = validateAppointment(JSON.parse(await readRequestBody(request) || "{}"));
    if (errors.length) { sendJson(response, 400, { success: false, errors }); return; }
    const doctorSchedules = await database.collection("doctorSchedules").find().toArray();
    if (doctorSchedules.length) {
      const schedulesForDate = doctorSchedules.filter(schedule =>
        schedule.day === appointmentWeekday(appointment.appointmentDate) &&
        (!appointment.doctor || schedule.doctor === appointment.doctor)
      );
      const scheduledDoctors = [...new Set(schedulesForDate
        .filter(schedule => getAppointmentTimeSlots(schedule.startTime, schedule.endTime).includes(appointment.appointmentTime))
        .map(schedule => schedule.doctor))];
      if (!scheduledDoctors.length) {
        sendJson(response, 400, { success: false, errors: ["The selected doctor is not available at that time. Please choose another slot."] });
        return;
      }

      const occupied = await appointments.find({
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        doctor: { $in: scheduledDoctors },
        status: { $nin: ["cancelled"] }
      }).project({ doctor: 1, _id: 0 }).toArray();
      const occupiedDoctors = new Set(occupied.map(item => item.doctor));
      const availableDoctor = scheduledDoctors.find(doctor => !occupiedDoctors.has(doctor));
      if (!availableDoctor) {
        sendJson(response, 409, { success: false, errors: ["That doctor's time slot is already requested. Please choose another time."] });
        return;
      }
      appointment.doctor = availableDoctor;
    } else {
      const duplicate = await appointments.findOne({
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: { $nin: ["cancelled"] }
      });
      if (duplicate) {
        sendJson(response, 409, { success: false, errors: ["That time slot is already requested. Please choose another time."] });
        return;
      }
    }
    const session = getSession(request);
    const saved = {
      ...appointment,
      status: "pending",
      createdAt: new Date(),
      emailSent: false,
      notificationDelivery: {}
    };
    if (session?.role === "patient") {
      saved.userId = new ObjectId(session.userId);
      saved.name = session.name;
    }
    const result = await appointments.insertOne(saved);
    await notifyAppointment(database, result.insertedId, saved, "request");
    sendJson(response, 201, { success: true, message: "Your appointment request has been received.", appointmentId: result.insertedId, price: appointment.price });
    return;
  }

  if (url.pathname === "/api/treatments/pricing" && request.method === "GET") {
    sendJson(response, 200, { success: true, pricing: Object.fromEntries(Object.entries(require("./features").treatmentPricing).map(([key, value]) => [key, value])) });
    return;
  }

  if (url.pathname === "/api/availability" && request.method === "GET") {
    const date = clean(url.searchParams.get("date"), 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(response, 400, { success: false, errors: ["A valid date is required."] });
      return;
    }
    const doctor = clean(url.searchParams.get("doctor"), 100);
    const allSchedules = await database.collection("doctorSchedules").find().toArray();
    const schedulesForDate = allSchedules.filter(schedule =>
      schedule.day === appointmentWeekday(date) && (!doctor || schedule.doctor === doctor)
    );
    if (!allSchedules.length) {
      const booked = await appointments.find({ appointmentDate: date, status: { $nin: ["cancelled"] } })
        .project({ appointmentTime: 1, _id: 0 }).toArray();
      const bookedTimes = [...new Set(booked.map(item => item.appointmentTime))];
      sendJson(response, 200, {
        success: true,
        bookedTimes,
        availableTimes: buildAppointmentTimeOptions().map(option => option.value).filter(time => !bookedTimes.includes(time))
      });
      return;
    }

    const bookedAppointments = await appointments.find({
      appointmentDate: date,
      status: { $nin: ["cancelled"] },
      ...(doctor ? { doctor } : {})
    }).project({ appointmentTime: 1, doctor: 1, _id: 0 }).toArray();
    const availableTimes = [...new Set(schedulesForDate.flatMap(schedule =>
      getAppointmentTimeSlots(schedule.startTime, schedule.endTime)
    ))].filter(time => {
      const availableDoctors = schedulesForDate
        .filter(schedule => getAppointmentTimeSlots(schedule.startTime, schedule.endTime).includes(time))
        .map(schedule => schedule.doctor);
      return !bookedAppointments.some(item =>
        item.appointmentTime === time && (!doctor || item.doctor === doctor) &&
        (!availableDoctors.length || availableDoctors.includes(item.doctor))
      );
    }).sort();
    sendJson(response, 200, { success: true, bookedTimes: [], availableTimes });
    return;
  }

  if (url.pathname === "/api/doctors" && request.method === "GET") {
    const schedules = await database.collection("doctorSchedules").find().project({ doctor: 1, _id: 0 }).toArray();
    sendJson(response, 200, { success: true, doctors: [...new Set(schedules.map(item => item.doctor).filter(Boolean))].sort() });
    return;
  }

  if (url.pathname === "/api/appointments" && request.method === "GET") {
    if (!requireRole(request, response, "admin")) return;
    const data = await appointments.find().sort({ appointmentDate: 1, appointmentTime: 1 }).toArray();
    sendJson(response, 200, { success: true, appointments: data });
    return;
  }

  if (url.pathname === "/api/appointments/export" && request.method === "GET") {
    if (!requireRole(request, response, "admin")) return;
    const data = await appointments.find().sort({ appointmentDate: 1, appointmentTime: 1 }).toArray();
    const csvRows = [
      ["Name", "Email", "Phone", "Date", "Time", "Treatment", "Doctor", "Status", "Price", "Notes"],
      ...data.map(item => [
        item.name || "",
        item.email || "",
        item.phone || "",
        item.appointmentDate || "",
        item.appointmentTime || "",
        item.treatment || "",
        item.doctor || "",
        item.status || "",
        String(item.price || 0),
        item.adminNotes || ""
      ])
    ];
    const csv = csvRows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    response.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=sakthi-appointments.csv" });
    response.end(csv);
    return;
  }

  const appointmentMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)$/);
  if (appointmentMatch && request.method === "DELETE") {
    if (!requireRole(request, response, "admin")) return;
    if (!ObjectId.isValid(appointmentMatch[1])) {
      sendJson(response, 400, { success: false, errors: ["Invalid appointment ID."] });
      return;
    }
    const result = await appointments.deleteOne({ _id: new ObjectId(appointmentMatch[1]) });
    sendJson(response, result.deletedCount ? 200 : 404, {
      success: Boolean(result.deletedCount),
      message: result.deletedCount ? "Appointment deleted." : "Appointment not found."
    });
    return;
  }

  if (appointmentMatch && request.method === "PATCH") {
    if (!requireRole(request, response, "admin")) return;
    const payload = JSON.parse(await readRequestBody(request) || "{}");
    const update = {};
    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (typeof payload.status === "string") {
      update.status = clean(payload.status, 20);
      if (!validStatuses.includes(update.status)) {
        sendJson(response, 400, { success: false, errors: ["Status must be pending, confirmed, completed, or cancelled."] });
        return;
      }
    }
    if (typeof payload.doctor === "string") update.doctor = clean(payload.doctor, 100);
    if (typeof payload.adminNotes === "string") update.adminNotes = clean(payload.adminNotes, 2000);
    if (typeof payload.price === "number") update.price = payload.price;
    if (Object.keys(update).length === 0) { sendJson(response, 400, { success: false, errors: ["No valid appointment update provided."] }); return; }
    if (!ObjectId.isValid(appointmentMatch[1])) { sendJson(response, 400, { success: false, errors: ["Invalid appointment ID."] }); return; }
    const appointmentId = new ObjectId(appointmentMatch[1]);
    const existing = await appointments.findOne({ _id: appointmentId });
    if (update.doctor && existing) {
      const doctorSchedules = await database.collection("doctorSchedules").find({
        doctor: update.doctor,
        day: appointmentWeekday(existing.appointmentDate)
      }).toArray();
      if (doctorSchedules.length && !doctorSchedules.some(schedule =>
        getAppointmentTimeSlots(schedule.startTime, schedule.endTime).includes(existing.appointmentTime)
      )) {
        sendJson(response, 400, { success: false, errors: ["The selected doctor is not scheduled at this appointment time."] });
        return;
      }
      if (!doctorSchedules.length && (await database.collection("doctorSchedules").countDocuments()) > 0) {
        sendJson(response, 400, { success: false, errors: ["The selected doctor is not scheduled on this appointment day."] });
        return;
      }
      const conflict = await appointments.findOne({
        _id: { $ne: appointmentId },
        appointmentDate: existing.appointmentDate,
        appointmentTime: existing.appointmentTime,
        doctor: update.doctor,
        status: { $nin: ["cancelled"] }
      });
      if (conflict) {
        sendJson(response, 409, { success: false, errors: ["That doctor already has an appointment at this time."] });
        return;
      }
    }
    const result = await appointments.updateOne({ _id: appointmentId }, { $set: { ...update, updatedAt: new Date() } });
    if (result.matchedCount && update.status && existing?.status !== update.status) {
      await notifyAppointment(database, appointmentId, { ...existing, ...update }, "status");
    }
    sendJson(response, result.matchedCount ? 200 : 404, { success: Boolean(result.matchedCount), message: result.matchedCount ? "Appointment updated." : "Appointment not found." });
    return;
  }

  if (url.pathname === "/api/analytics" && request.method === "GET") {
    if (!requireRole(request, response, "admin")) return;
    const [total, pending, confirmed, completed, cancelled] = await Promise.all([
      appointments.countDocuments(), appointments.countDocuments({ status: "pending" }), appointments.countDocuments({ status: "confirmed" }),
      appointments.countDocuments({ status: "completed" }), appointments.countDocuments({ status: "cancelled" })
    ]);
    sendJson(response, 200, { success: true, analytics: { total, pending, confirmed, completed, cancelled } });
    return;
  }

  if (url.pathname === "/api/my-profile" && request.method === "GET") {
    if (!requirePatient(request, response)) return;
    const session = getSession(request);
    const user = await database.collection("users").findOne({
      _id: new ObjectId(session.userId)
    }, {
      projection: {
        passwordHash: 0,
        resetToken: 0,
        resetTokenExpiresAt: 0,
        resetOtpHash: 0,
        resetOtpExpiresAt: 0,
        resetOtpAttempts: 0,
        resetOtpLastSentAt: 0
      }
    });
    sendJson(response, 200, { success: true, user });
    return;
  }

  if (url.pathname === "/api/my-profile" && request.method === "PUT") {
    if (!requirePatient(request, response)) return;
    const session = getSession(request);
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const name = clean(input.name, 100);
    const phone = clean(input.phone, 30);
    const password = String(input.password || "");
    const update = { name, phone, updatedAt: new Date() };
    if (password.length >= 8) update.passwordHash = await bcrypt.hash(password, 12);
    await database.collection("users").updateOne({ _id: new ObjectId(session.userId) }, { $set: update });
    sendJson(response, 200, { success: true, message: "Profile updated successfully." });
    return;
  }

  if (url.pathname === "/api/my-appointments" && request.method === "GET") {
    if (!requirePatient(request, response)) return;
    const session = getSession(request);
    const data = await appointments.find({ userId: new ObjectId(session.userId) }).sort({ appointmentDate: -1, appointmentTime: -1 }).toArray();
    sendJson(response, 200, { success: true, appointments: data });
    return;
  }

  if (url.pathname === "/api/schedules" && request.method === "GET") {
    if (!requireRole(request, response, "admin")) return;
    const schedules = await database.collection("doctorSchedules").find().sort({ day: 1, startTime: 1 }).toArray();
    sendJson(response, 200, { success: true, schedules });
    return;
  }

  if (url.pathname === "/api/schedules" && request.method === "POST") {
    if (!requireRole(request, response, "admin")) return;
    const payload = JSON.parse(await readRequestBody(request) || "{}");
    const record = {
      doctor: clean(payload.doctor, 100),
      day: clean(payload.day, 20),
      startTime: clean(payload.startTime, 5),
      endTime: clean(payload.endTime, 5),
      createdAt: new Date()
    };
    const startMinutes = normalizeAppointmentTime(record.startTime);
    const endMinutes = normalizeAppointmentTime(record.endTime);
    if (!record.doctor || !record.day || !startMinutes || !endMinutes ||
        !["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(record.day) ||
        !isClinicTimeAvailable(startMinutes) || !isClinicTimeAvailable(endMinutes) ||
        startMinutes >= endMinutes || !getAppointmentTimeSlots(startMinutes, endMinutes).length) {
      sendJson(response, 400, { success: false, errors: ["Choose a doctor and day, and enter a valid clinic shift using 30-minute times between 9:00 AM and 7:00 PM."] });
      return;
    }
    const result = await database.collection("doctorSchedules").insertOne(record);
    sendJson(response, 201, { success: true, message: "Doctor schedule saved.", scheduleId: result.insertedId });
    return;
  }

  const myAppointmentMatch = url.pathname.match(/^\/api\/my-appointments\/([^/]+)$/);
  if (myAppointmentMatch && request.method === "PATCH") {
    if (!requirePatient(request, response)) return;
    const session = getSession(request);
    if (!ObjectId.isValid(myAppointmentMatch[1])) { sendJson(response, 400, { success: false, errors: ["Invalid appointment ID."] }); return; }
    const result = await appointments.updateOne(
      { _id: new ObjectId(myAppointmentMatch[1]), userId: new ObjectId(session.userId), status: "pending" },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );
    sendJson(response, result.matchedCount ? 200 : 404, { success: Boolean(result.matchedCount), message: result.matchedCount ? "Appointment cancelled." : "Appointment not found or cannot be cancelled." });
    return;
  }

  sendJson(response, 404, { success: false, errors: ["API route not found."] });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
    else if (request.method === "GET") serveStatic(response, url.pathname);
    else sendJson(response, 405, { success: false, errors: ["Method not allowed."] });
  } catch (error) {
    console.error(error);
    sendJson(response, error instanceof SyntaxError ? 400 : 500, { success: false, errors: [error instanceof SyntaxError ? "Invalid request data." : "Server or database error."] });
  }
});  

async function startServer() {
  try {
    await getDatabase();

    server.listen(PORT, () => {
      console.log(`Sakthi Dental Clinic is running at http://localhost:${PORT}`);
      setTimeout(checkAppointmentReminders, 5000);
      setInterval(checkAppointmentReminders, 60 * 1000);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
process.on("SIGINT", async () => { server.close(); await closeDatabase(); process.exit(0); });
             