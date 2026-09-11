const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const centreSchema = new mongoose.Schema({
  centreId: { type: String, default: null },
  name: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  location: { type: String, required: true },
  workingHours: { type: String, default: "09:00 AM – 05:00 PM" },
  status: { type: String, enum: ["Open", "Closed", "Crowded"], default: "Open" },
  scheduledFarmers: { type: Number, default: 0 },
  completedFarmers: { type: Number, default: 0 },
  waitingFarmers: { type: Number, default: 0 },
  estimatedWait: { type: String, default: "30 minutes" },
  congestionLevel: { type: String, enum: ["Low Traffic", "Moderate", "Heavy"], default: "Moderate" },
  congestionScore: { type: Number, default: 50 }, // 0 - 100 percentage
  queueTractors: { type: Number, default: 10 },
  activeWeighbridges: { type: Number, default: 2 },
  totalWeighbridges: { type: Number, default: 3 },
  trend: { type: String, enum: ["Easing", "Stable", "Rising"], default: "Stable" },
  bestTimeToVisit: { type: String, default: "02:00 PM – 04:00 PM" },
  peakHours: { type: String, default: "11:00 AM – 01:30 PM" },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

let MongooseCentre;
try {
  MongooseCentre = mongoose.model("Centre", centreSchema);
} catch (e) {
  MongooseCentre = mongoose.models.Centre;
}

function attachSave(item) {
  if (!item || typeof item !== "object") return item;
  if (!item.save) {
    Object.defineProperty(item, "save", {
      value: async function() {
        const idx = inMemoryDB.centres.findIndex(c => String(c._id) === String(this._id));
        if (idx !== -1) inMemoryDB.centres[idx] = this;
        return this;
      },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  return item;
}

const Centre = {
  schema: centreSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async find(query = {}) {
    if (this.isMongoose()) return await MongooseCentre.find(query);
    return inMemoryDB.centres.filter(c => {
      for (const key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    }).map(attachSave);
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseCentre.findById(id);
    const item = inMemoryDB.centres.find(c => String(c._id) === String(id) || c.centreId === id || c.name === id) || null;
    return attachSave(item);
  },

  async findOne(query) {
    if (this.isMongoose()) return await MongooseCentre.findOne(query);
    const item = inMemoryDB.centres.find(c => {
      if (query.$or && Array.isArray(query.$or)) {
        return query.$or.some(subQuery => {
          for (const k in subQuery) {
            if (c[k] !== subQuery[k]) return false;
          }
          return true;
        });
      }
      for (const key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    }) || null;
    return attachSave(item);
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseCentre.create(data);
    const newCentre = {
      _id: "cnt_" + Math.random().toString(36).substr(2, 9),
      centreId: data.centreId || "CENTRE_" + Math.floor(100 + Math.random() * 900),
      createdAt: new Date(),
      ...data
    };
    attachSave(newCentre);
    inMemoryDB.centres.push(newCentre);
    return newCentre;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) return await MongooseCentre.findByIdAndUpdate(id, update, options);
    const idx = inMemoryDB.centres.findIndex(c => String(c._id) === String(id) || c.centreId === id || c.name === id);
    if (idx === -1) return null;
    inMemoryDB.centres[idx] = { ...inMemoryDB.centres[idx], ...update };
    return attachSave(inMemoryDB.centres[idx]);
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) return await MongooseCentre.countDocuments(query);
    return (await this.find(query)).length;
  }
};

module.exports = Centre;
