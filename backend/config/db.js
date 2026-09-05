const mongoose = require("mongoose");

// In-memory fallback database storage for zero-dependency instant local running & testing
const inMemoryDB = {
  farmers: [],
  centres: [],
  procurements: [],
  notifications: [],
  isUsingMemory: false
};

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kisan_procurement_db";
  try {
    // Attempt Mongoose connection with 1.5s serverSelectionTimeout
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 1500,
    });
    console.log("✅ MongoDB Connected successfully:", mongoURI);
    return true;
  } catch (err) {
    console.log("⚠️ MongoDB local daemon not reachable. Falling back to high-fidelity In-Memory Database Store.");
    inMemoryDB.isUsingMemory = true;
    return false;
  }
};

module.exports = { connectDB, inMemoryDB };
