const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Notification = require("../models/Notification");
const { JWT_SECRET } = require("../middleware/authMiddleware");

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      mobile,
      password,
      village,
      district,
      state,
      farmerId,
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

    const trimmedName = (name || "").trim();
    const rawMobile = (mobile || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10) || rawMobile;
    const cleanPassword = (password || "").trim();
    const cleanAadhar = (aadharNumber || "").replace(/[^0-9]/g, "");
    const cleanAccount = (accountNumber || "").replace(/[^0-9]/g, "");
    const cleanIfsc = (ifscCode || "").trim().toUpperCase();

    if (!trimmedName || !cleanMobile || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please enter your Name, Aadhaar-Linked Mobile Number, and Password." });
    }

    if (cleanMobile.length < 10) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit Aadhaar-linked mobile number." });
    }

    const existingMobile = await Farmer.findOne({ mobile: cleanMobile }) || (rawMobile !== cleanMobile ? await Farmer.findOne({ mobile: rawMobile }) : null);
    if (existingMobile) {
      return res.status(400).json({ success: false, message: `Mobile ${cleanMobile} is already registered. Please use Farmer Login.` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    let generatedFarmerId = (farmerId || "").trim();
    if (!generatedFarmerId) {
      generatedFarmerId = "FMR" + Math.floor(1000 + Math.random() * 9000);
    }
    const existingId = await Farmer.findOne({ farmerId: generatedFarmerId });
    if (existingId) {
      generatedFarmerId = "FMR" + Math.floor(10000 + Math.random() * 90000);
    }

    const newFarmer = await Farmer.create({
      name: trimmedName,
      mobile: cleanMobile,
      password: hashedPassword,
      farmerId: generatedFarmerId,
      village: (village || "Sanwer").trim(),
      district: (district || "Indore").trim(),
      state: (state || "Madhya Pradesh").trim(),
      crop: (crop || "Wheat").trim(),
      landArea: (landArea || "3.5 Acres").trim(),
      preferredCentre: preferredCentre || "Sanwer Procurement Centre",
      aadharNumber: cleanAadhar || "7894" + Math.floor(10000000 + Math.random() * 90000000),
      isAadharLinked: true,
      bankName: (bankName || "Aadhaar Linked Primary Bank (NPCI/PFMS)").trim(),
      accountNumber: cleanAccount || `Aadhaar-Seeded (${(cleanAadhar || "7894").slice(-4)})`,
      ifscCode: cleanIfsc || "APBS0000001",
      accountHolderName: (accountHolderName || trimmedName).trim(),
      branchName: (branchName || (district ? district + " Branch" : "Aadhaar Seeding Branch")).trim(),
      dbtStatus: "Active (Aadhaar Seeded via NPCI)",
      role: "farmer"
    });

    // Auto-create initial demo procurement schedule and token
    const tokenNumber = "TK-" + Math.floor(1000 + Math.random() * 9000);
    try {
      await Procurement.create({
        farmerId: newFarmer.farmerId,
        centreId: newFarmer.preferredCentre || "Sanwer Procurement Centre",
        crop: newFarmer.crop,
        quantity: "15 Quintal",
        receivedQuantity: "0 Quintal",
        tokenNumber: tokenNumber,
        scheduleDate: "15 October 2026",
        startTime: "10:00 AM",
        endTime: "11:00 AM",
        procurementStatus: "Scheduled",
        paymentStatus: "Pending",
        amount: 37500
      });

      // Auto-create welcome notifications
      await Notification.create({
        farmerId: newFarmer.farmerId,
        title: "Welcome to Mandisathi",
        message: `Registration successful! Your Farmer ID is ${newFarmer.farmerId} and initial token is ${tokenNumber}.`,
        type: "General"
      });

      await Notification.create({
        farmerId: newFarmer.farmerId,
        title: "Procurement Schedule Confirmed",
        message: `Your procurement slot for ${newFarmer.crop} is booked for 15 October 2026 at ${newFarmer.preferredCentre}.`,
        type: "Schedule"
      });

      // Send Welcome WhatsApp Notification to Farmer's Aadhaar-linked mobile via Meta WhatsApp Cloud API
      const { sendWhatsAppNotification } = require("../services/metaWhatsAppService");
      sendWhatsAppNotification(
        newFarmer.mobile,
        `🌾 *Mandisathi Registration Successful* 🌾
नमस्ते ${newFarmer.name} जी!
मंडी साथी (MSP Direct Procurement) पोर्टल पर आपका सफल पंजीकरण हो गया है।

• किसान आईडी: *${newFarmer.farmerId}*
• ई-टोकन: *${tokenNumber}*
• उपज: *${newFarmer.crop}*
• डीबीटी स्थिति: *✓ आधार-सीडेड (NPCI Mapper Active)*

मंडी पहुंचने से पूर्व लाइव कतार स्थिति देखने हेतु इस चैट पर *QUEUE* या *TOKEN* भेजें।
- खाद्य एवं नागरिक आपूर्ति विभाग`
      ).catch(e => console.warn("WhatsApp welcome dispatch notice:", e.message));
    } catch (createErr) {
      console.warn("Notice: Non-blocking error generating initial token/notifications:", createErr.message);
    }

    const token = jwt.sign(
      { id: newFarmer._id, farmerId: newFarmer.farmerId, role: newFarmer.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        farmer: {
          id: newFarmer._id,
          name: newFarmer.name,
          mobile: newFarmer.mobile,
          farmerId: newFarmer.farmerId,
          village: newFarmer.village,
          district: newFarmer.district,
          state: newFarmer.state,
          crop: newFarmer.crop,
          landArea: newFarmer.landArea,
          preferredCentre: newFarmer.preferredCentre,
          aadharNumber: newFarmer.aadharNumber || "",
          isAadharLinked: newFarmer.isAadharLinked !== false,
          bankName: newFarmer.bankName || "",
          accountNumber: newFarmer.accountNumber || "",
          ifscCode: newFarmer.ifscCode || "",
          accountHolderName: newFarmer.accountHolderName || newFarmer.name || "",
          branchName: newFarmer.branchName || "",
          dbtStatus: newFarmer.dbtStatus || "Active (Aadhaar Seeded)",
          role: newFarmer.role
        }
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error during registration: " + (error.message || "Please try again.") });
  }
});

// POST /api/auth/login (Farmer / Portal login)
router.post("/login", async (req, res) => {
  try {
    const { mobile, password, portalType } = req.body;

    const rawInput = (mobile || "").trim();
    const cleanPassword = (password || "").trim();

    if (!rawInput || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please provide mobile number and password" });
    }

    const cleanDigits = rawInput.replace(/[^0-9]/g, "").slice(-10);

    // Search by 10-digit mobile, raw input, or Farmer ID / Admin ID
    let user = null;
    if (cleanDigits && cleanDigits.length === 10) {
      user = await Farmer.findOne({ mobile: cleanDigits });
    }
    if (!user) {
      user = await Farmer.findOne({ mobile: rawInput });
    }
    if (!user) {
      user = await Farmer.findOne({ farmerId: rawInput.toUpperCase() }) || await Farmer.findOne({ farmerId: rawInput });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid mobile number / ID or password" });
    }

    // Support both bcrypt hashed password and demo plaintext match
    let isMatch = false;
    if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } else {
      isMatch = (user.password === cleanPassword);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
    }

    // STRICT PORTAL ROLE ENFORCEMENT:
    // If logging into Farmer Portal, reject Admin users!
    if (portalType === "farmer" && user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "This login is only for Farmers. Mandi Officers/Staff please use the Procurement Centre Login."
      });
    }

    // If logging into Admin Portal via this endpoint, reject Farmer users!
    if (portalType === "admin" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This login is strictly for Mandi Officers. Farmers please use Farmer Login."
      });
    }

    const token = jwt.sign(
      { id: user._id, farmerId: user.farmerId, role: user.role || "farmer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        token,
        farmer: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          village: user.village,
          district: user.district,
          state: user.state,
          crop: user.crop,
          landArea: user.landArea,
          preferredCentre: user.preferredCentre,
          aadharNumber: user.aadharNumber || "",
          isAadharLinked: user.isAadharLinked !== false,
          bankName: user.bankName || "",
          accountNumber: user.accountNumber || "",
          ifscCode: user.ifscCode || "",
          accountHolderName: user.accountHolderName || user.name || "",
          branchName: user.branchName || "",
          dbtStatus: user.dbtStatus || "Active (Aadhaar Seeded)",
          role: user.role || "farmer"
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// POST /api/auth/admin-login (Mandi Officers / Admins only)
router.post("/admin-login", async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const rawInput = (mobile || "").trim();
    const cleanPassword = (password || "").trim();

    if (!rawInput || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please provide Mandi Officer mobile/ID and password" });
    }

    const cleanDigits = rawInput.replace(/[^0-9]/g, "").slice(-10);

    let user = null;
    if (cleanDigits && cleanDigits.length === 10) {
      user = await Farmer.findOne({ mobile: cleanDigits });
    }
    if (!user) {
      user = await Farmer.findOne({ mobile: rawInput });
    }
    if (!user) {
      user = await Farmer.findOne({ farmerId: rawInput.toUpperCase() }) || await Farmer.findOne({ farmerId: rawInput });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid officer credentials or password" });
    }

    // STRICT: Only Admin role is permitted here
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This login is strictly for Mandi Officers and Administrative Staff. Farmers please use the Farmer Login."
      });
    }

    let isMatch = false;
    if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } else {
      isMatch = (user.password === cleanPassword);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid password for Mandi Officer" });
    }

    const token = jwt.sign(
      { id: user._id, farmerId: user.farmerId, role: "admin" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        token,
        farmer: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          role: "admin",
          preferredCentre: user.preferredCentre || "Sanwer Procurement Centre"
        }
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success: false, message: "Server error during admin login" });
  }
});

module.exports = router;
