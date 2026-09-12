require("dotenv").config();
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
let database;

async function getDatabase() {
  if (!database) {        
    await client.connect();
    database = client.db(process.env.MONGODB_DB || "sakthi_dental_clinic");
    await database.collection("appointments").createIndex({ appointmentDate: 1, appointmentTime: 1 });
    await database.collection("appointments").createIndex({ status: 1 });
    await database.collection("appointments").createIndex({ userId: 1 });
    await database.collection("users").createIndex({ email: 1 }, { unique: true });
    await database.collection("admins").createIndex({ username: 1 }, { unique: true });
  }
  return database;
}

async function closeDatabase() {
  await client.close();
  database = undefined;
}

module.exports = { getDatabase, closeDatabase };