const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");

/**
 * Public Verification API Routes for QR Code Scanning
 * Strictly non-sensitive data returned.
 */

// GET /api/verify/farmer/:farmerId
router.get("/farmer/:farmerId", async (req, res) => {
  try {
    const rawId = req.params.farmerId;
    if (!rawId) {
      return res.status(400).json({ success: false, message: "Farmer ID required" });
    }

    const farmer = await Farmer.findOne({
      $or: [
        { farmerId: rawId },
        { farmerId: rawId.toUpperCase() },
        { _id: rawId }
      ],
      role: { $in: ["FARMER", "farmer"] }
    });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "No verified farmer record found matching ID: " + rawId
      });
    }

    res.json({
      success: true,
      data: {
        entityType: "FARMER",
        farmerId: farmer.farmerId,
        name: farmer.name,
        status: farmer.isActive !== false ? "Active" : "Inactive",
        procurementCentre: farmer.assignedCentreName || farmer.preferredCentre || "Sanwer Procurement Centre",
        village: farmer.village || "Sanwer",
        district: farmer.district || "Indore",
        state: farmer.state || "Madhya Pradesh",
        crop: farmer.crop || "Wheat",
        landArea: farmer.landArea || "4.5 Acres",
        landRecordStatus: farmer.landRecordStatus || "Farmer Provided",
        verificationStatus: "Official MandiSathi Registered Farmer",
        cardGeneratedAt: farmer.cardGeneratedAt || null,
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Public farmer verification error:", error);
    res.status(500).json({ success: false, message: "Verification service temporarily unavailable" });
  }
});

// GET /api/verify/officer/:officerId
router.get("/officer/:officerId", async (req, res) => {
  try {
    const rawId = req.params.officerId;
    if (!rawId) {
      return res.status(400).json({ success: false, message: "Officer ID required" });
    }

    const officer = await Farmer.findOne({
      $or: [
        { farmerId: rawId },
        { farmerId: rawId.toUpperCase() },
        { _id: rawId }
      ],
      role: { $in: ["CENTRE_OFFICER", "centre_officer", "OFFICER", "officer"] }
    });

    if (!officer) {
      return res.status(404).json({
        success: false,
        message: "No verified Procurement Centre Officer record found matching ID: " + rawId
      });
    }

    res.json({
      success: true,
      data: {
        entityType: "CENTRE_OFFICER",
        officerId: officer.farmerId,
        name: officer.name,
        designation: officer.designation || "Procurement Centre Officer",
        assignedCentre: officer.assignedCentreName || officer.preferredCentre || "Sanwer Procurement Centre",
        centreId: officer.assignedCentreId || "CENTRE_001",
        district: officer.district || "Indore",
        state: officer.state || "Madhya Pradesh",
        status: officer.isActive !== false ? "Active" : "Inactive",
        verificationStatus: "Official MandiSathi Authorized Procurement Officer",
        cardGeneratedAt: officer.cardGeneratedAt || null,
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Public officer verification error:", error);
    res.status(500).json({ success: false, message: "Verification service temporarily unavailable" });
  }
});

module.exports = router;
