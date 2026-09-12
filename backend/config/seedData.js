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

    console.log("Seeding initial data for MSP procurement portal...");

    const salt = await bcrypt.genSalt(10);
    const farmerPassword = await bcrypt.hash("123456", salt);
    const officerPassword = await bcrypt.hash("officer123", salt);
    const adminPassword = await bcrypt.hash("admin123", salt);

    // 1. Create Centres with unique centreId and real-time congestion metrics
    const centresData = [
      {
        centreId: "CENTRE_001",
        name: "Sanwer Procurement Centre",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Sanwer Mandi Campus, Indore Road",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 62,
        completedFarmers: 38,
        waitingFarmers: 18,
        estimatedWait: "45 minutes",
        congestionLevel: "Moderate",
        congestionScore: 58,
        queueTractors: 14,
        activeWeighbridges: 2,
        totalWeighbridges: 3,
        trend: "Stable",
        bestTimeToVisit: "02:00 PM – 04:00 PM",
        peakHours: "11:00 AM – 01:30 PM"
      },
      {
        centreId: "CENTRE_002",
        name: "Indore Central Mandi",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Laxmibai Nagar Mandi, Indore",
        workingHours: "08:30 AM – 06:00 PM",
        status: "Open",
        scheduledFarmers: 96,
        completedFarmers: 58,
        waitingFarmers: 34,
        estimatedWait: "1 hr 15 mins",
        congestionLevel: "Heavy",
        congestionScore: 88,
        queueTractors: 28,
        activeWeighbridges: 4,
        totalWeighbridges: 4,
        trend: "Rising",
        bestTimeToVisit: "03:30 PM – 05:30 PM",
        peakHours: "10:00 AM – 02:00 PM"
      },
      {
        centreId: "CENTRE_003",
        name: "Depalpur Krishi Upaj Mandi",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Depalpur Main Highway, Indore",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 43,
        completedFarmers: 35,
        waitingFarmers: 6,
        estimatedWait: "15 minutes",
        congestionLevel: "Low Traffic",
        congestionScore: 22,
        queueTractors: 4,
        activeWeighbridges: 2,
        totalWeighbridges: 2,
        trend: "Easing",
        bestTimeToVisit: "10:00 AM – 03:00 PM",
        peakHours: "12:00 PM – 01:00 PM"
      },
      {
        centreId: "CENTRE_004",
        name: "Mhow Kisan Samriddhi Mandi",
        district: "Indore",
        state: "Madhya Pradesh",
        location: "Mhow-Pithampur Bypass, Indore",
        workingHours: "09:00 AM – 05:30 PM",
        status: "Open",
        scheduledFarmers: 52,
        completedFarmers: 41,
        waitingFarmers: 8,
        estimatedWait: "20 minutes",
        congestionLevel: "Low Traffic",
        congestionScore: 28,
        queueTractors: 6,
        activeWeighbridges: 2,
        totalWeighbridges: 3,
        trend: "Stable",
        bestTimeToVisit: "11:00 AM – 03:00 PM",
        peakHours: "09:30 AM – 11:00 AM"
      },
      {
        centreId: "CENTRE_005",
        name: "Ujjain APMC Procurement Hub",
        district: "Ujjain",
        state: "Madhya Pradesh",
        location: "Agar Road Krishi Parisar, Ujjain",
        workingHours: "08:00 AM – 06:30 PM",
        status: "Open",
        scheduledFarmers: 110,
        completedFarmers: 65,
        waitingFarmers: 42,
        estimatedWait: "1 hr 30 mins",
        congestionLevel: "Heavy",
        congestionScore: 92,
        queueTractors: 35,
        activeWeighbridges: 3,
        totalWeighbridges: 5,
        trend: "Rising",
        bestTimeToVisit: "04:00 PM – 06:00 PM",
        peakHours: "10:30 AM – 02:30 PM"
      },
      {
        centreId: "CENTRE_006",
        name: "Dewas Agro Procurement Complex",
        district: "Dewas",
        state: "Madhya Pradesh",
        location: "Bhopal Bypass Road, Dewas",
        workingHours: "09:00 AM – 05:00 PM",
        status: "Open",
        scheduledFarmers: 68,
        completedFarmers: 48,
        waitingFarmers: 16,
        estimatedWait: "35 minutes",
        congestionLevel: "Moderate",
        congestionScore: 52,
        queueTractors: 12,
        activeWeighbridges: 3,
        totalWeighbridges: 4,
        trend: "Easing",
        bestTimeToVisit: "01:30 PM – 04:00 PM",
        peakHours: "11:00 AM – 01:00 PM"
      }
    ];

    for (const c of centresData) {
      await Centre.create(c);
    }

    // 2. Create Government Admin User
    await Farmer.create({
      name: "Administrative Director (Mandi Board)",
      mobile: "9999999999",
      password: adminPassword,
      plainPassword: "admin123",
      farmerId: "ADM001",
      village: "Mandi Board HQ",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "All Crops",
      landArea: "N/A",
      preferredCentre: "All Procurement Centres",
      role: "GOVERNMENT_ADMIN",
      isActive: true
    });

    // 3. Create Centre Officer 1 (Sanwer Procurement Centre - 9893011111 / OFF001)
    await Farmer.create({
      name: "Rajesh Sharma (Sanwer Officer)",
      mobile: "9893011111",
      password: officerPassword,
      plainPassword: "officer123",
      farmerId: "OFF001",
      designation: "Procurement Centre Officer",
      village: "Sanwer",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Procurement Administration",
      landArea: "N/A",
      preferredCentre: "Sanwer Procurement Centre",
      assignedCentreId: "CENTRE_001",
      assignedCentreName: "Sanwer Procurement Centre",
      role: "CENTRE_OFFICER",
      verificationStatus: "Active",
      isActive: true
    });

    // 3b. Alternate line for Sanwer (9811111111)
    await Farmer.create({
      name: "Rajesh Sharma (Field Line)",
      mobile: "9811111111",
      password: officerPassword,
      plainPassword: "officer123",
      farmerId: "OFF001B",
      village: "Sanwer",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Procurement Administration",
      landArea: "N/A",
      preferredCentre: "Sanwer Procurement Centre",
      assignedCentreId: "CENTRE_001",
      assignedCentreName: "Sanwer Procurement Centre",
      role: "CENTRE_OFFICER",
      isActive: true
    });

    // 4. Create Centre Officer 2 (Indore Central Mandi - 9822222222 / OFF002)
    await Farmer.create({
      name: "Vikram Singh (Indore Central Officer)",
      mobile: "9822222222",
      password: officerPassword,
      plainPassword: "officer123",
      farmerId: "OFF002",
      village: "Laxmibai Nagar",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Procurement Administration",
      landArea: "N/A",
      preferredCentre: "Indore Central Mandi",
      assignedCentreId: "CENTRE_002",
      assignedCentreName: "Indore Central Mandi",
      role: "CENTRE_OFFICER",
      isActive: true
    });

    // 4b. Create Centre Officer 3 (Depalpur Procurement Centre - 9833333333 / OFF003)
    await Farmer.create({
      name: "Anita Verma (Depalpur Officer)",
      mobile: "9833333333",
      password: officerPassword,
      plainPassword: "officer123",
      farmerId: "OFF003",
      village: "Depalpur Mandi",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Procurement Administration",
      landArea: "N/A",
      preferredCentre: "Depalpur Procurement Centre",
      assignedCentreId: "CENTRE_003",
      assignedCentreName: "Depalpur Procurement Centre",
      role: "CENTRE_OFFICER",
      isActive: true
    });

    // 4c. Create Centre Officer 4 (Mhow Procurement Sub-Mandi - 9844444444 / OFF004)
    await Farmer.create({
      name: "Mahesh Choudhary (Mhow Officer)",
      mobile: "9844444444",
      password: officerPassword,
      plainPassword: "officer123",
      farmerId: "OFF004",
      village: "Mhow Mandi Complex",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Procurement Administration",
      landArea: "N/A",
      preferredCentre: "Mhow Procurement Sub-Mandi",
      assignedCentreId: "CENTRE_004",
      assignedCentreName: "Mhow Procurement Sub-Mandi",
      role: "CENTRE_OFFICER",
      isActive: true
    });

    // 5. Create Main Demo Farmer: Ramesh Patel (Sanwer Centre)
    await Farmer.create({
      name: "Ramesh Patel",
      mobile: "9876543210",
      password: farmerPassword,
      plainPassword: "123456",
      farmerId: "FMR1001",
      village: "Sanwer",
      district: "Indore",
      state: "Madhya Pradesh",
      crop: "Wheat",
      landArea: "4.5 Acres",
      preferredCentre: "Sanwer Procurement Centre",
      assignedCentreId: "CENTRE_001",
      assignedCentreName: "Sanwer Procurement Centre",
      aadharNumber: "789456124589",
      isAadharLinked: true,
      bankName: "State Bank of India",
      accountNumber: "30982451928",
      ifscCode: "SBIN0001234",
      accountHolderName: "Ramesh Patel",
      branchName: "Sanwer Branch (Indore)",
      dbtStatus: "Active (Aadhaar Seeded)",
      surveyNumber: "KH-2024/782",
      landRecordStatus: "Farmer Provided",
      verificationStatus: "Active",
      role: "FARMER",
      isActive: true
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
      message: "Your procurement slot is confirmed for 12 September 2026 at 10:00 AM at Sanwer Procurement Centre.",
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

    // 6. Create multi-centre demo farmers
    const otherFarmers = [
      // Sanwer Centre Farmers (Officer 1's centre)
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
        assignedCentreId: "CENTRE_001",
        token: "TK-1044",
        date: "15 September 2026",
        procStatus: "Arrived",
        payStatus: "Processing",
        amount: 52000,
        payDate: null,
        txId: null
      },
      {
        name: "Harish Solanki",
        mobile: "9876543215",
        farmerId: "FMR1006",
        village: "Baloda",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Wheat",
        landArea: "6.2 Acres",
        preferredCentre: "Sanwer Procurement Centre",
        assignedCentreId: "CENTRE_001",
        token: "TK-1047",
        date: "11 September 2026",
        procStatus: "Procurement Completed",
        payStatus: "Paid",
        amount: 56250,
        payDate: "11 September 2026",
        txId: "DBT-2026-MP-984401"
      },
      {
        name: "Sohan Lal",
        mobile: "9876543216",
        farmerId: "FMR1007",
        village: "Kshipra",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Mustard",
        landArea: "3.5 Acres",
        preferredCentre: "Sanwer Procurement Centre",
        assignedCentreId: "CENTRE_001",
        token: "TK-1048",
        date: "13 September 2026",
        procStatus: "Scheduled",
        payStatus: "Pending",
        amount: 38000,
        payDate: null,
        txId: null
      },

      // Indore Central Mandi Farmers (Officer 2's centre)
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
        assignedCentreId: "CENTRE_002",
        token: "TK-1043",
        date: "14 September 2026",
        procStatus: "Procurement Completed",
        payStatus: "Paid",
        amount: 32000,
        payDate: "18 September 2026",
        txId: "PAY-20260918-1001"
      },
      {
        name: "Devendra Verma",
        mobile: "9876543217",
        farmerId: "FMR1008",
        village: "Rau",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Wheat",
        landArea: "7.0 Acres",
        preferredCentre: "Indore Central Mandi",
        assignedCentreId: "CENTRE_002",
        token: "TK-1049",
        date: "12 September 2026",
        procStatus: "Scheduled",
        payStatus: "Pending",
        amount: 67500,
        payDate: null,
        txId: null
      },
      {
        name: "Priya Patidar",
        mobile: "9876543218",
        farmerId: "FMR1009",
        village: "Kanadia",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Gram (Chana)",
        landArea: "4.0 Acres",
        preferredCentre: "Indore Central Mandi",
        assignedCentreId: "CENTRE_002",
        token: "TK-1050",
        date: "12 September 2026",
        procStatus: "Arrived",
        payStatus: "Processing",
        amount: 45000,
        payDate: null,
        txId: null
      },

      // Depalpur Mandi Farmers
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
        assignedCentreId: "CENTRE_003",
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
        assignedCentreId: "CENTRE_003",
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
        plainPassword: "123456",
        farmerId: f.farmerId,
        village: f.village,
        district: f.district,
        state: f.state,
        crop: f.crop,
        landArea: f.landArea,
        preferredCentre: f.preferredCentre,
        assignedCentreId: f.assignedCentreId,
        assignedCentreName: f.preferredCentre,
        role: "FARMER",
        isActive: true
      });

      await Procurement.create({
        farmerId: f.farmerId,
        centreId: f.preferredCentre,
        crop: f.crop,
        quantity: f.crop === "Soybean" ? "12 Quintal" : "20 Quintal",
        receivedQuantity: f.procStatus === "Procurement Completed" ? (f.crop === "Soybean" ? "12 Quintal" : "20 Quintal") : "0 Quintal",
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

    console.log("✅ Demo data seeded successfully with 3 roles: Farmers, Centre Officers, Government Admin, and isolated centres.");
  } catch (error) {
    console.error("Seed data error:", error);
  }
};

module.exports = seedInitialData;
