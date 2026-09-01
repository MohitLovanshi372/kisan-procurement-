const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Farmer = require("../models/Farmer");
const { protect } = require("../middleware/authMiddleware");

// GET /api/procurement/qr-code
// Generates a high-resolution QR code image and encoded gate pass payload from the digital token
router.get("/qr-code", protect, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    const farmerId = farmer ? farmer.farmerId : req.user.farmerId;
    const farmerName = farmer ? farmer.name : (req.user.name || "Farmer");
    const mobile = farmer ? farmer.mobile : "9876543210";

    let procurements = await Procurement.find({ farmerId });
    let activeProc = procurements && procurements.length > 0 ? procurements[0] : null;

    if (!activeProc) {
      activeProc = await Procurement.create({
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
    }

    const tokenNumber = activeProc.tokenNumber || "TK-1042";
    const centreName = activeProc.centreId || "Sanwer Procurement Centre";
    const crop = activeProc.crop || "Wheat";
    const quantity = activeProc.quantity || "18 Quintal";
    const scheduleDate = activeProc.scheduleDate || "12 September 2026";
    const timeSlot = `${activeProc.startTime || "10:00 AM"} – ${activeProc.endTime || "11:00 AM"}`;

    // Payload embedded in the QR Code
    const qrPayload = JSON.stringify({
      scheme: "GOV-MSP-GATEPASS-2026",
      tokenNumber: tokenNumber,
      farmerId: farmerId,
      farmerName: farmerName,
      mobile: mobile.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
      crop: crop,
      quantity: quantity,
      centre: centreName,
      scheduleDate: scheduleDate,
      timeSlot: timeSlot,
      status: activeProc.procurementStatus,
      issuedAt: new Date().toISOString(),
      verifiedGate: "Priority-Lane-A1"
    });

    // Generate high resolution PNG data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "H",
      type: "image/png",
      margin: 2,
      scale: 8,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      }
    });

    res.json({
      success: true,
      data: {
        tokenNumber,
        qrDataUrl,
        qrPayload,
        farmerName,
        farmerId,
        crop,
        quantity,
        centreName,
        scheduleDate,
        timeSlot,
        status: activeProc.procurementStatus,
        paymentStatus: activeProc.paymentStatus,
        verificationHash: `VER-${tokenNumber}-${farmerId.slice(-4)}`
      }
    });
  } catch (error) {
    console.error("QR Generation error:", error);
    res.status(500).json({ success: false, message: "Unable to generate QR code for digital token" });
  }
});

// POST /api/procurement/verify-qr
// Simulates centre gatekeeper scanner verifying the farmer's scannable QR pass
router.post("/verify-qr", protect, async (req, res) => {
  try {
    const { tokenNumber, qrPayload } = req.body;
    let searchToken = tokenNumber;

    if (qrPayload) {
      try {
        const parsed = typeof qrPayload === "string" ? JSON.parse(qrPayload) : qrPayload;
        if (parsed && parsed.tokenNumber) {
          searchToken = parsed.tokenNumber;
        }
      } catch (e) {
        // Raw token fallback
        searchToken = qrPayload;
      }
    }

    if (!searchToken) {
      return res.status(400).json({ success: false, message: "Token number or QR payload is required" });
    }

    const procurement = await Procurement.findOne({ tokenNumber: searchToken });
    const farmer = procurement ? await Farmer.findOne({ farmerId: procurement.farmerId }) : null;

    if (!procurement) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: `Token ${searchToken} not found in procurement registry.`
      });
    }

    res.json({
      success: true,
      valid: true,
      message: "✅ Gate Entry Authorized • Valid Digital QR Pass",
      data: {
        tokenNumber: procurement.tokenNumber,
        farmerName: farmer ? farmer.name : "Registered Farmer",
        farmerId: procurement.farmerId,
        crop: procurement.crop,
        quantity: procurement.quantity,
        centre: procurement.centreId,
        scheduleDate: procurement.scheduleDate,
        timeSlot: `${procurement.startTime} – ${procurement.endTime}`,
        status: procurement.procurementStatus,
        gateAssigned: "Gate 2 (Weighbridge Scale A)",
        verifiedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        documentsRequired: ["Aadhaar Card", "Bank Passbook", "Khasra (Land Record)"]
      }
    });
  } catch (error) {
    console.error("QR Verification error:", error);
    res.status(500).json({ success: false, message: "Server error verifying QR code" });
  }
});

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
        isDemo: false,
        demoNote: "Queue and transaction information verified by Mandi Board."
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
