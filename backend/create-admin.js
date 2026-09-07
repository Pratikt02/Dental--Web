require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getDatabase, closeDatabase } = require("./db");

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password === "change-this-password") {
    throw new Error("Set ADMIN_PASSWORD before creating the admin account.");
  }

  const database = await getDatabase();
  await database.collection("admins").updateOne(
    { username },
    { $set: { username, passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`Admin account ready for ${username}.`);
}

createAdmin().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(closeDatabase);