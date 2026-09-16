require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { getDatabase, closeDatabase } = require("./db");
const { getTreatmentPricing, buildAppointmentEmail, buildReminderSms } = require("./features");

const PORT = Number(process.env.PORT) || 3000;
const SITE_ROOT = path.join(__dirname, "..", "docs");
const MAX_BODY_SIZE = 10 * 1024;
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
  const appointment = {
    name: clean(input.name, 100), email: clean(input.email, 160).toLowerCase(), phone: clean(input.phone, 30),
    appointmentDate: clean(input.appointmentDate, 10), appointmentTime: clean(input.appointmentTime, 5),
    treatment: clean(input.treatment, 100), doctor: clean(input.doctor, 100), message: clean(input.message, 1000),
    price: Number(input.price) || getTreatmentPricing(input.treatment)
  };
  const errors = [];
  if (!appointment.name) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email)) errors.push("A valid email is required.");
  if (!appointment.phone) errors.push("Phone number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appointmentDate)) errors.push("A valid appointment date is required.");
  if (!/^\d{2}:\d{2}$/.test(appointment.appointmentTime)) errors.push("A valid appointment time is required.");
  if (!appointment.treatment) errors.push("Please select a treatment.");
  if (!appointment.price || appointment.price < 0) appointment.price = getTreatmentPricing(appointment.treatment);
  return { appointment, errors };
}

async function notifyAppointmentCreated(appointment) {
  const email = buildAppointmentEmail({
    name: appointment.name,
    treatment: appointment.treatment,
    date: appointment.appointmentDate,
    time: appointment.appointmentTime,
    price: appointment.price
  });
  const sms = buildReminderSms({
    name: appointment.name,
    date: appointment.appointmentDate,
    time: appointment.appointmentTime
  });

  console.log("EMAIL_CONFIRMATION");
  console.log(email.subject);
  console.log(email.body);
  console.log("SMS_REMINDER");
  console.log(sms);
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
    const user = await database.collection("users").findOne({ email });
    if (!user) {
      sendJson(response, 200, { success: true, message: "If that account exists, a password reset link has been generated." });
      return;
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    await database.collection("users").updateOne(
      { _id: user._id },
      { $set: { resetToken, resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), updatedAt: new Date() } }
    );
    sendJson(response, 200, {
      success: true,
      message: "If that account exists, a password reset link has been generated.",
      resetToken,
      resetExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
    return;
  }

  if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
    const input = JSON.parse(await readRequestBody(request) || "{}");
    const token = clean(input.token, 200);
    const newPassword = String(input.newPassword || "");
    if (newPassword.length < 8) {
      sendJson(response, 400, { success: false, errors: ["New password must be at least 8 characters long."] });
      return;
    }
    const user = await database.collection("users").findOne({ resetToken: token, resetTokenExpiresAt: { $gt: new Date() } });
    if (!user) {
      sendJson(response, 400, { success: false, errors: ["Reset link is invalid or expired."] });
      return;
    }
    await database.collection("users").updateOne(
      { _id: user._id },
      { $set: { passwordHash: await bcrypt.hash(newPassword, 12), resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() } }
    );
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
    const duplicate = await appointments.findOne({ appointmentDate: appointment.appointmentDate, appointmentTime: appointment.appointmentTime, status: { $nin: ["cancelled"] } });
    if (duplicate) { sendJson(response, 409, { success: false, errors: ["That time slot is already requested. Please choose another time."] }); return; }
    const session = getSession(request);
    const saved = { ...appointment, status: "pending", createdAt: new Date(), emailSent: false, smsSent: false };
    if (session?.role === "patient") {
      saved.userId = new ObjectId(session.userId);
      saved.name = session.name;
    }
    const result = await appointments.insertOne(saved);
    await notifyAppointmentCreated(saved);
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
    const booked = await appointments.find({ appointmentDate: date, status: { $nin: ["cancelled"] } }).project({ appointmentTime: 1, _id: 0 }).toArray();
    sendJson(response, 200, { success: true, bookedTimes: booked.map(item => item.appointmentTime) });
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
  if (appointmentMatch && request.method === "PATCH") {
    if (!requireRole(request, response, "admin")) return;
    const payload = JSON.parse(await readRequestBody(request) || "{}");
    const update = {};
    if (typeof payload.status === "string") update.status = clean(payload.status, 20);
    if (typeof payload.doctor === "string") update.doctor = clean(payload.doctor, 100);
    if (typeof payload.adminNotes === "string") update.adminNotes = clean(payload.adminNotes, 2000);
    if (typeof payload.price === "number") update.price = payload.price;
    if (Object.keys(update).length === 0) { sendJson(response, 400, { success: false, errors: ["No valid appointment update provided."] }); return; }
    if (!ObjectId.isValid(appointmentMatch[1])) { sendJson(response, 400, { success: false, errors: ["Invalid appointment ID."] }); return; }
    const result = await appointments.updateOne({ _id: new ObjectId(appointmentMatch[1]) }, { $set: { ...update, updatedAt: new Date() } });
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
    const user = await database.collection("users").findOne({ _id: new ObjectId(session.userId) }, { projection: { passwordHash: 0, resetToken: 0, resetTokenExpiresAt: 0 } });
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
    if (!record.doctor || !record.day || !record.startTime || !record.endTime) {
      sendJson(response, 400, { success: false, errors: ["Doctor, day, start time, and end time are required."] });
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

server.listen(PORT, () => console.log(`Sakthi Dental Clinic is running at http://localhost:${PORT}`));
process.on("SIGINT", async () => { server.close(); await closeDatabase(); process.exit(0); });
             