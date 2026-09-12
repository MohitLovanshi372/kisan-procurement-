const express = require("express");
const router = express.Router();
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");
const Notification = require("../models/Notification");
const QRCode = require("qrcode");
const { generateCardPdf } = require("../services/cardPdfService");
const { authenticateJWT, authorizeRoles, authorizeCentre } = require("../middleware/authMiddleware");
const { emitToFarmer, emitToAll } = require("../socket");
const { sendWhatsAppNotification } = require("../services/metaWhatsAppService");

// All routes require CENTRE_OFFICER (or GOVERNMENT_ADMIN) role
router.use(authenticateJWT);
router.use(authorizeRoles("CENTRE_OFFICER", "GOVERNMENT_ADMIN"));
router.use(authorizeCentre);

// Helper to resolve officer's assigned centre
async function getOfficerCentre(req) {
  let officer = null;
  try {
    officer = await Farmer.findById(req.user.id);
  } catch (err) {
    console.error("Error finding officer:", err);
  }
  const centreId = req.user.assignedCentreId || officer?.assignedCentreId || null;
  const centreName = req.user.assignedCentreName || officer?.assignedCentreName || officer?.preferredCentre || null;
  return { officer, centreId, centreName };
}

// GET /api/officer/dashboard - stats strictly for officer's assigned centre
router.get("/dashboard", async (req, res) => {
  try {
    const { officer, centreId, centreName } = await getOfficerCentre(req);

    if (!centreId && !centreName) {
      return res.json({
        success: true,
        data: {
          officer: {
            name: officer?.name || req.user.name,
            mobile: officer?.mobile || req.user.mobile,
            officerId: officer?.farmerId || req.user.farmerId,
            role: "CENTRE_OFFICER",
            assignedCentreId: null,
            assignedCentreName: "Unassigned"
          },
          centre: {
            id: null,
            centreId: null,
            name: "No Centre Assigned",
            location: "No Mandi Procurement Centre assigned yet. Please contact Mandi Board Administrator.",
            status: "Inactive",
            workingHours: "N/A",
            activeWeighbridges: 0,
            totalWeighbridges: 0,
            waitingFarmers: 0,
            estimatedWait: "N/A",
            congestionLevel: "N/A"
          },
          stats: {
            centreFarmersCount: 0,
            scheduledToday: 0,
            waitingNow: 0,
            completedProcurement: 0,
            pendingPayments: 0,
            completedPayments: 0,
            totalDisbursed: 0
          }
        },
        message: "No procurement centre assigned to this officer account."
      });
    }

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

    if (!centreId && !centreName) {
      return res.json({
        success: true,
        centre: "Unassigned",
        centreId: null,
        count: 0,
        data: []
      });
    }

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

    if (!centreId && !centreName) {
      return res.json({
        success: true,
        data: {
          centre: null,
          activeTokens: []
        }
      });
    }

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

// GET /api/officer/centre/:centreId - fetch specific centre details (restricted to assigned centre)
router.get("/centre/:centreId", async (req, res) => {
  try {
    const { centreId } = req.params;
    const { centreId: assignedId, centreName: assignedName } = await getOfficerCentre(req);
    const isSuperAdmin = req.user?.role === "GOVERNMENT_ADMIN";

    if (!isSuperAdmin) {
      const target = String(centreId || "").trim().toLowerCase();
      const aId = String(assignedId || "").trim().toLowerCase();
      const aName = String(assignedName || "").trim().toLowerCase();

      if (!aId && !aName) {
        return res.status(403).json({
          success: false,
          message: "Access Denied: You are not assigned to any procurement centre"
        });
      }

      if (target !== aId && target !== aName) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: You are not authorized for procurement centre '${centreId}'`
        });
      }
    }

    let centre = await Centre.findOne({ centreId }) || await Centre.findOne({ name: centreId });
    if (!centre) {
      return res.status(404).json({ success: false, message: "Procurement centre not found" });
    }
    return res.json({ success: true, data: centre });
  } catch (error) {
    console.error("Officer centre fetch error:", error);
    return res.status(500).json({ success: false, message: "Unable to load centre details" });
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

// POST /api/officer/verify-token - verifies token for officer's assigned centre ONLY and issues PASSED GATE PASS
router.post("/verify-token", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const { tokenNumber, qrPayload } = req.body;

    let searchToken = tokenNumber ? String(tokenNumber).trim() : null;
    if (qrPayload) {
      try {
        const parsed = typeof qrPayload === "string" ? JSON.parse(qrPayload) : qrPayload;
        if (parsed?.tokenNumber) {
          searchToken = String(parsed.tokenNumber).trim();
        }
      } catch (e) {
        // Handle raw string payload
        const raw = String(qrPayload).trim();
        // Check if raw contains token like TK-1042 or VER-TK-1042
        const match = raw.match(/TK-\d+/i);
        if (match) {
          searchToken = match[0].toUpperCase();
        } else {
          searchToken = raw;
        }
      }
    }

    if (searchToken) {
      // Strip any VER- prefix or whitespace
      searchToken = searchToken.replace(/^VER-/i, "").trim();
      // If composite like TK-1042-FMR1001, extract token
      const tkMatch = searchToken.match(/TK-\d+/i);
      if (tkMatch) searchToken = tkMatch[0].toUpperCase();
    }

    if (!searchToken) {
      return res.status(400).json({ success: false, message: "Token number or valid QR code is required" });
    }

    let procurement = await Procurement.findOne({ tokenNumber: searchToken });
    if (!procurement) {
      // Try search by farmerId or ID
      procurement = await Procurement.findOne({ farmerId: searchToken });
    }

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
        message: `Access Denied: Token ${searchToken} belongs to '${tokenCentre}'. You are assigned to '${centreName}' and can only issue Gate Passes for your own centre.`
      });
    }

    const farmer = await Farmer.findOne({ farmerId: procurement.farmerId });

    // Official Gate Pass Generation & Verification
    const now = new Date();
    const passedAtStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ", " + now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    if (!procurement.gatePassNumber) {
      procurement.gatePassNumber = `GP-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    }
    procurement.gatePassStatus = "Passed";
    procurement.gatePassPassedAt = procurement.gatePassPassedAt || passedAtStr;
    procurement.assignedGate = procurement.assignedGate || "Gate 1 (Weighbridge Scale 1)";
    procurement.gatePassedByOfficer = req.user?.name || "Centre Officer";

    // Mark status as Arrived if currently Scheduled or Token Generated
    if (procurement.procurementStatus === "Scheduled" || procurement.procurementStatus === "Token Generated") {
      procurement.procurementStatus = "Arrived";
    }

    if (typeof procurement.save === "function") {
      await procurement.save().catch(() => {});
    } else {
      await Procurement.findByIdAndUpdate(procurement._id, {
        gatePassNumber: procurement.gatePassNumber,
        gatePassStatus: "Passed",
        gatePassPassedAt: procurement.gatePassPassedAt,
        assignedGate: procurement.assignedGate,
        gatePassedByOfficer: procurement.gatePassedByOfficer,
        procurementStatus: procurement.procurementStatus
      });
    }

    // Real-time socket alerts to farmer and centre terminals
    const passPayload = {
      tokenNumber: procurement.tokenNumber,
      gatePassNumber: procurement.gatePassNumber,
      gatePassStatus: "Passed",
      gatePassPassedAt: procurement.gatePassPassedAt,
      assignedGate: procurement.assignedGate,
      centre: centreName,
      procurementStatus: procurement.procurementStatus,
      time: now.toISOString()
    };

    emitToFarmer(procurement.farmerId, "gate:pass_passed", passPayload);
    emitToFarmer(procurement.farmerId, "gate:entry_verified", passPayload);
    emitToAll("gate:pass_passed", {
      ...passPayload,
      farmerName: farmer ? farmer.name : "Registered Farmer",
      crop: procurement.crop,
      quantity: procurement.quantity,
      farmerId: procurement.farmerId
    });
    emitToFarmer(procurement.farmerId, "procurement-update", {
      farmerId: procurement.farmerId,
      procurementId: procurement._id,
      tokenNumber: procurement.tokenNumber,
      gatePassNumber: procurement.gatePassNumber,
      procurementStatus: procurement.procurementStatus
    });

    // Create persistent Notification for farmer
    try {
      const notif = await Notification.create({
        farmerId: procurement.farmerId,
        title: "✅ Gate Pass Passed • Entry Authorized",
        message: `Your Gate Pass #${procurement.gatePassNumber} (Token ${procurement.tokenNumber}) has been PASSED by ${centreName} Officer. Vehicle entry authorized for ${procurement.crop} (${procurement.quantity}). Please proceed to ${procurement.assignedGate}.`,
        type: "Procurement"
      });
      emitToFarmer(procurement.farmerId, "notification:new", notif);
    } catch (e) {}

    // Outbound WhatsApp alert
    try {
      if (farmer && farmer.mobile) {
        sendWhatsAppNotification(
          farmer.mobile,
          `🌾 *Gate Pass Passed - Entry Authorized* 🌾\nनमस्ते ${farmer.name} जी!\nआपका गेट पास स्वीकृत कर दिया गया है:\n• गेट पास सं.: *${procurement.gatePassNumber}*\n• टोकन सं.: *${procurement.tokenNumber}*\n• केंद्र: *${centreName}*\n• आवंटित गेट: *${procurement.assignedGate}*\nकृपया अपनी फसल (${procurement.crop} - ${procurement.quantity}) लेकर सीधे धर्मकांटा / तुलाई केंद्र पर जाएं।`
        ).catch(() => {});
      }
    } catch (e) {}

    res.json({
      success: true,
      valid: true,
      passedGatePass: true,
      message: `✅ Gate Pass Passed • Entry Authorized for ${centreName}`,
      gatePassNumber: procurement.gatePassNumber,
      gatePassStatus: "Passed",
      gatePassPassedAt: procurement.gatePassPassedAt,
      assignedGate: procurement.assignedGate,
      officerName: procurement.gatePassedByOfficer,
      centreName: centreName,
      data: {
        procurementId: procurement._id,
        tokenNumber: procurement.tokenNumber,
        gatePassNumber: procurement.gatePassNumber,
        gatePassStatus: "Passed",
        gatePassPassedAt: procurement.gatePassPassedAt,
        assignedGate: procurement.assignedGate,
        farmerName: farmer ? farmer.name : "Registered Farmer",
        farmerMobile: farmer ? farmer.mobile : "N/A",
        farmerVillage: farmer ? (farmer.village || farmer.address || "Local Tehsil") : "Local Tehsil",
        farmerId: procurement.farmerId,
        crop: procurement.crop,
        quantity: procurement.quantity,
        receivedQuantity: procurement.receivedQuantity || procurement.quantity,
        centre: centreName,
        scheduleDate: procurement.scheduleDate,
        timeSlot: `${procurement.startTime || "10:00 AM"} – ${procurement.endTime || "11:00 AM"}`,
        status: procurement.procurementStatus,
        officerName: procurement.gatePassedByOfficer,
        verifiedAt: passedAtStr
      }
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ success: false, message: "Error verifying token and generating gate pass" });
  }
});

// GET /api/officer/passed-gate-passes - list all gate passes passed at this centre
router.get("/passed-gate-passes", async (req, res) => {
  try {
    const { centreId, centreName } = await getOfficerCentre(req);
    const isSuperAdmin = req.user?.role === "GOVERNMENT_ADMIN" || centreName === "All Procurement Centres";

    if (!centreId && !centreName && !isSuperAdmin) {
      return res.json({
        success: true,
        centre: "Unassigned",
        totalPassed: 0,
        data: []
      });
    }

    let procs = await Procurement.find({});

    // Filter for officer's centre (or all if admin)
    procs = procs.filter(p => {
      const match = isSuperAdmin || (p.centreId === centreName || p.centreId === centreId);
      return match && (p.gatePassStatus === "Passed" || p.gatePassNumber || p.procurementStatus === "Arrived" || p.procurementStatus === "Procurement Completed");
    });

    const farmers = await Farmer.find({});
    const farmerMap = new Map(farmers.map(f => [f.farmerId, f]));

    const list = procs.map(p => {
      const f = farmerMap.get(p.farmerId);
      return {
        id: p._id,
        gatePassNumber: p.gatePassNumber || `GP-2026-${String(p._id).slice(-6).toUpperCase()}`,
        tokenNumber: p.tokenNumber,
        farmerId: p.farmerId,
        farmerName: f ? f.name : "Registered Farmer",
        farmerMobile: f ? f.mobile : "N/A",
        farmerVillage: f ? (f.village || f.address || "Local Tehsil") : "Local Tehsil",
        crop: p.crop,
        quantity: p.quantity,
        receivedQuantity: p.receivedQuantity || p.quantity,
        assignedGate: p.assignedGate || "Gate 1 (Weighbridge Scale 1)",
        passedAt: p.gatePassPassedAt || "Today",
        passedTimestamp: p.gatePassPassedAt ? new Date(p.gatePassPassedAt).getTime() : 0,
        status: p.procurementStatus,
        paymentStatus: p.paymentStatus,
        officerName: p.gatePassedByOfficer || "Centre Officer"
      };
    }).sort((a, b) => (b.passedTimestamp || 0) - (a.passedTimestamp || 0));

    res.json({
      success: true,
      centre: centreName,
      totalPassed: list.length,
      data: list
    });
  } catch (error) {
    console.error("Passed gate passes error:", error);
    res.status(500).json({ success: false, message: "Failed to load passed gate passes" });
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

/**
 * PROCUREMENT CENTRE OFFICER DIGITAL ID CARD & PROFILE ENDPOINTS
 */
async function formatOfficerCard(officer, req) {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol || "http";
  const officerId = officer.farmerId || req.user.farmerId || "OFF001";
  const verificationPath = `/verify/officer/${officerId}`;
  const verificationUrl = `${protocol}://${host}${verificationPath}`;

  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: {
        dark: "#065f46",
        light: "#ffffff"
      }
    });
  } catch (qrErr) {
    console.error("Officer QR Code generation error:", qrErr);
  }

  const cleanMobile = officer.mobile ? String(officer.mobile).replace(/[^0-9]/g, "") : "9893011111";
  const maskedMobile = cleanMobile.length >= 4 
    ? "******" + cleanMobile.slice(-4) 
    : "******3210";

  return {
    officerName: officer.name,
    officerId: officerId,
    designation: officer.designation || "Procurement Centre Officer",
    assignedCentre: officer.assignedCentreName || officer.preferredCentre || "Sanwer Procurement Centre",
    centreId: officer.assignedCentreId || "CENTRE_001",
    district: officer.district || "Indore",
    mobileNumber: maskedMobile,
    status: officer.isActive !== false ? "ACTIVE" : "INACTIVE",
    photo: officer.photo || "",
    cardId: officer.cardId || `OFF-CRD-${officerId}`,
    hasGeneratedCard: !!officer.hasGeneratedCard,
    cardGeneratedAt: officer.cardGeneratedAt || null,
    verificationUrl,
    verificationPath,
    qrCodeDataUrl
  };
}

// GET /api/officer/profile - Officer Profile
router.get("/profile", async (req, res) => {
  try {
    const officer = await Farmer.findById(req.user.id);
    if (!officer) {
      return res.status(404).json({ success: false, message: "Officer record not found" });
    }
    res.json({
      success: true,
      data: {
        id: officer._id,
        name: officer.name,
        officerId: officer.farmerId,
        designation: officer.designation || "Procurement Centre Officer",
        mobile: officer.mobile,
        village: officer.village,
        district: officer.district,
        state: officer.state,
        assignedCentreId: officer.assignedCentreId,
        assignedCentreName: officer.assignedCentreName || officer.preferredCentre,
        status: officer.isActive !== false ? "Active" : "Inactive",
        hasGeneratedCard: !!officer.hasGeneratedCard,
        cardGeneratedAt: officer.cardGeneratedAt,
        cardId: officer.cardId
      }
    });
  } catch (err) {
    console.error("Officer profile error:", err);
    res.status(500).json({ success: false, message: "Unable to load officer profile" });
  }
});

// GET /api/officer/card - Authenticated officer ID Card
router.get("/card", async (req, res) => {
  try {
    if (req.user.role !== "CENTRE_OFFICER") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Officer ID Card is available only for Procurement Centre Officers."
      });
    }

    const officer = await Farmer.findById(req.user.id);
    if (!officer) {
      return res.status(404).json({ success: false, message: "Officer record not found" });
    }

    const cardData = await formatOfficerCard(officer, req);
    res.json({ success: true, data: cardData });
  } catch (error) {
    console.error("Officer card fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to load Officer ID Card" });
  }
});

// POST /api/officer/card/generate - Generate Officer ID Card
router.post("/card/generate", async (req, res) => {
  try {
    if (req.user.role !== "CENTRE_OFFICER") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Officer ID Card is available only for Procurement Centre Officers."
      });
    }

    const officer = await Farmer.findById(req.user.id);
    if (!officer) {
      return res.status(404).json({ success: false, message: "Officer record not found" });
    }

    officer.hasGeneratedCard = true;
    officer.cardGeneratedAt = new Date();
    if (!officer.cardId) {
      officer.cardId = `OFF-CRD-${officer.farmerId}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    await officer.save();

    const cardData = await formatOfficerCard(officer, req);
    res.json({
      success: true,
      message: "Officer ID Card generated successfully",
      data: cardData
    });
  } catch (error) {
    console.error("Officer card generate error:", error);
    res.status(500).json({ success: false, message: "Unable to generate Officer ID Card" });
  }
});

// GET /api/officer/card/pdf - Download clean, printer-friendly PDF of Officer ID Card
router.get("/card/pdf", async (req, res) => {
  try {
    if (req.user.role !== "CENTRE_OFFICER" && req.user.role !== "GOVERNMENT_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Officer ID Card is available only for Procurement Centre Officers."
      });
    }

    const officer = await Farmer.findById(req.user.id);
    if (!officer) {
      return res.status(404).json({ success: false, message: "Officer record not found" });
    }

    const cardData = await formatOfficerCard(officer, req);
    const pdfBuffer = await generateCardPdf(cardData, "officer");

    const cleanId = (officer.farmerId || "OFF001").replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `MandiSathi_Officer_Card_${cleanId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("Officer card PDF download error:", error);
    res.status(500).json({ success: false, message: "Unable to generate PDF ID card" });
  }
});

// GET /api/officer/card/:officerId - Strict isolation: officer can ONLY access their own card
router.get("/card/:officerId", async (req, res) => {
  try {
    const requestedId = req.params.officerId;

    // Strict identity check: authenticated Officer's JWT identity
    const isSelf = String(req.user.id) === String(requestedId) || String(req.user.farmerId) === String(requestedId);

    if (!isSelf) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const officer = await Farmer.findById(req.user.id);
    if (!officer) {
      return res.status(404).json({ success: false, message: "Officer record not found" });
    }

    const cardData = await formatOfficerCard(officer, req);
    res.json({ success: true, data: cardData });
  } catch (error) {
    console.error("Officer card fetch by ID error:", error);
    res.status(500).json({ success: false, message: "Unable to load Officer ID Card" });
  }
});

module.exports = router;
