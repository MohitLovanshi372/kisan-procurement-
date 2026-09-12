/**
 * Mandisathi - Admin Dashboard Handler
 * Comprehensive Government Administrator Control:
 * 1. Procurement Officer ID, Mobile, Password & Mandi Control
 * 2. Farmer Master Sheet (Data, Bank DBT, Land, Crops, Tokens, MSP Payment Status)
 * 3. Mandi Queue & Procurement Live Monitoring
 * 4. Meta WhatsApp Notifications Dispatch & Webhook History
 */

let allFarmersData = [];
let allOfficersData = [];
let selectedFarmerForUpdate = null;
let selectedOfficerForEdit = null;
let selectedFarmerForEdit = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["GOVERNMENT_ADMIN", "admin"])) return;

  setupAdminListeners();
  setupOfficerManagementListeners();
  setupFarmerSheetListeners();

  await loadAdminDashboard();
  await loadAdminOfficers();
  await loadAdminFarmers();
  await loadAdminWhatsAppMessages();

  window.addEventListener("languageChanged", () => {
    if (allFarmersData && allFarmersData.length > 0) {
      applyFarmerSheetFilters();
    }
    if (allOfficersData && allOfficersData.length > 0) {
      renderAdminOfficersTable(allOfficersData);
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
        showToast(t("procStatusUpdatedSuccess") || "Status updated successfully", "success");
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
        showToast(t("notifDispatchedSuccess") || "Notification sent to farmers", "success");
        notifForm.reset();
      } else {
        showToast(res.message || t("failedDispatchNotif"), "error");
      }
    });
  }

  // Meta WhatsApp Message Dispatch Form
  const waForm = document.getElementById("adminSendWhatsAppForm");
  if (waForm) {
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

/* ==========================================================================
   OFFICER ID & PASSWORD CREDENTIALS MANAGEMENT (GOVT ADMIN CONTROL)
   ========================================================================== */

function setupOfficerManagementListeners() {
  // Search officers
  const searchInput = document.getElementById("adminOfficerSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      filterOfficersTable(term);
    });
  }

  // Open Add Officer Modal
  const btnOpenAdd = document.getElementById("btnOpenAddOfficerModal");
  const addModal = document.getElementById("adminAddOfficerModal");
  const closeAddBtn = document.getElementById("closeAddOfficerModalBtn");
  const cancelAddBtn = document.getElementById("cancelAddOfficerBtn");

  if (btnOpenAdd && addModal) {
    btnOpenAdd.addEventListener("click", () => {
      // Auto-suggest next Officer ID
      const nextNum = allOfficersData.length + 1;
      const suggestedId = "OFF" + String(nextNum).padStart(3, "0");
      const idInput = document.getElementById("newOfficerId");
      if (idInput && !idInput.value) idInput.value = suggestedId;
      addModal.classList.add("active");
    });
  }

  if (closeAddBtn && addModal) {
    closeAddBtn.addEventListener("click", () => addModal.classList.remove("active"));
  }
  if (cancelAddBtn && addModal) {
    cancelAddBtn.addEventListener("click", () => addModal.classList.remove("active"));
  }

  // Submit Add Officer Form
  const addOfficerForm = document.getElementById("adminAddOfficerForm");
  if (addOfficerForm) {
    addOfficerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = addOfficerForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const centreVal = document.getElementById("newOfficerCentre").value;
      const [centreId, centreName] = centreVal.split("|");

      const payload = {
        officerId: document.getElementById("newOfficerId").value.trim().toUpperCase(),
        name: document.getElementById("newOfficerName").value.trim(),
        mobile: document.getElementById("newOfficerMobile").value.trim(),
        password: document.getElementById("newOfficerPassword").value.trim(),
        assignedCentreId: centreId,
        assignedCentreName: centreName
      };

      try {
        const res = await apiFetch("/api/admin/officers", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        submitBtn.disabled = false;

        if (res.success) {
          showToast(`Officer "${payload.name}" created with ID ${payload.officerId}!`, "success");
          addOfficerForm.reset();
          if (addModal) addModal.classList.remove("active");
          await loadAdminOfficers();
        } else {
          showToast(res.message || "Failed to create officer", "error");
        }
      } catch (err) {
        submitBtn.disabled = false;
        showToast("Error creating officer", "error");
      }
    });
  }

  // Edit Officer Modal handlers
  const editModal = document.getElementById("adminEditOfficerModal");
  const closeEditBtn = document.getElementById("closeEditOfficerModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditOfficerBtn");

  if (closeEditBtn && editModal) {
    closeEditBtn.addEventListener("click", () => editModal.classList.remove("active"));
  }
  if (cancelEditBtn && editModal) {
    cancelEditBtn.addEventListener("click", () => editModal.classList.remove("active"));
  }

  // Submit Edit Officer Form
  const editOfficerForm = document.getElementById("adminEditOfficerForm");
  if (editOfficerForm) {
    editOfficerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedOfficerForEdit) return;

      const submitBtn = editOfficerForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const centreVal = document.getElementById("editOfficerCentre").value;
      const [centreId, centreName] = centreVal.includes("|") ? centreVal.split("|") : ["CENTRE_001", centreVal];

      const payload = {
        officerId: document.getElementById("editOfficerId").value.trim().toUpperCase(),
        name: document.getElementById("editOfficerName").value.trim(),
        mobile: document.getElementById("editOfficerMobile").value.trim(),
        assignedCentreId: centreId,
        assignedCentreName: centreName,
        isActive: document.getElementById("editOfficerActive").value === "true"
      };

      const newPass = document.getElementById("editOfficerPassword").value.trim();
      if (newPass) {
        payload.password = newPass;
      }

      try {
        const officerDbId = selectedOfficerForEdit.id || selectedOfficerForEdit._id || selectedOfficerForEdit.officerId;
        const res = await apiFetch(`/api/admin/officers/${officerDbId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        submitBtn.disabled = false;

        if (res.success) {
          showToast(`Officer "${payload.name}" credentials updated successfully!`, "success");
          if (editModal) editModal.classList.remove("active");
          await loadAdminOfficers();
        } else {
          showToast(res.message || "Failed to update officer", "error");
        }
      } catch (err) {
        submitBtn.disabled = false;
        showToast("Error updating officer credentials", "error");
      }
    });
  }

  // Delete Officer Action
  const btnDeleteOfficer = document.getElementById("btnDeleteOfficerAction");
  if (btnDeleteOfficer) {
    btnDeleteOfficer.addEventListener("click", async () => {
      if (!selectedOfficerForEdit) return;
      const confirmDelete = confirm(`Are you sure you want to delete Officer "${selectedOfficerForEdit.name}" (${selectedOfficerForEdit.officerId})? This will revoke their portal access.`);
      if (!confirmDelete) return;

      const officerDbId = selectedOfficerForEdit.id || selectedOfficerForEdit._id || selectedOfficerForEdit.officerId;
      try {
        const res = await apiFetch(`/api/admin/officers/${officerDbId}`, {
          method: "DELETE"
        });

        if (res.success) {
          showToast(res.message || "Officer removed successfully", "success");
          if (editModal) editModal.classList.remove("active");
          await loadAdminOfficers();
        } else {
          showToast(res.message || "Failed to remove officer", "error");
        }
      } catch (err) {
        showToast("Error removing officer", "error");
      }
    });
  }
}

async function loadAdminOfficers() {
  const loading = document.getElementById("adminOfficersLoading");
  const tbody = document.getElementById("adminOfficersTableBody");
  if (loading) loading.style.display = "block";

  try {
    const res = await apiFetch("/api/admin/officers");
    if (loading) loading.style.display = "none";

    if (res.success && Array.isArray(res.data)) {
      allOfficersData = res.data;
      renderAdminOfficersTable(allOfficersData);
    } else {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No procurement officers found.</td></tr>`;
      }
    }
  } catch (err) {
    console.error("Admin load officers error:", err);
    if (loading) loading.textContent = "Unable to load officers.";
  }
}

function renderAdminOfficersTable(officers) {
  const tbody = document.getElementById("adminOfficersTableBody");
  if (!tbody) return;

  if (!officers || officers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No officers found matching search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = officers.map((off, idx) => {
    const plainPwd = off.plainPassword || "officer123";
    const isActive = off.isActive !== false;
    const centreTitle = off.assignedCentreName || off.preferredCentre || "Sanwer Procurement Centre";

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span class="badge badge-blue" style="font-size: 0.85rem; font-weight: 700; font-family: monospace;">
              ${escapeHtml(off.officerId || "OFF001")}
            </span>
            <button type="button" class="btn-icon" title="Copy Officer ID" onclick="copyToClipboard('${escapeHtml(off.officerId || "")}', 'Officer ID copied!')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;">
              📋
            </button>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(off.name)}</strong><br>
          <span style="font-size: 0.82rem; color: var(--text-muted); font-family: monospace;">📞 +91 ${escapeHtml(off.mobile)}</span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-color); font-size: 0.88rem;">
            🏛️ ${escapeHtml(centreTitle)}
          </div>
          <small style="color: var(--text-muted); font-size: 0.75rem;">ID: ${escapeHtml(off.assignedCentreId || "CENTRE_001")}</small>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span id="officer-pwd-${idx}" style="font-family: monospace; font-size: 0.9rem; font-weight: 700; background: #e2e8f0; padding: 3px 8px; border-radius: 4px; letter-spacing: 1.5px;">
              ••••••••
            </span>
            <button type="button" class="btn btn-outline-secondary btn-sm" style="padding: 2px 6px; font-size: 0.75rem;" title="Toggle Password" onclick="toggleOfficerPassword(${idx}, '${escapeHtml(plainPwd)}')">
              👁️ Show
            </button>
            <button type="button" class="btn btn-outline-primary btn-sm" style="padding: 2px 6px; font-size: 0.75rem;" title="Copy Login Credentials" onclick="copyOfficerCredentials('${escapeHtml(off.officerId)}', '${escapeHtml(off.mobile)}', '${escapeHtml(plainPwd)}', '${escapeHtml(centreTitle)}')">
              📋 Copy
            </button>
          </div>
        </td>
        <td>
          <span class="badge ${isActive ? 'badge-green' : 'badge-red'}" style="cursor: pointer;" title="Click to toggle status" onclick="toggleOfficerActiveStatus(${idx})">
            ${isActive ? 'Active (सक्रिय)' : 'Disabled (निष्क्रिय)'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button class="btn btn-sm btn-primary" title="Edit Officer ID & Password" onclick="openEditOfficerModal(${idx})">
              🔑 Edit & Password
            </button>
            <button class="btn btn-sm btn-outline-danger" title="Remove Officer" onclick="deleteOfficerDirect(${idx})">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterOfficersTable(term) {
  if (!term) {
    renderAdminOfficersTable(allOfficersData);
    return;
  }

  const filtered = allOfficersData.filter(o => 
    (o.officerId && o.officerId.toLowerCase().includes(term)) ||
    (o.name && o.name.toLowerCase().includes(term)) ||
    (o.mobile && o.mobile.toLowerCase().includes(term)) ||
    (o.assignedCentreName && o.assignedCentreName.toLowerCase().includes(term))
  );

  renderAdminOfficersTable(filtered);
}

window.toggleOfficerPassword = function(idx, rawPassword) {
  const el = document.getElementById(`officer-pwd-${idx}`);
  if (!el) return;

  if (el.textContent.includes("•••")) {
    el.textContent = rawPassword;
    el.style.background = "#fef3c7";
    el.style.color = "#92400e";
  } else {
    el.textContent = "••••••••";
    el.style.background = "#e2e8f0";
    el.style.color = "inherit";
  }
};

window.copyOfficerCredentials = function(officerId, mobile, pwd, centre) {
  const text = `Mandisathi Procurement Portal Login:\nOfficer ID: ${officerId}\nMobile: ${mobile}\nPassword: ${pwd}\nAssigned Mandi: ${centre}\nLogin URL: ${window.location.origin}/login.html`;
  copyToClipboard(text, "Officer credentials copied to clipboard!");
};

window.openEditOfficerModal = function(idx) {
  const officer = allOfficersData[idx];
  if (!officer) return;

  selectedOfficerForEdit = officer;

  const modal = document.getElementById("adminEditOfficerModal");
  const subTitle = document.getElementById("editOfficerSubTitle");

  if (subTitle) subTitle.textContent = `Managing credentials for ${officer.name} (${officer.officerId})`;

  document.getElementById("editOfficerDbId").value = officer.id || officer._id || officer.officerId;
  document.getElementById("editOfficerId").value = officer.officerId || "";
  document.getElementById("editOfficerName").value = officer.name || "";
  document.getElementById("editOfficerMobile").value = officer.mobile || "";
  document.getElementById("editOfficerPassword").value = officer.plainPassword || "officer123";
  document.getElementById("editOfficerActive").value = (officer.isActive !== false) ? "true" : "false";

  // Match centre dropdown
  const centreSelect = document.getElementById("editOfficerCentre");
  if (centreSelect) {
    const currentCentre = officer.assignedCentreName || officer.preferredCentre || "";
    let found = false;
    for (let opt of centreSelect.options) {
      if (opt.value.includes(currentCentre) || currentCentre.includes(opt.text.split(" ")[0])) {
        centreSelect.value = opt.value;
        found = true;
        break;
      }
    }
    if (!found && centreSelect.options.length > 0) {
      centreSelect.selectedIndex = 0;
    }
  }

  if (modal) modal.classList.add("active");
};

window.toggleOfficerActiveStatus = async function(idx) {
  const officer = allOfficersData[idx];
  if (!officer) return;

  const newStatus = officer.isActive === false;
  const officerDbId = officer.id || officer._id || officer.officerId;

  try {
    const res = await apiFetch(`/api/admin/officers/${officerDbId}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: newStatus })
    });

    if (res.success) {
      showToast(`Officer ${officer.officerId} status set to ${newStatus ? 'Active' : 'Disabled'}`, "info");
      await loadAdminOfficers();
    }
  } catch (err) {
    showToast("Error updating officer status", "error");
  }
};

window.deleteOfficerDirect = async function(idx) {
  const officer = allOfficersData[idx];
  if (!officer) return;

  const confirmDelete = confirm(`Delete Officer "${officer.name}" (${officer.officerId})?`);
  if (!confirmDelete) return;

  const officerDbId = officer.id || officer._id || officer.officerId;
  try {
    const res = await apiFetch(`/api/admin/officers/${officerDbId}`, {
      method: "DELETE"
    });

    if (res.success) {
      showToast("Officer removed successfully", "success");
      await loadAdminOfficers();
    } else {
      showToast(res.message || "Failed to remove officer", "error");
    }
  } catch (err) {
    showToast("Error removing officer", "error");
  }
};

/* ==========================================================================
   COMPREHENSIVE FARMER MASTER SHEET (GOVT ADMIN CONTROL)
   ========================================================================== */

function setupFarmerSheetListeners() {
  // Free text search
  const searchInput = document.getElementById("adminFarmerSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => applyFarmerSheetFilters());
  }

  // Filter dropdowns
  const cropFilter = document.getElementById("filterCrop");
  const procFilter = document.getElementById("filterProcStatus");
  const payFilter = document.getElementById("filterPaymentStatus");

  if (cropFilter) cropFilter.addEventListener("change", () => applyFarmerSheetFilters());
  if (procFilter) procFilter.addEventListener("change", () => applyFarmerSheetFilters());
  if (payFilter) payFilter.addEventListener("change", () => applyFarmerSheetFilters());

  // Export CSV Button
  const btnExport = document.getElementById("btnExportFarmerCsv");
  if (btnExport) {
    btnExport.addEventListener("click", () => exportFarmerSheetToCsv());
  }

  // Print Sheet Button
  const btnPrint = document.getElementById("btnPrintFarmerSheet");
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  // Add Farmer Modal
  const btnOpenAddFarmer = document.getElementById("btnOpenAddFarmerModal");
  const addFarmerModal = document.getElementById("adminAddFarmerModal");
  const closeAddFarmerBtn = document.getElementById("closeAddFarmerModalBtn");
  const cancelAddFarmerBtn = document.getElementById("cancelAddFarmerBtn");

  if (btnOpenAddFarmer && addFarmerModal) {
    btnOpenAddFarmer.addEventListener("click", () => {
      const nextNum = allFarmersData.length + 1001;
      const suggestedId = "FMR" + nextNum;
      const idInput = document.getElementById("newFarmerId");
      if (idInput && !idInput.value) idInput.value = suggestedId;
      addFarmerModal.classList.add("active");
    });
  }

  if (closeAddFarmerBtn && addFarmerModal) {
    closeAddFarmerBtn.addEventListener("click", () => addFarmerModal.classList.remove("active"));
  }
  if (cancelAddFarmerBtn && addFarmerModal) {
    cancelAddFarmerBtn.addEventListener("click", () => addFarmerModal.classList.remove("active"));
  }

  // Add Farmer Form Submit
  const addFarmerForm = document.getElementById("adminAddFarmerForm");
  if (addFarmerForm) {
    addFarmerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = addFarmerForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const payload = {
        farmerId: document.getElementById("newFarmerId").value.trim().toUpperCase(),
        name: document.getElementById("newFarmerName").value.trim(),
        mobile: document.getElementById("newFarmerMobile").value.trim(),
        password: document.getElementById("newFarmerPassword").value.trim() || "123456",
        village: document.getElementById("newFarmerVillage").value.trim(),
        district: document.getElementById("newFarmerDistrict").value.trim(),
        crop: document.getElementById("newFarmerCrop").value,
        landArea: document.getElementById("newFarmerLand").value.trim(),
        preferredCentre: document.getElementById("newFarmerCentre").value,
        aadharNumber: document.getElementById("newFarmerAadhar").value.trim(),
        bankName: document.getElementById("newFarmerBank").value.trim(),
        accountNumber: document.getElementById("newFarmerAccount").value.trim(),
        ifscCode: document.getElementById("newFarmerIfsc").value.trim()
      };

      try {
        const res = await apiFetch("/api/admin/farmers", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        submitBtn.disabled = false;

        if (res.success) {
          showToast(`Farmer "${payload.name}" added to Master Sheet!`, "success");
          addFarmerForm.reset();
          if (addFarmerModal) addFarmerModal.classList.remove("active");
          await loadAdminFarmers();
          await loadAdminDashboard();
        } else {
          showToast(res.message || "Failed to add farmer", "error");
        }
      } catch (err) {
        submitBtn.disabled = false;
        showToast("Error adding farmer", "error");
      }
    });
  }

  // Edit Farmer Modal
  const editFarmerModal = document.getElementById("adminEditFarmerModal");
  const closeEditFarmerBtn = document.getElementById("closeEditFarmerModalBtn");
  const cancelEditFarmerBtn = document.getElementById("cancelEditFarmerBtn");

  if (closeEditFarmerBtn && editFarmerModal) {
    closeEditFarmerBtn.addEventListener("click", () => editFarmerModal.classList.remove("active"));
  }
  if (cancelEditFarmerBtn && editFarmerModal) {
    cancelEditFarmerBtn.addEventListener("click", () => editFarmerModal.classList.remove("active"));
  }

  // Edit Farmer Form Submit
  const editFarmerForm = document.getElementById("adminEditFarmerForm");
  if (editFarmerForm) {
    editFarmerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedFarmerForEdit) return;

      const submitBtn = editFarmerForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const payload = {
        name: document.getElementById("editFarmerName").value.trim(),
        mobile: document.getElementById("editFarmerMobile").value.trim(),
        village: document.getElementById("editFarmerVillage").value.trim(),
        district: document.getElementById("editFarmerDistrict").value.trim(),
        crop: document.getElementById("editFarmerCrop").value,
        landArea: document.getElementById("editFarmerLand").value.trim(),
        preferredCentre: document.getElementById("editFarmerCentre").value,
        bankName: document.getElementById("editFarmerBank").value.trim(),
        accountNumber: document.getElementById("editFarmerAccount").value.trim(),
        ifscCode: document.getElementById("editFarmerIfsc").value.trim(),
        dbtStatus: document.getElementById("editFarmerDbt").value
      };

      const newPass = document.getElementById("editFarmerPassword").value.trim();
      if (newPass) {
        payload.password = newPass;
      }

      const farmerDbId = selectedFarmerForEdit.id || selectedFarmerForEdit._id || selectedFarmerForEdit.farmerId;
      try {
        const res = await apiFetch(`/api/admin/farmers/${farmerDbId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        submitBtn.disabled = false;

        if (res.success) {
          showToast(`Farmer ${selectedFarmerForEdit.farmerId} master record updated!`, "success");
          if (editFarmerModal) editFarmerModal.classList.remove("active");
          await loadAdminFarmers();
        } else {
          showToast(res.message || "Failed to update farmer", "error");
        }
      } catch (err) {
        submitBtn.disabled = false;
        showToast("Error updating farmer record", "error");
      }
    });
  }

  // Delete Farmer Action
  const btnDeleteFarmer = document.getElementById("btnDeleteFarmerAction");
  if (btnDeleteFarmer) {
    btnDeleteFarmer.addEventListener("click", async () => {
      if (!selectedFarmerForEdit) return;
      const confirmDelete = confirm(`Are you sure you want to delete Farmer "${selectedFarmerForEdit.name}" (${selectedFarmerForEdit.farmerId}) from the Master Sheet?`);
      if (!confirmDelete) return;

      const farmerDbId = selectedFarmerForEdit.id || selectedFarmerForEdit._id || selectedFarmerForEdit.farmerId;
      try {
        const res = await apiFetch(`/api/admin/farmers/${farmerDbId}`, {
          method: "DELETE"
        });

        if (res.success) {
          showToast("Farmer record removed from master sheet", "success");
          if (editFarmerModal) editFarmerModal.classList.remove("active");
          await loadAdminFarmers();
          await loadAdminDashboard();
        } else {
          showToast(res.message || "Failed to delete farmer", "error");
        }
      } catch (err) {
        showToast("Error deleting farmer", "error");
      }
    });
  }
}

async function loadAdminFarmers() {
  const loading = document.getElementById("adminFarmersLoading");
  try {
    const res = await apiFetch("/api/admin/farmers");
    if (loading) loading.style.display = "none";

    if (res.success && res.data) {
      allFarmersData = res.data;
      applyFarmerSheetFilters();
    }
  } catch (error) {
    console.error("Admin farmers load error:", error);
    if (loading) loading.textContent = "Unable to load farmer master sheet.";
  }
}

function applyFarmerSheetFilters() {
  const searchInput = document.getElementById("adminFarmerSearch");
  const cropFilter = document.getElementById("filterCrop");
  const procFilter = document.getElementById("filterProcStatus");
  const payFilter = document.getElementById("filterPaymentStatus");

  const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selectedCrop = cropFilter ? cropFilter.value : "";
  const selectedProc = procFilter ? procFilter.value : "";
  const selectedPay = payFilter ? payFilter.value : "";

  let filtered = allFarmersData;

  if (term) {
    filtered = filtered.filter(f => 
      (f.farmerId && f.farmerId.toLowerCase().includes(term)) ||
      (f.name && f.name.toLowerCase().includes(term)) ||
      (f.mobile && f.mobile.toLowerCase().includes(term)) ||
      (f.village && f.village.toLowerCase().includes(term)) ||
      (f.district && f.district.toLowerCase().includes(term)) ||
      (f.crop && f.crop.toLowerCase().includes(term)) ||
      (f.bankName && f.bankName.toLowerCase().includes(term)) ||
      (f.accountNumber && f.accountNumber.toLowerCase().includes(term)) ||
      (f.aadharNumber && f.aadharNumber.toLowerCase().includes(term))
    );
  }

  if (selectedCrop) {
    filtered = filtered.filter(f => f.crop && f.crop.toLowerCase() === selectedCrop.toLowerCase());
  }

  if (selectedProc) {
    filtered = filtered.filter(f => f.procurementStatus && f.procurementStatus.toLowerCase().includes(selectedProc.toLowerCase()));
  }

  if (selectedPay) {
    filtered = filtered.filter(f => f.paymentStatus && f.paymentStatus.toLowerCase().includes(selectedPay.toLowerCase()));
  }

  renderAdminFarmersTable(filtered);
}

function renderAdminFarmersTable(farmers) {
  const tbody = document.getElementById("adminFarmersTableBody");
  if (!tbody) return;

  if (farmers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted); font-size: 0.95rem;">No farmers found matching the search and filter criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = farmers.map((f, idx) => {
    const rawIndex = allFarmersData.indexOf(f);
    const aadharMasked = f.aadharNumber ? `•••• ${String(f.aadharNumber).slice(-4)}` : "Verified";
    const accMasked = f.accountNumber ? `•••• ${String(f.accountNumber).slice(-4)}` : "Registered";
    const plainPwd = f.plainPassword || "123456";

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span class="badge badge-gray" style="font-family: monospace; font-weight: 700; font-size: 0.85rem;">
              ${escapeHtml(f.farmerId || "FMR1001")}
            </span>
            <button type="button" class="btn-icon" title="Copy Farmer ID" onclick="copyToClipboard('${escapeHtml(f.farmerId || "")}', 'Farmer ID copied!')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;">
              📋
            </button>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(f.name)}</strong><br>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">📞 +91 ${escapeHtml(f.mobile)}</span><br>
          <small style="color: #64748b; font-size: 0.72rem;">Pass: <code style="background: #f1f5f9; padding: 1px 4px; border-radius: 3px;">${escapeHtml(plainPwd)}</code></small>
        </td>
        <td>
          <span style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(f.village || "Sanwer")}</span><br>
          <small style="color: var(--text-muted);">${escapeHtml(f.district || "Indore")}</small>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--primary-dark); font-size: 0.85rem;">${escapeHtml(f.crop || "Wheat")}</span><br>
          <small style="color: var(--text-muted); font-size: 0.78rem;">📐 ${escapeHtml(f.landArea || "3.5 Acres")}</small>
        </td>
        <td style="font-size: 0.82rem;">
          ${escapeHtml(f.preferredCentre ? f.preferredCentre.replace("Procurement Centre", "").replace("Krishi Upaj Mandi", "") : "Sanwer")}
        </td>
        <td>
          <div style="font-size: 0.8rem; line-height: 1.3;">
            <div><strong>${escapeHtml(f.bankName || "SBI")}</strong> (${accMasked})</div>
            <div style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem;">IFSC: ${escapeHtml(f.ifscCode || "SBIN0001234")}</div>
            <div style="margin-top: 2px;">
              <span class="badge ${f.dbtStatus && f.dbtStatus.includes('Active') ? 'badge-green' : 'badge-amber'}" style="font-size: 0.7rem; padding: 1px 6px;">
                ${escapeHtml(f.dbtStatus || "Aadhaar Linked")}
              </span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-family: monospace; font-weight: 700; font-size: 0.82rem; color: var(--primary-dark);">
            ${escapeHtml(f.tokenNumber || "TK-1042")}
          </span><br>
          <small style="color: var(--text-muted); font-size: 0.75rem;">📅 ${escapeHtml(f.scheduleDate || "12 Sep 2026")}</small>
        </td>
        <td>
          <span class="badge ${getStatusBadge(f.procurementStatus)}">
            ${escapeHtml(f.procurementStatus || "Scheduled")}
          </span><br>
          <small style="color: var(--text-muted); font-size: 0.75rem;">Qty: ${escapeHtml(f.receivedQuantity || f.quantity || "18 Quintal")}</small>
        </td>
        <td>
          <span class="badge ${getPaymentBadge(f.paymentStatus)}">
            ${escapeHtml(f.paymentStatus || "Pending")}
          </span><br>
          <strong style="font-size: 0.82rem; color: var(--text-color);">₹${Number(f.amount || 45000).toLocaleString("en-IN")}</strong>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm btn-outline-primary" style="padding: 2px 7px; font-size: 0.78rem;" title="Edit Farmer Master Details" onclick="openEditFarmerModal(${rawIndex})">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-primary" style="padding: 2px 7px; font-size: 0.78rem;" title="Update Procurement & Payment" onclick="openStatusUpdateModal(${rawIndex})">
              📋 Status
            </button>
            <button class="btn btn-sm btn-outline-danger" style="padding: 2px 5px; font-size: 0.78rem;" title="Remove Farmer" onclick="deleteFarmerDirect(${rawIndex})">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.openEditFarmerModal = function(idx) {
  const farmer = allFarmersData[idx];
  if (!farmer) return;

  selectedFarmerForEdit = farmer;

  const modal = document.getElementById("adminEditFarmerModal");
  const subTitle = document.getElementById("editFarmerSubTitle");

  if (subTitle) subTitle.textContent = `Editing Master Ledger for ${farmer.name} (${farmer.farmerId})`;

  document.getElementById("editFarmerDbId").value = farmer.id || farmer._id || farmer.farmerId;
  document.getElementById("editFarmerName").value = farmer.name || "";
  document.getElementById("editFarmerMobile").value = farmer.mobile || "";
  document.getElementById("editFarmerVillage").value = farmer.village || "";
  document.getElementById("editFarmerDistrict").value = farmer.district || "Indore";
  document.getElementById("editFarmerCrop").value = farmer.crop || "Wheat";
  document.getElementById("editFarmerLand").value = farmer.landArea || "3.5 Acres";
  document.getElementById("editFarmerPassword").value = farmer.plainPassword || "123456";

  const centreSelect = document.getElementById("editFarmerCentre");
  if (centreSelect && farmer.preferredCentre) {
    for (let opt of centreSelect.options) {
      if (opt.value.includes(farmer.preferredCentre) || farmer.preferredCentre.includes(opt.value)) {
        centreSelect.value = opt.value;
        break;
      }
    }
  }

  document.getElementById("editFarmerBank").value = farmer.bankName || "State Bank of India";
  document.getElementById("editFarmerAccount").value = farmer.accountNumber || "30829104820";
  document.getElementById("editFarmerIfsc").value = farmer.ifscCode || "SBIN0001234";
  document.getElementById("editFarmerDbt").value = farmer.dbtStatus || "Active (Aadhaar Seeded)";

  if (modal) modal.classList.add("active");
};

window.deleteFarmerDirect = async function(idx) {
  const farmer = allFarmersData[idx];
  if (!farmer) return;

  const confirmDelete = confirm(`Remove Farmer "${farmer.name}" (${farmer.farmerId}) from Master Sheet?`);
  if (!confirmDelete) return;

  const farmerDbId = farmer.id || farmer._id || farmer.farmerId;
  try {
    const res = await apiFetch(`/api/admin/farmers/${farmerDbId}`, {
      method: "DELETE"
    });

    if (res.success) {
      showToast("Farmer record removed", "success");
      await loadAdminFarmers();
      await loadAdminDashboard();
    } else {
      showToast(res.message || "Failed to remove farmer", "error");
    }
  } catch (err) {
    showToast("Error deleting farmer", "error");
  }
};

function exportFarmerSheetToCsv() {
  if (!allFarmersData || allFarmersData.length === 0) {
    showToast("No farmer data available to export", "error");
    return;
  }

  const headers = [
    "Farmer ID",
    "Farmer Name",
    "Mobile Number",
    "Login Password",
    "Village",
    "District",
    "State",
    "Crop",
    "Land Area",
    "Preferred Centre",
    "Aadhaar Number",
    "Bank Name",
    "Account Number",
    "IFSC Code",
    "DBT Status",
    "Token Number",
    "Schedule Date",
    "Procurement Status",
    "Received Quantity",
    "Payment Status",
    "Disbursement Amount (INR)"
  ];

  const rows = allFarmersData.map(f => [
    `"${f.farmerId || ''}"`,
    `"${f.name || ''}"`,
    `"${f.mobile || ''}"`,
    `"${f.plainPassword || '123456'}"`,
    `"${f.village || ''}"`,
    `"${f.district || ''}"`,
    `"${f.state || 'Madhya Pradesh'}"`,
    `"${f.crop || ''}"`,
    `"${f.landArea || ''}"`,
    `"${f.preferredCentre || ''}"`,
    `"${f.aadharNumber || ''}"`,
    `"${f.bankName || ''}"`,
    `"${f.accountNumber || ''}"`,
    `"${f.ifscCode || ''}"`,
    `"${f.dbtStatus || ''}"`,
    `"${f.tokenNumber || ''}"`,
    `"${f.scheduleDate || ''}"`,
    `"${f.procurementStatus || ''}"`,
    `"${f.receivedQuantity || f.quantity || ''}"`,
    `"${f.paymentStatus || ''}"`,
    `"${f.amount || 0}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Mandisathi_Farmer_Master_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Farmer Master Sheet downloaded as CSV!", "success");
}

/* ==========================================================================
   DASHBOARD METRICS & CENTRES STATUS OVERVIEW
   ========================================================================== */

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
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function copyToClipboard(text, successMsg) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg || "Copied to clipboard!", "info");
    }).catch(() => {
      prompt("Copy to clipboard: Ctrl+C, Enter", text);
    });
  } else {
    prompt("Copy to clipboard: Ctrl+C, Enter", text);
  }
}

/* ==========================================================================
   META WHATSAPP MESSAGES LOG
   ========================================================================== */

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
