/**
 * Mandisathi - Admin Dashboard Handler
 */

let allFarmersData = [];
let selectedFarmerForUpdate = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["GOVERNMENT_ADMIN", "admin"])) return;

  setupAdminListeners();
  await loadAdminDashboard();
  await loadAdminFarmers();
  await loadAdminWhatsAppMessages();

  window.addEventListener("languageChanged", () => {
    if (allFarmersData && allFarmersData.length > 0) {
      renderAdminFarmersTable(allFarmersData);
    }
  });
});

function setupAdminListeners() {
  // Socket.io real-time queue and procurement updates
  window.addEventListener("queue-update", (e) => {
    const data = e.detail;
    if (data && data.centres) {
      renderAdminCentres(data.centres);
    }
  });

  window.addEventListener("procurement-update", () => {
    loadAdminDashboard();
    loadAdminFarmers();
  });

  // Search input filtering
  const searchInput = document.getElementById("adminFarmerSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      filterFarmerTable(term);
    });
  }

  // Edit Modal close handlers
  const modal = document.getElementById("adminStatusModal");
  const closeBtn = document.getElementById("closeAdminModalBtn");
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  // Update Status Form Submit
  const updateForm = document.getElementById("adminUpdateStatusForm");
  if (updateForm) {
    updateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedFarmerForUpdate) return;

      const submitBtn = updateForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const payload = {
        procurementStatus: document.getElementById("adminProcStatus").value,
        paymentStatus: document.getElementById("adminPaymentStatus").value,
        receivedQuantity: document.getElementById("adminReceivedQty").value,
        amount: Number(document.getElementById("adminAmount").value),
        paymentDate: document.getElementById("adminPaymentStatus").value === "Paid" ? "18 September 2026" : null,
        transactionId: document.getElementById("adminPaymentStatus").value === "Paid" ? "PAY-20260918-1001" : null,
        farmerId: selectedFarmerForUpdate.farmerId
      };

      const procId = selectedFarmerForUpdate.procurementId || "active";
      const res = await apiFetch(`/api/admin/procurement/${procId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;

      if (res.success) {
        showToast(t("procStatusUpdatedSuccess"), "success");
        if (modal) modal.classList.remove("active");
        await loadAdminDashboard();
        await loadAdminFarmers();
      } else {
        showToast(res.message || t("updateFailed"), "error");
      }
    });
  }

  // Send Notification Form
  const notifForm = document.getElementById("adminSendNotifForm");
  if (notifForm) {
    notifForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = notifForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const payload = {
        title: document.getElementById("notifTitle").value.trim(),
        message: document.getElementById("notifMessage").value.trim(),
        type: document.getElementById("notifType").value,
        farmerId: document.getElementById("notifFarmerId").value.trim() || "all"
      };

      const res = await apiFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;

      if (res.success) {
        showToast(t("notifDispatchedSuccess"), "success");
        notifForm.reset();
      } else {
        showToast(res.message || t("failedDispatchNotif"), "error");
      }
    });
  }

  // Meta WhatsApp Message Dispatch Form
  const waForm = document.getElementById("adminSendWhatsAppForm");
  if (waForm) {
    // Quick template buttons
    document.querySelectorAll(".wa-template-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tpl = btn.getAttribute("data-template");
        const msgBox = document.getElementById("adminWaMessage");
        if (msgBox && tpl) {
          msgBox.value = tpl;
          msgBox.focus();
        }
      });
    });

    waForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const mobileInput = document.getElementById("adminWaMobile");
      const messageInput = document.getElementById("adminWaMessage");
      const submitBtn = document.getElementById("adminWaSendBtn");
      const statusMsg = document.getElementById("waSendStatusMsg");

      const mobile = mobileInput.value.trim();
      const message = messageInput.value.trim();

      if (!mobile || !message) {
        showToast("Please provide mobile number and message", "error");
        return;
      }

      submitBtn.disabled = true;
      if (statusMsg) {
        statusMsg.textContent = "Sending via Meta WhatsApp Cloud API...";
        statusMsg.style.color = "var(--primary)";
      }

      try {
        const res = await apiFetch("/api/admin/whatsapp/send", {
          method: "POST",
          body: JSON.stringify({ mobile, message })
        });

        submitBtn.disabled = false;

        if (res.success) {
          showToast("WhatsApp message sent successfully via Meta Cloud API!", "success");
          if (statusMsg) {
            statusMsg.textContent = "✅ Message dispatched to WhatsApp!";
            statusMsg.style.color = "var(--primary-dark)";
          }
          messageInput.value = "";
          await loadAdminWhatsAppMessages();
        } else {
          showToast(res.message || "Could not dispatch WhatsApp message", "error");
          if (statusMsg) {
            statusMsg.textContent = res.message || "Failed to send";
            statusMsg.style.color = "var(--danger)";
          }
          await loadAdminWhatsAppMessages();
        }
      } catch (err) {
        submitBtn.disabled = false;
        showToast("Error communicating with WhatsApp service", "error");
      }
    });
  }

  // Refresh WhatsApp history button
  const refreshWaBtn = document.getElementById("refreshWaHistoryBtn");
  if (refreshWaBtn) {
    refreshWaBtn.addEventListener("click", async () => {
      refreshWaBtn.disabled = true;
      await loadAdminWhatsAppMessages();
      refreshWaBtn.disabled = false;
      showToast("WhatsApp message history updated", "info");
    });
  }
}

async function loadAdminDashboard() {
  try {
    const res = await apiFetch("/api/admin/dashboard");
    if (res.success && res.data) {
      const { stats, centres } = res.data;

      // Stats cards
      const tfEl = document.getElementById("admTotalFarmers");
      const tsEl = document.getElementById("admTodaySchedule");
      const pcEl = document.getElementById("admProcCompleted");
      const ppEl = document.getElementById("admPendingPayments");

      if (tfEl) tfEl.textContent = Number(stats.totalFarmers).toLocaleString("en-IN");
      if (tsEl) tsEl.textContent = Number(stats.todaySchedule).toLocaleString("en-IN");
      if (pcEl) pcEl.textContent = Number(stats.procurementCompleted).toLocaleString("en-IN");
      if (ppEl) ppEl.textContent = Number(stats.pendingPayments).toLocaleString("en-IN");

      // Centre status table
      const centreTable = document.getElementById("adminCentresTableBody");
      if (centreTable && centres) {
        centreTable.innerHTML = centres.map(c => `
          <tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${c.scheduledFarmers || 60}</td>
            <td><span class="badge badge-green">${c.completedFarmers || 35}</span></td>
            <td><span class="badge badge-amber">${c.waitingFarmers || 15}</span></td>
            <td><span class="badge ${c.status === 'Open' ? 'badge-green' : 'badge-amber'}">${escapeHtml(c.status || 'Open')}</span></td>
          </tr>
        `).join("");
      }
    }
  } catch (error) {
    console.error("Admin dashboard load error:", error);
  }
}

async function loadAdminFarmers() {
  const loading = document.getElementById("adminFarmersLoading");
  try {
    const res = await apiFetch("/api/admin/farmers");
    if (loading) loading.style.display = "none";

    if (res.success && res.data) {
      allFarmersData = res.data;
      renderAdminFarmersTable(allFarmersData);
    }
  } catch (error) {
    console.error("Admin farmers load error:", error);
    if (loading) loading.textContent = "Unable to load farmers.";
  }
}

function renderAdminFarmersTable(farmers) {
  const tbody = document.getElementById("adminFarmersTableBody");
  if (!tbody) return;

  if (farmers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">${t("noFarmersMatchingSearch")}</td></tr>`;
    return;
  }

  tbody.innerHTML = farmers.map((f, idx) => `
    <tr>
      <td><span class="badge badge-gray">${escapeHtml(f.farmerId || "FMR1001")}</span></td>
      <td><strong>${escapeHtml(f.name)}</strong><br><small style="color: var(--text-muted);">${escapeHtml(f.mobile)}</small></td>
      <td>${escapeHtml(f.village)}, ${escapeHtml(f.district)}</td>
      <td>${escapeHtml(f.crop)}</td>
      <td>${escapeHtml(f.preferredCentre ? f.preferredCentre.replace("Procurement Centre", "") : "Sanwer")}</td>
      <td>
        <span class="badge ${getStatusBadge(f.procurementStatus)}">${escapeHtml(f.procurementStatus || "Scheduled")}</span>
      </td>
      <td>
        <span class="badge ${getPaymentBadge(f.paymentStatus)}">${escapeHtml(f.paymentStatus || "Pending")}</span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="openStatusUpdateModal(${idx})">
          ${t("updateStatusBtn")}
        </button>
      </td>
    </tr>
  `).join("");
}

function filterFarmerTable(term) {
  if (!term) {
    renderAdminFarmersTable(allFarmersData);
    return;
  }

  const filtered = allFarmersData.filter(f => 
    (f.farmerId && f.farmerId.toLowerCase().includes(term)) ||
    (f.name && f.name.toLowerCase().includes(term)) ||
    (f.village && f.village.toLowerCase().includes(term)) ||
    (f.crop && f.crop.toLowerCase().includes(term))
  );

  renderAdminFarmersTable(filtered);
}

window.openStatusUpdateModal = function(idx) {
  const farmer = allFarmersData[idx];
  if (!farmer) return;

  selectedFarmerForUpdate = farmer;

  const modal = document.getElementById("adminStatusModal");
  const nameEl = document.getElementById("modalFarmerName");
  const idEl = document.getElementById("modalFarmerId");

  if (nameEl) nameEl.textContent = farmer.name;
  if (idEl) idEl.textContent = `(${farmer.farmerId} • ${farmer.crop})`;

  document.getElementById("adminProcStatus").value = farmer.procurementStatus || "Scheduled";
  document.getElementById("adminPaymentStatus").value = farmer.paymentStatus || "Pending";
  document.getElementById("adminReceivedQty").value = farmer.receivedQuantity || farmer.quantity || "18 Quintal";
  document.getElementById("adminAmount").value = farmer.amount || 45000;

  if (modal) modal.classList.add("active");
};

function getStatusBadge(status) {
  switch (status) {
    case "Completed":
    case "Procurement Completed": return "badge-green";
    case "Scheduled": return "badge-blue";
    case "Arrived": return "badge-amber";
    case "Cancelled": return "badge-red";
    default: return "badge-gray";
  }
}

function getPaymentBadge(status) {
  switch (status) {
    case "Paid": return "badge-green";
    case "Processing": return "badge-blue";
    case "Pending": return "badge-amber";
    default: return "badge-gray";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadAdminWhatsAppMessages() {
  const tbody = document.getElementById("adminWaMessagesTableBody");
  if (!tbody) return;

  try {
    const res = await apiFetch("/api/admin/whatsapp/messages");
    if (res.success && Array.isArray(res.data)) {
      renderAdminWhatsAppMessages(res.data);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No WhatsApp messages recorded yet.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error("Admin load WhatsApp messages error:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--danger); padding: 1.5rem;">
          Unable to load WhatsApp message history.
        </td>
      </tr>
    `;
  }
}

function renderAdminWhatsAppMessages(messages) {
  const tbody = document.getElementById("adminWaMessagesTableBody");
  if (!tbody) return;

  if (!messages || messages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          No WhatsApp messages logged yet. When messages arrive via Meta Webhook or are sent via Admin panel, they will appear here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = messages.map(msg => {
    const isIncoming = msg.direction === "incoming";
    const dirBadge = isIncoming
      ? `<span class="badge badge-green">📥 Incoming</span>`
      : `<span class="badge badge-blue">📤 Outgoing</span>`;

    let statusBadge = `<span class="badge badge-gray">${escapeHtml(msg.status || "logged")}</span>`;
    if (msg.status === "sent" || msg.status === "delivered" || msg.status === "read") {
      statusBadge = `<span class="badge badge-green">${escapeHtml(msg.status)}</span>`;
    } else if (msg.status === "failed") {
      statusBadge = `<span class="badge badge-red">Failed</span>`;
    } else if (msg.status === "received") {
      statusBadge = `<span class="badge badge-blue">Received</span>`;
    } else if (msg.status === "pending") {
      statusBadge = `<span class="badge badge-amber">Pending</span>`;
    }

    const dateStr = msg.timestamp
      ? new Date(msg.timestamp).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      : "Just now";

    return `
      <tr>
        <td><strong>+${escapeHtml(String(msg.phoneNumber).replace(/\D/g, ""))}</strong></td>
        <td>${dirBadge}</td>
        <td style="max-width: 320px; word-break: break-word; font-family: monospace; font-size: 0.82rem;">${escapeHtml(msg.message)}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(dateStr)}</td>
      </tr>
    `;
  }).join("");
}

