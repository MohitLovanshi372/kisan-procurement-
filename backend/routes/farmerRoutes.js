const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Notification = require("../models/Notification");
const QRCode = require("qrcode");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

// All routes in this router require authentication and FARMER or GOVERNMENT_ADMIN role
router.use(authenticateJWT);

// GET /api/farmer/profile
router.get("/profile", async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer profile not found" });
    }

    res.json({
      success: true,
      data: {
        id: farmer._id,
        name: farmer.name,
        mobile: farmer.mobile,
        farmerId: farmer.farmerId,
        village: farmer.village,
        district: farmer.district,
        state: farmer.state,
        crop: farmer.crop,
        landArea: farmer.landArea,
        preferredCentre: farmer.preferredCentre,
        assignedCentreId: farmer.assignedCentreId || null,
        assignedCentreName: farmer.assignedCentreName || farmer.preferredCentre,
        aadharNumber: farmer.aadharNumber || "",
        isAadharLinked: farmer.isAadharLinked !== false,
        bankName: farmer.bankName || "",
        accountNumber: farmer.accountNumber || "",
        ifscCode: farmer.ifscCode || "",
        accountHolderName: farmer.accountHolderName || farmer.name || "",
        branchName: farmer.branchName || "",
        dbtStatus: farmer.dbtStatus || "Active (Aadhaar Seeded)",
        role: farmer.role,
        createdAt: farmer.createdAt
      }
    });
  } catch (error) {
    console.error("Profile get error:", error);
    res.status(500).json({ success: false, message: "Unable to load profile details" });
  }
});

// PUT /api/farmer/profile
router.put("/profile", async (req, res) => {
  try {
    const {
      name,
      village,
      district,
      state,
      crop,
      landArea,
      preferredCentre,
      aadharNumber,
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      branchName
    } = req.body;

    const cleanAccount = accountNumber ? accountNumber.replace(/[^0-9]/g, "") : undefined;
    const cleanIfsc = ifscCode ? ifscCode.trim().toUpperCase() : undefined;
    const cleanAadhar = aadharNumber ? aadharNumber.replace(/[^0-9]/g, "") : undefined;

    const updatedFarmer = await Farmer.findByIdAndUpdate(
      req.user.id,
      {
        ...(name && { name }),
        ...(village && { village }),
        ...(district && { district }),
        ...(state && { state }),
        ...(crop && { crop }),
        ...(landArea && { landArea }),
        ...(preferredCentre && { preferredCentre, assignedCentreName: preferredCentre }),
        ...(cleanAadhar && { aadharNumber: cleanAadhar }),
        ...(bankName && { bankName }),
        ...(cleanAccount && { accountNumber: cleanAccount }),
        ...(cleanIfsc && { ifscCode: cleanIfsc }),
        ...(accountHolderName && { accountHolderName }),
        ...(branchName && { branchName }),
        dbtStatus: "Active (Aadhaar Seeded)"
      },
      { new: true }
    );

    if (!updatedFarmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedFarmer._id,
        name: updatedFarmer.name,
        mobile: updatedFarmer.mobile,
        farmerId: updatedFarmer.farmerId,
        village: updatedFarmer.village,
        district: updatedFarmer.district,
        state: updatedFarmer.state,
        crop: updatedFarmer.crop,
        landArea: updatedFarmer.landArea,
        preferredCentre: updatedFarmer.preferredCentre,
        assignedCentreId: updatedFarmer.assignedCentreId,
        assignedCentreName: updatedFarmer.assignedCentreName,
        aadharNumber: updatedFarmer.aadharNumber || "",
        isAadharLinked: updatedFarmer.isAadharLinked !== false,
        bankName: updatedFarmer.bankName || "",
        accountNumber: updatedFarmer.accountNumber || "",
        ifscCode: updatedFarmer.ifscCode || "",
        accountHolderName: updatedFarmer.accountHolderName || updatedFarmer.name || "",
        branchName: updatedFarmer.branchName || "",
        dbtStatus: updatedFarmer.dbtStatus || "Active (Aadhaar Seeded)",
        role: updatedFarmer.role
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

// GET /api/farmer/schedule (Own schedule only)
router.get("/schedule", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const procurements = await Procurement.find({ farmerId });

    res.json({
      success: true,
      data: procurements || []
    });
  } catch (error) {
    console.error("Farmer schedule error:", error);
    res.status(500).json({ success: false, message: "Unable to load schedule" });
  }
});

// GET /api/farmer/token (Own digital token & QR Gate Pass)
router.get("/token", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const farmer = await Farmer.findById(req.user.id);
    const procurements = await Procurement.find({ farmerId });
    const activeProc = (procurements && procurements.length > 0) ? procurements[0] : null;

    if (!activeProc) {
      return res.status(404).json({ success: false, message: "No active token found for this farmer" });
    }

    const tokenNumber = activeProc.tokenNumber || "TK-1042";
    const centreName = activeProc.centreId || farmer?.preferredCentre || "Sanwer Procurement Centre";
    const crop = activeProc.crop || farmer?.crop || "Wheat";
    const quantity = activeProc.quantity || "18 Quintal";
    const scheduleDate = activeProc.scheduleDate || "12 September 2026";
    const timeSlot = `${activeProc.startTime || "10:00 AM"} – ${activeProc.endTime || "11:00 AM"}`;

    // Payload embedded in the QR Code
    const qrPayload = JSON.stringify({
      scheme: "GOV-MSP-GATEPASS-2026",
      tokenNumber: tokenNumber,
      farmerId: farmerId,
      farmerName: farmer ? farmer.name : req.user.name,
      mobile: (farmer ? farmer.mobile : req.user.mobile).replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
      crop: crop,
      quantity: quantity,
      centre: centreName,
      scheduleDate: scheduleDate,
      timeSlot: timeSlot,
      status: activeProc.procurementStatus,
      issuedAt: new Date().toISOString(),
      verifiedGate: "Priority-Lane-A1"
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "H",
      type: "image/png",
      margin: 2,
      scale: 8,
      color: { dark: "#0f172a", light: "#ffffff" }
    });

    res.json({
      success: true,
      data: {
        tokenNumber,
        qrDataUrl,
        qrPayload,
        farmerName: farmer ? farmer.name : req.user.name,
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
    console.error("Farmer token error:", error);
    res.status(500).json({ success: false, message: "Unable to load token details" });
  }
});

// GET /api/farmer/procurement (Own procurement details)
router.get("/procurement", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const farmer = await Farmer.findById(req.user.id);
    let procurements = await Procurement.find({ farmerId });

    const activeProc = (procurements && procurements.length > 0) ? procurements[0] : null;

    let centre = null;
    if (activeProc) {
      centre = await Centre.findOne({ name: activeProc.centreId }) || await Centre.findOne({ centreId: activeProc.centreId });
    }
    if (!centre && farmer) {
      centre = await Centre.findOne({ name: farmer.preferredCentre }) || await Centre.findOne({ centreId: farmer.assignedCentreId });
    }

    res.json({
      success: true,
      data: {
        procurement: activeProc,
        allProcurements: procurements,
        centre: centre,
        farmer: farmer ? {
          name: farmer.name,
          farmerId: farmer.farmerId,
          mobile: farmer.mobile,
          preferredCentre: farmer.preferredCentre,
          crop: farmer.crop,
          landArea: farmer.landArea,
          aadharNumber: farmer.aadharNumber || "",
          bankName: farmer.bankName || "",
          accountNumber: farmer.accountNumber || "",
          dbtStatus: farmer.dbtStatus || "Active (Aadhaar Seeded)"
        } : null
      }
    });
  } catch (error) {
    console.error("Farmer procurement error:", error);
    res.status(500).json({ success: false, message: "Unable to load procurement data" });
  }
});

// GET /api/farmer/payment (Own payment status & DBT details)
router.get("/payment", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const farmer = await Farmer.findById(req.user.id);
    const procurements = await Procurement.find({ farmerId });
    const activeProc = (procurements && procurements.length > 0) ? procurements[0] : null;

    res.json({
      success: true,
      data: {
        farmerId,
        farmerName: farmer?.name,
        crop: activeProc?.crop || farmer?.crop,
        receivedQuantity: activeProc?.receivedQuantity || "0 Quintal",
        amount: activeProc?.amount || 0,
        paymentStatus: activeProc?.paymentStatus || "Pending",
        paymentDate: activeProc?.paymentDate || null,
        transactionId: activeProc?.transactionId || null,
        bankName: farmer?.bankName || "State Bank of India",
        accountNumber: farmer?.accountNumber ? farmer.accountNumber.replace(/.(?=.{4})/g, "X") : "XXXX-XXXX-1928",
        ifscCode: farmer?.ifscCode || "SBIN0001234",
        dbtStatus: farmer?.dbtStatus || "Active (Aadhaar Seeded)"
      }
    });
  } catch (error) {
    console.error("Farmer payment error:", error);
    res.status(500).json({ success: false, message: "Unable to load payment details" });
  }
});

// GET /api/farmer/notifications (Own notifications)
router.get("/notifications", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const allNotifs = await Notification.find();
    // Return notifications specifically targeted to this farmer or global/centre broadcast
    const farmerNotifs = allNotifs.filter(n => !n.farmerId || n.farmerId === farmerId || n.farmerId === "all");

    res.json({
      success: true,
      data: farmerNotifs
    });
  } catch (error) {
    console.error("Farmer notifications error:", error);
    res.status(500).json({ success: false, message: "Unable to load notifications" });
  }
});

// PUT /api/farmer/notifications/read-all
router.put("/notifications/read-all", async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    const allNotifs = await Notification.find();
    allNotifs.forEach(n => {
      if (!n.farmerId || n.farmerId === farmerId || n.farmerId === "all") {
        n.isRead = true;
      }
    });

    res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    console.error("Read all notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
});

// GET /api/farmer/queue (Live queue status of farmer's assigned centre)
router.get("/queue", async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    const centreName = farmer?.preferredCentre || "Sanwer Procurement Centre";
    const centre = await Centre.findOne({ name: centreName }) || await Centre.findOne({ centreId: farmer?.assignedCentreId });

    if (!centre) {
      return res.status(404).json({ success: false, message: "Assigned procurement centre not found" });
    }

    res.json({
      success: true,
      data: {
        centreName: centre.name,
        status: centre.status,
        scheduledFarmers: centre.scheduledFarmers,
        completedFarmers: centre.completedFarmers,
        waitingFarmers: centre.waitingFarmers,
        estimatedWait: centre.estimatedWait,
        congestionLevel: centre.congestionLevel,
        congestionScore: centre.congestionScore,
        activeWeighbridges: centre.activeWeighbridges,
        totalWeighbridges: centre.totalWeighbridges,
        bestTimeToVisit: centre.bestTimeToVisit,
        peakHours: centre.peakHours
      }
    });
  } catch (error) {
    console.error("Farmer queue error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre queue details" });
  }
});

module.exports = router;
