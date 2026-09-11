const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Notification = require("../models/Notification");
const { JWT_SECRET, authenticateJWT, normalizeRole } = require("../middleware/authMiddleware");

function getRedirectUrlForRole(role) {
  const norm = normalizeRole(role);
  if (norm === "GOVERNMENT_ADMIN") return "admin.html";
  if (norm === "CENTRE_OFFICER") return "centre-officer.html";
  return "dashboard.html";
}

// In-memory OTP registry for farmer registration verification
const registrationOTPs = new Map(); // mobile -> { otp, expiresAt, verified, name }

// POST /api/auth/send-registration-otp
router.post("/send-registration-otp", async (req, res) => {
  try {
    const { mobile, name } = req.body;
    const rawMobile = (mobile || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);

    if (!cleanMobile || cleanMobile.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit Aadhaar-linked mobile number."
      });
    }

    // Check if mobile is already registered
    const existing = await Farmer.findOne({ mobile: cleanMobile });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mobile number ${cleanMobile} is already registered. Please login to your account.`
      });
    }

    // Generate secure 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    registrationOTPs.set(cleanMobile, {
      otp: generatedOtp,
      expiresAt,
      verified: false,
      name: (name || "").trim(),
      attempts: 0
    });

    // Mask mobile for display: e.g. +91 98*****210
    const masked = `+91 ${cleanMobile.slice(0, 2)}*****${cleanMobile.slice(-3)}`;

    // Dispatch via WhatsApp Notification service asynchronously
    try {
      const { sendWhatsAppNotification } = require("../services/metaWhatsAppService");
      const farmerSalutation = name ? `${name} ji` : "Kisan Mitra";
      sendWhatsAppNotification(
        cleanMobile,
        `🌾 *MandiSathi Aadhaar OTP Verification* 🌾\n\nNamaste ${farmerSalutation}!\nYour verification code for MandiSathi portal registration is: *${generatedOtp}*.\n\n⏱️ Valid for 10 minutes.\n🔒 Do not share this OTP with anyone.\n- Department of Food & Civil Supplies`
      ).catch(e => console.warn("WhatsApp OTP dispatch notice:", e.message));
    } catch (dispatchErr) {
      console.warn("WhatsApp dispatch warning:", dispatchErr.message);
    }

    res.json({
      success: true,
      message: `OTP sent successfully to ${masked}`,
      mobile: cleanMobile,
      maskedMobile: masked,
      demoOtp: generatedOtp, // Included for effortless testing and evaluation
      expiresIn: 600
    });
  } catch (error) {
    console.error("send-registration-otp error:", error);
    res.status(500).json({ success: false, message: "Failed to generate OTP. Please try again." });
  }
});

// POST /api/auth/verify-registration-otp
router.post("/verify-registration-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const cleanMobile = (mobile || "").replace(/[^0-9]/g, "").slice(-10);
    const cleanOtp = (otp || "").toString().trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number." });
    }

    if (!cleanOtp || cleanOtp.length < 4) {
      return res.status(400).json({ success: false, message: "Please enter the OTP." });
    }

    const record = registrationOTPs.get(cleanMobile);

    // Universal demo/fallback code "123456" for automated testing and sandbox environments
    const isMasterDemoOtp = cleanOtp === "123456";
    const isStoredOtpMatch = record && record.otp === cleanOtp;

    if (!record && !isMasterDemoOtp) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this mobile number. Please click 'Send OTP' first."
      });
    }

    if (record && Date.now() > record.expiresAt && !isMasterDemoOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please click 'Resend OTP'."
      });
    }

    if (!isMasterDemoOtp && !isStoredOtpMatch) {
      if (record) record.attempts = (record.attempts || 0) + 1;
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check the code and try again."
      });
    }

    // Mark verified
    if (record) {
      record.verified = true;
      record.verifiedAt = Date.now();
      registrationOTPs.set(cleanMobile, record);
    } else {
      registrationOTPs.set(cleanMobile, {
        otp: cleanOtp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: true,
        verifiedAt: Date.now()
      });
    }

    res.json({
      success: true,
      message: "Mobile number successfully verified via Aadhaar OTP!",
      verified: true
    });
  } catch (error) {
    console.error("verify-registration-otp error:", error);
    res.status(500).json({ success: false, message: "OTP verification failed. Please try again." });
  }
});

// POST /api/auth/register (Farmers only)
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
      branchName,
      otp
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

    // Enforce Aadhaar Mobile OTP verification
    const otpRecord = registrationOTPs.get(cleanMobile);
    const cleanOtp = (otp || "").toString().trim();
    const isMasterDemoOtp = cleanOtp === "123456";
    const isOtpMatching = otpRecord && otpRecord.otp === cleanOtp;
    const isPreVerified = otpRecord && otpRecord.verified;

    if (!isPreVerified && !isMasterDemoOtp && !isOtpMatching) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar Mobile OTP verification required. Please verify your mobile number with OTP before completing registration."
      });
    }

    // Clean up OTP record once validated
    registrationOTPs.delete(cleanMobile);

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

    const targetCentre = preferredCentre || "Sanwer Procurement Centre";

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
      preferredCentre: targetCentre,
      assignedCentreId: targetCentre === "Sanwer Procurement Centre" ? "CENTRE_001" : "CENTRE_002",
      assignedCentreName: targetCentre,
      aadharNumber: cleanAadhar || "7894" + Math.floor(10000000 + Math.random() * 90000000),
      isAadharLinked: true,
      bankName: (bankName || "Aadhaar Linked Primary Bank (NPCI/PFMS)").trim(),
      accountNumber: cleanAccount || `Aadhaar-Seeded (${(cleanAadhar || "7894").slice(-4)})`,
      ifscCode: cleanIfsc || "APBS0000001",
      accountHolderName: (accountHolderName || trimmedName).trim(),
      branchName: (branchName || (district ? district + " Branch" : "Aadhaar Seeding Branch")).trim(),
      dbtStatus: "Active (Aadhaar Seeded via NPCI)",
      role: "FARMER",
      isActive: true
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

      // Send Welcome WhatsApp Notification to Farmer's mobile via Meta WhatsApp Cloud API
      const { sendWhatsAppNotification } = require("../services/metaWhatsAppService");
      sendWhatsAppNotification(
        newFarmer.mobile,
        `🌾 *Mandisathi Registration Successful* 🌾\nनमस्ते ${newFarmer.name} जी!\nमंडी साथी (MSP Direct Procurement) पोर्टल पर आपका सफल पंजीकरण हो गया है।\n\n• किसान आईडी: *${newFarmer.farmerId}*\n• ई-टोकन: *${tokenNumber}*\n• उपज: *${newFarmer.crop}*\n• डीबीटी स्थिति: *✓ आधार-सीडेड (NPCI Mapper Active)*\n\nमंडी पहुंचने से पूर्व लाइव कतार स्थिति देखने हेतु इस चैट पर *QUEUE* या *TOKEN* भेजें।\n- खाद्य एवं नागरिक आपूर्ति विभाग`
      ).catch(e => console.warn("WhatsApp welcome dispatch notice:", e.message));
    } catch (createErr) {
      console.warn("Notice: Non-blocking error generating initial token/notifications:", createErr.message);
    }

    const token = jwt.sign(
      { id: newFarmer._id, farmerId: newFarmer.farmerId, role: "FARMER" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const redirectUrl = "dashboard.html";

    res.status(201).json({
      success: true,
      data: {
        token,
        role: "FARMER",
        redirectUrl,
        user: {
          id: newFarmer._id,
          name: newFarmer.name,
          mobile: newFarmer.mobile,
          farmerId: newFarmer.farmerId,
          role: "FARMER",
          preferredCentre: newFarmer.preferredCentre,
          assignedCentreId: newFarmer.assignedCentreId,
          assignedCentreName: newFarmer.assignedCentreName,
          redirectUrl
        },
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
          assignedCentreId: newFarmer.assignedCentreId,
          assignedCentreName: newFarmer.assignedCentreName,
          aadharNumber: newFarmer.aadharNumber || "",
          isAadharLinked: newFarmer.isAadharLinked !== false,
          bankName: newFarmer.bankName || "",
          accountNumber: newFarmer.accountNumber || "",
          ifscCode: newFarmer.ifscCode || "",
          accountHolderName: newFarmer.accountHolderName || newFarmer.name || "",
          branchName: newFarmer.branchName || "",
          dbtStatus: newFarmer.dbtStatus || "Active (Aadhaar Seeded)",
          role: "FARMER"
        }
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error during registration: " + (error.message || "Please try again.") });
  }
});

// POST /api/auth/login (Unified Role-Based Login)
router.post("/login", async (req, res) => {
  try {
    const { mobile, password, portalType } = req.body;

    const rawInput = (mobile || "").trim();
    const cleanPassword = (password || "").trim();

    if (!rawInput || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please provide mobile number and password" });
    }

    const cleanDigits = rawInput.replace(/[^0-9]/g, "").slice(-10);

    // Search by 10-digit mobile, raw input, or Farmer ID / Officer ID / Admin ID
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

    // Check account active status
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account disabled by administrator. Contact Mandi Head Office." });
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

    const userRole = normalizeRole(user.role);

    // Strict portal separation if portalType is specified
    if (portalType === "farmer" && userRole !== "FARMER") {
      return res.status(403).json({
        success: false,
        message: "This portal is strictly for registered Farmers. Centre Officers and Admins please use the Staff/Admin Login."
      });
    }

    if (portalType === "centre_officer" && userRole !== "CENTRE_OFFICER" && userRole !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This login is strictly for Procurement Centre Officers. Farmers please use the Farmer Login."
      });
    }

    if (portalType === "admin" && userRole !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Government Admin privileges required. Centre Officers please use the Centre Officer portal."
      });
    }

    const redirectUrl = getRedirectUrlForRole(userRole);

    const token = jwt.sign(
      {
        id: user._id,
        farmerId: user.farmerId,
        role: userRole,
        assignedCentreId: user.assignedCentreId || null,
        assignedCentreName: user.assignedCentreName || user.preferredCentre || null
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        token,
        role: userRole,
        redirectUrl,
        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          role: userRole,
          assignedCentreId: user.assignedCentreId || null,
          assignedCentreName: user.assignedCentreName || user.preferredCentre || null,
          preferredCentre: user.preferredCentre || null,
          village: user.village || null,
          district: user.district || null,
          crop: user.crop || null,
          redirectUrl
        },
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
          assignedCentreId: user.assignedCentreId || null,
          assignedCentreName: user.assignedCentreName || user.preferredCentre || null,
          aadharNumber: user.aadharNumber || "",
          isAadharLinked: user.isAadharLinked !== false,
          bankName: user.bankName || "",
          accountNumber: user.accountNumber || "",
          ifscCode: user.ifscCode || "",
          accountHolderName: user.accountHolderName || user.name || "",
          branchName: user.branchName || "",
          dbtStatus: user.dbtStatus || "Active (Aadhaar Seeded)",
          role: userRole
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// POST /api/auth/admin-login (Mandi Staff / Officers / Admins only)
router.post("/admin-login", async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const rawInput = (mobile || "").trim();
    const cleanPassword = (password || "").trim();

    if (!rawInput || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please provide Mandi Officer/Admin mobile/ID and password" });
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
      return res.status(401).json({ success: false, message: "Invalid credentials or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account disabled by administrator." });
    }

    const userRole = normalizeRole(user.role);

    // Only CENTRE_OFFICER and GOVERNMENT_ADMIN are allowed here
    if (userRole !== "CENTRE_OFFICER" && userRole !== "GOVERNMENT_ADMIN") {
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
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    const redirectUrl = getRedirectUrlForRole(userRole);

    const token = jwt.sign(
      {
        id: user._id,
        farmerId: user.farmerId,
        role: userRole,
        assignedCentreId: user.assignedCentreId || null,
        assignedCentreName: user.assignedCentreName || user.preferredCentre || null
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        token,
        role: userRole,
        redirectUrl,
        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          role: userRole,
          assignedCentreId: user.assignedCentreId || null,
          assignedCentreName: user.assignedCentreName || user.preferredCentre || null,
          redirectUrl
        },
        farmer: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          role: userRole,
          assignedCentreId: user.assignedCentreId || null,
          assignedCentreName: user.assignedCentreName || user.preferredCentre || null
        }
      }
    });
  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({ success: false, message: "Server error during staff login" });
  }
});

// GET /api/auth/me (Get current authenticated user details)
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const user = await Farmer.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userRole = normalizeRole(user.role);
    const redirectUrl = getRedirectUrlForRole(userRole);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          farmerId: user.farmerId,
          role: userRole,
          assignedCentreId: user.assignedCentreId || null,
          assignedCentreName: user.assignedCentreName || user.preferredCentre || null,
          preferredCentre: user.preferredCentre || null,
          village: user.village || null,
          district: user.district || null,
          state: user.state || null,
          crop: user.crop || null,
          landArea: user.landArea || null,
          bankName: user.bankName || "",
          accountNumber: user.accountNumber || "",
          ifscCode: user.ifscCode || "",
          dbtStatus: user.dbtStatus || "Active",
          redirectUrl
        }
      }
    });
  } catch (error) {
    console.error("Auth /me error:", error);
    res.status(500).json({ success: false, message: "Server error fetching user session" });
  }
});

module.exports = router;
