const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");
const { protect } = require("../middleware/authMiddleware");

// GET /api/farmers/profile
router.get("/profile", protect, async (req, res) => {
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

// PUT /api/farmers/profile
router.put("/profile", protect, async (req, res) => {
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
        ...(preferredCentre && { preferredCentre }),
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

module.exports = router;
