require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getDatabase, closeDatabase } = require("./db");

async function migrate() {
  const source = path.join(__dirname, "data", "appointments.json");
  if (!fs.existsSync(source)) {
    console.log("No legacy appointments.json file found. Nothing to migrate.");
    return;
  }

  const appointments = JSON.parse(fs.readFileSync(source, "utf8"));
  const database = await getDatabase();
  const collection = database.collection("appointments");
  const existing = await collection.countDocuments();

  if (existing > 0) {
    console.log("MongoDB already contains appointments. Migration skipped to prevent duplicates.");
    return;
  }

  if (appointments.length > 0) {
    await collection.insertMany(appointments.map(({ id, ...appointment }) => ({
      ...appointment,
      createdAt: new Date(appointment.createdAt || Date.now())
    })));
  }
  console.log(`Migrated ${appointments.length} appointment(s) to MongoDB.`);
}

migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(closeDatabase);
