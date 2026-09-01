const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const centreSchema = new mongoose.Schema({
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
    });
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseCentre.findById(id);
    return inMemoryDB.centres.find(c => String(c._id) === String(id) || c.name === id) || null;
  },

  async findOne(query) {
    if (this.isMongoose()) return await MongooseCentre.findOne(query);
    return inMemoryDB.centres.find(c => {
      for (const key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseCentre.create(data);
    const newCentre = {
      _id: "cnt_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      ...data
    };
    inMemoryDB.centres.push(newCentre);
    return newCentre;
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) return await MongooseCentre.countDocuments(query);
    return (await this.find(query)).length;
  }
};

module.exports = Centre;
