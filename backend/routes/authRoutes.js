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
      preferredCentre
    } = req.body;

    if (!name || !mobile || !password || !village || !district || !state || !crop || !landArea) {
      return res.status(400).json({ success: false, message: "Please fill all required fields" });
    }

    const existingMobile = await Farmer.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({ success: false, message: "Mobile number already registered. Please login." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const generatedFarmerId = farmerId || "FMR" + Math.floor(1000 + Math.random() * 9000);

    const newFarmer = await Farmer.create({
      name,
      mobile,
      password: hashedPassword,
      farmerId: generatedFarmerId,
      village,
      district,
      state,
      crop,
      landArea,
      preferredCentre: preferredCentre || "Sanwer Procurement Centre",
      role: "farmer"
    });

    // Auto-create initial demo procurement schedule and token
    const tokenNumber = "TK-" + Math.floor(1000 + Math.random() * 9000);
    const initialProcurement = await Procurement.create({
      farmerId: newFarmer.farmerId,
      centreId: preferredCentre || "Sanwer Procurement Centre",
      crop: crop,
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

    // Auto-create welcome notification
    await Notification.create({
      farmerId: newFarmer.farmerId,
      title: "Welcome to Kisan Procurement Mitra",
      message: `Registration successful! Your Farmer ID is ${newFarmer.farmerId} and initial token is ${tokenNumber}.`,
      type: "General"
    });

    await Notification.create({
      farmerId: newFarmer.farmerId,
      title: "Procurement Schedule Confirmed",
      message: `Your procurement slot for ${crop} is booked for 15 October 2026 at ${preferredCentre || "Sanwer Procurement Centre"}.`,
      type: "Schedule"
    });

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
          role: newFarmer.role
        }
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ success: false, message: "Please provide mobile number and password" });
    }

    const user = await Farmer.findOne({ mobile });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
    }

    // Support both hashed password comparison and demo plaintext match
    let isMatch = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password" });
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
          role: user.role || "farmer"
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

module.exports = router;
