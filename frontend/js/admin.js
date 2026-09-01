/**
 * Kisan Procurement Mitra - Admin Dashboard Handler
 */

let allFarmersData = [];
let selectedFarmerForUpdate = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["admin"])) return;

  setupAdminListeners();
  await loadAdminDashboard();
  await loadAdminFarmers();

  window.addEventListener("languageChanged", () => {
    if (allFarmersData && allFarmersData.length > 0) {
      renderAdminFarmersTable(allFarmersData);
    }
  });
});

function setupAdminListeners() {
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
