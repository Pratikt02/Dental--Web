const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const SITE_ROOT = path.join(__dirname, "..", "frontend");
const DATA_FILE = path.join(__dirname, "data", "appointments.json");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "clinic-admin";
const MAX_BODY_SIZE = 10 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readAppointments() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

function saveAppointments(appointments) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(appointments, null, 2) + "\n");
}

function isAdminAuthorized(request) {
  return request.headers["x-admin-token"] === ADMIN_TOKEN;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
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
    name: clean(input.name, 100),
    email: clean(input.email, 160).toLowerCase(),
    phone: clean(input.phone, 30),
    appointmentDate: clean(input.appointmentDate, 10),
    appointmentTime: clean(input.appointmentTime, 5),
    treatment: clean(input.treatment, 100),
    message: clean(input.message, 1000)
  };
  const errors = [];

  if (!appointment.name) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email)) {
    errors.push("A valid email is required.");
  }
  if (!appointment.phone) errors.push("Phone number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appointmentDate)) {
    errors.push("A valid appointment date is required.");
  }
  if (!/^\d{2}:\d{2}$/.test(appointment.appointmentTime)) {
    errors.push("A valid appointment time is required.");
  }
  if (!appointment.treatment) errors.push("Please select a treatment.");

  return { appointment, errors };
}

function serveStatic(request, response, pathname) {
  let requestedPath;

  try {
    requestedPath = decodeURIComponent(pathname);
  } catch (error) {
    response.writeHead(400);
    response.end("Invalid path");
    return;
  }

  requestedPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.resolve(SITE_ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(SITE_ROOT + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/appointments" && request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Methods": "POST, OPTIONS" });
    response.end();
    return;
  }

  if (url.pathname === "/api/appointments" && request.method === "POST") {
    try {
      const body = await readRequestBody(request);
      const input = JSON.parse(body || "{}");
      const { appointment, errors } = validateAppointment(input);

      if (errors.length > 0) {
        sendJson(response, 400, { success: false, errors });
        return;
      }

      const appointments = readAppointments();
      const savedAppointment = {
        id: crypto.randomUUID(),
        ...appointment,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      appointments.push(savedAppointment);
      saveAppointments(appointments);
      sendJson(response, 201, {
        success: true,
        message: "Your appointment request has been received.",
        appointmentId: savedAppointment.id
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { success: false, errors: ["Invalid request data."] });
      } else {
        console.error(error);
        sendJson(response, 500, { success: false, errors: ["Unable to save the appointment right now."] });
      }
    }
    return;
  }

  if (url.pathname === "/api/appointments" && request.method === "GET") {
    if (!isAdminAuthorized(request)) {
      sendJson(response, 401, { success: false, errors: ["Admin authorization is required."] });
      return;
    }

    sendJson(response, 200, { success: true, appointments: readAppointments() });
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response, url.pathname);
    return;
  }

  sendJson(response, 405, { success: false, errors: ["Method not allowed."] });
});

server.listen(PORT, () => {
  console.log(`Sakthi Dental Clinic is running at http://localhost:${PORT}`);
});
