const express = require("express");
const router = express.Router();
const Centre = require("../models/Centre");

// Helper to determine congestion level from metrics if not explicitly set
function calculateCongestion(centre) {
  const waiting = centre.waitingFarmers || 0;
  const score = centre.congestionScore !== undefined ? centre.congestionScore : Math.min(100, Math.round((waiting / 35) * 100));
  let level = centre.congestionLevel;
  if (!level) {
    if (waiting < 10 || score < 35) level = "Low Traffic";
    else if (waiting < 25 || score < 75) level = "Moderate";
    else level = "Heavy";
  }
  return { level, score };
}

// GET /api/centres/live-status
// Returns real-time congestion levels, queue metrics, and recommendations for major centres
router.get("/live-status", async (req, res) => {
  try {
    let centres = await Centre.find();

    // Default fallback dataset if DB has not yet been populated
    if (!centres || centres.length === 0) {
      centres = [
        {
          _id: "c1",
          name: "Sanwer Procurement Centre",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Sanwer Mandi Campus, Indore Road",
          workingHours: "09:00 AM – 05:00 PM",
          status: "Open",
          scheduledFarmers: 62,
          completedFarmers: 38,
          waitingFarmers: 18,
          estimatedWait: "45 minutes",
          congestionLevel: "Moderate",
          congestionScore: 58,
          queueTractors: 14,
          activeWeighbridges: 2,
          totalWeighbridges: 3,
          trend: "Stable",
          bestTimeToVisit: "02:00 PM – 04:00 PM",
          peakHours: "11:00 AM – 01:30 PM"
        },
        {
          _id: "c2",
          name: "Indore Central Mandi",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Laxmibai Nagar Mandi, Indore",
          workingHours: "08:30 AM – 06:00 PM",
          status: "Open",
          scheduledFarmers: 96,
          completedFarmers: 58,
          waitingFarmers: 34,
          estimatedWait: "1 hr 15 mins",
          congestionLevel: "Heavy",
          congestionScore: 88,
          queueTractors: 28,
          activeWeighbridges: 4,
          totalWeighbridges: 4,
          trend: "Rising",
          bestTimeToVisit: "03:30 PM – 05:30 PM",
          peakHours: "10:00 AM – 02:00 PM"
        },
        {
          _id: "c3",
          name: "Depalpur Krishi Upaj Mandi",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Depalpur Main Highway, Indore",
          workingHours: "09:00 AM – 05:00 PM",
          status: "Open",
          scheduledFarmers: 43,
          completedFarmers: 35,
          waitingFarmers: 6,
          estimatedWait: "15 minutes",
          congestionLevel: "Low Traffic",
          congestionScore: 22,
          queueTractors: 4,
          activeWeighbridges: 2,
          totalWeighbridges: 2,
          trend: "Easing",
          bestTimeToVisit: "10:00 AM – 03:00 PM",
          peakHours: "12:00 PM – 01:00 PM"
        },
        {
          _id: "c4",
          name: "Mhow Kisan Samriddhi Mandi",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Mhow-Pithampur Bypass, Indore",
          workingHours: "09:00 AM – 05:30 PM",
          status: "Open",
          scheduledFarmers: 52,
          completedFarmers: 41,
          waitingFarmers: 8,
          estimatedWait: "20 minutes",
          congestionLevel: "Low Traffic",
          congestionScore: 28,
          queueTractors: 6,
          activeWeighbridges: 2,
          totalWeighbridges: 3,
          trend: "Stable",
          bestTimeToVisit: "11:00 AM – 03:00 PM",
          peakHours: "09:30 AM – 11:00 AM"
        },
        {
          _id: "c5",
          name: "Ujjain APMC Procurement Hub",
          district: "Ujjain",
          state: "Madhya Pradesh",
          location: "Agar Road Krishi Parisar, Ujjain",
          workingHours: "08:00 AM – 06:30 PM",
          status: "Open",
          scheduledFarmers: 110,
          completedFarmers: 65,
          waitingFarmers: 42,
          estimatedWait: "1 hr 30 mins",
          congestionLevel: "Heavy",
          congestionScore: 92,
          queueTractors: 35,
          activeWeighbridges: 3,
          totalWeighbridges: 5,
          trend: "Rising",
          bestTimeToVisit: "04:00 PM – 06:00 PM",
          peakHours: "10:30 AM – 02:30 PM"
        },
        {
          _id: "c6",
          name: "Dewas Agro Procurement Complex",
          district: "Dewas",
          state: "Madhya Pradesh",
          location: "Bhopal Bypass Road, Dewas",
          workingHours: "09:00 AM – 05:00 PM",
          status: "Open",
          scheduledFarmers: 68,
          completedFarmers: 48,
          waitingFarmers: 16,
          estimatedWait: "35 minutes",
          congestionLevel: "Moderate",
          congestionScore: 52,
          queueTractors: 12,
          activeWeighbridges: 3,
          totalWeighbridges: 4,
          trend: "Easing",
          bestTimeToVisit: "01:30 PM – 04:00 PM",
          peakHours: "11:00 AM – 01:00 PM"
        }
      ];
    }

    const formattedCentres = centres.map(c => {
      const { level, score } = calculateCongestion(c);
      return {
        _id: c._id,
        name: c.name,
        district: c.district,
        state: c.state,
        location: c.location,
        workingHours: c.workingHours || "09:00 AM – 05:00 PM",
        status: c.status || "Open",
        scheduledFarmers: c.scheduledFarmers || 0,
        completedFarmers: c.completedFarmers || 0,
        waitingFarmers: c.waitingFarmers || 0,
        estimatedWait: c.estimatedWait || "25 minutes",
        congestionLevel: level, // 'Low Traffic' | 'Moderate' | 'Heavy'
        congestionScore: score,
        queueTractors: c.queueTractors || Math.round((c.waitingFarmers || 10) * 0.7),
        activeWeighbridges: c.activeWeighbridges || 2,
        totalWeighbridges: c.totalWeighbridges || 3,
        trend: c.trend || "Stable",
        bestTimeToVisit: c.bestTimeToVisit || "02:00 PM – 04:00 PM",
        peakHours: c.peakHours || "11:00 AM – 01:30 PM",
        lastUpdated: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
    });

    // Summary calculations
    const lowCount = formattedCentres.filter(c => c.congestionLevel === "Low Traffic").length;
    const modCount = formattedCentres.filter(c => c.congestionLevel === "Moderate").length;
    const heavyCount = formattedCentres.filter(c => c.congestionLevel === "Heavy").length;
    const openCount = formattedCentres.filter(c => c.status === "Open").length;

    // Lowest traffic centre recommendation
    const bestCentre = [...formattedCentres].sort((a, b) => a.congestionScore - b.congestionScore)[0];

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalCentres: formattedCentres.length,
        openCentres: openCount,
        lowTrafficCount: lowCount,
        moderateCount: modCount,
        heavyCount: heavyCount,
        recommendedFastestCentre: bestCentre ? { name: bestCentre.name, wait: bestCentre.estimatedWait } : null
      },
      data: formattedCentres
    });
  } catch (error) {
    console.error("Live congestion status error:", error);
    res.status(500).json({ success: false, message: "Unable to load live centre congestion status" });
  }
});

// POST /api/centres/live-status/refresh
// Simulates dynamic fluctuation in queue and congestion levels for real-time demonstration
router.post("/live-status/refresh", async (req, res) => {
  try {
    let centres = await Centre.find();
    if (centres && centres.length > 0) {
      // Apply slight realistic delta simulation to in-memory/DB records
      for (const c of centres) {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
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
      }
    }

    res.json({
      success: true,
      message: "Live mandi telemetry refreshed successfully."
    });
  } catch (error) {
    console.error("Refresh congestion error:", error);
    res.status(500).json({ success: false, message: "Failed to refresh telemetry" });
  }
});

// GET /api/centres
router.get("/", async (req, res) => {
  try {
    let centres = await Centre.find();
    if (!centres || centres.length === 0) {
      centres = await Centre.find();
    }

    const formatted = (centres || []).map(c => {
      const { level, score } = calculateCongestion(c);
      return {
        ...c._doc || c,
        congestionLevel: level,
        congestionScore: score
      };
    });

    res.json({
      success: true,
      data: formatted,
      note: "Live procurement centre telemetry and queue status"
    });
  } catch (error) {
    console.error("Centres fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to load procurement centres" });
  }
});

// GET /api/centres/:id
router.get("/:id", async (req, res) => {
  try {
    let centre = await Centre.findById(req.params.id);
    if (!centre) {
      centre = await Centre.findOne({ name: req.params.id });
    }

    if (!centre) {
      return res.status(404).json({ success: false, message: "Procurement centre not found" });
    }

    const { level, score } = calculateCongestion(centre);

    res.json({
      success: true,
      data: {
        ...centre._doc || centre,
        congestionLevel: level,
        congestionScore: score,
        hourlyForecast: [
          { time: "09:00 AM", level: "Low Traffic", wait: "10 mins" },
          { time: "11:00 AM", level: "Heavy", wait: "1 hr" },
          { time: "01:00 PM", level: "Moderate", wait: "35 mins" },
          { time: "03:00 PM", level: "Low Traffic", wait: "15 mins" },
          { time: "05:00 PM", level: "Low Traffic", wait: "10 mins" }
        ]
      }
    });
  } catch (error) {
    console.error("Centre get error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre details" });
  }
});

module.exports = router;

