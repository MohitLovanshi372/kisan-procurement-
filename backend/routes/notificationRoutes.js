const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
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
