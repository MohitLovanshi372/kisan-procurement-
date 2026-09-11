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
  aadharNumber: { type: String, default: "" },
  isAadharLinked: { type: Boolean, default: true },
  bankName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  ifscCode: { type: String, default: "" },
  accountHolderName: { type: String, default: "" },
  branchName: { type: String, default: "" },
  dbtStatus: { type: String, default: "Active (Aadhaar Seeded)" },
  role: {
    type: String,
    enum: ["FARMER", "CENTRE_OFFICER", "GOVERNMENT_ADMIN", "farmer", "centre_officer", "government_admin", "admin"],
    default: "FARMER"
  },
  assignedCentreId: { type: String, default: null },
  assignedCentreName: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

let MongooseFarmer;
try {
  MongooseFarmer = mongoose.model("Farmer", farmerSchema);
} catch (e) {
  MongooseFarmer = mongoose.models.Farmer;
}

function attachSave(item) {
  if (!item || typeof item !== "object") return item;
  if (!item.save) {
    Object.defineProperty(item, "save", {
      value: async function() {
        const idx = inMemoryDB.farmers.findIndex(f => String(f._id) === String(this._id) || f.farmerId === this.farmerId);
        if (idx !== -1) inMemoryDB.farmers[idx] = this;
        return this;
      },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  return item;
}

// Unified wrapper supporting both Mongoose and In-Memory demo store
const Farmer = {
  schema: farmerSchema,
  isMongoose: () => mongoose.connection.readyState === 1 && !inMemoryDB.isUsingMemory,

  async findOne(query) {
    if (this.isMongoose()) return await MongooseFarmer.findOne(query);
    const item = inMemoryDB.farmers.find(f => {
      if (query.$or && Array.isArray(query.$or)) {
        return query.$or.some(subQuery => {
          for (const k in subQuery) {
            if (f[k] !== subQuery[k]) return false;
          }
          return true;
        });
      }
      for (const key in query) {
        if (f[key] !== query[key]) return false;
      }
      return true;
    }) || null;
    return attachSave(item);
  },

  async findById(id) {
    if (this.isMongoose()) return await MongooseFarmer.findById(id);
    const item = inMemoryDB.farmers.find(f => String(f._id) === String(id) || f.farmerId === id) || null;
    return attachSave(item);
  },

  async find(query = {}) {
    if (this.isMongoose()) return await MongooseFarmer.find(query);
    return inMemoryDB.farmers.filter(f => {
      for (const key in query) {
        if (f[key] !== query[key]) return false;
      }
      return true;
    }).map(attachSave);
  },

  async create(data) {
    if (this.isMongoose()) return await MongooseFarmer.create(data);
    const newFarmer = {
      _id: "fmr_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      role: data.role || "FARMER",
      isActive: data.isActive !== false,
      assignedCentreId: data.assignedCentreId || null,
      assignedCentreName: data.assignedCentreName || null,
      ...data
    };
    attachSave(newFarmer);
    inMemoryDB.farmers.push(newFarmer);
    return newFarmer;
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (this.isMongoose()) return await MongooseFarmer.findByIdAndUpdate(id, update, options);
    const idx = inMemoryDB.farmers.findIndex(f => String(f._id) === String(id) || f.farmerId === id);
    if (idx === -1) return null;
    inMemoryDB.farmers[idx] = { ...inMemoryDB.farmers[idx], ...update };
    return attachSave(inMemoryDB.farmers[idx]);
  },

  async countDocuments(query = {}) {
    if (this.isMongoose()) return await MongooseFarmer.countDocuments(query);
    return (await this.find(query)).length;
  }
};

module.exports = Farmer;
