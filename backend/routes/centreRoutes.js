const express = require("express");
const router = express.Router();
const Centre = require("../models/Centre");

// GET /api/centres
router.get("/", async (req, res) => {
  try {
    let centres = await Centre.find();
    if (!centres || centres.length === 0) {
      centres = [
        {
          _id: "c1",
          name: "Sanwer Procurement Centre",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Sanwer Mandi Campus, Indore",
          workingHours: "09:00 AM – 05:00 PM",
          status: "Open",
          scheduledFarmers: 62,
          completedFarmers: 38,
          waitingFarmers: 18,
          estimatedWait: "45 minutes"
        },
        {
          _id: "c2",
          name: "Indore Central Mandi",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Laxmibai Nagar Mandi, Indore",
          workingHours: "08:30 AM – 06:00 PM",
          status: "Open",
          scheduledFarmers: 74,
          completedFarmers: 51,
          waitingFarmers: 12,
          estimatedWait: "25 minutes"
        },
        {
          _id: "c3",
          name: "Depalpur Krishi Upaj Mandi",
          district: "Indore",
          state: "Madhya Pradesh",
          location: "Depalpur Main Road, Indore",
          workingHours: "09:00 AM – 05:00 PM",
          status: "Open",
          scheduledFarmers: 43,
          completedFarmers: 29,
          waitingFarmers: 8,
          estimatedWait: "15 minutes"
        }
      ];
    }

    res.json({
      success: true,
      data: centres,
      note: "Centre statistics and queue data are demo values for SIH26032 prototype"
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

    res.json({
      success: true,
      data: centre
    });
  } catch (error) {
    console.error("Centre get error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre details" });
  }
});

module.exports = router;
