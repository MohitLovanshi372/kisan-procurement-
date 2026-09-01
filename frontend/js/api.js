/**
 * Kisan Procurement Mitra - SIH26032 API & Common Helper Utilities
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
    dashboard: "Dashboard",
    schedule: "My Schedule",
    procurement: "Procurement",
    notifications: "Notifications",
    profile: "Profile",
    admin: "Admin",
    logout: "Logout",
    login: "Farmer Login",
    register: "Register",
    adminLogin: "Admin Login",
    procurementDate: "Procurement Date",
    tokenNumber: "Token Number",
    procurementCentre: "Procurement Centre",
    paymentStatus: "Payment Status",
    nextVisit: "Your Next Procurement Visit",
    viewFullSchedule: "View Full Schedule",
    printToken: "Print Token",
    centreStatus: "Centre Status",
    smartRecommendation: "Recommended Visit",
    scheduled: "Scheduled",
    completed: "Completed",
    arrived: "Arrived",
    pending: "Pending",
    paid: "Paid",
    processing: "Processing",
    cancelled: "Cancelled",
    farmersAhead: "Farmers ahead",
    estimatedWaiting: "Estimated waiting time",
    demoDataNotice: "Demo data for SIH26032 prototype",
    saveChanges: "Save Changes",
    totalFarmers: "Total Farmers",
    todaySchedule: "Today's Schedule",
    pendingPayments: "Pending Payments",
    allCaughtUp: "You're all caught up.",
    markAsRead: "Mark as read",
    sendReminder: "Simulate SMS / WhatsApp Reminder",
    reminderNotice: "Receive mock SMS & WhatsApp alerts for your scheduled date and time.",
    sendTestNotification: "Send Test Reminder Now",
    reminderSentSuccess: "Mock SMS & WhatsApp reminder sent successfully!",
    qrGatePass: "Fast-Track Digital QR Gate Pass",
    scanAtCentre: "Scan at Procurement Centre Gate for Instant Verification",
    viewQrCode: "View Scannable QR Pass",
    downloadQr: "Download QR Pass (PNG)",
    liveCongestionTitle: "Live Procurement Centres Congestion Status",
    liveCongestionSubtitle: "Real-time mandi queue telemetry, weighbridge throughput, and wait-time estimates across major centres.",
    lowTraffic: "Low Traffic",
    moderateTraffic: "Moderate",
    heavyTraffic: "Heavy",
    autoRefresh: "Auto-Refresh (15s)",
    refreshTelemetry: "Refresh Telemetry",
    tractorsInQueue: "Tractors in Queue",
    activeWeighbridges: "Active Weighbridges",
    bestTimeVisit: "Recommended Arrival Window",
    liveTelemetryPulse: "LIVE TELEMETRY"
  },
  hi: {
    dashboard: "डैशबोर्ड",
    schedule: "मेरी अनुसूची",
    procurement: "उपार्जन/खरीदी",
    notifications: "सूचनाएँ",
    profile: "प्रोफ़ाइल",
    admin: "एडमिन",
    logout: "लॉगआउट",
    login: "किसान लॉगिन",
    register: "पंजीकरण",
    adminLogin: "एडमिन लॉगिन",
    procurementDate: "खरीदी की तारीख",
    tokenNumber: "टोकन संख्या",
    procurementCentre: "खरीदी केंद्र",
    paymentStatus: "भुगतान स्थिति",
    nextVisit: "आपकी अगली उपार्जन यात्रा",
    viewFullSchedule: "पूरी अनुसूची देखें",
    printToken: "टोकन प्रिंट करें",
    centreStatus: "केंद्र की स्थिति",
    smartRecommendation: "सुझावित यात्रा समय",
    scheduled: "निर्धारित (Scheduled)",
    completed: "पूर्ण (Completed)",
    arrived: "उपस्थित (Arrived)",
    pending: "लंबित (Pending)",
    paid: "भुगतान हुआ (Paid)",
    processing: "प्रक्रियाधीन (Processing)",
    cancelled: "रद्द (Cancelled)",
    farmersAhead: "कतार में किसान",
    estimatedWaiting: "अनुमानित प्रतीक्षा समय",
    demoDataNotice: "SIH26032 प्रोटोटाइप हेतु डेमो डेटा",
    saveChanges: "परिवर्तन सहेजें",
    totalFarmers: "कुल पंजीकृत किसान",
    todaySchedule: "आज की अनुसूची",
    pendingPayments: "लंबित भुगतान",
    allCaughtUp: "सभी सूचनाएँ पढ़ी जा चुकी हैं।",
    markAsRead: "पढ़ा हुआ चिह्नित करें",
    sendReminder: "एसएमएस / व्हाट्सएप रिमाइंडर सिमुलेशन",
    reminderNotice: "अपने निर्धारित उपार्जन दिनांक व समय की सूचना फोन पर प्राप्त करें।",
    sendTestNotification: "रिमाइंडर टेस्ट संदेश भेजें",
    reminderSentSuccess: "एसएमएस एवं व्हाट्सएप मॉक अनुस्मारक सफलतापूर्वक भेजा गया!",
    qrGatePass: "फास्ट-ट्रैक डिजिटल क्यूआर गेट पास",
    scanAtCentre: "त्वरित सत्यापन हेतु उपार्जन केंद्र गेट पर स्कैन कराएं",
    viewQrCode: "स्कैन योग्य क्यूआर पास देखें",
    downloadQr: "क्यूआर पास डाउनलोड करें (PNG)",
    liveCongestionTitle: "उपार्जन केंद्रों की लाइव भीड़ / ट्रैफ़िक स्थिति",
    liveCongestionSubtitle: "प्रमुख मंडियों में वाहनों की कतार, तौलकांटा सक्रियता व प्रतीक्षा समय की रीयल-टाइम जानकारी।",
    lowTraffic: "कम भीड़ (Low Traffic)",
    moderateTraffic: "मध्यम भीड़ (Moderate)",
    heavyTraffic: "भारी भीड़ (Heavy)",
    autoRefresh: "ऑटो-रिफ्रेश (15 से.)",
    refreshTelemetry: "रीयल-टाइम अपडेट करें",
    tractorsInQueue: "कतार में ट्रैक्टर/वाहन",
    activeWeighbridges: "सक्रिय तौलकांटे",
    bestTimeVisit: "आगमन का सर्वोत्तम समय",
    liveTelemetryPulse: "लाइव स्थिति"
  }
};

function getLanguage() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang);
  applyTranslations(lang);
}

function applyTranslations(lang = getLanguage()) {
  const dict = translations[lang] || translations.en;
  
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  const langBtn = document.getElementById("langSwitchBtn");
  if (langBtn) {
    langBtn.textContent = lang === "en" ? "हिंदी" : "English";
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
