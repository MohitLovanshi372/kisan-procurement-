const mongoose = require("mongoose");
const { inMemoryDB } = require("../config/db");

const farmerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  farmerId: { type: String, required: true, unique: true },
  village: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  crop: { type: String, required: true },
  landArea: { type: String, required: true },
  preferredCentre: { type: String, required: true },
  role: { type: String, enum: ["farmer", "admin"], default: "farmer" },
  createdAt: { type: Date, default: Date.now }
});

let MongooseFarmer;
try {
  MongooseFarmer = mongoose.model("Farmer", farmerSchema);
} catch (e) {
  MongooseFarmer = mongoose.models.Farmer;
}

// Unified wrapper supporting both Mongoose and In-Memory demo store
const Farmer = {
  schema: farmerSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async findOne(query) {
    if (this.isMongoose()) return await MongooseFarmer.findOne(query);
    return inMemoryDB.farmers.find(f => {
      for (const key in query) {
        if (f[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseFarmer.findById(id);
    return inMemoryDB.farmers.find(f => String(f._id) === String(id) || f.farmerId === id) || null;
  },

  async find(query = {}) {
    if (this.isMongoose()) return await MongooseFarmer.find(query);
    return inMemoryDB.farmers.filter(f => {
      for (const key in query) {
        if (f[key] !== query[key]) return false;
      }
      return true;
    });
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseFarmer.create(data);
    const newFarmer = {
      _id: "fmr_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      role: "farmer",
      ...data
    };
    inMemoryDB.farmers.push(newFarmer);
    return newFarmer;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) return await MongooseFarmer.findByIdAndUpdate(id, update, options);
    const idx = inMemoryDB.farmers.findIndex(f => String(f._id) === String(id) || f.farmerId === id);
    if (idx === -1) return null;
    inMemoryDB.farmers[idx] = { ...inMemoryDB.farmers[idx], ...update };
    return inMemoryDB.farmers[idx];
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) return await MongooseFarmer.countDocuments(query);
    return (await this.find(query)).length;
  }
};

module.exports = Farmer;
