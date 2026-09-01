require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const { connectDB } = require("./config/db");
const seedInitialData = require("./config/seedData");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const farmerRoutes = require("./routes/farmerRoutes");
const procurementRoutes = require("./routes/procurementRoutes");
const centreRoutes = require("./routes/centreRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/farmers", farmerRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/centres", centreRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

// Health check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Kisan Procurement Mitra",
    version: "1.0.0",
    prototype: "SIH26032",
    time: new Date().toISOString()
  });
});

// Fallback to frontend index for root navigation
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Start Server
async function start() {
  await connectDB();
  await seedInitialData();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌾 Kisan Procurement Mitra running on http://0.0.0.0:${PORT}`);
    console.log(`📌 SIH26032 Student Prototype server ready`);
  });
}

start();
