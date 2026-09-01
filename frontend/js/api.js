/**
 * Kisan Procurement Mitra - API & Common Helper Utilities
 */

const API_BASE = "";

// Auth token & session management
const TOKEN_KEY = "kpm_auth_token";
const USER_KEY = "kpm_user_data";
const LANG_KEY = "kpm_selected_lang";

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getUser() {
  const data = localStorage.getItem(USER_KEY);
  try {
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "login.html";
}

// Authentication guard
function requireAuth(allowedRoles = ["farmer", "admin"]) {
  const token = getAuthToken();
  const user = getUser();

  if (!token || !user) {
    window.location.href = "login.html";
    return false;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    if (user.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }
    return false;
  }

  return true;
}

// Unified API caller with Bearer JWT
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (response.status === 401) {
      // Token expired or unauthorized
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("index.html")) {
        window.location.href = "login.html";
      }
    }

    return data;
  } catch (error) {
    console.error("API Fetch Error:", error);
    return { success: false, message: "Network connection error. Please try again." };
  }
}

// Toast notification helper
function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️"}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Hindi & English Localization Dictionary
const translations = {
  en: {
    // Brand & Navigation
    brandTitle: "Kisan Procurement Mitra",
    brandTagMsp: "MSP Portal",
    brandTagAdmin: "Admin Portal",
    brandSubtitle: "Simple • Transparent • Farmer First",
    farmerPortal: "Farmer Portal",
    mandiOfficerOps: "Mandi Officer Operations",
    dashboard: "Dashboard",
    schedule: "My Schedule",
    procurement: "Procurement",
    notifications: "Notifications",
    profile: "Profile",
    admin: "Admin",
    logout: "Logout",
    login: "Farmer Login",
    register: "Register",
    registerNewFarmer: "Register New Farmer",
    adminLogin: "Admin Portal",
    authorizedOfficer: "Authorized Mandi Officer",

    // Landing Hero & Features
    mspTag: "🌾 Direct Minimum Support Price (MSP) Portal",
    heroTitle: "Your Procurement. Your Schedule. Clearly.",
    heroSubtitle: "Kisan Procurement Mitra helps farmers view their procurement schedule, token, centre information, live queue estimates and payment status in one simple, transparent interface.",
    quickDemoTitle: "⚡ Instant Demo Credentials (Evaluation)",
    oneClickReady: "One-Click Ready",
    farmerDemoLabel: "Farmer (Ramesh Patel):",
    adminDemoLabel: "Admin (Mandi Officer):",
    mobileLabel: "Mobile:",
    passwordLabel: "Password:",
    keyServicesTitle: "Key Farmer Services",
    scheduleCardTitle: "Procurement Schedule",
    scheduleCardDesc: "Know exactly when to bring your crop with assigned time slots, reducing unnecessary wait times and mandi congestion.",
    tokenCardTitle: "Digital Token & QR Gate Pass",
    tokenCardDesc: "Instant digital tokens (e.g. TK-1042) with QR-compatible printouts, crop quantity specs, and centre verification.",
    paymentCardTitle: "Transparent Payment Status",
    paymentCardDesc: "Real-time tracking of procurement acceptance, weighing receipts, bank payment processing, and direct transaction IDs.",
    howItWorksTitle: "How It Works — Farmer Journey",
    step1Title: "Register",
    step1Desc: "Enter land & crop details once.",
    step2Title: "Get Schedule",
    step2Desc: "Receive confirmed date & token.",
    step3Title: "Visit Centre",
    step3Desc: "Check queue status and arrive in slot.",
    step4Title: "Track Procurement",
    step4Desc: "Weighing and quality verification.",
    step5Title: "Check Payment",
    step5Desc: "Direct bank credit update & TxID.",
    footerText: "Department of Food & Civil Supplies",
    footerSubNote: "Official Farmer-Centric Interface Layer for State & Central MSP Crop Procurement",
    footerPortalNote: "Official MSP Direct Procurement & Token Management Portal",
    footerAdminNote: "Mandi Procurement Administration",

    // Auth (Login & Register)
    accountLogin: "Account Login",
    loginWithMobile: "Login with your registered mobile number",
    mobileInputLabel: "Mobile Number",
    mobilePlaceholder: "e.g. 9876543210",
    passwordInputLabel: "Password",
    passwordPlaceholder: "Enter your password",
    secureLoginBtn: "Secure Login →",
    quickDemoLogins: "⚡ Quick Demo Logins:",
    farmerDemoBtnText: "👨‍🌾 Farmer Demo: Ramesh Patel (9876543210 / 123456)",
    adminDemoBtnText: "👮‍♂️ Admin Demo: Mandi Officer (9999999999 / admin123)",
    newFarmerPrompt: "New farmer?",
    registerForProcurement: "Register for Procurement",
    farmerRegistrationTitle: "Farmer Registration",
    registerSubtitle: "Register to generate procurement token and schedule slot",
    autoFillDemoBtn: "⚡ Auto-fill Sample Farmer Data",
    fullNameLabel: "Full Name *",
    fullNamePlaceholder: "e.g. Ramesh Patel",
    farmerIdOptionalLabel: "Farmer ID (Optional)",
    farmerIdPlaceholder: "e.g. FMR1001",
    villageLabel: "Village *",
    villagePlaceholder: "e.g. Sanwer",
    districtLabel: "District *",
    districtPlaceholder: "e.g. Indore",
    stateLabel: "State *",
    cropLabel: "Crop *",
    landAreaLabel: "Land Area *",
    landAreaPlaceholder: "e.g. 4.5 Acres",
    preferredCentreLabel: "Preferred Mandi Centre *",
    completeRegBtn: "Complete Registration & Generate Token →",
    alreadyRegistered: "Already registered?",
    loginToDashboard: "Login to Dashboard",

    // Dashboard
    dashboardGreeting: "Namaste",
    rabiSeasonBadge: "🌾 Rabi Season 2026",
    procSummarySubtitle: "Here is your procurement summary.",
    procurementDate: "Procurement Date",
    tokenNumber: "Token Number",
    procurementCentre: "Procurement Centre",
    paymentStatus: "Payment Status",
    nextVisit: "Your Next Procurement Visit",
    viewFullSchedule: "View Full Schedule →",
    printToken: "Print Token Slip",
    centreStatus: "Centre Status",
    smartRecommendation: "Recommended Visit",
    qrReady: "⚡ QR Ready",
    clickToGenerateQr: "Click to generate / scan QR pass →",
    assignedTimeSlot: "Assigned Time Slot",
    tokenCode: "Token Code",

    // Progress Tracker
    procProgressStatus: "Procurement Progress Status",
    liveTracking: "Live Tracking",
    stepReg: "1. Registration",
    stepToken: "2. Token Generated",
    stepSched: "3. Scheduled",
    stepArrived: "4. Arrived",
    stepCompleted: "5. Procurement Completed",
    stepPayment: "6. Payment Processed",

    // Live Mandi Congestion & Telemetry Widget
    liveCongestionTitle: "Live Procurement Centres Congestion Status",
    liveCongestionSubtitle: "Real-time mandi queue telemetry, weighbridge throughput, and wait-time estimates across major centres.",
    liveTelemetryPulse: "LIVE TELEMETRY",
    autoRefresh: "Auto-Refresh (15s)",
    refreshTelemetry: "Refresh Telemetry",
    updatedJustNow: "Updated: Just now",
    monitoredHubs: "Monitored Hubs",
    lowTraffic: "Low Traffic",
    moderateTraffic: "Moderate",
    heavyTraffic: "Heavy",
    recommendedFastest: "Recommended Fastest",
    allCentresChip: "All (6)",
    lowTrafficChip: "🟢 Low Traffic",
    moderateChip: "🟡 Moderate",
    heavyChip: "🔴 Heavy",
    searchCentrePlaceholder: "Search centre or district...",
    tractorsInQueue: "Tractors in Queue",
    activeWeighbridges: "Active Weighbridges",
    bestTimeVisit: "Recommended Arrival Window",
    farmersAhead: "Farmers ahead",
    estimatedWaiting: "Estimated waiting time",
    mandiOpsSmooth: "ℹ️ Mandi operations are running smoothly with active weighbridges.",
    aiQueueAdvisory: "⚡ AI Queue Advisory",
    checklistTitle: "📋 Checklist before leaving:",
    checklistDoc1: "Printed Token or Mobile SMS",
    checklistDoc2: "Aadhaar Card & Bank Account Passbook",
    checklistDoc3: "Khasra / Land Revenue Document",
    recentNotifications: "Recent Notifications",
    viewAll: "View All →",

    // Simulator & QR Modals
    sendReminder: "Simulate SMS / WhatsApp Reminder",
    reminderNotice: "Receive mock SMS & WhatsApp alerts for your scheduled date and time.",
    simulateReminderBtn: "Simulate Reminder",
    fastTrackQrPass: "Fast-Track QR Gate Pass",
    tapToScan: "Tap to Scan",
    mandiCheckinReady: "Mandi Check-in Ready",
    qrGatePass: "Digital Token Scannable QR Gate Pass",
    scanAtCentre: "Transforms your digital token number into a high-speed scannable QR code for zero-wait gate entry and weighbridge access at the procurement centre.",
    viewQrCode: "View Scannable QR",
    downloadQr: "Download QR Pass (PNG)",
    testGateScanner: "Test Gate Scanner",
    recipientMobile: "Recipient Mobile:",
    registeredFarmerBadge: "Registered Farmer",
    gatewayStatus: "Gateway Status:",
    deliveredGovGateway: "Delivered (Gov SMS Gateway)",
    copyMessage: "Copy Message",
    sendTestReminderNow: "Send Mock Reminder Now",
    closeModal: "Close",
    digitalQrGatePass: "Digital QR Gate Pass",
    gateScannerSimulator: "Gate Scanner Simulator",
    gatePassSlipTitle: "MSP AGRICULTURAL PROCUREMENT GATE PASS",
    gatePassGovtSub: "Govt. of India • Department of Food & Public Distribution",
    activeValidBadge: "Active & Valid",
    authorizedGatePassToken: "Authorized Gate Pass Token",
    fastTrackWeighbridgeEntry: "⚡ Fast-Track Weighbridge Entry",
    scanAtMandiGate: "Scan at Mandi Gate",
    requiredAtGate: "📋 Required at Gate: Aadhaar Card • Land Khasra • Bank Passbook",
    activeGatePass: "✓ Active Gate Pass",
    printPass: "Print Pass",
    testGateScannerBtn: "Test Gate Scanner →",
    mandiGateScannerTerminal: "Mandi Entrance Gate Scanner Terminal",
    operatorMode: "Operator Mode",
    scannerSubtitle: "Simulate the procurement centre gatekeeper scanning the farmer's QR code to instantly verify registration and schedule.",
    alignQrPrompt: "Align QR code inside frame for instant barcode decode",
    scanVerifyTokenBtn: "SCAN & VERIFY TOKEN",
    entryAuthorizedTitle: "ENTRY AUTHORIZED — FAST TRACK LANE 1",
    passedVerification: "Passed",
    backToQrPass: "← Back to QR Gate Pass",
    setAsPreferredMandi: "📌 Set as Preferred Mandi",
    bookAppointmentSlot: "📅 Book Appointment Slot →",
    todayHourlyCurve: "📈 Today's Hourly Traffic Curve & Optimal Slots",
    bestArrivalWindow: "Best Recommended Arrival Window:",
    peakArrivalHours: "Peak Arrival Hours:",
    mandiGateDensity: "Current Mandi Gate Load Density",

    // Schedule & Procurement Pages
    myScheduleTitle: "My Procurement Schedule",
    myScheduleSubtitle: "View and track your assigned mandi slots, verification tokens, and status.",
    printActiveToken: "🖨️ Print Active Token",
    allSlots: "All Slots",
    loadingSchedule: "Loading your procurement schedule...",
    thDate: "Date",
    thTimeSlot: "Time Slot",
    thProcCentre: "Procurement Centre",
    thCrop: "Crop",
    thQuantity: "Quantity",
    thStatus: "Status",
    thAction: "Action",
    viewDetails: "View Details",
    reminder: "Reminder",
    verifiedSlots: "✓ Verified Procurement Slots",
    loadingProcurementDetails: "Loading procurement status & digital token...",
    procDetailsTitle: "Procurement & Token Details",
    procDetailsSubtitle: "Official token slip, weighing verification, and direct bank settlement status.",
    farmerName: "Farmer Name",
    farmerId: "Farmer ID",
    dateTimeSlot: "Date & Time Slot",
    cropType: "Crop Type",
    expectedQty: "Expected Quantity",
    receivedQty: "Received Quantity",
    tokenSlipWarning: "* Present this token slip along with original Aadhaar Card at weighing scale.",
    validDigitalToken: "✓ Valid Digital Token",
    procVerificationTitle: "Procurement Verification",
    procStage: "Procurement Stage",
    dbtSettlementTitle: "Direct Payment Settlement",
    totalExpectedAmount: "Total Expected Amount",
    calculatedMspRate: "Calculated per MSP standard rate",
    procurementLabel: "Procurement:",
    settlementDate: "Settlement Date:",
    transactionIdLabel: "Transaction ID:",
    dbtExplanation: "Direct Benefit Transfer (DBT): Payment is processed directly to the farmer's Aadhaar-linked bank account within 3 to 7 working days.",
    awaitingSettlement: "Awaiting Settlement",
    notAvailableAwaiting: "Not available (Awaiting procurement settlement)",
    willBeGeneratedTransfer: "Will be generated upon bank transfer",

    // Notifications Page
    notificationsTitle: "Notifications & Updates",
    notificationsSubtitle: "Real-time alerts regarding schedule confirmation, token creation, and payment updates.",
    markAllRead: "✓ Mark All as Read",
    loadingNotifications: "Loading notifications...",
    systemOperational: "✓ System Operational",
    allCaughtUp: "You're all caught up",
    noNewNotifications: "No new notifications for your account.",
    markAsRead: "Mark as read",
    readCheck: "Read ✓",

    // Profile Page
    farmerProfileTitle: "Farmer Registration Profile",
    farmerProfileSubtitle: "Personal, landholding, and preferred procurement centre records.",
    editProfileBtn: "✏️ Edit Profile",
    lblVillage: "VILLAGE / ग्राम",
    lblDistrict: "DISTRICT / जिला",
    lblState: "STATE / राज्य",
    lblCrop: "PRIMARY CROP / मुख्य फसल",
    lblLandArea: "LAND AREA / भूमि का रकबा",
    lblPreferredCentre: "PREFERRED CENTRE / उपार्जन केंद्र",
    registeredOnPortal: "Registered on Kisan Procurement Mitra Portal",
    verifiedFarmerAccount: "✓ Verified Farmer Account",
    editProfileModalTitle: "Edit Farmer Profile",
    saveChanges: "Save Changes",

    // Admin Page
    adminOpsTitle: "Mandi Administrative Operations",
    adminOpsSubtitle: "Manage procurement progress, weighment acceptance, DBT payments, and broadcast notifications.",
    liveMongoConn: "🟢 Live Database Connection",
    admTotalFarmers: "👥 Total Registered Farmers",
    admTodaySchedule: "📅 Today's Schedule",
    admProcCompleted: "🌾 Procurement Completed",
    admPendingPayments: "💰 Pending Payments",
    allocatedTimeSlots: "Allocated Time Slots",
    weighedVerified: "Weighed & Verified",
    awaitingDbtSettlement: "Awaiting DBT Settlement",
    centreOverviewTitle: "Procurement Centre Status Overview",
    officialMandiData: "Official Mandi Data",
    thTodayScheduled: "Today Scheduled",
    thCompleted: "Completed",
    thWaitingQueue: "Waiting in Queue",
    thMandiStatus: "Mandi Status",
    farmerMgmtTitle: "Farmer Procurement & Payment Management",
    searchFarmerPlaceholder: "🔍 Search Farmer ID, Name, Village...",
    loadingFarmers: "Loading registered farmers...",
    thFarmerId: "Farmer ID",
    thFarmerNameMobile: "Farmer Name & Mobile",
    thVillageDistrict: "Village & District",
    thProcStatus: "Procurement Status",
    thPaymentStatus: "Payment Status",
    updateStatus: "Update Status",
    broadcastNotifTitle: "Send Farmer Notification / Advisory",
    instantPushBadge: "Instant Push",
    notifTitleInputLabel: "Notification Title *",
    notifTitlePlaceholder: "e.g. Sanwer Mandi Weather Advisory",
    notifTypeInputLabel: "Notification Type",
    optGeneralAdvisory: "General Advisory",
    optScheduleUpdate: "Schedule Update",
    optTokenNotif: "Token Notification",
    optProcStatus: "Procurement Status",
    optPaymentSettlement: "Payment Settlement",
    targetFarmerLabel: "Target Farmer (Optional: leave blank for all)",
    targetFarmerPlaceholder: "e.g. FMR1001 or all",
    notifMsgLabel: "Message Content *",
    notifMsgPlaceholder: "Enter message text for farmers",
    sendNotifBtn: "📤 Send Notification to Farmers",
    updateModalTitle: "Update Procurement & Payment",
    receivedQtyInputLabel: "Received Quantity",
    settlementAmountLabel: "Settlement Amount (₹)",
    updateNoticeInfo: "ℹ️ Updating status automatically generates an alert notification for the farmer and updates their dashboard in real-time.",
    saveToDbBtn: "Save Changes to Database",

    // Status Values & Common Labels
    scheduled: "Scheduled",
    completed: "Completed",
    arrived: "Arrived",
    pending: "Pending",
    paid: "Paid",
    processing: "Processing",
    cancelled: "Cancelled",
    openStatus: "Open",
    closedStatus: "Closed",
    activeStatus: "Active",
    wheatCrop: "Wheat",
    soybeanCrop: "Soybean",
    gramCrop: "Gram / Chana",
    paddyCrop: "Paddy / Dhan",
    maizeCrop: "Maize",
    mustardCrop: "Mustard",
    
    // Additional UI & Telemetry Keys
    estQueueWait: "EST. QUEUE WAIT",
    tractorsInLine: "TRACTORS IN LINE",
    weighbridgeScales: "WEIGHBRIDGE SCALES",
    expectHighestQueue: "Expect highest queue density",
    digitalTokenCode: "Digital Token Code",
    activeAndValid: "Active & Valid",
    generatingQr: "⏳ Generating QR...",
    farmerColon: "Farmer:",
    cropQtyColon: "Crop / Qty:",
    centreColon: "Centre:",
    dateSlotColon: "Date & Slot:",
    downloadQrPassPng: "Download QR Pass (PNG)",
    digitalQrGatePassTab: "Digital QR Gate Pass",
    gateScannerSimulatorTab: "Gate Scanner Simulator",
    mspProcGatePassTitle: "🌾 MSP AGRICULTURAL PROCUREMENT GATE PASS",
    govIndiaDept: "Govt. of India • Department of Food & Public Distribution",
    cameraGateScanner: "CAMERA: HD GATE SCANNER #01",
    alignQrCode: "Align QR code inside frame for instant barcode decode",
    scanAndVerifyToken: "SCAN & VERIFY TOKEN",
    entryAuthorized: "ENTRY AUTHORIZED — FAST TRACK LANE 1",
    passedBadge: "Passed",
    testGateScannerArrow: "Test Gate Scanner →",
    trafficCurveTitle: "Today's Hourly Traffic Curve & Optimal Slots",
    qrModalSubtitle: "Transforms your digital token into an instant scannable gate pass for contactless verification.",
    scannerSimSubtitle: "Simulate the procurement centre gatekeeper scanning the farmer's QR code to instantly verify registration and schedule.",
    allCaughtUpMsg: "You're all caught up. No new notifications.",
    noMatchedCentres: "No procurement centres matched your filter or search.",
    resetFilters: "Reset Filters",
    gateTrafficDensity: "Gate Traffic Density",
    capacityText: "Capacity",
    estWait: "EST. WAIT",
    tractorLine: "TRACTOR LINE",
    scalesActive: "SCALES ACTIVE",
    bestSlot: "Best Slot:",
    minWait: "Min Wait",
    hourlyForecast: "Hourly Forecast",
    setPreferred: "Set Preferred",
    currentBadge: "Current",
    assignedCentre: "Assigned Centre",
    risingTrend: "↗ Rising",
    easingTrend: "↘ Easing",
    stableTrend: "→ Stable"
  },
  hi: {
    // Brand & Navigation
    brandTitle: "किसान खरीद मित्र",
    brandTagMsp: "एमएसपी पोर्टल",
    brandTagAdmin: "एडमिन पोर्टल",
    brandSubtitle: "सरल • पारदर्शी • किसान हित सर्वोपरि",
    farmerPortal: "किसान पोर्टल",
    mandiOfficerOps: "मंडी अधिकारी संचालन",
    dashboard: "डैशबोर्ड",
    schedule: "मेरी अनुसूची",
    procurement: "उपार्जन/खरीदी",
    notifications: "सूचनाएँ",
    profile: "प्रोफ़ाइल",
    admin: "एडमिन",
    logout: "लॉगआउट",
    login: "किसान लॉगिन",
    register: "पंजीकरण",
    registerNewFarmer: "नया किसान पंजीकरण",
    adminLogin: "एडमिन पोर्टल",
    authorizedOfficer: "अधिकृत मंडी अधिकारी",

    // Landing Hero & Features
    mspTag: "🌾 प्रत्यक्ष न्यूनतम समर्थन मूल्य (MSP) उपार्जन पोर्टल",
    heroTitle: "आपकी फसल खरीदी। आपका समय। पारदर्शी व्यवस्था।",
    heroSubtitle: "किसान खरीद मित्र किसानों को अपनी उपज उपार्जन समय-सारणी, टोकन, केंद्र की जानकारी, लाइव कतार स्थिति और भुगतान ट्रैकिंग एक ही पारदर्शी मंच पर प्रदान करता है।",
    quickDemoTitle: "⚡ त्वरित डेमो लॉगिन क्रेडेंशियल्स",
    oneClickReady: "एक क्लिक में तैयार",
    farmerDemoLabel: "किसान (रमेश पटेल):",
    adminDemoLabel: "एडमिन (मंडी अधिकारी):",
    mobileLabel: "मोबाइल:",
    passwordLabel: "पासवर्ड:",
    keyServicesTitle: "प्रमुख किसान सेवाएं",
    scheduleCardTitle: "उपार्जन अनुसूची (स्लॉट)",
    scheduleCardDesc: "अपने निर्धारित समय स्लॉट पर फसल लाएं, जिससे मंडी में अनावश्यक प्रतीक्षा और भीड़ से बचा जा सके।",
    tokenCardTitle: "डिजिटल टोकन व क्यूआर गेट पास",
    tokenCardDesc: "तुरंत डिजिटल टोकन (जैसे TK-1042) और क्यूआर कोड युक्त गेट पास प्राप्त करें जो तौलकांटे पर फास्ट-ट्रैक प्रवेश सुनिश्चित करता है।",
    paymentCardTitle: "पारदर्शी भुगतान स्थिति (DBT)",
    paymentCardDesc: "फसल तुलाई स्वीकृति, वजन रसीद, बैंक भुगतान प्रक्रिया और डीबीटी लेन-देन आईडी की लाइव ट्रैकिंग।",
    howItWorksTitle: "कार्यप्रणाली — किसान प्रक्रिया",
    step1Title: "पंजीकरण",
    step1Desc: "भूमि एवं फसल विवरण दर्ज करें।",
    step2Title: "स्लॉट प्राप्त करें",
    step2Desc: "स्वीकृत तारीख व टोकन प्राप्त करें।",
    step3Title: "केंद्र पहुंचे",
    step3Desc: "लाइव भीड़ देखकर समय पर पहुंचें।",
    step4Title: "तुलाई व सत्यापन",
    step4Desc: "तौलकांटे पर वजन व गुणवत्ता जांच।",
    step5Title: "भुगतान प्राप्ति",
    step5Desc: "सीधे बैंक खाते में राशि व लेन-देन विवरण।",
    footerText: "खाद्य एवं नागरिक आपूर्ति विभाग",
    footerSubNote: "राज्य एवं केंद्र सरकार के न्यूनतम समर्थन मूल्य (MSP) उपार्जन हेतु आधिकारिक किसान पोर्टल",
    footerPortalNote: "आधिकारिक एमएसपी प्रत्यक्ष उपार्जन एवं टोकन प्रबंधन पोर्टल",
    footerAdminNote: "मंडी उपार्जन प्रशासन",

    // Auth (Login & Register)
    accountLogin: "खाता लॉगिन",
    loginWithMobile: "अपने पंजीकृत मोबाइल नंबर से लॉगिन करें",
    mobileInputLabel: "मोबाइल नंबर",
    mobilePlaceholder: "उदा. 9876543210",
    passwordInputLabel: "पासवर्ड",
    passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    secureLoginBtn: "सुरक्षित लॉगिन →",
    quickDemoLogins: "⚡ त्वरित डेमो लॉगिन:",
    farmerDemoBtnText: "👨‍🌾 किसान डेमो: रमेश पटेल (9876543210 / 123456)",
    adminDemoBtnText: "👮‍♂️ एडमिन डेमो: मंडी अधिकारी (9999999999 / admin123)",
    newFarmerPrompt: "नए किसान हैं?",
    registerForProcurement: "उपार्जन हेतु पंजीकरण करें",
    farmerRegistrationTitle: "किसान पंजीकरण",
    registerSubtitle: "उपार्जन टोकन व समय स्लॉट प्राप्त करने के लिए पंजीकरण करें",
    autoFillDemoBtn: "⚡ नमूना किसान डेटा स्वतः भरें",
    fullNameLabel: "पूरा नाम *",
    fullNamePlaceholder: "उदा. रमेश पटेल",
    farmerIdOptionalLabel: "किसान आईडी (वैकल्पिक)",
    farmerIdPlaceholder: "उदा. FMR1001",
    villageLabel: "ग्राम *",
    villagePlaceholder: "उदा. सांवेर",
    districtLabel: "जिला *",
    districtPlaceholder: "उदा. इंदौर",
    stateLabel: "राज्य *",
    cropLabel: "फसल *",
    landAreaLabel: "भूमि का रकबा *",
    landAreaPlaceholder: "उदा. 4.5 एकड़",
    preferredCentreLabel: "पसंदीदा उपार्जन मंडी केंद्र *",
    completeRegBtn: "पंजीकरण पूर्ण करें एवं टोकन बनाएं →",
    alreadyRegistered: "पहले से पंजीकृत हैं?",
    loginToDashboard: "डैशबोर्ड पर लॉगिन करें",

    // Dashboard
    dashboardGreeting: "नमस्ते",
    rabiSeasonBadge: "🌾 रबी सीजन 2026",
    procSummarySubtitle: "यहाँ आपकी उपार्जन सारांश जानकारी है।",
    procurementDate: "उपार्जन दिनांक",
    tokenNumber: "टोकन संख्या",
    procurementCentre: "उपार्जन केंद्र",
    paymentStatus: "भुगतान स्थिति",
    nextVisit: "आपकी अगली उपार्जन यात्रा",
    viewFullSchedule: "पूरी अनुसूची देखें →",
    printToken: "टोकन पर्ची प्रिंट करें",
    centreStatus: "उपार्जन केंद्र की स्थिति",
    smartRecommendation: "सुझावित आगमन समय",
    qrReady: "⚡ क्यूआर तैयार",
    clickToGenerateQr: "क्यूआर पास देखने / स्कैन करने हेतु क्लिक करें →",
    assignedTimeSlot: "निर्धारित समय स्लॉट",
    tokenCode: "टोकन कोड",

    // Progress Tracker
    procProgressStatus: "उपार्जन प्रगति स्थिति",
    liveTracking: "लाइव ट्रैकिंग",
    stepReg: "1. पंजीकरण",
    stepToken: "2. टोकन जारी",
    stepSched: "3. स्लॉट निर्धारित",
    stepArrived: "4. केंद्र में उपस्थित",
    stepCompleted: "5. तुलाई पूर्ण",
    stepPayment: "6. भुगतान संपन्न",

    // Live Mandi Congestion & Telemetry Widget
    liveCongestionTitle: "उपार्जन केंद्रों की लाइव भीड़ / ट्रैफ़िक स्थिति",
    liveCongestionSubtitle: "प्रमुख मंडियों में वाहनों की कतार, तौलकांटा सक्रियता व प्रतीक्षा समय की रीयल-टाइम जानकारी।",
    liveTelemetryPulse: "लाइव स्थिति",
    autoRefresh: "ऑटो-रिफ्रेश (15 से.)",
    refreshTelemetry: "रीयल-टाइम अपडेट करें",
    updatedJustNow: "अद्यतन: अभी-अभी",
    monitoredHubs: "निगरानी केंद्र",
    lowTraffic: "कम भीड़",
    moderateTraffic: "मध्यम भीड़",
    heavyTraffic: "भारी भीड़",
    recommendedFastest: "सबसे तेज़ केंद्र",
    allCentresChip: "सभी (6)",
    lowTrafficChip: "🟢 कम भीड़",
    moderateChip: "🟡 मध्यम भीड़",
    heavyChip: "🔴 भारी भीड़",
    searchCentrePlaceholder: "मंडी केंद्र या जिला खोजें...",
    tractorsInQueue: "कतार में ट्रैक्टर/वाहन",
    activeWeighbridges: "सक्रिय तौलकांटे",
    bestTimeVisit: "आगमन का सर्वोत्तम समय",
    farmersAhead: "कतार में किसान",
    estimatedWaiting: "अनुमानित प्रतीक्षा समय",
    mandiOpsSmooth: "ℹ️ मंडी संचालन सुचारु रूप से चालू है एवं तौलकांटे सक्रिय हैं।",
    aiQueueAdvisory: "⚡ एआई कतार परामर्श",
    checklistTitle: "📋 घर से निकलने से पूर्व जरूरी दस्तावेज:",
    checklistDoc1: "प्रिंटेड टोकन या मोबाइल एसएमएस",
    checklistDoc2: "आधार कार्ड एवं बैंक पासबुक",
    checklistDoc3: "खसरा / खतौनी भू-अभिलेख",
    recentNotifications: "हाल की सूचनाएँ",
    viewAll: "सभी देखें →",

    // Simulator & QR Modals
    sendReminder: "एसएमएस / व्हाट्सएप रिमाइंडर सिमुलेशन",
    reminderNotice: "अपने निर्धारित उपार्जन दिनांक व समय की सूचना फोन पर प्राप्त करें।",
    simulateReminderBtn: "रिमाइंडर भेजें",
    fastTrackQrPass: "फास्ट-ट्रैक क्यूआर गेट पास",
    tapToScan: "स्कैन हेतु टैप करें",
    mandiCheckinReady: "मंडी प्रवेश हेतु तैयार",
    qrGatePass: "डिजिटल टोकन स्कैन योग्य क्यूआर गेट पास",
    scanAtCentre: "आपके डिजिटल टोकन को उच्च-गति स्कैन योग्य क्यूआर कोड में बदलता है, जिससे मंडी गेट एवं तौलकांटे पर बिना रुके प्रवेश मिलता है।",
    viewQrCode: "स्कैन योग्य क्यूआर देखें",
    downloadQr: "क्यूआर पास डाउनलोड करें (PNG)",
    testGateScanner: "गेट स्कैनर टेस्ट करें",
    recipientMobile: "प्राप्तकर्ता मोबाइल:",
    registeredFarmerBadge: "पंजीकृत किसान",
    gatewayStatus: "गेटवे स्थिति:",
    deliveredGovGateway: "सफलतापूर्वक प्रेषित (सरकारी एसएमएस गेटवे)",
    copyMessage: "संदेश कॉपी करें",
    sendTestReminderNow: "रिमाइंडर संदेश भेजें",
    closeModal: "बंद करें",
    digitalQrGatePass: "डिजिटल क्यूआर गेट पास",
    gateScannerSimulator: "गेट स्कैनर सिमुलेटर",
    gatePassSlipTitle: "एमएसपी कृषि उपज उपार्जन गेट पास",
    gatePassGovtSub: "भारत सरकार • खाद्य एवं सार्वजनिक वितरण विभाग",
    activeValidBadge: "सक्रिय एवं मान्य",
    authorizedGatePassToken: "अधिकृत गेट पास टोकन",
    fastTrackWeighbridgeEntry: "⚡ फास्ट-ट्रैक तौलकांटा प्रवेश",
    scanAtMandiGate: "मंडी गेट पर स्कैन कराएं",
    requiredAtGate: "📋 गेट पर आवश्यक: आधार कार्ड • खसरा • बैंक पासबुक",
    activeGatePass: "✓ सक्रिय गेट पास",
    printPass: "पास प्रिंट करें",
    testGateScannerBtn: "गेट स्कैनर टेस्ट करें →",
    mandiGateScannerTerminal: "मंडी प्रवेश द्वार स्कैनर टर्मिनल",
    operatorMode: "ऑपरेटर मोड",
    scannerSubtitle: "किसान का क्यूआर कोड स्कैन करके पंजीकरण व स्लॉट का तुरंत सत्यापन करें।",
    alignQrPrompt: "त्वरित बारकोड डिकोड हेतु क्यूआर कोड को फ्रेम में लाएं",
    scanVerifyTokenBtn: "टोकन स्कैन एवं सत्यापित करें",
    entryAuthorizedTitle: "प्रवेश अधिकृत — फास्ट ट्रैक लेन 1",
    passedVerification: "सत्यापित",
    backToQrPass: "← क्यूआर गेट पास पर वापस",
    setAsPreferredMandi: "📌 पसंदीदा मंडी के रूप में सेट करें",
    bookAppointmentSlot: "📅 उपार्जन स्लॉट बुक करें →",
    todayHourlyCurve: "📈 आज का प्रति घंटा ट्रैफ़िक चार्ट व उपयुक्त स्लॉट",
    bestArrivalWindow: "आगमन का सर्वोत्तम समय:",
    peakArrivalHours: "अधिकतम भीड़ का समय:",
    mandiGateDensity: "वर्तमान मंडी द्वार भार घनत्व",

    // Schedule & Procurement Pages
    myScheduleTitle: "मेरी उपार्जन अनुसूची",
    myScheduleSubtitle: "अपने निर्धारित मंडी स्लॉट, टोकन और स्थिति देखें।",
    printActiveToken: "🖨️ सक्रिय टोकन प्रिंट करें",
    allSlots: "सभी स्लॉट",
    loadingSchedule: "उपार्जन अनुसूची लोड हो रही है...",
    thDate: "दिनांक",
    thTimeSlot: "समय स्लॉट",
    thProcCentre: "उपार्जन केंद्र",
    thCrop: "फसल",
    thQuantity: "मात्रा",
    thStatus: "स्थिति",
    thAction: "कार्रवाई",
    viewDetails: "विवरण देखें",
    reminder: "रिमाइंडर",
    verifiedSlots: "✓ सत्यापित उपार्जन स्लॉट",
    loadingProcurementDetails: "उपार्जन स्थिति व डिजिटल टोकन लोड हो रहा है...",
    procDetailsTitle: "उपार्जन एवं टोकन विवरण",
    procDetailsSubtitle: "आधिकारिक टोकन पर्ची, वजन सत्यापन और सीधे बैंक भुगतान स्थिति।",
    farmerName: "किसान का नाम",
    farmerId: "किसान आईडी",
    dateTimeSlot: "दिनांक व समय स्लॉट",
    cropType: "फसल का प्रकार",
    expectedQty: "अनुमानित मात्रा",
    receivedQty: "प्राप्त मात्रा",
    tokenSlipWarning: "* तौलकांटे पर मूल आधार कार्ड के साथ यह टोकन पर्ची प्रस्तुत करें।",
    validDigitalToken: "✓ मान्य डिजिटल टोकन",
    procVerificationTitle: "उपार्जन सत्यापन",
    procStage: "उपार्जन चरण",
    dbtSettlementTitle: "प्रत्यक्ष बैंक भुगतान निपटान (DBT)",
    totalExpectedAmount: "कुल अनुमानित राशि",
    calculatedMspRate: "न्यूनतम समर्थन मूल्य (MSP) दर अनुसार",
    procurementLabel: "उपार्जन:",
    settlementDate: "भुगतान दिनांक:",
    transactionIdLabel: "लेन-देन संख्या (TxID):",
    dbtExplanation: "प्रत्यक्ष लाभ अंतरण (DBT): राशि 3 से 7 कार्य दिवसों के भीतर किसान के आधार-लिंक्ड बैंक खाते में सीधे जमा की जाती है।",
    awaitingSettlement: "भुगतान प्रक्रियाधीन",
    notAvailableAwaiting: "उपलब्ध नहीं (तुलाई सत्यापन उपरांत)",
    willBeGeneratedTransfer: "बैंक अंतरण के समय जारी किया जाएगा",

    // Notifications Page
    notificationsTitle: "सूचनाएँ एवं नवीनतम अपडेट",
    notificationsSubtitle: "स्लॉट निर्धारण, टोकन जारी होने और भुगतान से संबंधित रीयल-टाइम अलर्ट।",
    markAllRead: "✓ सभी को पढ़ा हुआ चिह्नित करें",
    loadingNotifications: "सूचनाएँ लोड हो रही हैं...",
    systemOperational: "✓ प्रणाली सक्रिय है",
    allCaughtUp: "सभी सूचनाएँ पढ़ी जा चुकी हैं",
    noNewNotifications: "आपके खाते के लिए कोई नई सूचना नहीं है।",
    markAsRead: "पढ़ा हुआ चिह्नित करें",
    readCheck: "पढ़ा गया ✓",

    // Profile Page
    farmerProfileTitle: "किसान पंजीकरण प्रोफ़ाइल",
    farmerProfileSubtitle: "व्यक्तिगत, भू-स्वामित्व एवं पसंदीदा उपार्जन केंद्र रिकॉर्ड।",
    editProfileBtn: "✏️ प्रोफ़ाइल संपादित करें",
    lblVillage: "ग्राम",
    lblDistrict: "जिला",
    lblState: "राज्य",
    lblCrop: "मुख्य फसल",
    lblLandArea: "भूमि का रकबा",
    lblPreferredCentre: "पसंदीदा उपार्जन केंद्र",
    registeredOnPortal: "किसान खरीद मित्र पोर्टल पर पंजीकृत",
    verifiedFarmerAccount: "✓ सत्यापित किसान खाता",
    editProfileModalTitle: "किसान प्रोफ़ाइल संपादित करें",
    saveChanges: "परिवर्तन सहेजें",

    // Admin Page
    adminOpsTitle: "मंडी प्रशासनिक संचालन",
    adminOpsSubtitle: "उपार्जन प्रगति, तौल स्वीकृति, डीबीटी भुगतान और किसान संदेश प्रबंधित करें।",
    liveMongoConn: "🟢 लाइव डेटाबेस कनेक्शन",
    admTotalFarmers: "👥 कुल पंजीकृत किसान",
    admTodaySchedule: "📅 आज की अनुसूची",
    admProcCompleted: "🌾 उपार्जन संपन्न",
    admPendingPayments: "💰 लंबित भुगतान",
    allocatedTimeSlots: "आवंटित समय स्लॉट",
    weighedVerified: "तुलाई व सत्यापित",
    awaitingDbtSettlement: "डीबीटी निपटान हेतु प्रतीक्षारत",
    centreOverviewTitle: "उपार्जन केंद्र स्थिति अवलोकन",
    officialMandiData: "आधिकारिक मंडी डेटा",
    thTodayScheduled: "आज निर्धारित",
    thCompleted: "पूर्ण",
    thWaitingQueue: "कतार में प्रतीक्षारत",
    thMandiStatus: "मंडी स्थिति",
    farmerMgmtTitle: "किसान उपार्जन एवं भुगतान प्रबंधन",
    searchFarmerPlaceholder: "🔍 किसान आईडी, नाम, ग्राम खोजें...",
    loadingFarmers: "पंजीकृत किसान लोड हो रहे हैं...",
    thFarmerId: "किसान आईडी",
    thFarmerNameMobile: "किसान का नाम व मोबाइल",
    thVillageDistrict: "ग्राम व जिला",
    thProcStatus: "उपार्जन स्थिति",
    thPaymentStatus: "भुगतान स्थिति",
    updateStatus: "स्थिति अपडेट करें",
    broadcastNotifTitle: "किसान सूचना / परामर्श जारी करें",
    instantPushBadge: "तत्काल संदेश",
    notifTitleInputLabel: "सूचना शीर्षक *",
    notifTitlePlaceholder: "उदा. सांवेर मंडी मौसम परामर्श",
    notifTypeInputLabel: "सूचना का प्रकार",
    optGeneralAdvisory: "सामान्य परामर्श",
    optScheduleUpdate: "समय-सारणी अपडेट",
    optTokenNotif: "टोकन सूचना",
    optProcStatus: "उपार्जन स्थिति",
    optPaymentSettlement: "भुगतान निपटान",
    targetFarmerLabel: "लक्षित किसान (वैकल्पिक: सभी के लिए रिक्त छोड़ें)",
    targetFarmerPlaceholder: "उदा. FMR1001 या all",
    notifMsgLabel: "संदेश सामग्री *",
    notifMsgPlaceholder: "किसानों के लिए संदेश दर्ज करें",
    sendNotifBtn: "📤 किसानों को सूचना भेजें",
    updateModalTitle: "उपार्जन व भुगतान अपडेट करें",
    receivedQtyInputLabel: "प्राप्त मात्रा",
    settlementAmountLabel: "भुगतान राशि (₹)",
    updateNoticeInfo: "ℹ️ स्थिति अपडेट करने पर किसान को स्वचालित सूचना प्राप्त होगी और उनका डैशबोर्ड रीयल-टाइम में अपडेट होगा।",
    saveToDbBtn: "डेटाबेस में सहेजें",

    // Status Values & Common Labels
    scheduled: "निर्धारित (Scheduled)",
    completed: "पूर्ण (Completed)",
    arrived: "उपस्थित (Arrived)",
    pending: "लंबित (Pending)",
    paid: "भुगतान हुआ (Paid)",
    processing: "प्रक्रियाधीन (Processing)",
    cancelled: "रद्द (Cancelled)",
    openStatus: "खुला है (Open)",
    closedStatus: "बंद है (Closed)",
    activeStatus: "सक्रिय (Active)",
    wheatCrop: "गेहूँ (Wheat)",
    soybeanCrop: "सोयाबीन (Soybean)",
    gramCrop: "चना (Gram/Chana)",
    paddyCrop: "धान (Paddy/Dhan)",
    maizeCrop: "मक्का (Maize)",
    mustardCrop: "सरसों (Mustard)",

    // Additional UI & Telemetry Keys
    estQueueWait: "अनुमानित कतार प्रतीक्षा",
    tractorsInLine: "कतार में वाहन/ट्रैक्टर",
    weighbridgeScales: "सक्रिय तौलकांटे",
    expectHighestQueue: "अधिकतम कतार घनत्व की संभावना",
    digitalTokenCode: "डिजिटल टोकन कोड",
    activeAndValid: "सक्रिय एवं मान्य",
    generatingQr: "⏳ क्यूआर कोड तैयार हो रहा है...",
    farmerColon: "किसान:",
    cropQtyColon: "फसल / मात्रा:",
    centreColon: "केंद्र:",
    dateSlotColon: "दिनांक व स्लॉट:",
    downloadQrPassPng: "क्यूआर पास डाउनलोड करें (PNG)",
    digitalQrGatePassTab: "डिजिटल क्यूआर गेट पास",
    gateScannerSimulatorTab: "गेट स्कैनर सिमुलेटर",
    mspProcGatePassTitle: "🌾 एमएसपी कृषि उपज उपार्जन गेट पास",
    govIndiaDept: "भारत सरकार • खाद्य एवं सार्वजनिक वितरण विभाग",
    cameraGateScanner: "कैमरा: एचडी गेट स्कैनर #01",
    alignQrCode: "त्वरित बारकोड डिकोड हेतु क्यूआर कोड को फ्रेम में लाएं",
    scanAndVerifyToken: "टोकन स्कैन एवं सत्यापित करें",
    entryAuthorized: "प्रवेश अधिकृत — फास्ट-ट्रैक लेन 1",
    passedBadge: "सत्यापित",
    testGateScannerArrow: "गेट स्कैनर टेस्ट करें →",
    trafficCurveTitle: "आज का प्रति घंटा ट्रैफ़िक चार्ट व उपयुक्त स्लॉट",
    qrModalSubtitle: "कांटेक्टलेस सत्यापन हेतु अपने डिजिटल टोकन को तुरंत स्कैन योग्य गेट पास में बदलें।",
    scannerSimSubtitle: "किसान के क्यूआर कोड को स्कैन करके पंजीकरण व स्लॉट का तुरंत सत्यापन करें।",
    allCaughtUpMsg: "सभी सूचनाएं पढ़ी जा चुकी हैं। कोई नई सूचना नहीं है।",
    noMatchedCentres: "आपके फ़िल्टर या खोज से कोई उपार्जन केंद्र मेल नहीं खाता।",
    resetFilters: "फ़िल्टर रीसेट करें",
    gateTrafficDensity: "मंडी गेट ट्रैफ़िक घनत्व",
    capacityText: "क्षमता",
    estWait: "अनुमानित प्रतीक्षा",
    tractorLine: "ट्रैक्टर लाइन",
    scalesActive: "सक्रिय कांटे",
    bestSlot: "उत्तम स्लॉट:",
    minWait: "न्यूनतम प्रतीक्षा",
    hourlyForecast: "प्रति घंटा पूर्वानुमान",
    setPreferred: "पसंदीदा बनाएं",
    currentBadge: "वर्तमान",
    assignedCentre: "आवंटित केंद्र",
    risingTrend: "↗ बढ़ रहा है",
    easingTrend: "↘ घट रहा है",
    stableTrend: "→ स्थिर"
  }
};

function getLanguage() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function t(key, fallback = "") {
  const lang = getLanguage();
  const dict = translations[lang] || translations.en;
  if (dict && dict[key] !== undefined) {
    return dict[key];
  }
  if (translations.en && translations.en[key] !== undefined) {
    return translations.en[key];
  }
  return fallback || key;
}

function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang);
  applyTranslations(lang);
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
}

function applyTranslations(lang = getLanguage()) {
  const dict = translations[lang] || translations.en;
  
  // Set html document lang
  document.documentElement.lang = lang;

  // Text content translation
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) {
      el.textContent = dict[key];
    }
  });

  // HTML content translation
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key] !== undefined) {
      el.innerHTML = dict[key];
    }
  });

  // Input placeholder translation
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key] !== undefined) {
      el.placeholder = dict[key];
    }
  });

  // Element title attribute translation
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (dict[key] !== undefined) {
      el.title = dict[key];
    }
  });

  // Element aria-label attribute translation
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria");
    if (dict[key] !== undefined) {
      el.setAttribute("aria-label", dict[key]);
    }
  });

  // Element value attribute translation (for submit buttons / options if needed)
  document.querySelectorAll("[data-i18n-value]").forEach(el => {
    const key = el.getAttribute("data-i18n-value");
    if (dict[key] !== undefined) {
      el.value = dict[key];
    }
  });

  // Language switch toggle button text
  const langBtn = document.getElementById("langSwitchBtn");
  if (langBtn) {
    langBtn.textContent = lang === "en" ? "हिंदी" : "English";
    langBtn.setAttribute("aria-label", lang === "en" ? "Switch to Hindi" : "Switch to English");
  }
}

function toggleLanguage() {
  const current = getLanguage();
  const next = current === "en" ? "hi" : "en";
  setLanguage(next);
}

// Global initialization for header and navigation
function initCommonUI() {
  // Mobile hamburger menu toggle
  const hamburger = document.getElementById("hamburgerBtn");
  const navMenu = document.getElementById("navLinks");
  if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
      navMenu.classList.toggle("show-mobile");
    });
  }

  // Language switcher
  const langBtn = document.getElementById("langSwitchBtn");
  if (langBtn) {
    langBtn.addEventListener("click", toggleLanguage);
  }

  // User details in header
  const user = getUser();
  const userDisplay = document.getElementById("headerUserName");
  const userAvatar = document.getElementById("headerUserAvatar");
  const logoutBtn = document.getElementById("headerLogoutBtn");

  if (userDisplay && user) {
    userDisplay.textContent = user.name || "Farmer";
    if (userAvatar) userAvatar.textContent = (user.name || "F")[0].toUpperCase();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Fetch unread notifications count for badge
  if (getAuthToken() && user && user.role === "farmer") {
    apiFetch("/api/notifications").then(res => {
      if (res.success && res.data) {
        const unreadCount = res.data.filter(n => !n.isRead).length;
        const badge = document.getElementById("headerNotifBadge");
        if (badge) {
          if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = "inline-block";
          } else {
            badge.style.display = "none";
          }
        }
      }
    }).catch(console.error);
  }

  applyTranslations(getLanguage());
}

document.addEventListener("DOMContentLoaded", initCommonUI);
