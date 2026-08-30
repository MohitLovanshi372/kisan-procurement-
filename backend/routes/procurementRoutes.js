const express = require("express");
const router = express.Router();
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Farmer = require("../models/Farmer");
const { protect } = require("../middleware/authMiddleware");

// GET /api/procurement/my
// Returns the active/latest procurement record for the logged in farmer along with centre data
router.get("/my", protect, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    const farmerId = farmer ? farmer.farmerId : req.user.farmerId;

    let procurements = await Procurement.find({ farmerId });

    // If no procurement exists yet, generate default demo procurement for the farmer
    let activeProcurement;
    if (!procurements || procurements.length === 0) {
      activeProcurement = await Procurement.create({
        farmerId: farmerId,
        centreId: farmer ? farmer.preferredCentre : "Sanwer Procurement Centre",
        crop: farmer ? farmer.crop : "Wheat",
        quantity: "18 Quintal",
        receivedQuantity: "18 Quintal",
        tokenNumber: "TK-1042",
        scheduleDate: "12 September 2026",
        startTime: "10:00 AM",
        endTime: "11:00 AM",
        procurementStatus: "Scheduled",
        paymentStatus: "Pending",
        amount: 45000,
        paymentDate: null,
        transactionId: null
      });
      procurements = [activeProcurement];
    } else {
      activeProcurement = procurements[0];
    }

    // Get centre details
    let centre = await Centre.findOne({ name: activeProcurement.centreId });
    if (!centre) {
      centre = {
        name: activeProcurement.centreId || "Sanwer Procurement Centre",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Sanwer Mandi, Indore",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 62,
        completedFarmers: 38,
        waitingFarmers: 18,
        estimatedWait: "45 minutes"
      };
    }

    // Determine smart visit indicator rule
    let visitRecommendation = {
      queueCount: centre.waitingFarmers || 18,
      status: "Moderate waiting.",
      advice: "Your scheduled slot is " + (activeProcurement.startTime || "10:00 AM") + " – " + (activeProcurement.endTime || "11:00 AM") + ". Please carry your required documents and arrive during your assigned slot.",
      level: "moderate"
    };

    if (centre.waitingFarmers < 10) {
      visitRecommendation.status = "Low waiting — good time to visit.";
      visitRecommendation.level = "low";
    } else if (centre.waitingFarmers > 25) {
      visitRecommendation.status = "High waiting — strictly follow your assigned schedule.";
      visitRecommendation.level = "high";
    }

    res.json({
      success: true,
      data: {
        procurement: activeProcurement,
        allProcurements: procurements,
        centre: centre,
        smartRecommendation: visitRecommendation,
        isDemo: true,
        demoNote: "Queue and transaction information shown in this prototype is demo data for SIH26032 prototype."
      }
    });
  } catch (error) {
    console.error("My procurement get error:", error);
    res.status(500).json({ success: false, message: "Unable to load procurement details" });
  }
});

// GET /api/procurement/schedule
router.get("/schedule", protect, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    const farmerId = farmer ? farmer.farmerId : req.user.farmerId;

    let procurements = await Procurement.find({ farmerId });

    if (!procurements || procurements.length === 0) {
      const defaultProc = await Procurement.create({
        farmerId: farmerId,
        centreId: farmer ? farmer.preferredCentre : "Sanwer Procurement Centre",
        crop: farmer ? farmer.crop : "Wheat",
        quantity: "18 Quintal",
        receivedQuantity: "18 Quintal",
        tokenNumber: "TK-1042",
        scheduleDate: "12 September 2026",
        startTime: "10:00 AM",
        endTime: "11:00 AM",
        procurementStatus: "Scheduled",
        paymentStatus: "Pending",
        amount: 45000
      });
      procurements = [defaultProc];
    }

    res.json({
      success: true,
      data: procurements
    });
  } catch (error) {
    console.error("Schedule error:", error);
    res.status(500).json({ success: false, message: "Unable to load schedule list" });
  }
});

// PUT /api/procurement/:id
router.put("/:id", protect, async (req, res) => {
  try {
    const { procurementStatus, paymentStatus, receivedQuantity, amount, paymentDate, transactionId } = req.body;

    const updated = await Procurement.findByIdAndUpdate(
      req.params.id,
      {
        ...(procurementStatus && { procurementStatus }),
        ...(paymentStatus && { paymentStatus }),
        ...(receivedQuantity && { receivedQuantity }),
        ...(amount !== undefined && { amount }),
        ...(paymentDate !== undefined && { paymentDate }),
        ...(transactionId !== undefined && { transactionId })
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Procurement record not found" });
    }

    res.json({
      success: true,
      message: "Procurement record updated",
      data: updated
    });
  } catch (error) {
    console.error("Procurement update error:", error);
    res.status(500).json({ success: false, message: "Failed to update procurement record" });
  }
});

module.exports = router;
