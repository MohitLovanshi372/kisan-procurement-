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
const whatsappRoutes = require("./routes/whatsappRoutes");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io real-time engine
const io = initSocket(server);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, "..", "frontend");
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

// Logo update endpoint (accepts base64 or imageUrl)
app.post("/api/system/upload-logo", express.json({ limit: "25mb" }), async (req, res) => {
  try {
    const { imageBase64, imageUrl } = req.body;
    let buffer = null;

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(cleanBase64, "base64");
    } else if (imageUrl) {
      const resp = await fetch(imageUrl);
      if (!resp.ok) {
        return res.status(400).json({ error: `Failed to fetch image from URL: ${resp.status} ${resp.statusText}` });
      }
      const arrayBuffer = await resp.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return res.status(400).json({ error: "Please provide either imageBase64 or imageUrl" });
    }

    const logoPngPath = path.join(frontendPath, "img", "logo.png");
    const brandLogoPngPath = path.join(frontendPath, "img", "brand-logo.png");
    fs.writeFileSync(logoPngPath, buffer);
    fs.writeFileSync(brandLogoPngPath, buffer);

    if (io) {
      io.emit("logo-updated", { timestamp: Date.now() });
    }

    return res.json({ success: true, message: "Logo updated successfully!" });
  } catch (err) {
    console.error("Logo update error:", err);
    return res.status(500).json({ error: err.message || "Failed to update logo" });
  }
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
