/**
 * Mandisathi - Meta WhatsApp Cloud API Webhook & Routes
 * Implements:
 *  - GET /webhook: Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
 *  - POST /webhook: Incoming message handler from Meta WhatsApp Cloud API
 *  - GET /status: Non-sensitive integration status
 */

const express = require("express");
const router = express.Router();
const {
  isMetaConfigured,
  processIncomingMetaMessage
} = require("../services/metaWhatsAppService");
const WhatsAppMessage = require("../models/WhatsAppMessage");

/**
 * GET /webhook (Meta Webhook Verification)
 * Called by Meta when configuring webhook in WhatsApp Cloud API App Dashboard
 */
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "mandisathi_meta_verify_token_2026";

  console.log(`[Meta Webhook GET] Verification request received. Mode: ${mode}, Token matched: ${token === expectedToken}`);

  if (mode === "subscribe" && token && token === expectedToken) {
    console.log("✅ Meta Webhook successfully verified! Returning hub.challenge");
    return res.status(200).send(challenge);
  } else {
    console.warn("❌ Meta Webhook verification failed. Token mismatch or missing subscribe mode.");
    return res.status(403).send("Verification token mismatch");
  }
});

/**
 * POST /webhook (Meta Incoming Messages & Statuses)
 * Receives messages and message status updates from Meta WhatsApp Cloud API
 */
router.post("/webhook", async (req, res) => {
  try {
    // 1. Immediately return HTTP 200 to Meta to acknowledge receipt and prevent timeout retries
    res.status(200).send("EVENT_RECEIVED");

    const body = req.body;
    if (!body || body.object !== "whatsapp_business_account") {
      return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // A. Handle incoming user messages
        if (value.messages && Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            await processIncomingMetaMessage(msg).catch(err => {
              console.error("[Meta Webhook Processing Error]:", err);
            });
          }
        }

        // B. Handle delivery & read status callbacks from Meta
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const st of value.statuses) {
            const messageId = st.id;
            const status = st.status; // sent, delivered, read, failed
            if (messageId && status) {
              await WhatsAppMessage.findByIdAndUpdate(messageId, { status }).catch(() => {});
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[Meta Webhook POST Handler Error]:", error);
    // Even on error, response has been returned or can be terminated safely
    if (!res.headersSent) {
      res.status(200).send("EVENT_RECEIVED");
    }
  }
});

/**
 * GET /api/whatsapp/status
 * Public status endpoint showing Meta Cloud API status without exposing secrets
 */
router.get("/status", (req, res) => {
  const isConfigured = isMetaConfigured();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  res.json({
    status: "ok",
    service: "Meta WhatsApp Cloud API (Graph API)",
    configured: isConfigured,
    phoneNumberId: phoneId ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}` : "Not Configured",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v22.0",
    verifyTokenSet: !!process.env.WHATSAPP_VERIFY_TOKEN,
    webhookPaths: ["/webhook", "/api/whatsapp/webhook"],
    freeTierNotice: "Meta WhatsApp Cloud API includes 1,000 free service (user-initiated) conversations per month."
  });
});

module.exports = router;
