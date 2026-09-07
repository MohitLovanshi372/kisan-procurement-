/**
 * Mandisathi - Meta WhatsApp Cloud API Service
 * Implements:
 *  - Official Meta WhatsApp Cloud API (Graph API)
 *  - E.164 / Indian phone number normalization
 *  - Incoming message processing & farmer identification against MongoDB
 *  - Standard 6-command multilingual WhatsApp bot menu (English + Hindi)
 *  - WhatsAppMessage collection persistence (incoming & outgoing)
 *  - Safe non-blocking automatic notification dispatch
 */

const WhatsAppMessage = require("../models/WhatsAppMessage");
const Farmer = require("../models/Farmer");
const Procurement = require("../models/Procurement");
const Centre = require("../models/Centre");

// In-memory cache for deduplicating Meta webhook retries (stores wamid for 10 minutes)
const processedMessageIds = new Map();

/**
 * Normalize phone number for Meta WhatsApp Cloud API and MongoDB query
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return { fullMetaNumber: "", clean10: "" };
  const str = String(rawPhone).trim();
  let digits = str.replace(/\D/g, "");

  // Remove leading zeros
  while (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 10-digit Indian number
  const clean10 = digits.slice(-10);

  // Meta Cloud API recipient format: country code + national number (no +)
  let fullMetaNumber = digits;
  if (digits.length === 10) {
    fullMetaNumber = "91" + digits;
  } else if (digits.startsWith("91") && digits.length === 12) {
    fullMetaNumber = digits;
  }

  return { fullMetaNumber, clean10 };
}

/**
 * Check if Meta WhatsApp Cloud API is configured in environment
 */
function isMetaConfigured() {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/**
 * Send WhatsApp Message using official Meta Graph API
 * Endpoint: https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages
 */
async function sendWhatsAppMessage(to, message, farmerId = null) {
  const { fullMetaNumber, clean10 } = normalizePhoneNumber(to);

  if (!fullMetaNumber) {
    console.warn("[Meta WhatsApp] Invalid destination phone number:", to);
    return { success: false, error: "Invalid phone number" };
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // If credentials are not yet configured (e.g. initial setup before user adds secrets)
  if (!phoneNumberId || !accessToken) {
    console.warn(`[Meta WhatsApp Cloud API] Missing credentials in .env (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN). Logging outgoing message.`);
    await WhatsAppMessage.create({
      phoneNumber: fullMetaNumber,
      direction: "outgoing",
      message: message,
      status: "pending",
      farmerId: farmerId || null
    }).catch(err => console.warn("Notice: Error logging WhatsApp message:", err.message));

    return {
      success: false,
      error: "Meta WhatsApp credentials not configured in environment variables",
      simulatedNotice: "Message logged to database. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to dispatch to real WhatsApp."
    };
  }

  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: fullMetaNumber,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resData = await res.json();

    if (res.ok) {
      const messageId = resData.messages?.[0]?.id || null;
      console.log(`[Meta WhatsApp] Outbound message delivered to Meta for ${fullMetaNumber}, ID: ${messageId}`);

      await WhatsAppMessage.create({
        phoneNumber: fullMetaNumber,
        direction: "outgoing",
        message: message,
        status: "sent",
        farmerId: farmerId || null,
        messageId: messageId
      }).catch(err => console.warn("Notice: Error logging WhatsApp message:", err.message));

      return { success: true, data: resData, messageId };
    } else {
      console.error("[Meta WhatsApp Error Response]:", resData);
      const errMsg = resData.error?.message || "Meta WhatsApp API request failed";

      await WhatsAppMessage.create({
        phoneNumber: fullMetaNumber,
        direction: "outgoing",
        message: message,
        status: "failed",
        farmerId: farmerId || null
      }).catch(() => {});

      return { success: false, error: errMsg, details: resData.error };
    }
  } catch (error) {
    console.error("[Meta WhatsApp Cloud API Exception]:", error);
    await WhatsAppMessage.create({
      phoneNumber: fullMetaNumber,
      direction: "outgoing",
      message: message,
      status: "failed",
      farmerId: farmerId || null
    }).catch(() => {});

    return { success: false, error: error.message };
  }
}

/**
 * Reusable notification wrapper for procurement workflows
 */
async function sendWhatsAppNotification(phone, message) {
  try {
    return await sendWhatsAppMessage(phone, message);
  } catch (err) {
    console.warn("[Meta WhatsApp Notification] Non-blocking dispatch notice:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Formulate response based on incoming text and farmer record
 */
async function generateBotReply(rawText, fromPhone) {
  const { clean10 } = normalizePhoneNumber(fromPhone);
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();

  // Search existing Farmer collection using normalized 10-digit mobile
  const farmer = await Farmer.findOne({ mobile: clean10 });

  // If farmer does NOT exist: show registration message without leaking data
  if (!farmer) {
    return {
      farmerId: null,
      replyText: `🌾 *MandiSathi (मंडी साथी) – Kisan Mitra*

Namaste! Aapka mobile number (+91 ${clean10}) MandiSathi portal par registered nahi hai.

Kripya MSP khareed, digital token aur direct DBT bank payment ke liye portal par registration karein:
🌐 https://mandisathi.gov.in/register.html

Registration ke baad aap is number par *TOKEN*, *QUEUE*, ya *STATUS* bhej kar live jaankari prapt kar sakte hain.`
    };
  }

  // Farmer exists: retrieve real MongoDB procurement and centre records
  const proc = await Procurement.findOne({ farmerId: farmer.farmerId });
  const centreName = (proc && proc.centreId) || farmer.preferredCentre || "Sanwer Procurement Centre";
  const centre = (await Centre.findOne({ name: centreName })) || (await Centre.find())[0];

  // 1. GREETING / MAIN MENU
  const greetingKeywords = ["hi", "hello", "namaste", "start", "नमस्ते", "नमस्कार", "शुरू", "हाय", "हेलो", "menu", "मेनू"];
  const isGreeting = greetingKeywords.some(kw => lower === kw || lower.startsWith(kw + " "));

  if (isGreeting || lower === "0") {
    return {
      farmerId: farmer.farmerId,
      replyText: `🌾 MandiSathi – Kisan Procurement Mitra

Namaste ${farmer.name} ji! Aap kya check karna chahte hain?

1️⃣ Token Status
2️⃣ Queue Status
3️⃣ Procurement Status
4️⃣ Payment Status
5️⃣ My Schedule
6️⃣ Help

Reply with a number.`
    };
  }

  // 2. COMMAND 1: TOKEN STATUS (1, Token, Token Status, टोकन)
  if (
    lower === "1" ||
    lower === "token" ||
    lower === "token status" ||
    lower.includes("टोकन") ||
    lower === "my token"
  ) {
    if (!proc || !proc.tokenNumber) {
      return {
        farmerId: farmer.farmerId,
        replyText: "No active procurement token found."
      };
    }

    return {
      farmerId: farmer.farmerId,
      replyText: `🌾 Token Status

Token: ${proc.tokenNumber}
Centre: ${proc.centreId || farmer.preferredCentre}
Date: ${proc.scheduleDate || "Scheduled Date"}
Time: ${proc.startTime || "10:00 AM"} – ${proc.endTime || "11:00 AM"}`
    };
  }

  // 3. COMMAND 2: QUEUE STATUS (2, Queue, Queue Status, क्यू)
  if (
    lower === "2" ||
    lower === "queue" ||
    lower === "queue status" ||
    lower.includes("क्यू") ||
    lower.includes("कतार") ||
    lower.includes("लाइन")
  ) {
    const centreTitle = centre ? centre.name : centreName;
    const waitFarmers = centre ? (centre.waitingFarmers || 18) : 18;
    const queueTractors = centre ? (centre.queueTractors || 10) : 10;
    const waitTime = centre ? (centre.estimatedWait || "30 minutes") : "30 minutes";

    return {
      farmerId: farmer.farmerId,
      replyText: `📍 Centre: ${centreTitle}

👥 Queue: ${waitFarmers} farmers waiting (approx ${queueTractors} tractors)

⏱ Estimated Waiting Time: ${waitTime}

Estimated/Demo queue information`
    };
  }

  // 4. COMMAND 3: PROCUREMENT STATUS (3, Procurement, Procurement Status, Status, स्टेटस, प्रोक्योरमेंट)
  if (
    lower === "3" ||
    lower === "procurement" ||
    lower === "procurement status" ||
    lower === "status" ||
    lower.includes("स्टेटस") ||
    lower.includes("प्रोक्योरमेंट") ||
    lower.includes("प्रगति")
  ) {
    const currentStage = proc ? proc.procurementStatus : "Scheduled";

    return {
      farmerId: farmer.farmerId,
      replyText: `🌾 Procurement Status

Farmer: ${farmer.name} (${farmer.farmerId})
Crop: ${farmer.crop || (proc ? proc.crop : "Wheat")}
Current Stage: ${currentStage}
Centre: ${proc ? proc.centreId : farmer.preferredCentre}`
    };
  }

  // 5. COMMAND 4: PAYMENT STATUS (4, Payment, Payment Status, पेमेंट, भुगतान)
  if (
    lower === "4" ||
    lower === "payment" ||
    lower === "payment status" ||
    lower.includes("पेमेंट") ||
    lower.includes("भुगतान") ||
    lower.includes("dbt")
  ) {
    const amount = proc && proc.amount ? proc.amount : 45000;
    const status = proc ? proc.paymentStatus : "Pending";
    const txnId = proc && proc.transactionId ? proc.transactionId : (status === "Paid" ? "DBT-2026-MP-982104" : null);

    let reply = `💰 Payment Status

Expected Amount: ₹${Number(amount).toLocaleString("en-IN")}
Status: ${status}`;

    if (txnId) {
      reply += `\nTransaction ID: ${txnId}`;
    }

    reply += `\n\n(Demo/Prototype payment information)`;

    return {
      farmerId: farmer.farmerId,
      replyText: reply
    };
  }

  // 6. COMMAND 5: SCHEDULE (5, Schedule, My Schedule, शेड्यूल)
  if (
    lower === "5" ||
    lower === "schedule" ||
    lower === "my schedule" ||
    lower.includes("शेड्यूल") ||
    lower.includes("समय")
  ) {
    const centreVal = proc ? proc.centreId : farmer.preferredCentre;
    const dateVal = proc ? proc.scheduleDate : "12 September 2026";
    const timeVal = proc ? `${proc.startTime} – ${proc.endTime}` : "10:00 AM – 11:00 AM";

    return {
      farmerId: farmer.farmerId,
      replyText: `📅 My Procurement Schedule

Centre:
${centreVal}

Date:
${dateVal}

Time:
${timeVal}`
    };
  }

  // 7. COMMAND 6: HELP (6, Help, मदद)
  if (
    lower === "6" ||
    lower === "help" ||
    lower.includes("मदद") ||
    lower.includes("सहायता") ||
    lower === "commands"
  ) {
    return {
      farmerId: farmer.farmerId,
      replyText: `🌾 MandiSathi Help & Commands

Aap nimnankit commands bhej sakte hain:
1️⃣ Token / टोकन - Check Token Status
2️⃣ Queue / क्यू - Mandi Waiting Queue
3️⃣ Status / स्टेटस - Procurement Stage
4️⃣ Payment / पेमेंट - MSP DBT Payment Status
5️⃣ Schedule / शेड्यूल - Arrival Date & Slot
6️⃣ Help / मदद - Available Options

Main Menu ke liye *Hi* ya *Namaste* reply karein.`
    };
  }

  // Fallback / Unknown input
  return {
    farmerId: farmer.farmerId,
    replyText: `🌾 MandiSathi – Kisan Procurement Mitra

Namaste ${farmer.name} ji! Kripya 1 se 6 tak ka number bhejein:

1️⃣ Token Status
2️⃣ Queue Status
3️⃣ Procurement Status
4️⃣ Payment Status
5️⃣ My Schedule
6️⃣ Help

Ya *Hi* reply karein.`
  };
}

/**
 * Handle incoming message payload from Meta Webhook
 */
async function processIncomingMetaMessage(messageObj) {
  if (!messageObj || !messageObj.from) return;

  const from = messageObj.from;
  const messageId = messageObj.id;

  // Basic duplicate check using wamid
  if (messageId && processedMessageIds.has(messageId)) {
    console.log(`[Meta WhatsApp] Skipping duplicate message ID: ${messageId}`);
    return;
  }
  if (messageId) {
    processedMessageIds.set(messageId, Date.now());
    // Cleanup old keys after 10 minutes
    setTimeout(() => processedMessageIds.delete(messageId), 10 * 60 * 1000);
  }

  // Extract text body
  let text = "";
  if (messageObj.type === "text" && messageObj.text) {
    text = messageObj.text.body;
  } else if (messageObj.type === "interactive" && messageObj.interactive) {
    text = messageObj.interactive.button_reply?.title || messageObj.interactive.list_reply?.title || "";
  } else if (messageObj.type === "button" && messageObj.button) {
    text = messageObj.button.text;
  }

  if (!text) {
    text = "Hi";
  }

  console.log(`[Meta WhatsApp] Received from ${from}: "${text}" (ID: ${messageId})`);

  // Log incoming message in database
  const { fullMetaNumber } = normalizePhoneNumber(from);
  await WhatsAppMessage.create({
    phoneNumber: fullMetaNumber,
    direction: "incoming",
    message: text,
    status: "received",
    messageId: messageId
  }).catch(err => console.warn("Notice: Error logging incoming WhatsApp message:", err.message));

  // Formulate reply according to rules
  const { farmerId, replyText } = await generateBotReply(text, from);

  // Send real reply via Meta WhatsApp Cloud API
  await sendWhatsAppMessage(from, replyText, farmerId);
}

module.exports = {
  normalizePhoneNumber,
  isMetaConfigured,
  sendWhatsAppMessage,
  sendWhatsAppNotification,
  generateBotReply,
  processIncomingMetaMessage
};
