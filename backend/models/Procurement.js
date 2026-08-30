const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const procurementSchema = new mongoose.Schema({
  farmerId: { type: String, required: true },
  centreId: { type: String, required: true },
  crop: { type: String, required: true },
  quantity: { type: String, required: true },
  receivedQuantity: { type: String, default: "0 Quintal" },
  tokenNumber: { type: String, required: true },
  scheduleDate: { type: String, required: true },
  startTime: { type: String, default: "10:00 AM" },
  endTime: { type: String, default: "11:00 AM" },
  procurementStatus: {
    type: String,
    enum: ["Registration", "Token Generated", "Scheduled", "Arrived", "Procurement Completed", "Cancelled"],
    default: "Scheduled"
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Processing", "Paid"],
    default: "Pending"
  },
  amount: { type: Number, default: 0 },
  paymentDate: { type: String, default: null },
  transactionId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

let MongooseProcurement;
try {
  MongooseProcurement = mongoose.model("Procurement", procurementSchema);
} catch (e) {
  MongooseProcurement = mongoose.models.Procurement;
}

const Procurement = {
  schema: procurementSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async find(query = {}) {
    if (this.isMongoose()) return await MongooseProcurement.find(query);
    return inMemoryDB.procurements.filter(p => {
      for (const key in query) {
        if (p[key] !== query[key]) return false;
      }
      return true;
    });
  },

  async findOne(query) {
    if (this.isMongoose()) return await MongooseProcurement.findOne(query);
    return inMemoryDB.procurements.find(p => {
      for (const key in query) {
        if (p[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseProcurement.findById(id);
    return inMemoryDB.procurements.find(p => String(p._id) === String(id)) || null;
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseProcurement.create(data);
    const newProc = {
      _id: "prc_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      ...data
    };
    inMemoryDB.procurements.push(newProc);
    return newProc;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) return await MongooseProcurement.findByIdAndUpdate(id, update, options);
    const idx = inMemoryDB.procurements.findIndex(p => String(p._id) === String(id));
    if (idx === -1) return null;
    inMemoryDB.procurements[idx] = { ...inMemoryDB.procurements[idx], ...update };
    return inMemoryDB.procurements[idx];
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) return await MongooseProcurement.countDocuments(query);
    return (await this.find(query)).length;
  }
};

module.exports = Procurement;
