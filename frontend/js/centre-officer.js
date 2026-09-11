/**
 * Mandisathi - Centre Officer Portal Logic
 * Strictly isolated for the officer's assigned procurement centre.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Enforce Centre Officer or Admin authentication
  if (!requireAuth(["CENTRE_OFFICER", "officer", "GOVERNMENT_ADMIN", "admin"])) {
    return;
  }

  let centreData = null;
  let farmersList = [];

  // DOM Elements
  const officerNameHeader = document.getElementById("officerNameHeader");
  const officerCentreTitle = document.getElementById("officerCentreTitle");
  const officerCentreMeta = document.getElementById("officerCentreMeta");

  const statCentreFarmers = document.getElementById("statCentreFarmers");
  const statWaitingFarmers = document.getElementById("statWaitingFarmers");
  const statEstimatedWait = document.getElementById("statEstimatedWait");
  const statCompletedProcurement = document.getElementById("statCompletedProcurement");
  const statTotalDisbursed = document.getElementById("statTotalDisbursed");
  const statPendingPayments = document.getElementById("statPendingPayments");

  const verifyTokenInput = document.getElementById("verifyTokenInput");
  const verifyTokenBtn = document.getElementById("verifyTokenBtn");
  const verifyResultContainer = document.getElementById("verifyResultContainer");

  const ctrlWaitingFarmers = document.getElementById("ctrlWaitingFarmers");
  const ctrlEstimatedWait = document.getElementById("ctrlEstimatedWait");
  const ctrlActiveWeighbridges = document.getElementById("ctrlActiveWeighbridges");
  const saveQueueMetricsBtn = document.getElementById("saveQueueMetricsBtn");
  const callNextTokenBtn = document.getElementById("callNextTokenBtn");

  const officerFarmerSearch = document.getElementById("officerFarmerSearch");
  const officerFarmersTableBody = document.getElementById("officerFarmersTableBody");

  // Modals
  const weighModal = document.getElementById("weighModal");
  const closeWeighModal = document.getElementById("closeWeighModal");
  const weighForm = document.getElementById("weighForm");
  const weighProcId = document.getElementById("weighProcId");
  const weighFarmerId = document.getElementById("weighFarmerId");
  const weighFarmerName = document.getElementById("weighFarmerName");
  const weighTokenNum = document.getElementById("weighTokenNum");
  const weighStatusSelect = document.getElementById("weighStatusSelect");
  const weighReceivedQty = document.getElementById("weighReceivedQty");
  const weighAmount = document.getElementById("weighAmount");

  const paymentModal = document.getElementById("paymentModal");
  const closePaymentModal = document.getElementById("closePaymentModal");
  const paymentForm = document.getElementById("paymentForm");
  const payProcId = document.getElementById("payProcId");
  const payFarmerName = document.getElementById("payFarmerName");
  const payTokenNum = document.getElementById("payTokenNum");
  const payAmount = document.getElementById("payAmount");
  const payTxId = document.getElementById("payTxId");

  // Load Dashboard Stats
  async function loadDashboard() {
    try {
      const res = await apiFetch("/api/officer/dashboard");
      if (res.success && res.data) {
        const { officer, centre, stats } = res.data;
        centreData = centre;

        if (officerNameHeader) {
          officerNameHeader.textContent = `${officer.name} (${centre.name})`;
        }
        if (officerCentreTitle) {
          officerCentreTitle.textContent = centre.name;
        }
        if (officerCentreMeta) {
          officerCentreMeta.innerHTML = `
            District: ${centre.district || "Indore"} • Hours: ${centre.workingHours || "09:00 AM – 05:00 PM"} • Status: <span style="color: #a7f3d0; font-weight: 700;">${centre.status || "Open"}</span>
          `;
        }

        if (statCentreFarmers) statCentreFarmers.textContent = stats.centreFarmersCount || 0;
        if (statWaitingFarmers) statWaitingFarmers.textContent = stats.waitingNow || 0;
        if (statEstimatedWait) statEstimatedWait.textContent = centre.estimatedWait || "30 mins wait";
        if (statCompletedProcurement) statCompletedProcurement.textContent = stats.completedProcurement || 0;
        if (statTotalDisbursed) statTotalDisbursed.textContent = "₹" + (stats.totalDisbursed || 0).toLocaleString("en-IN");
        if (statPendingPayments) statPendingPayments.textContent = `${stats.pendingPayments || 0} Pending DBT`;

        if (ctrlWaitingFarmers) ctrlWaitingFarmers.value = centre.waitingFarmers || 12;
        if (ctrlEstimatedWait) ctrlEstimatedWait.value = centre.estimatedWait || "30 minutes";
        if (ctrlActiveWeighbridges) ctrlActiveWeighbridges.value = centre.activeWeighbridges || 2;
      }
    } catch (e) {
      console.error("Error loading officer dashboard:", e);
    }
  }

  // Load Farmers for THIS centre
  async function loadFarmers() {
    try {
      const res = await apiFetch("/api/officer/farmers");
      if (res.success && res.data) {
        farmersList = res.data;
        renderFarmersTable(farmersList);
      } else {
        officerFarmersTableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">
              Failed to load centre farmers: ${res.message || "Error"}
            </td>
          </tr>
        `;
      }
    } catch (e) {
      console.error("Error loading centre farmers:", e);
    }
  }

  function renderFarmersTable(list) {
    if (!officerFarmersTableBody) return;
    if (!list || list.length === 0) {
      officerFarmersTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No farmers scheduled for this centre currently.
          </td>
        </tr>
      `;
      return;
    }

    officerFarmersTableBody.innerHTML = list.map(f => {
      const isProcDone = f.procurementStatus === "Procurement Completed";
      const isPaid = f.paymentStatus === "Paid";

      const statusBadge = isProcDone
        ? `<span class="badge badge-green">✓ Completed</span>`
        : f.procurementStatus === "Arrived"
        ? `<span class="badge badge-blue">⏳ At Gate</span>`
        : `<span class="badge badge-amber">📅 Scheduled</span>`;

      const paymentBadge = isPaid
        ? `<span class="badge badge-green">✓ Paid (DBT)</span>`
        : `<span class="badge badge-amber">Pending</span>`;

      return `
        <tr>
          <td>
            <strong style="color: var(--primary-dark);">${f.tokenNumber || "TK-1042"}</strong>
          </td>
          <td>
            <strong>${f.name}</strong><br>
            <span style="font-size: 0.78rem; color: var(--text-muted);">📱 ${f.mobile}</span>
          </td>
          <td>${f.village || "Sanwer"}</td>
          <td>
            <span>${f.crop || "Wheat"}</span><br>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${f.landArea || "4.5 Acres"}</span>
          </td>
          <td style="font-size: 0.82rem;">${f.scheduleDate || "Today"}<br><span style="color: var(--text-muted);">${f.timeSlot || "10:00 AM"}</span></td>
          <td>${statusBadge}</td>
          <td>${f.receivedQuantity || f.quantity || "15 Quintal"}</td>
          <td>
            <strong>₹${Number(f.amount || 37500).toLocaleString("en-IN")}</strong><br>
            ${paymentBadge}
          </td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button
                class="action-btn-sm action-btn-weigh"
                onclick="window.openWeighModal('${f.procurementId || f.farmerId}', '${f.name}', '${f.tokenNumber || "TK-1042"}', '${f.procurementStatus}', '${f.receivedQuantity || f.quantity || "15 Quintal"}', '${f.amount || 37500}')"
                title="Weigh and verify grain"
              >
                ⚖️ Weigh
              </button>
              ${!isPaid ? `
                <button
                  class="action-btn-sm action-btn-pay"
                  onclick="window.openPaymentModal('${f.procurementId || f.farmerId}', '${f.name}', '${f.tokenNumber || "TK-1042"}', '${f.amount || 37500}')"
                  title="Disburse DBT Payment"
                >
                  💳 Pay
                </button>
              ` : `
                <span style="font-size: 0.72rem; color: #166534; font-weight: 700;">✓ DBT Settled</span>
              `}
              <button
                class="action-btn-sm action-btn-notify"
                onclick="window.sendFarmerAlert('${f.farmerId}', '${f.name}')"
                title="Send SMS / WhatsApp alert"
              >
                📢 Alert
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Filter Farmers
  if (officerFarmerSearch) {
    officerFarmerSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderFarmersTable(farmersList);
        return;
      }
      const filtered = farmersList.filter(f =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.tokenNumber && f.tokenNumber.toLowerCase().includes(q)) ||
        (f.village && f.village.toLowerCase().includes(q)) ||
        (f.mobile && f.mobile.includes(q))
      );
      renderFarmersTable(filtered);
    });
  }

  // Token Gate Pass Verification
  if (verifyTokenBtn && verifyTokenInput) {
    verifyTokenBtn.addEventListener("click", async () => {
      const tokenVal = verifyTokenInput.value.trim().toUpperCase();
      if (!tokenVal) {
        showToast("Please enter a token number to verify", "error");
        return;
      }

      verifyTokenBtn.disabled = true;
      verifyTokenBtn.textContent = "Verifying...";
      verifyResultContainer.style.display = "block";
      verifyResultContainer.innerHTML = `<div style="color: var(--text-muted);">⏳ Checking token registry for assigned centre...</div>`;

      const res = await apiFetch("/api/officer/verify-token", {
        method: "POST",
        body: JSON.stringify({ tokenNumber: tokenVal })
      });

      verifyTokenBtn.disabled = false;
      verifyTokenBtn.textContent = "🔍 Verify Token";

      if (res.success && res.valid) {
        const d = res.data;
        verifyResultContainer.innerHTML = `
          <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: var(--radius-sm); padding: 1rem; color: #065f46;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong style="font-size: 1.05rem;">✅ Gate Entry Authorized</strong>
              <span class="badge badge-green">${d.assignedGate || "Scale 1"}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
              <div><strong>Farmer:</strong> ${d.farmerName} (${d.farmerId})</div>
              <div><strong>Token:</strong> <code>${d.tokenNumber}</code></div>
              <div><strong>Crop:</strong> ${d.crop} (${d.quantity})</div>
              <div><strong>Slot Time:</strong> ${d.timeSlot}</div>
            </div>
            <div style="font-size: 0.75rem; color: #047857; margin-top: 0.5rem;">
              ✓ Status updated to Arrived. Direct vehicle to weighbridge inspection.
            </div>
          </div>
        `;
        showToast("Gate Entry Authorized! Farmer marked as Arrived.", "success");
        loadFarmers();
        loadDashboard();
      } else if (res.isCentreMismatch) {
        // STRICT ISOLATION ERROR DISPLAY
        verifyResultContainer.innerHTML = `
          <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: var(--radius-sm); padding: 1rem; color: #991b1b;">
            <div style="font-weight: 700; font-size: 1rem; margin-bottom: 0.4rem;">
              ⛔ Access Denied — Centre Mismatch
            </div>
            <div style="font-size: 0.85rem; line-height: 1.5;">
              Token <strong>${tokenVal}</strong> is scheduled for <strong>${res.tokenCentre}</strong>.<br>
              You are assigned to <strong>${res.officerCentre}</strong> and are strictly prohibited from verifying or processing tokens for other centres.
            </div>
          </div>
        `;
        showToast(res.message || "Centre Mismatch: Token belongs to another centre", "error");
      } else {
        verifyResultContainer.innerHTML = `
          <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: var(--radius-sm); padding: 1rem; color: #92400e;">
            <strong>⚠️ Token Not Found:</strong> ${res.message || "No record found for token " + tokenVal}
          </div>
        `;
        showToast(res.message || "Token not found", "error");
      }
    });
  }

  // Update Centre Queue Metrics
  if (saveQueueMetricsBtn) {
    saveQueueMetricsBtn.addEventListener("click", async () => {
      const waitingFarmers = ctrlWaitingFarmers.value;
      const estimatedWait = ctrlEstimatedWait.value;
      const activeWeighbridges = ctrlActiveWeighbridges.value;

      saveQueueMetricsBtn.disabled = true;
      saveQueueMetricsBtn.textContent = "Updating...";

      const res = await apiFetch("/api/officer/queue/update", {
        method: "POST",
        body: JSON.stringify({ waitingFarmers, estimatedWait, activeWeighbridges })
      });

      saveQueueMetricsBtn.disabled = false;
      saveQueueMetricsBtn.textContent = "💾 Update Live Queue";

      if (res.success) {
        showToast("Live Queue and Weighbridge status updated!", "success");
        loadDashboard();
      } else {
        showToast(res.message || "Failed to update queue parameters", "error");
      }
    });
  }

  // Call Next Token
  if (callNextTokenBtn) {
    callNextTokenBtn.addEventListener("click", async () => {
      const waitingFarmer = farmersList.find(f => f.procurementStatus === "Arrived" || f.procurementStatus === "Scheduled");
      if (!waitingFarmer) {
        showToast("No waiting farmers currently in queue for this centre", "info");
        return;
      }

      const res = await apiFetch("/api/officer/notify-farmer", {
        method: "POST",
        body: JSON.stringify({
          farmerId: waitingFarmer.farmerId,
          title: "📢 Turn Arrived at Weighbridge",
          message: `नमस्ते ${waitingFarmer.name} जी! आपका टोकन ${waitingFarmer.tokenNumber} तौल कांटे पर बुलाया गया है। कृपया वाहन सीधे तौलकांटे पर लाएं।`
        })
      });

      if (res.success) {
        showToast(`Token ${waitingFarmer.tokenNumber} (${waitingFarmer.name}) called to weighbridge!`, "success");
      } else {
        showToast("Failed to alert farmer", "error");
      }
    });
  }

  // Global helper functions for table rows
  window.openWeighModal = (procId, farmerName, token, status, qty, amount) => {
    weighProcId.value = procId;
    weighFarmerName.textContent = farmerName;
    weighTokenNum.textContent = token;
    weighStatusSelect.value = status || "Procurement Completed";
    weighReceivedQty.value = qty || "15 Quintal";
    weighAmount.value = amount || 37500;
    weighModal.classList.add("active");
  };

  window.openPaymentModal = (procId, farmerName, token, amount) => {
    payProcId.value = procId;
    payFarmerName.textContent = farmerName;
    payTokenNum.textContent = token;
    payAmount.value = amount || 37500;
    payTxId.value = "DBT-" + Date.now().toString().slice(-8);
    paymentModal.classList.add("active");
  };

  window.sendFarmerAlert = async (farmerId, farmerName) => {
    const customMsg = prompt(`Send alert to ${farmerName}:`, `नमस्ते ${farmerName} जी! कृपया सांवेर उपार्जन केंद्र पर अपना मूल आधार कार्ड और बैंक पासबुक साथ रखें।`);
    if (!customMsg) return;

    const res = await apiFetch("/api/officer/notify-farmer", {
      method: "POST",
      body: JSON.stringify({ farmerId, title: "Mandi Notice", message: customMsg })
    });

    if (res.success) {
      showToast(`Notification sent to ${farmerName}`, "success");
    } else {
      showToast("Failed to send notice", "error");
    }
  };

  // Close modals
  if (closeWeighModal) {
    closeWeighModal.addEventListener("click", () => weighModal.classList.remove("active"));
  }
  if (closePaymentModal) {
    closePaymentModal.addEventListener("click", () => paymentModal.classList.remove("active"));
  }

  // Submit Weighment
  if (weighForm) {
    weighForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const procId = weighProcId.value;
      const procurementStatus = weighStatusSelect.value;
      const receivedQuantity = weighReceivedQty.value.trim();
      const amount = weighAmount.value;

      const submitBtn = weighForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      const res = await apiFetch(`/api/officer/procurement/${procId}`, {
        method: "PUT",
        body: JSON.stringify({ procurementStatus, receivedQuantity, amount })
      });

      submitBtn.disabled = false;
      submitBtn.textContent = "✓ Save Weighment & Generate Slip";

      if (res.success) {
        weighModal.classList.remove("active");
        showToast("Procurement record and weighment slip updated successfully!", "success");
        loadFarmers();
        loadDashboard();
      } else {
        showToast(res.message || "Failed to update record", "error");
      }
    });
  }

  // Submit DBT Payment
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const procId = payProcId.value;
      const amount = payAmount.value;
      const transactionId = payTxId.value.trim();

      const submitBtn = paymentForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing DBT...";

      const res = await apiFetch(`/api/officer/payment/${procId}`, {
        method: "POST",
        body: JSON.stringify({ amount, transactionId })
      });

      submitBtn.disabled = false;
      submitBtn.textContent = "✓ Confirm & Credit DBT to Bank Account";

      if (res.success) {
        paymentModal.classList.remove("active");
        showToast(`DBT Payment credited! Txn ID: ${transactionId}`, "success");
        loadFarmers();
        loadDashboard();
      } else {
        showToast(res.message || "Payment disbursement failed", "error");
      }
    });
  }

  // Socket.io Real-time updates
  if (typeof io !== "undefined") {
    const socket = io();
    socket.on("queue-update", () => {
      loadDashboard();
    });
  }

  // Initial Load
  loadDashboard();
  loadFarmers();
});
