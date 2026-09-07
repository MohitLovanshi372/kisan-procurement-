const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const whatsAppMessageSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  direction: {
    type: String,
    enum: ["incoming", "outgoing"],
    required: true
  },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["received", "sent", "failed", "delivered", "read", "pending"],
    default: "received"
  },
  farmerId: { type: String, default: null },
  messageId: { type: String, default: null }
});

let MongooseWhatsAppMessage;
try {
  MongooseWhatsAppMessage = mongoose.model("WhatsAppMessage", whatsAppMessageSchema);
} catch (e) {
  MongooseWhatsAppMessage = mongoose.models.WhatsAppMessage;
}

const WhatsAppMessage = {
  schema: whatsAppMessageSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async create(data) {
    if (this.isMongoose()) {
      return await MongooseWhatsAppMessage.create(data);
    }
    const newMsg = {
      _id: "wam_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      status: data.direction === "incoming" ? "received" : "sent",
      ...data
    };
    if (!inMemoryDB.whatsAppMessages) {
      inMemoryDB.whatsAppMessages = [];
    }
    inMemoryDB.whatsAppMessages.unshift(newMsg);
    return newMsg;
  },

  async find(query = {}) {
    if (this.isMongoose()) {
      return await MongooseWhatsAppMessage.find(query).sort({ timestamp: -1 });
    }
    const list = inMemoryDB.whatsAppMessages || [];
    return list.filter(m => {
      for (const key in query) {
        if (m[key] !== query[key]) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  async findOne(query) {
    if (this.isMongoose()) {
      return await MongooseWhatsAppMessage.findOne(query);
    }
    const list = inMemoryDB.whatsAppMessages || [];
    return list.find(m => {
      for (const key in query) {
        if (m[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) {
      return await MongooseWhatsAppMessage.findByIdAndUpdate(id, update, options);
    }
    const list = inMemoryDB.whatsAppMessages || [];
    const idx = list.findIndex(m => String(m._id) === String(id) || m.messageId === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...update };
    return list[idx];
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) {
      return await MongooseWhatsAppMessage.countDocuments(query);
    }
    const list = inMemoryDB.whatsAppMessages || [];
    return list.filter(m => {
      for (const key in query) {
        if (m[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }
};

module.exports = WhatsAppMessage;
