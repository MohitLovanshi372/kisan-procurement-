/**
 * Kisan Procurement Mitra - Farmer Dashboard Handler
 */

let currentProcurement = null;
let currentCentre = null;
let currentQrData = null;
let currentSimulatorChannel = "whatsapp"; // "whatsapp" | "sms"
let currentSimulatorLang = "en"; // "en" | "hi"
let liveCentresList = [];
let activeCongestionFilter = "all";
let autoRefreshTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  updateDashboardGreeting();

  setupSimulatorEventListeners();
  setupQrEventListeners();
  setupLiveCentresEventListeners();
  await loadDashboardData();
  await loadDashboardQrCode();
  await loadCentresLiveStatus();
  startAutoRefreshInterval();
});

// Re-render dynamic elements on language change
window.addEventListener("languageChanged", () => {
  updateDashboardGreeting();
  if (currentProcurement && currentCentre) {
    refreshDashboardDynamicUI();
  }
  updateSimulatorPreview();
  renderCentresGrid();
  loadRecentNotifications();
});

function updateDashboardGreeting() {
  const user = getUser();
  const greetingEl = document.getElementById("dashboardGreeting");
  if (greetingEl && user) {
    const greetingText = t("dashboardGreeting", "Namaste");
    greetingEl.textContent = `${greetingText}, ${user.name.split(" ")[0]} 👋`;
  }
}

function refreshDashboardDynamicUI() {
  if (!currentProcurement || !currentCentre) return;

  const paymentStatEl = document.getElementById("statPaymentStatus");
  if (paymentStatEl) {
    const payStatus = currentProcurement.paymentStatus || "Pending";
    paymentStatEl.innerHTML = `<span class="badge ${getPaymentBadgeClass(payStatus)}">${getLocalizedStatusText(payStatus)}</span>`;
  }

  const nvStatus = document.getElementById("nvStatus");
  if (nvStatus) {
    const status = currentProcurement.procurementStatus || "Scheduled";
    nvStatus.innerHTML = `<span class="badge ${getStatusBadgeClass(status)}">${getLocalizedStatusText(status)}</span>`;
  }

  const centreStatusBadge = document.getElementById("centreStatusBadge");
  if (centreStatusBadge) {
    const statusVal = currentCentre.status || "Open";
    centreStatusBadge.textContent = statusVal === "Open" ? t("openStatus", "Open") : t("closedStatus", "Closed");
    centreStatusBadge.className = `badge ${statusVal === 'Open' ? 'badge-green' : 'badge-amber'}`;
  }
}

async function loadDashboardData() {
  const loadingIndicator = document.getElementById("dashboardLoading");
  const contentArea = document.getElementById("dashboardContent");

  try {
    const res = await apiFetch("/api/procurement/my");

    if (loadingIndicator) loadingIndicator.style.display = "none";
    if (contentArea) contentArea.style.display = "block";

    if (!res.success || !res.data) {
      showToast("Unable to load procurement details. Please refresh.", "error");
      return;
    }

    const { procurement, centre, smartRecommendation } = res.data;
    currentProcurement = procurement;
    currentCentre = centre;

    // 1. Fill 4 Stats Cards
    const procDateEl = document.getElementById("statProcDate");
    const tokenNumEl = document.getElementById("statTokenNumber");
    const centreNameEl = document.getElementById("statCentreName");
    const paymentStatEl = document.getElementById("statPaymentStatus");

    if (procDateEl) procDateEl.textContent = procurement.scheduleDate || "12 September 2026";
    if (tokenNumEl) tokenNumEl.textContent = procurement.tokenNumber || "TK-1042";
    if (centreNameEl) centreNameEl.textContent = centre.name ? centre.name.replace("Procurement Centre", "Mandi") : "Sanwer Mandi";
    
    if (paymentStatEl) {
      const payStatus = procurement.paymentStatus || "Pending";
      paymentStatEl.innerHTML = `<span class="badge ${getPaymentBadgeClass(payStatus)}">${getLocalizedStatusText(payStatus)}</span>`;
    }

    // 2. Next Visit Card
    const nvDate = document.getElementById("nvDate");
    const nvTime = document.getElementById("nvTime");
    const nvCentre = document.getElementById("nvCentre");
    const nvToken = document.getElementById("nvToken");
    const nvStatus = document.getElementById("nvStatus");

    if (nvDate) nvDate.textContent = procurement.scheduleDate || "12 September 2026";
    if (nvTime) nvTime.textContent = `${procurement.startTime || "10:00 AM"} – ${procurement.endTime || "11:00 AM"}`;
    if (nvCentre) nvCentre.textContent = centre.name || "Sanwer Procurement Centre";
    if (nvToken) nvToken.textContent = procurement.tokenNumber || "TK-1042";
    if (nvStatus) {
      const status = procurement.procurementStatus || "Scheduled";
      nvStatus.innerHTML = `<span class="badge ${getStatusBadgeClass(status)}">${getLocalizedStatusText(status)}</span>`;
    }

    // 3. Progress Tracker Step Activation
    updateProgressTracker(procurement.procurementStatus, procurement.paymentStatus);

    // 4. Centre Status (Queue Information)
    const centreNameHeading = document.getElementById("centreNameHeading");
    const centreStatusBadge = document.getElementById("centreStatusBadge");
    const centreFarmersAhead = document.getElementById("centreFarmersAhead");
    const centreWaitTime = document.getElementById("centreWaitTime");

    if (centreNameHeading) centreNameHeading.textContent = centre.name || "Sanwer Procurement Centre";
    if (centreStatusBadge) {
      const statusVal = centre.status || "Open";
      centreStatusBadge.textContent = statusVal === "Open" ? t("openStatus", "Open") : t("closedStatus", "Closed");
      centreStatusBadge.className = `badge ${statusVal === 'Open' ? 'badge-green' : 'badge-amber'}`;
    }
    if (centreFarmersAhead) centreFarmersAhead.textContent = centre.waitingFarmers !== undefined ? centre.waitingFarmers : 18;
    if (centreWaitTime) centreWaitTime.textContent = centre.estimatedWait ? `~${centre.estimatedWait}` : "~45 minutes";

    // 5. Smart Visit Indicator
    const smartAdviceText = document.getElementById("smartAdviceText");
    const smartWaitStatus = document.getElementById("smartWaitStatus");
    if (smartRecommendation) {
      if (smartAdviceText) smartAdviceText.textContent = smartRecommendation.advice;
      if (smartWaitStatus) {
        smartWaitStatus.textContent = smartRecommendation.status;
        smartWaitStatus.className = `badge ${smartRecommendation.level === 'low' ? 'badge-green' : smartRecommendation.level === 'high' ? 'badge-red' : 'badge-amber'}`;
      }
    }

    // 6. Update Simulator with fresh data
    updateSimulatorPreview();

    // 7. Load Recent Notifications Preview
    loadRecentNotifications();

  } catch (error) {
    console.error("Dashboard render error:", error);
    if (loadingIndicator) loadingIndicator.textContent = "Unable to load procurement summary. Please try logging in again.";
  }
}

function setupSimulatorEventListeners() {
  const openBtn = document.getElementById("btnOpenReminderModal");
  const bannerBtn = document.getElementById("btnBannerSimulate");
  const closeBtn = document.getElementById("btnCloseReminderModal");
  const doneBtn = document.getElementById("btnModalDone");
  const modal = document.getElementById("reminderModal");

  const openModal = () => {
    if (modal) {
      modal.classList.add("active");
      updateSimulatorPreview();
    }
  };

  const closeModal = () => {
    if (modal) modal.classList.remove("active");
  };

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (bannerBtn) bannerBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (doneBtn) doneBtn.addEventListener("click", closeModal);

  // Close when clicking overlay backdrop
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Channel toggles
  const tabWa = document.getElementById("simTabWa");
  const tabSms = document.getElementById("simTabSms");

  if (tabWa) {
    tabWa.addEventListener("click", () => {
      currentSimulatorChannel = "whatsapp";
      updateSimulatorPreview();
    });
  }

  if (tabSms) {
    tabSms.addEventListener("click", () => {
      currentSimulatorChannel = "sms";
      updateSimulatorPreview();
    });
  }

  // Language toggles inside simulator
  const langEnBtn = document.getElementById("simLangEn");
  const langHiBtn = document.getElementById("simLangHi");

  if (langEnBtn) {
    langEnBtn.addEventListener("click", () => {
      currentSimulatorLang = "en";
      updateSimulatorPreview();
    });
  }

  if (langHiBtn) {
    langHiBtn.addEventListener("click", () => {
      currentSimulatorLang = "hi";
      updateSimulatorPreview();
    });
  }

  // Action Buttons
  const triggerBtn = document.getElementById("btnTriggerReminderApi");
  if (triggerBtn) {
    triggerBtn.addEventListener("click", triggerReminderSimulation);
  }

  const copyBtn = document.getElementById("btnCopySimMessage");
  if (copyBtn) {
    copyBtn.addEventListener("click", copySimulatorText);
  }
}

function updateSimulatorPreview() {
  const user = getUser() || { name: "Ramesh Patel", mobile: "9876543210" };
  const proc = currentProcurement || {
    scheduleDate: "12 September 2026",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    tokenNumber: "TK-1042",
    crop: "Wheat"
  };
  const centre = currentCentre || { name: "Sanwer Procurement Centre" };

  const mobileEl = document.getElementById("simFarmerMobile");
  if (mobileEl) mobileEl.textContent = `+91 ${user.mobile || "9876543210"}`;

  const clockEl = document.getElementById("simClock");
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (clockEl) clockEl.textContent = timeStr;

  const simMsgTime = document.getElementById("simMsgTime");
  if (simMsgTime) simMsgTime.textContent = timeStr;

  // Toggle Channels UI
  const tabWa = document.getElementById("simTabWa");
  const tabSms = document.getElementById("simTabSms");
  const waHeader = document.getElementById("simWaHeader");
  const smsHeader = document.getElementById("simSmsHeader");
  const waBody = document.getElementById("simWaBody");
  const smsBody = document.getElementById("simSmsBody");

  if (currentSimulatorChannel === "whatsapp") {
    if (tabWa) tabWa.classList.add("active");
    if (tabSms) tabSms.classList.remove("active");
    if (waHeader) waHeader.style.display = "flex";
    if (smsHeader) smsHeader.style.display = "none";
    if (waBody) waBody.style.display = "flex";
    if (smsBody) smsBody.style.display = "none";
  } else {
    if (tabWa) tabWa.classList.remove("active");
    if (tabSms) tabSms.classList.add("active");
    if (waHeader) waHeader.style.display = "none";
    if (smsHeader) smsHeader.style.display = "flex";
    if (waBody) waBody.style.display = "none";
    if (smsBody) smsBody.style.display = "flex";
  }

  // Toggle Language Buttons
  const langEnBtn = document.getElementById("simLangEn");
  const langHiBtn = document.getElementById("simLangHi");
  if (currentSimulatorLang === "en") {
    if (langEnBtn) {
      langEnBtn.style.background = "var(--primary)";
      langEnBtn.style.color = "#ffffff";
    }
    if (langHiBtn) {
      langHiBtn.style.background = "transparent";
      langHiBtn.style.color = "var(--text-muted)";
    }
  } else {
    if (langEnBtn) {
      langEnBtn.style.background = "transparent";
      langEnBtn.style.color = "var(--text-muted)";
    }
    if (langHiBtn) {
      langHiBtn.style.background = "var(--primary)";
      langHiBtn.style.color = "#ffffff";
    }
  }

  // Populate dynamic message text
  const waTextEl = document.getElementById("simWaMessageText");
  const smsTextEl = document.getElementById("simSmsMessageText");

  const timeSlot = `${proc.startTime || "10:00 AM"} – ${proc.endTime || "11:00 AM"}`;
  const date = proc.scheduleDate || "12 September 2026";
  const token = proc.tokenNumber || "TK-1042";
  const crop = proc.crop || "Wheat";
  const centreName = centre.name || "Sanwer Procurement Centre";

  if (currentSimulatorLang === "en") {
    if (waTextEl) {
      waTextEl.innerHTML = `🌾 <strong>Kisan Procurement Mitra</strong><br><br>` +
        `Namaste <strong>${escapeHtml(user.name)}</strong> ji,<br><br>` +
        `Here is your scheduled procurement appointment reminder:<br>` +
        `📅 <strong>Date:</strong> ${escapeHtml(date)}<br>` +
        `⏰ <strong>Time Slot:</strong> ${escapeHtml(timeSlot)}<br>` +
        `🎫 <strong>Token Number:</strong> ${escapeHtml(token)}<br>` +
        `🌾 <strong>Crop:</strong> ${escapeHtml(crop)}<br>` +
        `🏛️ <strong>Procurement Centre:</strong> ${escapeHtml(centreName)}<br><br>` +
        `📋 <strong>Required Documents:</strong> Aadhaar Card, Bank Passbook, Land Revenue Record (Khasra).<br><br>` +
        `💡 <strong>Arrival Advisory:</strong> Please arrive promptly during your designated slot to avoid waiting.<br>` +
        `<em style="display: block; margin-top: 0.4rem; font-size: 0.75rem; color: #475569;">Toll-free Kisan Helpline: 1800-180-1551</em>`;
    }

    if (smsTextEl) {
      smsTextEl.textContent = `[GOV-MSP-KMP] Kisan Mitra: Dear ${user.name}, your ${crop} procurement (Token: ${token}) is scheduled on ${date}, ${timeSlot} at ${centreName}. Carry Aadhaar & Land docs. Helpline: 1800-180-1551.`;
    }
  } else {
    // Hindi Version
    if (waTextEl) {
      waTextEl.innerHTML = `🌾 <strong>किसान खरीद मित्र</strong><br><br>` +
        `नमस्ते <strong>${escapeHtml(user.name)}</strong> जी,<br><br>` +
        `आपकी निर्धारित कृषि उपज खरीद का अनुस्मारक:<br>` +
        `📅 <strong>दिनांक:</strong> ${escapeHtml(date)}<br>` +
        `⏰ <strong>समय स्लॉट:</strong> ${escapeHtml(timeSlot)}<br>` +
        `🎫 <strong>टोकन संख्या:</strong> ${escapeHtml(token)}<br>` +
        `🌾 <strong>फसल:</strong> ${escapeHtml(crop)}<br>` +
        `🏛️ <strong>खरीद केंद्र:</strong> ${escapeHtml(centreName)}<br><br>` +
        `📋 <strong>आवश्यक दस्तावेज:</strong> आधार कार्ड, बैंक पासबुक, खसरा खतौनी नकल।<br><br>` +
        `💡 <strong>सलाह:</strong> भीड़ से बचने के लिए कृपया अपने निर्धारित समय पर ही पहुंचें।<br>` +
        `<em style="display: block; margin-top: 0.4rem; font-size: 0.75rem; color: #475569;">किसान हेल्पलाइन: 1800-180-1551</em>`;
    }

    if (smsTextEl) {
      smsTextEl.textContent = `[GOV-MSP-KMP] किसान मित्र: प्रिय ${user.name}, आपकी ${crop} खरीद (टोकन: ${token}) ${date}, ${timeSlot} पर ${centreName} में निर्धारित है। कृपया आधार कार्ड एवं खसरा साथ लाएं।`;
    }
  }
}

async function triggerReminderSimulation() {
  const triggerBtn = document.getElementById("btnTriggerReminderApi");
  const lastSentEl = document.getElementById("simLastSentTime");
  const user = getUser();

  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `<span>⏳</span> <span>Sending Reminder...</span>`;
  }

  try {
    const res = await apiFetch("/api/notifications/simulate-reminder", {
      method: "POST",
      body: JSON.stringify({
        channel: currentSimulatorChannel,
        mobile: user ? user.mobile : "9876543210",
        lang: currentSimulatorLang
      })
    });

    if (res.success) {
      const channelLabel = currentSimulatorChannel === "sms" ? "SMS" : "WhatsApp";
      showToast(`📲 Mock ${channelLabel} reminder sent to +91 ${user ? user.mobile : "9876543210"}!`, "success");

      if (lastSentEl) {
        lastSentEl.textContent = `Dispatched just now (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }

      // Refresh notification preview on the dashboard
      await loadRecentNotifications();
    } else {
      showToast(res.message || "Failed to simulate reminder", "error");
    }
  } catch (err) {
    console.error("Trigger reminder error:", err);
    showToast("Network error simulating notification", "error");
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = `<span>⚡</span> <span>Send Mock Reminder Now</span>`;
    }
  }
}

function copySimulatorText() {
  let textToCopy = "";
  if (currentSimulatorChannel === "sms") {
    const smsEl = document.getElementById("simSmsMessageText");
    textToCopy = smsEl ? smsEl.textContent.trim() : "";
  } else {
    const waEl = document.getElementById("simWaMessageText");
    textToCopy = waEl ? waEl.innerText.trim() : "";
  }

  if (navigator.clipboard && textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast("Notification message copied to clipboard! 📋", "success");
    }).catch(() => {
      showToast("Failed to copy message", "error");
    });
  } else {
    showToast("Message copied to clipboard! 📋", "success");
  }
}

function updateProgressTracker(procStatus, payStatus) {
  // Steps: 1: Registration, 2: Token Generated, 3: Scheduled, 4: Arrived, 5: Procurement Completed, 6: Payment Processed
  let currentStep = 3; // default 'Scheduled'

  if (payStatus === "Paid") {
    currentStep = 6;
  } else if (procStatus === "Procurement Completed") {
    currentStep = 5;
  } else if (procStatus === "Arrived") {
    currentStep = 4;
  } else if (procStatus === "Scheduled") {
    currentStep = 3;
  } else if (procStatus === "Token Generated") {
    currentStep = 2;
  } else if (procStatus === "Registration") {
    currentStep = 1;
  }

  for (let i = 1; i <= 6; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    if (stepEl) {
      stepEl.classList.remove("completed", "active");
      if (i < currentStep) {
        stepEl.classList.add("completed");
        const node = stepEl.querySelector(".step-node");
        if (node) node.textContent = "✓";
      } else if (i === currentStep) {
        stepEl.classList.add("active");
        const node = stepEl.querySelector(".step-node");
        if (node) node.textContent = i;
      } else {
        const node = stepEl.querySelector(".step-node");
        if (node) node.textContent = "○";
      }
    }
  }
}

async function loadRecentNotifications() {
  const container = document.getElementById("dashboardRecentNotifs");
  if (!container) return;

  const res = await apiFetch("/api/notifications");
  if (res.success && res.data && res.data.length > 0) {
    const recent = res.data.slice(0, 3);
    container.innerHTML = recent.map(n => `
      <div class="notification-card ${n.isRead ? '' : 'unread'}">
        <div class="notif-icon">${n.type === 'Reminder' ? '📲' : '🔔'}</div>
        <div class="notif-content">
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-msg">${escapeHtml(n.message)}</div>
          <div class="notif-time">${new Date(n.createdAt).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">${t("allCaughtUpMsg", "You're all caught up. No new notifications.")}</p>`;
  }
}

function getLocalizedStatusText(status) {
  switch (status) {
    case "Procurement Completed":
    case "Completed":
      return t("completed", "Completed");
    case "Scheduled":
      return t("scheduled", "Scheduled");
    case "Token Generated":
      return t("stepToken", "Token Generated");
    case "Arrived":
      return t("arrived", "Arrived");
    case "Pending":
      return t("pending", "Pending");
    case "Paid":
      return t("paid", "Paid");
    case "Processing":
      return t("processing", "Processing");
    case "Cancelled":
      return t("cancelled", "Cancelled");
    default:
      return status;
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "Procurement Completed":
    case "Completed":
      return "badge-green";
    case "Scheduled":
    case "Token Generated":
      return "badge-blue";
    case "Arrived":
    case "Pending":
      return "badge-amber";
    case "Cancelled":
      return "badge-red";
    default:
      return "badge-gray";
  }
}

function getPaymentBadgeClass(status) {
  switch (status) {
    case "Paid":
      return "badge-green";
    case "Processing":
      return "badge-blue";
    case "Pending":
      return "badge-amber";
    default:
      return "badge-gray";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ==========================================================================
   QR Code Generator & Fast-Track Gate Scanner Logic
   ========================================================================== */

async function loadDashboardQrCode() {
  const thumbImg = document.getElementById("dashboardQrThumb");
  const thumbLoading = document.getElementById("dashboardQrThumbLoading");
  const dashTokenBadge = document.getElementById("dashQrTokenBadge");
  const dashFarmer = document.getElementById("dashQrFarmer");
  const dashCrop = document.getElementById("dashQrCrop");
  const dashCentre = document.getElementById("dashQrCentre");

  try {
    const res = await apiFetch("/api/procurement/qr-code");
    if (res.success && res.data) {
      currentQrData = res.data;

      // Update thumbnail image
      if (thumbImg) {
        thumbImg.src = res.data.qrDataUrl;
        thumbImg.style.display = "block";
      }
      if (thumbLoading) thumbLoading.style.display = "none";

      // Update Dashboard Overview Labels
      if (dashTokenBadge) dashTokenBadge.textContent = res.data.tokenNumber || "TK-1042";
      if (dashFarmer) dashFarmer.textContent = res.data.farmerName || "Ramesh Patel";
      if (dashCrop) dashCrop.textContent = `${res.data.crop || "Wheat"} (${res.data.quantity || "18 Qtl"})`;
      if (dashCentre) dashCentre.textContent = res.data.centreName ? res.data.centreName.replace("Procurement Centre", "Mandi") : "Sanwer Mandi";

      // Pre-fill Modal Elements
      populateQrModal(res.data);
    }
  } catch (error) {
    console.error("QR Code loading error:", error);
    if (thumbLoading) thumbLoading.textContent = "QR Error";
  }
}

function populateQrModal(qrData) {
  if (!qrData) return;

  const modalImg = document.getElementById("modalQrImage");
  const modalLoading = document.getElementById("modalQrLoading");
  const modalToken = document.getElementById("modalQrToken");
  const modalFarmer = document.getElementById("modalQrFarmer");
  const modalFarmerId = document.getElementById("modalQrFarmerId");
  const modalCrop = document.getElementById("modalQrCrop");
  const modalCentre = document.getElementById("modalQrCentre");
  const modalSlot = document.getElementById("modalQrSlot");
  const modalHash = document.getElementById("modalQrHash");
  const scannerSampleQr = document.getElementById("scannerSampleQr");

  if (modalImg) {
    modalImg.src = qrData.qrDataUrl;
    modalImg.style.display = "block";
  }
  if (modalLoading) modalLoading.style.display = "none";

  if (scannerSampleQr) {
    scannerSampleQr.src = qrData.qrDataUrl;
  }

  if (modalToken) modalToken.textContent = qrData.tokenNumber;
  if (modalFarmer) modalFarmer.textContent = qrData.farmerName;
  if (modalFarmerId) modalFarmerId.textContent = qrData.farmerId;
  if (modalCrop) modalCrop.textContent = `${qrData.crop} (${qrData.quantity})`;
  if (modalCentre) modalCentre.textContent = qrData.centreName;
  if (modalSlot) modalSlot.textContent = `${qrData.scheduleDate} • ${qrData.timeSlot}`;
  if (modalHash) modalHash.textContent = qrData.verificationHash || `VER-${qrData.tokenNumber}`;
}

function setupQrEventListeners() {
  const qrModal = document.getElementById("qrPassModal");
  const cardTokenBox = document.getElementById("cardTokenBox");
  const btnQuickQr = document.getElementById("btnQuickQrPass");
  const btnThumb = document.getElementById("btnThumbOpenQr");
  const btnMainOpen = document.getElementById("btnMainOpenQrModal");
  const btnClose = document.getElementById("btnCloseQrModal");

  const openModal = () => {
    if (qrModal) {
      qrModal.classList.add("active");
      if (currentQrData) populateQrModal(currentQrData);
      switchQrTab("pass");
    }
  };

  const closeModal = () => {
    if (qrModal) qrModal.classList.remove("active");
  };

  if (cardTokenBox) cardTokenBox.addEventListener("click", openModal);
  if (btnQuickQr) btnQuickQr.addEventListener("click", openModal);
  if (btnThumb) btnThumb.addEventListener("click", openModal);
  if (btnMainOpen) btnMainOpen.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);

  if (qrModal) {
    qrModal.addEventListener("click", (e) => {
      if (e.target === qrModal) closeModal();
    });
  }

  // Tab buttons in modal
  const tabPass = document.getElementById("qrTabPass");
  const tabScanner = document.getElementById("qrTabScanner");
  const btnSwitchToScanner = document.getElementById("btnSwitchToScanner");
  const btnBackToPass = document.getElementById("btnBackToQrPass");

  if (tabPass) tabPass.addEventListener("click", () => switchQrTab("pass"));
  if (tabScanner) tabScanner.addEventListener("click", () => switchQrTab("scanner"));
  if (btnSwitchToScanner) btnSwitchToScanner.addEventListener("click", () => switchQrTab("scanner"));
  if (btnBackToPass) btnBackToPass.addEventListener("click", () => switchQrTab("pass"));

  // Download & Print buttons
  const btnMainDownload = document.getElementById("btnMainDownloadQr");
  const btnActionDownload = document.getElementById("btnDownloadQrAction");
  const btnActionPrint = document.getElementById("btnPrintQrAction");

  if (btnMainDownload) btnMainDownload.addEventListener("click", downloadQrCodeImage);
  if (btnActionDownload) btnActionDownload.addEventListener("click", downloadQrCodeImage);
  if (btnActionPrint) btnActionPrint.addEventListener("click", () => window.print());

  // Scanner Simulator Button
  const btnPerformGateScan = document.getElementById("btnPerformGateScan");
  const btnMainSimulateScan = document.getElementById("btnMainSimulateScan");

  if (btnPerformGateScan) btnPerformGateScan.addEventListener("click", performGateScanSimulation);
  if (btnMainSimulateScan) {
    btnMainSimulateScan.addEventListener("click", () => {
      openModal();
      switchQrTab("scanner");
      setTimeout(() => {
        performGateScanSimulation();
      }, 400);
    });
  }
}

function switchQrTab(tabName) {
  const tabPass = document.getElementById("qrTabPass");
  const tabScanner = document.getElementById("qrTabScanner");
  const viewPass = document.getElementById("qrPassView");
  const viewScanner = document.getElementById("qrScannerView");
  const scanLiveClock = document.getElementById("scanLiveClock");

  if (scanLiveClock) {
    scanLiveClock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  if (tabName === "pass") {
    if (tabPass) tabPass.classList.add("active");
    if (tabScanner) tabScanner.classList.remove("active");
    if (viewPass) viewPass.style.display = "block";
    if (viewScanner) viewScanner.style.display = "none";
  } else {
    if (tabPass) tabPass.classList.remove("active");
    if (tabScanner) tabScanner.classList.add("active");
    if (viewPass) viewPass.style.display = "none";
    if (viewScanner) viewScanner.style.display = "block";
  }
}

function downloadQrCodeImage() {
  if (!currentQrData || !currentQrData.qrDataUrl) {
    showToast("QR code is not ready yet. Please wait.", "error");
    return;
  }

  try {
    const token = currentQrData.tokenNumber || "Token";
    const link = document.createElement("a");
    link.href = currentQrData.qrDataUrl;
    link.download = `Kisan_Mitra_QR_Pass_${token}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Scannable QR Pass for ${token} downloaded! 📥`, "success");
  } catch (err) {
    console.error("Download QR error:", err);
    showToast("Unable to download QR code", "error");
  }
}

async function performGateScanSimulation() {
  const scanBtn = document.getElementById("btnPerformGateScan");
  const resultBox = document.getElementById("gateScanResultBox");
  const token = currentQrData ? currentQrData.tokenNumber : "TK-1042";

  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.innerHTML = `<span>⏳</span> <span>DECODING QR LASER STREAM...</span>`;
  }

  if (resultBox) resultBox.style.display = "none";

  try {
    // Call backend gate verification endpoint
    const res = await apiFetch("/api/procurement/verify-qr", {
      method: "POST",
      body: JSON.stringify({
        tokenNumber: token,
        qrPayload: currentQrData ? currentQrData.qrPayload : undefined
      })
    });

    if (res.success && res.data) {
      const d = res.data;
      const resFarmer = document.getElementById("resScanFarmer");
      const resToken = document.getElementById("resScanToken");
      const resCrop = document.getElementById("resScanCrop");
      const resCentre = document.getElementById("resScanCentre");
      const resSlot = document.getElementById("resScanSlot");
      const resTime = document.getElementById("resScanTime");
      const resTitle = document.getElementById("gateScanResultTitle");

      if (resFarmer) resFarmer.textContent = d.farmerName;
      if (resToken) resToken.textContent = d.tokenNumber;
      if (resCrop) resCrop.textContent = `${d.crop} (${d.quantity})`;
      if (resCentre) resCentre.textContent = d.centre;
      if (resSlot) resSlot.textContent = `${d.scheduleDate} • ${d.timeSlot}`;
      if (resTime) resTime.textContent = d.verifiedAt || new Date().toLocaleTimeString();
      if (resTitle) resTitle.textContent = `ENTRY AUTHORIZED — ${d.gateAssigned || "GATE 2 (WEIGHBRIDGE SCALE A)"}`;

      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      showToast("✅ QR Pass Scanned: Gate Entry Authorized!", "success");
    } else {
      showToast(res.message || "Invalid or unverified QR code", "error");
    }
  } catch (err) {
    console.error("Gate scan error:", err);
    showToast("Gate scanner communication error", "error");
  } finally {
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `<span>⚡</span> <span>SCAN & VERIFY TOKEN (${token})</span>`;
    }
  }
}

/* ==========================================================================
   Live Mandi Congestion Status Widget Logic
   ========================================================================== */

async function loadCentresLiveStatus(isManualRefresh = false) {
  const refreshSpinner = document.getElementById("telemetryRefreshSpinner");
  const lastUpdatedEl = document.getElementById("telemetryLastUpdated");

  if (isManualRefresh && refreshSpinner) {
    refreshSpinner.style.display = "inline-block";
    refreshSpinner.style.animation = "spin 1s linear infinite";
  }

  try {
    const res = await apiFetch("/api/centres/live-status");
    if (res.success && res.data) {
      liveCentresList = res.data;

      // Update KPI Statistics
      if (res.summary) {
        const kpiTotal = document.getElementById("kpiTotalCentres");
        const kpiLow = document.getElementById("kpiLowTraffic");
        const kpiMod = document.getElementById("kpiModerateTraffic");
        const kpiHeavy = document.getElementById("kpiHeavyTraffic");
        const kpiFastest = document.getElementById("kpiFastestCentre");

        if (kpiTotal) kpiTotal.textContent = res.summary.totalCentres || liveCentresList.length;
        if (kpiLow) kpiLow.textContent = res.summary.lowTrafficCount || 0;
        if (kpiMod) kpiMod.textContent = res.summary.moderateCount || 0;
        if (kpiHeavy) kpiHeavy.textContent = res.summary.heavyCount || 0;
        if (kpiFastest && res.summary.recommendedFastestCentre) {
          const fast = res.summary.recommendedFastestCentre;
          kpiFastest.textContent = `${fast.name.replace("Procurement Centre", "").replace("Krishi Upaj Mandi", "").trim()} (~${fast.wait})`;
        }

        // Update Filter chips text counts
        const btnAll = document.getElementById("filterAllCentres");
        const btnLow = document.getElementById("filterLowCentres");
        const btnMod = document.getElementById("filterModCentres");
        const btnHeavy = document.getElementById("filterHeavyCentres");

        if (btnAll) btnAll.textContent = `All (${res.summary.totalCentres || liveCentresList.length})`;
        if (btnLow) btnLow.textContent = `🟢 Low Traffic (${res.summary.lowTrafficCount || 0})`;
        if (btnMod) btnMod.textContent = `🟡 Moderate (${res.summary.moderateCount || 0})`;
        if (btnHeavy) btnHeavy.textContent = `🔴 Heavy (${res.summary.heavyCount || 0})`;
      }

      // Update Last Updated Time
      if (lastUpdatedEl) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastUpdatedEl.textContent = `Updated: ${timeStr}`;
      }

      renderCentresGrid();

      if (isManualRefresh) {
        showToast("Live telemetry refreshed with latest mandi data.", "success");
      }
    }
  } catch (err) {
    console.error("Live centres fetch error:", err);
    if (isManualRefresh) showToast("Failed to refresh mandi telemetry", "error");
  } finally {
    if (refreshSpinner) {
      refreshSpinner.style.animation = "none";
    }
  }
}

function renderCentresGrid() {
  const container = document.getElementById("liveCentresGrid");
  const searchInput = document.getElementById("centreSearchInput");
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!container) return;

  let filtered = liveCentresList.filter(c => {
    // Congestion Level Filter
    if (activeCongestionFilter !== "all" && c.congestionLevel !== activeCongestionFilter) {
      return false;
    }
    // Search query filter
    if (searchTerm) {
      const matchName = (c.name || "").toLowerCase().includes(searchTerm);
      const matchDistrict = (c.district || "").toLowerCase().includes(searchTerm);
      const matchLocation = (c.location || "").toLowerCase().includes(searchTerm);
      return matchName || matchDistrict || matchLocation;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-color); color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
        <div style="font-weight: 600;">${t("noMatchedCentres", "No procurement centres matched your filter or search.")}</div>
        <button class="btn btn-outline-primary btn-sm" style="margin-top: 0.75rem;" onclick="resetCentresFilter()">${t("resetFilters", "Reset Filters")}</button>
      </div>
    `;
    return;
  }

  const user = getUser();
  const preferredCentreName = (user && user.preferredCentre) || (currentCentre && currentCentre.name) || "Sanwer Procurement Centre";

  container.innerHTML = filtered.map(c => {
    const isPreferred = c.name === preferredCentreName;
    const levelClass = c.congestionLevel === "Low Traffic" ? "congestion-low" :
                       c.congestionLevel === "Moderate" ? "congestion-moderate" : "congestion-heavy";
    const gaugeClass = c.congestionLevel === "Low Traffic" ? "gauge-low" :
                       c.congestionLevel === "Moderate" ? "gauge-moderate" : "gauge-heavy";
    const levelIcon = c.congestionLevel === "Low Traffic" ? "🟢" :
                      c.congestionLevel === "Moderate" ? "🟡" : "🔴";
    
    const localizedCongestion = c.congestionLevel === "Low Traffic" ? t("lowTraffic", "Low Traffic") :
                                c.congestionLevel === "Moderate" ? t("moderateTraffic", "Moderate") :
                                t("heavyTraffic", "Heavy");

    const trendText = c.trend === "Rising" ? t("risingTrend", "↗ Rising") :
                      c.trend === "Easing" ? t("easingTrend", "↘ Easing") :
                      t("stableTrend", "→ Stable");

    const score = c.congestionScore || (c.congestionLevel === "Low Traffic" ? 25 : c.congestionLevel === "Moderate" ? 55 : 85);

    return `
      <div class="centre-congestion-card ${isPreferred ? 'highlight-preferred' : ''}" id="card-centre-${c._id}">
        <div>
          <!-- Header: Name & Badges -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; flex-wrap: wrap;">
                <span class="badge badge-gray" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">📍 ${escapeHtml(c.district || "Indore")}</span>
                ${isPreferred ? `<span class="badge badge-green" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">⭐ ${t("assignedCentre", "Assigned Centre")}</span>` : ''}
              </div>
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.3;">
                ${escapeHtml(c.name)}
              </h4>
            </div>
            
            <div style="text-align: right;">
              <span class="congestion-badge ${levelClass}">
                <span>${levelIcon}</span>
                <span>${escapeHtml(localizedCongestion)}</span>
              </span>
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; margin-top: 0.2rem;">
                ${trendText}
              </div>
            </div>
          </div>

          <!-- Location & Working Hours -->
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${escapeHtml(c.location || "Mandi Campus")} • 🕒 ${escapeHtml(c.workingHours || "09:00 AM – 05:00 PM")}
          </div>

          <!-- Traffic Density Gauge Bar -->
          <div style="margin-bottom: 0.85rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.2rem;">
              <span>${t("gateTrafficDensity", "Gate Traffic Density")}</span>
              <span style="color: var(--text-main);">${score}% ${t("capacityText", "Capacity")}</span>
            </div>
            <div class="traffic-gauge-container">
              <div class="traffic-gauge-fill ${gaugeClass}" style="width: ${score}%;"></div>
            </div>
          </div>

          <!-- 3-Box Telemetry Metrics -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem; margin-bottom: 0.85rem;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.4rem; text-align: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">${t("estWait", "EST. WAIT")}</div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--primary-dark); margin-top: 0.15rem;">
                ${escapeHtml(c.estimatedWait || "25 mins")}
              </div>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.4rem; text-align: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">${t("tractorLine", "TRACTOR LINE")}</div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-top: 0.15rem;">
                ${c.queueTractors || Math.round((c.waitingFarmers || 10) * 0.7)} <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-muted);">(${c.waitingFarmers || 0})</span>
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.4rem; text-align: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">${t("scalesActive", "SCALES ACTIVE")}</div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-top: 0.15rem;">
                ${c.activeWeighbridges || 2} / ${c.totalWeighbridges || 3}
              </div>
            </div>
          </div>

          <!-- Recommended Window Banner -->
          <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 6px; padding: 0.45rem 0.65rem; font-size: 0.74rem; color: #166534; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
            <span>💡 ${t("bestSlot", "Best Slot:")} <strong>${escapeHtml(c.bestTimeToVisit || "02:00 PM – 04:00 PM")}</strong></span>
            <span style="font-size: 0.7rem; color: #15803d; font-weight: 600;">${t("minWait", "Min Wait")}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.45rem; margin-top: 0.5rem;">
          <button class="btn btn-outline-primary btn-xs" style="flex: 1; font-weight: 600; font-size: 0.75rem; padding: 0.35rem 0.5rem;" onclick="openCentreForecastModal('${c._id}')">
            📊 ${t("hourlyForecast", "Hourly Forecast")}
          </button>
          ${!isPreferred ? `
            <button class="btn btn-secondary btn-xs" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;" onclick="setAsPreferredCentre('${c.name}')">
              📌 ${t("setPreferred", "Set Preferred")}
            </button>
          ` : `
            <span style="display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #15803d; padding: 0.35rem 0.6rem; background: #ecfdf5; border-radius: 4px; border: 1px solid #a7f3d0;">
              ✓ ${t("currentBadge", "Current")}
            </span>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function resetCentresFilter() {
  activeCongestionFilter = "all";
  const searchInput = document.getElementById("centreSearchInput");
  if (searchInput) searchInput.value = "";

  document.querySelectorAll(".filter-chip").forEach(chip => {
    if (chip.getAttribute("data-congestion-filter") === "all") chip.classList.add("active");
    else chip.classList.remove("active");
  });

  renderCentresGrid();
}

function setupLiveCentresEventListeners() {
  // Filter chips
  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeCongestionFilter = chip.getAttribute("data-congestion-filter") || "all";
      renderCentresGrid();
    });
  });

  // Search input
  const searchInput = document.getElementById("centreSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderCentresGrid();
    });
  }

  // Manual refresh button
  const btnRefresh = document.getElementById("btnRefreshCentresTelemetry");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      // Trigger simulation delta first
      try {
        await apiFetch("/api/centres/live-status/refresh", { method: "POST" });
      } catch (e) {
        console.warn("Simulation refresh trigger error:", e);
      }
      await loadCentresLiveStatus(true);
    });
  }

  // Auto-refresh checkbox
  const chkAuto = document.getElementById("chkAutoRefresh");
  if (chkAuto) {
    chkAuto.addEventListener("change", () => {
      if (chkAuto.checked) {
        startAutoRefreshInterval();
        showToast("Auto-refresh enabled (15s polling).", "info");
      } else {
        stopAutoRefreshInterval();
        showToast("Auto-refresh paused.", "info");
      }
    });
  }

  // Centre Modal Close
  const modal = document.getElementById("centreForecastModal");
  const btnClose = document.getElementById("btnCloseCentreModal");
  if (btnClose) {
    btnClose.addEventListener("click", () => {
      if (modal) modal.classList.remove("active");
    });
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  }
}

function startAutoRefreshInterval() {
  stopAutoRefreshInterval();
  autoRefreshTimer = setInterval(() => {
    const chkAuto = document.getElementById("chkAutoRefresh");
    if (chkAuto && chkAuto.checked) {
      loadCentresLiveStatus(false);
    }
  }, 15000);
}

function stopAutoRefreshInterval() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

window.openCentreForecastModal = async function(centreId) {
  const modal = document.getElementById("centreForecastModal");
  const centre = liveCentresList.find(c => String(c._id) === String(centreId) || c.name === centreId);

  if (!centre) {
    showToast("Procurement centre information not found", "error");
    return;
  }

  // Fill Modal Fields
  const mName = document.getElementById("modalCentreName");
  const mLocation = document.getElementById("modalCentreLocation");
  const mBadge = document.getElementById("modalCentreCongestionBadge");
  const mWait = document.getElementById("modalCentreWaitTime");
  const mTractors = document.getElementById("modalCentreTractors");
  const mScales = document.getElementById("modalCentreScales");
  const mDensityText = document.getElementById("modalCentreDensityText");
  const mGaugeFill = document.getElementById("modalCentreGaugeFill");
  const mBestTime = document.getElementById("modalCentreBestTime");
  const mPeakHours = document.getElementById("modalCentrePeakHours");
  const mForecastGrid = document.getElementById("modalHourlyForecastGrid");
  const btnPref = document.getElementById("btnSetAsPreferredModal");

  if (mName) mName.textContent = centre.name;
  if (mLocation) mLocation.textContent = `${centre.location || "Mandi Campus, Indore"} • Operating: ${centre.workingHours || "09:00 AM – 05:00 PM"}`;

  const levelClass = centre.congestionLevel === "Low Traffic" ? "congestion-low" :
                     centre.congestionLevel === "Moderate" ? "congestion-moderate" : "congestion-heavy";
  const gaugeClass = centre.congestionLevel === "Low Traffic" ? "gauge-low" :
                     centre.congestionLevel === "Moderate" ? "gauge-moderate" : "gauge-heavy";
  const levelIcon = centre.congestionLevel === "Low Traffic" ? "🟢" :
                    centre.congestionLevel === "Moderate" ? "🟡" : "🔴";

  const localizedCongestion = centre.congestionLevel === "Low Traffic" ? t("lowTraffic", "Low Traffic") :
                              centre.congestionLevel === "Moderate" ? t("moderateTraffic", "Moderate") :
                              t("heavyTraffic", "Heavy");

  if (mBadge) {
    mBadge.className = `congestion-badge ${levelClass}`;
    mBadge.innerHTML = `<span>${levelIcon}</span> <span>${escapeHtml(localizedCongestion)}</span>`;
  }

  if (mWait) mWait.textContent = centre.estimatedWait || "25 mins";
  if (mTractors) mTractors.textContent = `${centre.queueTractors || Math.round((centre.waitingFarmers || 10) * 0.7)} Tractors`;
  if (mScales) mScales.textContent = `${centre.activeWeighbridges || 2} / ${centre.totalWeighbridges || 3} Active`;

  const score = centre.congestionScore || (centre.congestionLevel === "Low Traffic" ? 22 : centre.congestionLevel === "Moderate" ? 58 : 88);
  if (mDensityText) mDensityText.textContent = `${score}% ${t("capacityText", "Capacity")} (${localizedCongestion})`;
  if (mGaugeFill) {
    mGaugeFill.className = `traffic-gauge-fill ${gaugeClass}`;
    mGaugeFill.style.width = `${score}%`;
  }

  if (mBestTime) mBestTime.textContent = `${centre.bestTimeToVisit || "02:00 PM – 04:00 PM"} (${t("minWait", "Min Wait")})`;
  if (mPeakHours) mPeakHours.textContent = centre.peakHours || "11:00 AM – 01:30 PM";

  // Render Hourly Forecast Curve
  if (mForecastGrid) {
    const defaultForecast = [
      { time: "09:00 AM", level: t("lowTraffic", "Low"), wait: "10m", color: "#15803d", bg: "#f0fdf4" },
      { time: "11:00 AM", level: t("heavyTraffic", "Peak"), wait: centre.congestionLevel === 'Heavy' ? "1h 30m" : "55m", color: "#be123c", bg: "#fff1f2" },
      { time: "01:00 PM", level: t("moderateTraffic", "Moderate"), wait: "35m", color: "#a16207", bg: "#fefce8" },
      { time: "03:00 PM", level: t("optProcStatus", "Optimal"), wait: "15m", color: "#15803d", bg: "#f0fdf4" },
      { time: "05:00 PM", level: t("lowTraffic", "Low"), wait: "10m", color: "#15803d", bg: "#f0fdf4" }
    ];

    mForecastGrid.innerHTML = defaultForecast.map(f => `
      <div class="forecast-hour-pill" style="background: ${f.bg}; border-color: ${f.color}40;">
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.72rem;">${f.time}</div>
        <div style="font-weight: 800; color: ${f.color}; font-size: 0.85rem; margin: 0.15rem 0;">${f.wait}</div>
        <div style="font-size: 0.65rem; color: ${f.color}; font-weight: 700; text-transform: uppercase;">${escapeHtml(f.level)}</div>
      </div>
    `).join("");
  }

  if (btnPref) {
    btnPref.onclick = () => {
      setAsPreferredCentre(centre.name);
      if (modal) modal.classList.remove("active");
    };
  }

  if (modal) modal.classList.add("active");
};

window.setAsPreferredCentre = async function(centreName) {
  try {
    const res = await apiFetch("/api/farmer/profile", {
      method: "PUT",
      body: JSON.stringify({ preferredCentre: centreName })
    });

    if (res.success) {
      const user = getUser();
      if (user) {
        user.preferredCentre = centreName;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      showToast(`✅ ${centreName} set as your primary procurement centre!`, "success");
      renderCentresGrid();
    } else {
      showToast(res.message || "Failed to update preferred centre", "error");
    }
  } catch (err) {
    console.error("Update centre preference error:", err);
    showToast("Preferred centre updated locally.", "success");
  }
};
