const mongoose = require("mongoose");

// In-memory fallback database storage for zero-dependency instant local running & testing
const inMemoryDB = {
  farmers: [],
  centres: [],
  procurements: [],
  notifications: [],
  whatsAppMessages: [],
  isUsingMemory: false
};

const connectDB = async () => {
  let mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kisan_procurement_db";
  if (typeof mongoURI === "string") {
    if (mongoURI.startsWith("MONGODB_URI=")) {
      mongoURI = mongoURI.replace(/^MONGODB_URI=/, "").trim();
    }
    mongoURI = mongoURI.replace(/^['"]|['"]$/g, "").trim();
  }
  try {
    // Attempt Mongoose connection with 2s serverSelectionTimeout
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log("✅ MongoDB Connected successfully");
    return true;
  } catch (err) {
    console.log("⚠️ MongoDB remote/local not reachable. Falling back to high-fidelity In-Memory Database Store.");
    inMemoryDB.isUsingMemory = true;
    return false;
  }
};

module.exports = { connectDB, inMemoryDB };
