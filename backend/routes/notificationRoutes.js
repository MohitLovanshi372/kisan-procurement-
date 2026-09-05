const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const Procurement = require("../models/Procurement");
const Farmer = require("../models/Farmer");
const { protect } = require("../middleware/authMiddleware");

// GET /api/notifications
router.get("/", protect, async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    let notifs = await Notification.find({
      $or: [{ farmerId: farmerId }, { farmerId: "all" }]
    });

    if (!notifs || notifs.length === 0) {
      // Create initial notifications if none exist
      await Notification.create({
        farmerId: farmerId,
        title: "Procurement Schedule Confirmed",
        message: "Your procurement slot is confirmed for 12 September 2026 at 10:00 AM.",
        type: "Schedule",
        isRead: false
      });
      await Notification.create({
        farmerId: farmerId,
        title: "Token Generated",
        message: "Your token TK-1042 has been generated successfully.",
        type: "Token",
        isRead: false
      });
      await Notification.create({
        farmerId: farmerId,
        title: "Centre Advisory",
        message: "Sanwer Mandi is operating normally. Please carry original Aadhaar card and land records.",
        type: "General",
        isRead: true
      });
      notifs = await Notification.find({
        $or: [{ farmerId: farmerId }, { farmerId: "all" }]
      });
    }

    res.json({
      success: true,
      data: notifs
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to load notifications" });
  }
});

// POST /api/notifications/simulate-reminder
// Simulates sending an official SMS & WhatsApp procurement reminder to the farmer
router.post("/simulate-reminder", protect, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    const farmerId = farmer ? farmer.farmerId : req.user.farmerId;
    const farmerName = farmer ? farmer.name : (req.user.name || "Farmer");
    const mobile = (req.body && req.body.mobile) || (farmer ? farmer.mobile : "9876543210");
    const channel = (req.body && req.body.channel) || "both"; // "sms" | "whatsapp" | "both"

    // Fetch active procurement for details
    let procurements = await Procurement.find({ farmerId });
    let activeProc = procurements && procurements.length > 0 ? procurements[0] : null;

    const scheduleDate = activeProc ? activeProc.scheduleDate : "12 September 2026";
    const startTime = activeProc ? activeProc.startTime : "10:00 AM";
    const endTime = activeProc ? activeProc.endTime : "11:00 AM";
    const timeSlot = `${startTime} – ${endTime}`;
    const tokenNumber = activeProc ? activeProc.tokenNumber : "TK-1042";
    const centreName = activeProc ? activeProc.centreId : (farmer ? farmer.preferredCentre : "Sanwer Procurement Centre");
    const crop = activeProc ? activeProc.crop : (farmer ? farmer.crop : "Wheat");

    // Compose SMS and WhatsApp templates in English and Hindi
    const smsEn = `[GOV-MSP-KMP] Mandisathi: Dear ${farmerName}, your ${crop} procurement (Token: ${tokenNumber}) is scheduled on ${scheduleDate}, ${timeSlot} at ${centreName}. Carry Aadhaar & Land docs. Helpline: 1800-180-1551.`;
    const smsHi = `[GOV-MSP-KMP] किसान मित्र: प्रिय ${farmerName}, आपकी ${crop} खरीद (टोकन: ${tokenNumber}) ${scheduleDate}, ${timeSlot} पर ${centreName} में निर्धारित है। कृपया आधार कार्ड एवं खसरा साथ लाएं।`;

    const whatsappEn = `🌾 *Mandisathi*\n\n` +
      `Namaste *${farmerName}* ji,\n\n` +
      `Here is your scheduled procurement appointment reminder:\n` +
      `📅 *Date:* ${scheduleDate}\n` +
      `⏰ *Time Slot:* ${timeSlot}\n` +
      `🎫 *Token Number:* ${tokenNumber}\n` +
      `🌾 *Crop:* ${crop}\n` +
      `🏛️ *Procurement Centre:* ${centreName}\n\n` +
      `📋 *Required Documents:* Aadhaar Card, Bank Passbook, Land Revenue Record (Khasra).\n\n` +
      `💡 *Arrival Advisory:* Please arrive promptly during your designated slot for smooth queue processing.\n` +
      `_Toll-free Kisan Helpline: 1800-180-1551_`;

    const whatsappHi = `🌾 *किसान खरीद मित्र*\n\n` +
      `नमस्ते *${farmerName}* जी,\n\n` +
      `आपकी निर्धारित कृषि उपज खरीद का अनुस्मारक:\n` +
      `📅 *दिनांक:* ${scheduleDate}\n` +
      `⏰ *समय स्लॉट:* ${timeSlot}\n` +
      `🎫 *टोकन संख्या:* ${tokenNumber}\n` +
      `🌾 *फसल:* ${crop}\n` +
      `🏛️ *खरीद केंद्र:* ${centreName}\n\n` +
      `📋 *आवश्यक दस्तावेज:* आधार कार्ड, बैंक पासबुक, खसरा खतौनी नकल।\n\n` +
      `💡 *सलाह:* कृपया बिना देरी अपने निर्धारित समय पर पहुंचें।\n` +
      `_किसान हेल्पलाइन: 1800-180-1551_`;

    // Save as an in-app notification record too so the farmer sees the record
    await Notification.create({
      farmerId: farmerId,
      title: channel === "sms" ? "📲 SMS Reminder Dispatched" : channel === "whatsapp" ? "🟢 WhatsApp Reminder Dispatched" : "📲 SMS & WhatsApp Reminder Dispatched",
      message: `Procurement reminder for ${scheduleDate} (${timeSlot}) at ${centreName} simulated for mobile +91 ${mobile}.`,
      type: "Reminder",
      isRead: false
    });

    res.json({
      success: true,
      message: "Mock notification dispatched successfully",
      data: {
        farmerName,
        mobile,
        channel,
        scheduleDate,
        timeSlot,
        tokenNumber,
        centreName,
        crop,
        smsEn,
        smsHi,
        whatsappEn,
        whatsappHi,
        timestamp: new Date().toISOString(),
        gatewayStatus: "Delivered (Gov SMS Gateway)"
      }
    });
  } catch (error) {
    console.error("Reminder simulation error:", error);
    res.status(500).json({ success: false, message: "Unable to simulate notification" });
  }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", protect, async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      data: updated
    });
  } catch (error) {
    console.error("Notification mark read error:", error);
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
});

// PUT /api/notifications/read-all
router.put("/read-all", protect, async (req, res) => {
  try {
    const farmerId = req.user.farmerId;
    await Notification.updateMany(
      { $or: [{ farmerId: farmerId }, { farmerId: "all" }] },
      { isRead: true }
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
});

module.exports = router;
