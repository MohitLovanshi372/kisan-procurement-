require("dotenv").config();
const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { connectDB } = require("./config/db");
const seedInitialData = require("./config/seedData");
const { initSocket, emitQueueUpdate } = require("./socket");
const Centre = require("./models/Centre");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const farmerRoutes = require("./routes/farmerRoutes");
const procurementRoutes = require("./routes/procurementRoutes");
const centreRoutes = require("./routes/centreRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const officerRoutes = require("./routes/officerRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");

const app = express();
const server = http.createServer(app);
// Dev and production server port MUST be hardcoded to 3000 for nginx reverse proxy
const PORT = 3000;

// Initialize Socket.io real-time engine
const io = initSocket(server);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, "..", "frontend");
const distPath = path.join(__dirname, "..", "dist");

// Serve React bundle assets if dist exists
if (fs.existsSync(distPath)) {
  app.use("/assets", express.static(path.join(distPath, "assets")));
  app.use("/dist", express.static(distPath));
}

app.use(express.static(frontendPath));

// API Routes
app.use("/", whatsappRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/farmers", farmerRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/centres", centreRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/centre-officer", officerRoutes);

// Health check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Mandisathi",
    version: "1.0.0",
    service: "MSP Direct Procurement Portal",
    realtime: "Socket.io Active",
    time: new Date().toISOString()
  });
});

// React Procurement Officer QR Scanner Entry Points
app.get(["/react", "/react-scanner", "/officer-scanner", "/scanner"], (req, res) => {
  const reactIndex = path.join(distPath, "index.html");
  if (fs.existsSync(reactIndex)) {
    return res.sendFile(reactIndex);
  }
  res.sendFile(path.join(frontendPath, "centre-officer.html"));
});

// Fallback to frontend index for root navigation
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Background live queue simulator ticker (every 18 seconds)
let queueTicker = null;
function startQueueTicker() {
  if (queueTicker) clearInterval(queueTicker);
  queueTicker = setInterval(async () => {
    try {
      const centres = await Centre.find();
      if (centres && centres.length > 0) {
        // Apply slight realistic delta simulation to in-memory/DB records
        for (const c of centres) {
          const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
          let newWaiting = Math.max(2, (c.waitingFarmers || 10) + delta);
          let newScore = Math.min(98, Math.max(12, Math.round((newWaiting / 38) * 100)));
          let level = "Moderate";
          if (newScore < 35 || newWaiting < 10) level = "Low Traffic";
          else if (newScore > 75 || newWaiting > 24) level = "Heavy";

          let estWait = `${Math.round(newWaiting * 2.4)} minutes`;
          if (newWaiting > 25) {
            const hrs = Math.floor((newWaiting * 2.4) / 60);
            const mins = Math.round((newWaiting * 2.4) % 60);
            estWait = `${hrs} hr ${mins} mins`;
          }

          c.waitingFarmers = newWaiting;
          c.congestionScore = newScore;
          c.congestionLevel = level;
          c.estimatedWait = estWait;
          c.queueTractors = Math.max(2, Math.round(newWaiting * 0.75));
          c.trend = delta > 0 ? "Rising" : delta < 0 ? "Easing" : "Stable";
          c.lastUpdated = new Date();
          await c.save().catch(() => {});
        }

        // Emit 'queue-update' event to all connected clients
        emitQueueUpdate({
          type: "ticker",
          centres: centres,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      // Ignore background interval errors
    }
  }, 18000);
}

// Start Server
async function start() {
  await connectDB();
  await seedInitialData();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌾 Mandisathi running on http://0.0.0.0:${PORT}`);
    console.log(`⚡ Socket.io real-time engine initialized`);
    console.log(`📌 MSP Procurement & Token Portal server ready`);
    startQueueTicker();
  });
}

start();

module.exports = { app, server, io };
