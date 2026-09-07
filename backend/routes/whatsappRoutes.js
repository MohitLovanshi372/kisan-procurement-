/**
 * MandiSathi - Meta WhatsApp Cloud API Webhook & Routes
 *
 * GET  /webhook  -> Meta webhook verification
 * POST /webhook  -> Incoming WhatsApp messages/statuses
 * GET  /status   -> WhatsApp integration status
 */

const express = require("express");
const router = express.Router();

const {
  isMetaConfigured,
  processIncomingMetaMessage
} = require("../services/metaWhatsAppService");

const WhatsAppMessage = require("../models/WhatsAppMessage");

/* =========================================================
   META WHATSAPP WEBHOOK VERIFICATION
   ========================================================= */

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // IMPORTANT:
  // Verify token comes ONLY from Render Environment Variables.
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  const tokenMatched =
    Boolean(token) &&
    Boolean(expectedToken) &&
    token === expectedToken;

  // SAFE DEBUG LOG
  // Never print the actual token.
  console.log("[Meta Webhook GET] Verification request:", {
    mode: mode || null,
    challengeReceived: Boolean(challenge),

    receivedTokenSet: Boolean(token),
    receivedTokenLength: token ? token.length : 0,

    configuredTokenSet: Boolean(expectedToken),
    configuredTokenLength: expectedToken
      ? expectedToken.length
      : 0,

    tokenMatched
  });

  // Meta verification
  if (
    mode === "subscribe" &&
    tokenMatched &&
    challenge
  ) {
    console.log("========================================");
    console.log("✅ META WEBHOOK VERIFIED SUCCESSFULLY");
    console.log("========================================");

    return res.status(200).send(challenge);
  }

  console.log("========================================");
  console.log("❌ META WEBHOOK VERIFICATION FAILED");
  console.log("========================================");

  return res
    .status(403)
    .send("Verification token mismatch");
});


/* =========================================================
   META WHATSAPP INCOMING WEBHOOK
   ========================================================= */

router.post("/webhook", async (req, res) => {
  try {
    /*
      IMPORTANT:
      Immediately acknowledge Meta with HTTP 200.
    */

    res.status(200).send("EVENT_RECEIVED");

    const body = req.body;

    if (
      !body ||
      body.object !== "whatsapp_business_account"
    ) {
      console.log(
        "[Meta Webhook POST] Ignored non-WhatsApp event"
      );
      return;
    }

    const entries = Array.isArray(body.entry)
      ? body.entry
      : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : [];

      for (const change of changes) {
        const value = change.value;

        if (!value) {
          continue;
        }

        /* -----------------------------------------------
           INCOMING USER MESSAGES
           ----------------------------------------------- */

        if (
          Array.isArray(value.messages) &&
          value.messages.length > 0
        ) {
          for (const msg of value.messages) {
            try {
              await processIncomingMetaMessage(msg);

              console.log(
                "[Meta Webhook] Incoming message processed:",
                msg.id || "unknown"
              );
            } catch (error) {
              console.error(
                "[Meta Webhook Processing Error]:",
                error
              );
            }
          }
        }

        /* -----------------------------------------------
           MESSAGE STATUS UPDATES
           sent / delivered / read / failed
           ----------------------------------------------- */

        if (
          Array.isArray(value.statuses) &&
          value.statuses.length > 0
        ) {
          for (const statusObject of value.statuses) {
            const messageId = statusObject.id;
            const status = statusObject.status;

            if (!messageId || !status) {
              continue;
            }

            try {
              await WhatsAppMessage.findByIdAndUpdate(
                messageId,
                {
                  status: status
                }
              );

              console.log(
                `[Meta Webhook] Message ${messageId} status: ${status}`
              );
            } catch (error) {
              console.error(
                "[Meta Webhook Status Update Error]:",
                error
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "[Meta Webhook POST Handler Error]:",
      error
    );

    /*
      Meta already received 200 above.
      Do not send another response.
    */
  }
});


/* =========================================================
   WHATSAPP STATUS
   ========================================================= */

const getWhatsAppStatus = (req, res) => {
  const configured = isMetaConfigured();

  const phoneId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  const apiVersion =
    process.env.WHATSAPP_API_VERSION;

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN;

  res.json({
    status: "ok",

    service:
      "Meta WhatsApp Cloud API (Graph API)",

    configured,

    phoneNumberId: phoneId
      ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}`
      : "Not Configured",

    apiVersion:
      apiVersion || "Not Configured",

    verifyTokenSet:
      Boolean(verifyToken),

    webhookUrl:
      "https://kisan-procurement.onrender.com/webhook",

    message:
      "Meta WhatsApp Cloud API integration is configured securely."
  });
};


/* =========================================================
   STATUS ROUTES
   ========================================================= */

// /api/whatsapp/status
router.get(
  "/api/whatsapp/status",
  getWhatsAppStatus
);

// /status
router.get(
  "/status",
  getWhatsAppStatus
);


/* =========================================================
   EXPORT
   ========================================================= */

module.exports = router;