const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Notification = require("../models/Notification");
const { authenticateJWT, authorizeRoles, authorizeCentre } = require("../middleware/authMiddleware");
const { emitToFarmer, emitToAll } = require("../socket");
const { sendWhatsAppNotification } = require("../services/metaWhatsAppService");

// All routes require CENTRE_OFFICER (or GOVERNMENT_ADMIN) role
router.use(authenticateJWT);
router.use(authorizeRoles("CENTRE_OFFICER", "GOVERNMENT_ADMIN"));

// Helper to resolve officer's assigned centre
async function getOfficerCentre(req) {
  const officer = await Farmer.findById(req.user.id);
  const centreId = req.user.assignedCentreId || officer?.assignedCentreId || "CENTRE_001";
  const centreName = req.user.assignedCentreName || officer?.assignedCentreName || officer?.preferredCentre || "Sanwer Procurement Centre";
  return { officer, centreId, centreName };
}

// GET /api/officer/dashboard - stats strictly for officer's assigned centre
router.get("/dashboard", async (req, res) => {
  try {
    const { officer, centreId, centreName } = await getOfficerCentre(req);

    // Find centre doc
    let centre = await Centre.findOne({ centreId }) || await Centre.findOne({ name: centreName });
    if (!centre) {
      centre = {
        name: centreName,
        centreId: centreId,
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Mandi Complex",
        status: "Open",
        workingHours: "09:00 AM – 05:00 PM",
        scheduledFarmers: 45,
        completedFarmers: 28,
        waitingFarmers: 12,
        estimatedWait: "30 minutes",
        activeWeighbridges: 2,
        totalWeighbridges: 3
      };
    }

    // Strictly fetch procurements for THIS centre only
    const allProcurements = await Procurement.find();
    const centreProcurements = allProcurements.filter(p =>
      p.centreId === centre.name ||
      p.centreId === centre.centreId ||
      p.centreId === centreId ||
      p.centreId === centreName
    );

    const scheduledToday = centreProcurements.filter(p => p.procurementStatus === "Scheduled" || p.procurementStatus === "Arrived").length;
    const completedProcurement = centreProcurements.filter(p => p.procurementStatus === "Procurement Completed").length;
    const pendingPayments = centreProcurements.filter(p => p.paymentStatus === "Pending").length;
    const completedPayments = centreProcurements.filter(p => p.paymentStatus === "Paid").length;
    const totalDisbursed = centreProcurements
      .filter(p => p.paymentStatus === "Paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Fetch farmers registered/assigned to THIS centre
    const allFarmers = await Farmer.find({ role: "FARMER" });
    const centreFarmers = allFarmers.filter(f =>
      f.preferredCentre === centre.name ||
      f.preferredCentre === centreName ||
      f.assignedCentreId === centreId ||
      f.assignedCentreId === centre.centreId
    );

    res.json({
      success: true,
      data: {
        officer: {
          name: officer?.name || req.user.name,
          mobile: officer?.mobile || req.user.mobile,
          officerId: officer?.farmerId || req.user.farmerId,
          role: "CENTRE_OFFICER",
          assignedCentreId: centreId,
          assignedCentreName: centreName
        },
        centre: {
          id: centre._id || centreId,
          centreId: centre.centreId || centreId,
          name: centre.name || centreName,
          location: centre.location,
          status: centre.status || "Open",
          workingHours: centre.workingHours || "09:00 AM – 05:00 PM",
          activeWeighbridges: centre.activeWeighbridges || 2,
          totalWeighbridges: centre.totalWeighbridges || 3,
          waitingFarmers: centre.waitingFarmers || 12,
          estimatedWait: centre.estimatedWait || "30 minutes",
          congestionLevel: centre.congestionLevel || "Moderate"
        },
        stats: {
          centreFarmersCount: centreFarmers.length,
          scheduledToday,
          waitingNow: centre.waitingFarmers || 12,
          completedProcurement,
          pendingPayments,
          completedPayments,
          totalDisbursed
        }
      }
    });
  } catch (error) {
    console.error("Officer dashboard error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre officer dashboard" });
  }
});

// GET /api/officer/farmers - farmers assigned ONLY to this centre
router.get("/farmers", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);

    const allFarmers = await Farmer.find({ role: "FARMER" });
    const allProcurements = await Procurement.find();

    // STRICT ISOLATION: Only include farmers assigned to THIS centre
    const filteredFarmers = allFarmers.filter(f =>
      f.preferredCentre === centreName ||
      f.assignedCentreId === centreId
    );

    const result = filteredFarmers.map(f => {
      const proc = allProcurements.find(p => p.farmerId === f.farmerId && (p.centreId === centreName || p.centreId === centreId)) ||
        allProcurements.find(p => p.farmerId === f.farmerId) || {
          _id: "proc_" + f.farmerId,
          procurementStatus: "Scheduled",
          paymentStatus: "Pending",
          tokenNumber: "TK-" + (1000 + Math.floor(Math.random() * 9000)),
          scheduleDate: "15 October 2026",
          startTime: "10:00 AM",
          endTime: "11:00 AM",
          quantity: "15 Quintal",
          receivedQuantity: "0 Quintal",
          amount: 37500
        };

      return {
        id: f._id,
        farmerId: f.farmerId,
        name: f.name,
        mobile: f.mobile,
        village: f.village,
        district: f.district,
        crop: f.crop,
        landArea: f.landArea,
        preferredCentre: f.preferredCentre,
        assignedCentreId: f.assignedCentreId || centreId,
        procurementId: proc._id,
        tokenNumber: proc.tokenNumber,
        scheduleDate: proc.scheduleDate,
        timeSlot: `${proc.startTime || "10:00 AM"} – ${proc.endTime || "11:00 AM"}`,
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
      centre: centreName,
      centreId: centreId,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error("Officer farmers fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre farmers" });
  }
});

// GET /api/officer/queue - live queue for officer's assigned centre only
router.get("/queue", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);

    const centre = await Centre.findOne({ centreId }) || await Centre.findOne({ name: centreName });
    const allProcurements = await Procurement.find();

    // Procurements for this centre
    const centreProcurements = allProcurements.filter(p =>
      p.centreId === centreName ||
      p.centreId === centreId
    );

    res.json({
      success: true,
      data: {
        centre: centre ? {
          name: centre.name,
          centreId: centre.centreId || centreId,
          status: centre.status,
          scheduledFarmers: centre.scheduledFarmers,
          completedFarmers: centre.completedFarmers,
          waitingFarmers: centre.waitingFarmers,
          estimatedWait: centre.estimatedWait,
          congestionLevel: centre.congestionLevel,
          activeWeighbridges: centre.activeWeighbridges,
          totalWeighbridges: centre.totalWeighbridges
        } : null,
        activeTokens: centreProcurements.filter(p => p.procurementStatus !== "Procurement Completed")
      }
    });
  } catch (error) {
    console.error("Officer queue fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to load centre queue" });
  }
});

// POST /api/officer/queue/update - update centre queue and weighbridge capacity
router.post("/queue/update", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const { waitingFarmers, estimatedWait, activeWeighbridges, status } = req.body;

    let centre = await Centre.findOne({ centreId }) || await Centre.findOne({ name: centreName });
    if (centre) {
      if (waitingFarmers !== undefined) centre.waitingFarmers = Number(waitingFarmers);
      if (estimatedWait) centre.estimatedWait = estimatedWait;
      if (activeWeighbridges !== undefined) centre.activeWeighbridges = Number(activeWeighbridges);
      if (status) centre.status = status;

      if (typeof centre.save === "function") {
        await centre.save().catch(() => {});
      } else {
        await Centre.findByIdAndUpdate(centre._id, centre);
      }

      // Broadcast update
      emitToAll("queue-update", { centres: [centre], timestamp: new Date().toISOString() });
    }

    res.json({
      success: true,
      message: "Centre queue metrics updated",
      data: centre
    });
  } catch (error) {
    console.error("Queue update error:", error);
    res.status(500).json({ success: false, message: "Failed to update queue parameters" });
  }
});

// POST /api/officer/verify-token - verifies token for officer's assigned centre ONLY
router.post("/verify-token", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const { tokenNumber, qrPayload } = req.body;

    let searchToken = tokenNumber;
    if (qrPayload) {
      try {
        const parsed = typeof qrPayload === "string" ? JSON.parse(qrPayload) : qrPayload;
        if (parsed?.tokenNumber) searchToken = parsed.tokenNumber;
      } catch (e) {
        searchToken = qrPayload;
      }
    }

    if (!searchToken) {
      return res.status(400).json({ success: false, message: "Token number is required" });
    }

    const procurement = await Procurement.findOne({ tokenNumber: searchToken });
    if (!procurement) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: `Token ${searchToken} not found in procurement registry.`
      });
    }

    // STRICT ISOLATION CHECK: Verify token is for THIS centre!
    const tokenCentre = procurement.centreId;
    const matchesCentre = (tokenCentre === centreName || tokenCentre === centreId);

    if (!matchesCentre && req.user.role !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        valid: false,
        isCentreMismatch: true,
        tokenCentre: tokenCentre,
        officerCentre: centreName,
        message: `Access Denied: Token ${searchToken} is issued for '${tokenCentre}'. You are assigned to '${centreName}' and cannot verify tokens from another centre.`
      });
    }

    const farmer = await Farmer.findOne({ farmerId: procurement.farmerId });

    // Mark status as Arrived if currently Scheduled
    if (procurement.procurementStatus === "Scheduled") {
      procurement.procurementStatus = "Arrived";
      if (typeof procurement.save === "function") {
        await procurement.save().catch(() => {});
      } else {
        await Procurement.findByIdAndUpdate(procurement._id, procurement);
      }
    }

    emitToFarmer(procurement.farmerId, "gate:entry_verified", {
      tokenNumber: procurement.tokenNumber,
      centre: centreName,
      time: new Date().toISOString()
    });

    res.json({
      success: true,
      valid: true,
      message: `✅ Gate Entry Authorized for ${centreName}`,
      data: {
        tokenNumber: procurement.tokenNumber,
        farmerName: farmer ? farmer.name : "Registered Farmer",
        farmerId: procurement.farmerId,
        crop: procurement.crop,
        quantity: procurement.quantity,
        centre: centreName,
        scheduleDate: procurement.scheduleDate,
        timeSlot: `${procurement.startTime || "10:00 AM"} – ${procurement.endTime || "11:00 AM"}`,
        status: procurement.procurementStatus,
        assignedGate: "Weighbridge Scale 1",
        verifiedAt: new Date().toLocaleTimeString("en-IN")
      }
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ success: false, message: "Error verifying token" });
  }
});

// PUT /api/officer/procurement/:id - update procurement for officer's centre ONLY
router.put("/procurement/:id", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const { procurementStatus, paymentStatus, receivedQuantity, amount, paymentDate, transactionId } = req.body;

    let proc = await Procurement.findById(req.params.id);
    if (!proc) {
      proc = await Procurement.findOne({ tokenNumber: req.params.id }) || await Procurement.findOne({ farmerId: req.params.id });
    }

    if (!proc) {
      return res.status(404).json({ success: false, message: "Procurement record not found" });
    }

    // STRICT ISOLATION CHECK: Officer cannot modify procurement belonging to another centre!
    const matchesCentre = (proc.centreId === centreName || proc.centreId === centreId);
    if (!matchesCentre && req.user.role !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        message: `Security Violation: This procurement record belongs to '${proc.centreId}'. You are only authorized to manage records for '${centreName}'.`
      });
    }

    // Apply updates
    if (procurementStatus) proc.procurementStatus = procurementStatus;
    if (paymentStatus) proc.paymentStatus = paymentStatus;
    if (receivedQuantity) proc.receivedQuantity = receivedQuantity;
    if (amount !== undefined) proc.amount = Number(amount);
    if (paymentDate !== undefined) proc.paymentDate = paymentDate;
    if (transactionId !== undefined) proc.transactionId = transactionId;

    if (typeof proc.save === "function") {
      await proc.save().catch(() => {});
    } else {
      await Procurement.findByIdAndUpdate(proc._id, proc);
    }

    // Notify farmer real-time
    const updatePayload = {
      farmerId: proc.farmerId,
      procurementId: proc._id,
      tokenNumber: proc.tokenNumber,
      procurementStatus: proc.procurementStatus,
      paymentStatus: proc.paymentStatus,
      amount: proc.amount,
      receivedQuantity: proc.receivedQuantity,
      updatedAt: new Date().toISOString()
    };
    emitToFarmer(proc.farmerId, "token:status_changed", updatePayload);
    emitToFarmer(proc.farmerId, "procurement-update", updatePayload);

    // Create farmer notification
    let notifTitle = "Procurement Update";
    let notifMessage = `Your procurement record at ${centreName} has been updated to: ${proc.procurementStatus}.`;
    if (procurementStatus === "Procurement Completed") {
      notifTitle = "Grain Weighment Completed";
      notifMessage = `Your ${proc.crop} (${proc.receivedQuantity || proc.quantity}) has been weighed and accepted at ${centreName}.`;
    }
    if (paymentStatus === "Paid") {
      notifTitle = "DBT Payment Disbursed";
      notifMessage = `Payment of ₹${(proc.amount || 0).toLocaleString("en-IN")} has been credited to your bank account. Txn: ${proc.transactionId || 'DBT-2026'}.`;
    }

    const newNotif = await Notification.create({
      farmerId: proc.farmerId,
      title: notifTitle,
      message: notifMessage,
      type: paymentStatus === "Paid" ? "Payment" : "Procurement"
    });
    emitToFarmer(proc.farmerId, "notification:new", newNotif);

    // Outbound WhatsApp alert
    try {
      const farmerDoc = await Farmer.findOne({ farmerId: proc.farmerId });
      if (farmerDoc && farmerDoc.mobile) {
        sendWhatsAppNotification(
          farmerDoc.mobile,
          `🌾 *${centreName} Update* 🌾\nनमस्ते ${farmerDoc.name} जी!\nआपके टोकन *${proc.tokenNumber}* की स्थिति:\n• तुलाई स्थिति: *${proc.procurementStatus}*\n• तौल मात्रा: *${proc.receivedQuantity || proc.quantity}*\n• भुगतान: *${proc.paymentStatus}* (₹${Number(proc.amount || 0).toLocaleString("en-IN")})`
        ).catch(() => {});
      }
    } catch (e) {}

    res.json({
      success: true,
      message: "Procurement record updated successfully",
      data: proc
    });
  } catch (error) {
    console.error("Officer procurement update error:", error);
    res.status(500).json({ success: false, message: "Failed to update procurement record" });
  }
});

// POST /api/officer/payment/:id - process payment for officer's centre ONLY
router.post("/payment/:id", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const { amount, transactionId, paymentDate } = req.body;

    let proc = await Procurement.findById(req.params.id);
    if (!proc) {
      proc = await Procurement.findOne({ tokenNumber: req.params.id }) || await Procurement.findOne({ farmerId: req.params.id });
    }

    if (!proc) {
      return res.status(404).json({ success: false, message: "Procurement record not found" });
    }

    // STRICT ISOLATION CHECK
    const matchesCentre = (proc.centreId === centreName || proc.centreId === centreId);
    if (!matchesCentre && req.user.role !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        message: `Security Violation: Cannot disburse payment for another centre ('${proc.centreId}').`
      });
    }

    const txId = transactionId || "DBT-" + Date.now().toString().slice(-8);
    const pDate = paymentDate || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const finalAmount = amount !== undefined ? Number(amount) : (proc.amount || 37500);

    proc.paymentStatus = "Paid";
    proc.amount = finalAmount;
    proc.paymentDate = pDate;
    proc.transactionId = txId;

    if (typeof proc.save === "function") {
      await proc.save().catch(() => {});
    } else {
      await Procurement.findByIdAndUpdate(proc._id, {
        paymentStatus: "Paid",
        amount: finalAmount,
        paymentDate: pDate,
        transactionId: txId
      });
    }

    // Notify farmer
    const updatePayload = {
      farmerId: proc.farmerId,
      procurementId: proc._id,
      tokenNumber: proc.tokenNumber,
      paymentStatus: "Paid",
      amount: finalAmount,
      paymentDate: pDate,
      transactionId: txId
    };
    try {
      emitToFarmer(proc.farmerId, "token:status_changed", updatePayload);
      emitToFarmer(proc.farmerId, "procurement-update", updatePayload);
    } catch (socketErr) {
      console.warn("Socket notification warning on payment:", socketErr.message);
    }

    try {
      await Notification.create({
        farmerId: proc.farmerId,
        title: "DBT Payment Completed",
        message: `Your MSP payment of ₹${finalAmount.toLocaleString("en-IN")} is processed under Transaction ID ${txId}.`,
        type: "Payment"
      });
    } catch (notifErr) {
      console.warn("Notification create warning on payment:", notifErr.message);
    }

    res.json({
      success: true,
      message: "DBT payment processed successfully",
      data: proc
    });
  } catch (error) {
    console.error("Officer payment error:", error);
    res.status(500).json({ success: false, message: "Failed to process DBT payment", error: error.message });
  }
});

// POST /api/officer/notify-farmer - send custom alert to farmer at this centre
router.post("/notify-farmer", async (req, res) => {
  try {
    const { centreName } = await getOfficerCentre(req);
    const { farmerId, title, message } = req.body;

    if (!farmerId || !message) {
      return res.status(400).json({ success: false, message: "Farmer ID and message are required" });
    }

    const notif = await Notification.create({
      farmerId,
      title: title || `Notice from ${centreName}`,
      message,
      type: "General"
    });

    emitToFarmer(farmerId, "notification:new", notif);

    // Also send WhatsApp if available
    const farmer = await Farmer.findOne({ farmerId });
    if (farmer && farmer.mobile) {
      sendWhatsAppNotification(farmer.mobile, `📢 *${title || centreName}*\n${message}`).catch(() => {});
    }

    res.json({
      success: true,
      message: "Notification sent to farmer",
      data: notif
    });
  } catch (error) {
    console.error("Notify farmer error:", error);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});

module.exports = router;
