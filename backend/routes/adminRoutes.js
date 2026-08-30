const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Notification = require("../models/Notification");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// GET /api/admin/dashboard
router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const totalFarmers = (await Farmer.countDocuments({ role: "farmer" })) || 1248;
    const scheduledToday = (await Procurement.countDocuments({ procurementStatus: "Scheduled" })) || 86;
    const completedProcurement = (await Procurement.countDocuments({ procurementStatus: "Procurement Completed" })) || 52;
    const pendingPayments = (await Procurement.countDocuments({ paymentStatus: "Pending" })) || 17;

    const centres = await Centre.find();

    res.json({
      success: true,
      data: {
        stats: {
          totalFarmers: totalFarmers > 10 ? totalFarmers : 1248,
          todaySchedule: scheduledToday > 5 ? scheduledToday : 86,
          procurementCompleted: completedProcurement > 5 ? completedProcurement : 52,
          pendingPayments: pendingPayments > 3 ? pendingPayments : 17
        },
        centres: centres.length > 0 ? centres : [
          { name: "Sanwer Procurement Centre", scheduledFarmers: 62, completedFarmers: 38, waitingFarmers: 18, status: "Open" },
          { name: "Indore Central Mandi", scheduledFarmers: 74, completedFarmers: 51, waitingFarmers: 12, status: "Open" },
          { name: "Depalpur Krishi Upaj Mandi", scheduledFarmers: 43, completedFarmers: 29, waitingFarmers: 8, status: "Open" }
        ],
        isDemo: true,
        demoNote: "Statistics shown for SIH26032 prototype demonstration"
      }
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ success: false, message: "Unable to load admin dashboard" });
  }
});

// GET /api/admin/farmers
router.get("/farmers", protect, adminOnly, async (req, res) => {
  try {
    const farmers = await Farmer.find({ role: "farmer" });
    const allProcurements = await Procurement.find();

    // Map each farmer with their procurement
    const farmerList = farmers.map(f => {
      const proc = allProcurements.find(p => p.farmerId === f.farmerId) || {
        _id: "demo_p_" + f.farmerId,
        procurementStatus: "Scheduled",
        paymentStatus: "Pending",
        tokenNumber: "TK-" + (1000 + Math.floor(Math.random() * 9000)),
        scheduleDate: "12 September 2026",
        amount: 45000,
        receivedQuantity: "18 Quintal",
        quantity: "18 Quintal"
      };

      return {
        id: f._id,
        farmerId: f.farmerId,
        name: f.name,
        mobile: f.mobile,
        village: f.village,
        district: f.district,
        state: f.state,
        crop: f.crop,
        landArea: f.landArea,
        preferredCentre: f.preferredCentre,
        procurementId: proc._id,
        tokenNumber: proc.tokenNumber,
        scheduleDate: proc.scheduleDate,
        procurementStatus: proc.procurementStatus,
        paymentStatus: proc.paymentStatus,
        quantity: proc.quantity,
        receivedQuantity: proc.receivedQuantity,
        amount: proc.amount,
        paymentDate: proc.paymentDate,
        transactionId: proc.transactionId
      };
    });

    res.json({
      success: true,
      data: farmerList
    });
  } catch (error) {
    console.error("Admin farmers error:", error);
    res.status(500).json({ success: false, message: "Unable to load farmers list" });
  }
});

// PUT /api/admin/procurement/:id
router.put("/procurement/:id", protect, adminOnly, async (req, res) => {
  try {
    const { procurementStatus, paymentStatus, receivedQuantity, amount, paymentDate, transactionId, farmerId } = req.body;

    let proc = await Procurement.findById(req.params.id);
    if (!proc && farmerId) {
      proc = await Procurement.findOne({ farmerId });
    }

    if (!proc) {
      // Create new record if updating by farmer ID
      proc = await Procurement.create({
        farmerId: farmerId || "FMR1001",
        centreId: "Sanwer Procurement Centre",
        crop: "Wheat",
        quantity: "18 Quintal",
        receivedQuantity: receivedQuantity || "18 Quintal",
        tokenNumber: "TK-1042",
        scheduleDate: "12 September 2026",
        procurementStatus: procurementStatus || "Procurement Completed",
        paymentStatus: paymentStatus || "Paid",
        amount: amount || 45000,
        paymentDate: paymentDate || "18 September 2026",
        transactionId: transactionId || "PAY-20260918-1001"
      });
    } else {
      proc = await Procurement.findByIdAndUpdate(
        proc._id,
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
    }

    // Auto-create notification for farmer on status change
    const targetFarmerId = proc ? proc.farmerId : farmerId;
    if (targetFarmerId) {
      if (procurementStatus === "Procurement Completed") {
        await Notification.create({
          farmerId: targetFarmerId,
          title: "Procurement Completed",
          message: `Your ${proc.crop || "crop"} procurement of ${proc.receivedQuantity || "18 Quintal"} has been recorded at ${proc.centreId || "the centre"}.`,
          type: "Procurement"
        });
      }

      if (paymentStatus === "Paid") {
        await Notification.create({
          farmerId: targetFarmerId,
          title: "Payment Processed",
          message: `Payment of ₹${(proc.amount || 45000).toLocaleString("en-IN")} has been credited. Transaction ID: ${proc.transactionId || "PAY-20260918-1001"}.`,
          type: "Payment"
        });
      } else if (paymentStatus === "Processing") {
        await Notification.create({
          farmerId: targetFarmerId,
          title: "Payment Update",
          message: `Your payment of ₹${(proc.amount || 45000).toLocaleString("en-IN")} is currently under verification and bank processing.`,
          type: "Payment"
        });
      }
    }

    res.json({
      success: true,
      message: "Procurement and payment status updated successfully",
      data: proc
    });
  } catch (error) {
    console.error("Admin update procurement error:", error);
    res.status(500).json({ success: false, message: "Failed to update procurement record" });
  }
});

// POST /api/admin/notifications
router.post("/notifications", protect, adminOnly, async (req, res) => {
  try {
    const { title, message, type, farmerId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const notif = await Notification.create({
      farmerId: farmerId || "all",
      title,
      message,
      type: type || "General",
      isRead: false
    });

    res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: notif
    });
  } catch (error) {
    console.error("Admin notification create error:", error);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
});

module.exports = router;
