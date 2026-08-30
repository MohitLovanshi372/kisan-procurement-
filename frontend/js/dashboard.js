/**
 * Kisan Procurement Mitra - Farmer Dashboard Handler
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  const user = getUser();
  const greetingEl = document.getElementById("dashboardGreeting");
  if (greetingEl && user) {
    greetingEl.textContent = `Namaste, ${user.name.split(" ")[0]} 👋`;
  }

  await loadDashboardData();
});

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
      paymentStatEl.innerHTML = `<span class="badge ${getPaymentBadgeClass(payStatus)}">${payStatus}</span>`;
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
      nvStatus.innerHTML = `<span class="badge ${getStatusBadgeClass(status)}">${status}</span>`;
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
      centreStatusBadge.textContent = centre.status || "Open";
      centreStatusBadge.className = `badge ${centre.status === 'Open' ? 'badge-green' : 'badge-amber'}`;
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

    // 6. Load Recent Notifications Preview
    loadRecentNotifications();

  } catch (error) {
    console.error("Dashboard render error:", error);
    if (loadingIndicator) loadingIndicator.textContent = "Unable to load procurement summary. Please try logging in again.";
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
        <div class="notif-icon">🔔</div>
        <div class="notif-content">
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-msg">${escapeHtml(n.message)}</div>
          <div class="notif-time">${new Date(n.createdAt).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">You're all caught up. No new notifications.</p>`;
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
