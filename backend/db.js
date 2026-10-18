const { MongoClient } = require("mongodb");
const dns = require("dns");

// Use Cloudflare + Google DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const client = new MongoClient(process.env.MONGODB_URI);

let database;

async function getDatabase() {
    if (!database) {
        try {
            await client.connect();

            console.log("Connected to MongoDB Atlas 🚀");

            database = client.db(
                process.env.MONGODB_DB || "sakthi_dental_clinic"
            );

            console.log(`Database: ${database.databaseName}`);

            // Create indexes
            await database.collection("appointments").createIndex({
                appointmentDate: 1,
                appointmentTime: 1
            });

            await database.collection("appointments").createIndex({
                status: 1
            });

            await database.collection("appointments").createIndex({
                userId: 1
            });

            await database.collection("users").createIndex(
                { email: 1 },
                { unique: true }
            );

            await database.collection("admins").createIndex(
                { username: 1 },
                { unique: true }
            );

            console.log("Database indexes created/verified ✅");

        } catch (error) {
            console.error("❌ MongoDB connection error:", error);
            throw error;
        }
    }

    return database;
}

async function closeDatabase() {
    try {
        await client.close();
        database = undefined;
        console.log("MongoDB connection closed");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
    }
}

module.exports = {
    getDatabase,
    closeDatabase
};