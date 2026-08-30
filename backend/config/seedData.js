const bcrypt = require("bcryptjs");
const Farmer = require("../models/Farmer");
const Centre = require("../models/Centre");
const Procurement = require("../models/Procurement");
const Notification = require("../models/Notification");
const { inMemoryDB } = require("./db");

const seedInitialData = async () => {
  try {
    const existingFarmersCount = await Farmer.countDocuments();
    if (existingFarmersCount > 0) {
      console.log("Database already seeded with demo records.");
      return;
    }

    console.log("Seeding demo data for SIH26032 prototype...");

    const salt = await bcrypt.genSalt(10);
    const farmerPassword = await bcrypt.hash("123456", salt);
    const adminPassword = await bcrypt.hash("admin123", salt);

    // 1. Create Centres
    const centresData = [
      {
        name: "Sanwer Procurement Centre",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Sanwer Mandi Campus, Indore Road",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 62,
        completedFarmers: 38,
        waitingFarmers: 18,
        estimatedWait: "45 minutes"
      },
      {
        name: "Indore Central Mandi",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Laxmibai Nagar Mandi, Indore",
        workingHours: "08:30 AM – 06:00 PM",
        status: "Open",
        scheduledFarmers: 74,
        completedFarmers: 51,
        waitingFarmers: 12,
        estimatedWait: "25 minutes"
      },
      {
        name: "Depalpur Krishi Upaj Mandi",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Depalpur Main Highway, Indore",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 43,
        completedFarmers: 29,
        waitingFarmers: 8,
        estimatedWait: "15 minutes"
      }
    ];

    for (const c of centresData) {
      await Centre.create(c);
    }

    // 2. Create Admin User
    await Farmer.create({
      name: "Admin Officer (Indore Division)",
      mobile: "9999999999",
      password: adminPassword,
      farmerId: "ADM001",
      village: "District HQ",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "All Crops",
      landArea: "N/A",
      preferredCentre: "Sanwer Procurement Centre",
      role: "admin"
    });

    // 3. Create Main Demo Farmer: Ramesh Patel
    const ramesh = await Farmer.create({
      name: "Ramesh Patel",
      mobile: "9876543210",
      password: farmerPassword,
      farmerId: "FMR1001",
      village: "Sanwer",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Wheat",
      landArea: "4.5 Acres",
      preferredCentre: "Sanwer Procurement Centre",
      role: "farmer"
    });

    // Procurement for Ramesh Patel
    await Procurement.create({
      farmerId: "FMR1001",
      centreId: "Sanwer Procurement Centre",
      crop: "Wheat",
      quantity: "18 Quintal",
      receivedQuantity: "18 Quintal",
      tokenNumber: "TK-1042",
      scheduleDate: "12 September 2026",
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      procurementStatus: "Scheduled",
      paymentStatus: "Pending",
      amount: 45000,
      paymentDate: null,
      transactionId: null
    });

    // Notifications for Ramesh
    await Notification.create({
      farmerId: "FMR1001",
      title: "Procurement Schedule Confirmed",
      message: "Your procurement slot is confirmed for 12 September 2026 at 10:00 AM.",
      type: "Schedule",
      isRead: false
    });
    await Notification.create({
      farmerId: "FMR1001",
      title: "Token Generated",
      message: "Your token TK-1042 has been generated successfully.",
      type: "Token",
      isRead: false
    });
    await Notification.create({
      farmerId: "FMR1001",
      title: "Centre Advisory",
      message: "Sanwer Procurement Centre opens at 09:00 AM. Please carry bank passbook and Aadhaar.",
      type: "General",
      isRead: true
    });

    // 4. Create other demo farmers
    const otherFarmers = [
      {
        name: "Sunita Sharma",
        mobile: "9876543211",
        farmerId: "FMR1002",
        village: "Manglia",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Soybean",
        landArea: "3.2 Acres",
        preferredCentre: "Indore Central Mandi",
        token: "TK-1043",
        date: "14 September 2026",
        procStatus: "Procurement Completed",
        payStatus: "Paid",
        amount: 32000,
        payDate: "18 September 2026",
        txId: "PAY-20260918-1001"
      },
      {
        name: "Rajesh Yadav",
        mobile: "9876543212",
        farmerId: "FMR1003",
        village: "Hatod",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Gram (Chana)",
        landArea: "5.0 Acres",
        preferredCentre: "Sanwer Procurement Centre",
        token: "TK-1044",
        date: "15 September 2026",
        procStatus: "Arrived",
        payStatus: "Processing",
        amount: 52000,
        payDate: null,
        txId: null
      },
      {
        name: "Mukesh Choudhary",
        mobile: "9876543213",
        farmerId: "FMR1004",
        village: "Gautampura",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Wheat",
        landArea: "6.0 Acres",
        preferredCentre: "Depalpur Krishi Upaj Mandi",
        token: "TK-1045",
        date: "16 September 2026",
        procStatus: "Scheduled",
        payStatus: "Pending",
        amount: 60000,
        payDate: null,
        txId: null
      },
      {
        name: "Anita Bai",
        mobile: "9876543214",
        farmerId: "FMR1005",
        village: "Betma",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Maize",
        landArea: "2.8 Acres",
        preferredCentre: "Depalpur Krishi Upaj Mandi",
        token: "TK-1046",
        date: "17 September 2026",
        procStatus: "Registration",
        payStatus: "Pending",
        amount: 28000,
        payDate: null,
        txId: null
      }
    ];

    for (const f of otherFarmers) {
      await Farmer.create({
        name: f.name,
        mobile: f.mobile,
        password: farmerPassword,
        farmerId: f.farmerId,
        village: f.village,
        district: f.district,
        state: f.state,
        crop: f.crop,
        landArea: f.landArea,
        preferredCentre: f.preferredCentre,
        role: "farmer"
      });

      await Procurement.create({
        farmerId: f.farmerId,
        centreId: f.preferredCentre,
        crop: f.crop,
        quantity: f.crop === "Soybean" ? "12 Quintal" : "20 Quintal",
        receivedQuantity: f.procStatus === "Procurement Completed" ? "12 Quintal" : "0 Quintal",
        tokenNumber: f.token,
        scheduleDate: f.date,
        startTime: "11:00 AM",
        endTime: "12:00 PM",
        procurementStatus: f.procStatus,
        paymentStatus: f.payStatus,
        amount: f.amount,
        paymentDate: f.payDate,
        transactionId: f.txId
      });

      await Notification.create({
        farmerId: f.farmerId,
        title: "Procurement Status: " + f.procStatus,
        message: `Your schedule at ${f.preferredCentre} is confirmed for ${f.date}.`,
        type: "Schedule",
        isRead: false
      });
    }

    console.log("✅ Demo data seeded successfully with 5+ farmers, admin account, centres and procurement records.");
  } catch (error) {
    console.error("Seed data error:", error);
  }
};

module.exports = seedInitialData;
