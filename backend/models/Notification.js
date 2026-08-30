const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const notificationSchema = new mongoose.Schema({
  farmerId: { type: String, required: true }, // or 'all'
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ["Schedule", "Token", "Procurement", "Payment", "General"],
    default: "General"
  },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

let MongooseNotification;
try {
  MongooseNotification = mongoose.model("Notification", notificationSchema);
} catch (e) {
  MongooseNotification = mongoose.models.Notification;
}

const Notification = {
  schema: notificationSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async find(query = {}) {
    if (this.isMongoose()) return await MongooseNotification.find(query).sort({ createdAt: -1 });
    return inMemoryDB.notifications.filter(n => {
      for (const key in query) {
        if (n[key] !== query[key]) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseNotification.findById(id);
    return inMemoryDB.notifications.find(n => String(n._id) === String(id)) || null;
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseNotification.create(data);
    const newNotif = {
      _id: "notif_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      isRead: false,
      ...data
    };
    inMemoryDB.notifications.push(newNotif);
    return newNotif;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) return await MongooseNotification.findByIdAndUpdate(id, update, options);
    const idx = inMemoryDB.notifications.findIndex(n => String(n._id) === String(id));
    if (idx === -1) return null;
    inMemoryDB.notifications[idx] = { ...inMemoryDB.notifications[idx], ...update };
    return inMemoryDB.notifications[idx];
  },

  async updateMany(query, update) {
    if (this.isMongoose()) return await MongooseNotification.updateMany(query, update);
    inMemoryDB.notifications.forEach(n => {
      let match = true;
      for (const key in query) {
        if (n[key] !== query[key]) {
          match = false;
          break;
        }
      }
      if (match) Object.assign(n, update);
    });
    return { acknowledged: true };
  }
};

module.exports = Notification;
