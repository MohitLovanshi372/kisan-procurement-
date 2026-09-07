/**
 * Mandisathi - Farmer Profile Handler
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  const editModal = document.getElementById("editProfileModal");
  const openEditBtn = document.getElementById("openEditProfileBtn");
  const closeEditBtn = document.getElementById("closeEditModalBtn");
  const profileForm = document.getElementById("editProfileForm");

  if (openEditBtn && editModal) {
    openEditBtn.addEventListener("click", () => {
      editModal.classList.add("active");
    });
  }

  if (closeEditBtn && editModal) {
    closeEditBtn.addEventListener("click", () => {
      editModal.classList.remove("active");
    });
  }

  let currentAccountNumber = "";
  let isAccountMasked = true;

  const toggleAccountBtn = document.getElementById("toggleMaskAccountBtn");
  if (toggleAccountBtn) {
    toggleAccountBtn.addEventListener("click", () => {
      const pAcc = document.getElementById("profAccountNumber");
      if (!pAcc) return;
      isAccountMasked = !isAccountMasked;
      if (isAccountMasked) {
        const last4 = currentAccountNumber.slice(-4) || "1928";
        pAcc.textContent = `•••• •••• ${last4}`;
        toggleAccountBtn.textContent = "Show";
      } else {
        pAcc.textContent = currentAccountNumber || "30982451928";
        toggleAccountBtn.textContent = "Hide";
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = profileForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      const payload = {
        name: document.getElementById("editName").value.trim(),
        village: document.getElementById("editVillage").value.trim(),
        district: document.getElementById("editDistrict").value.trim(),
        state: document.getElementById("editState").value.trim(),
        crop: document.getElementById("editCrop").value.trim(),
        landArea: document.getElementById("editLandArea").value.trim(),
        preferredCentre: document.getElementById("editPreferredCentre").value,
        bankName: document.getElementById("editBankName") ? document.getElementById("editBankName").value.trim() : undefined,
        accountHolderName: document.getElementById("editAccountHolder") ? document.getElementById("editAccountHolder").value.trim() : undefined,
        accountNumber: document.getElementById("editAccountNumber") ? document.getElementById("editAccountNumber").value.trim() : undefined,
        ifscCode: document.getElementById("editIfscCode") ? document.getElementById("editIfscCode").value.trim().toUpperCase() : undefined,
        branchName: document.getElementById("editBranchName") ? document.getElementById("editBranchName").value.trim() : undefined,
        aadharNumber: document.getElementById("editAadhar") ? document.getElementById("editAadhar").value.trim() : undefined
      };

      const res = await apiFetch("/api/farmers/profile", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;

      if (res.success && res.data) {
        setUser(res.data);
        showToast(t("profileUpdateSuccess") || "Profile & DBT details updated successfully", "success");
        if (editModal) editModal.classList.remove("active");
        renderProfile(res.data);

        const headerName = document.getElementById("headerUserName");
        if (headerName) headerName.textContent = res.data.name;
      } else {
        showToast(res.message || t("profileUpdateFailed"), "error");
      }
    });
  }

  await loadProfile();
});

async function loadProfile() {
  try {
    const res = await apiFetch("/api/farmers/profile");
    if (res.success && res.data) {
      renderProfile(res.data);
    }
  } catch (error) {
    console.error("Profile load error:", error);
  }
}

function renderProfile(farmer) {
  const pName = document.getElementById("profName");
  const pFarmerId = document.getElementById("profFarmerId");
  const pMobile = document.getElementById("profMobile");
  const pAadhar = document.getElementById("profAadhar");
  const pVillage = document.getElementById("profVillage");
  const pDistrict = document.getElementById("profDistrict");
  const pState = document.getElementById("profState");
  const pCrop = document.getElementById("profCrop");
  const pLandArea = document.getElementById("profLandArea");
  const pCentre = document.getElementById("profCentre");

  const pBankName = document.getElementById("profBankName");
  const pAccountHolder = document.getElementById("profAccountHolder");
  const pAccountNumber = document.getElementById("profAccountNumber");
  const pIfscCode = document.getElementById("profIfscCode");
  const pBranchName = document.getElementById("profBranchName");
  const pDbtBadge = document.getElementById("profDbtBadge");

  if (pName) pName.textContent = farmer.name || "Ramesh Patel";
  if (pFarmerId) pFarmerId.textContent = farmer.farmerId || "FMR1001";
  if (pMobile) pMobile.textContent = farmer.mobile || "9876543210";

  const rawAadhar = farmer.aadharNumber ? String(farmer.aadharNumber).replace(/[^0-9]/g, "") : "789456124589";
  if (pAadhar) pAadhar.textContent = `•••• •••• ${rawAadhar.slice(-4)}`;

  if (pVillage) pVillage.textContent = farmer.village || "Sanwer";
  if (pDistrict) pDistrict.textContent = farmer.district || "Indore";
  if (pState) pState.textContent = farmer.state || "Madhya Pradesh";
  if (pCrop) pCrop.textContent = farmer.crop || "Wheat";
  if (pLandArea) pLandArea.textContent = farmer.landArea || "4.5 Acres";
  if (pCentre) pCentre.textContent = farmer.preferredCentre || "Sanwer Procurement Centre";

  // DBT Details
  const rawAcc = farmer.accountNumber || "30982451928";
  currentAccountNumber = rawAcc;
  if (pBankName) pBankName.textContent = farmer.bankName || "State Bank of India";
  if (pAccountHolder) pAccountHolder.textContent = farmer.accountHolderName || farmer.name || "Ramesh Patel";
  if (pAccountNumber) pAccountNumber.textContent = `•••• •••• ${String(rawAcc).slice(-4)}`;
  if (pIfscCode) pIfscCode.textContent = farmer.ifscCode || "SBIN0001234";
  if (pBranchName) pBranchName.textContent = farmer.branchName || "Sanwer Branch (Indore)";
  if (pDbtBadge) pDbtBadge.textContent = farmer.dbtStatus ? `✓ ${farmer.dbtStatus}` : "✓ Active (Aadhaar Seeded)";

  // Pre-fill edit modal form
  const eName = document.getElementById("editName");
  const eVillage = document.getElementById("editVillage");
  const eDistrict = document.getElementById("editDistrict");
  const eState = document.getElementById("editState");
  const eCrop = document.getElementById("editCrop");
  const eLandArea = document.getElementById("editLandArea");
  const eCentre = document.getElementById("editPreferredCentre");

  const eBankName = document.getElementById("editBankName");
  const eHolder = document.getElementById("editAccountHolder");
  const eAccount = document.getElementById("editAccountNumber");
  const eIfsc = document.getElementById("editIfscCode");
  const eBranch = document.getElementById("editBranchName");
  const eAadhar = document.getElementById("editAadhar");

  if (eName) eName.value = farmer.name || "";
  if (eVillage) eVillage.value = farmer.village || "";
  if (eDistrict) eDistrict.value = farmer.district || "";
  if (eState) eState.value = farmer.state || "";
  if (eCrop) eCrop.value = farmer.crop || "";
  if (eLandArea) eLandArea.value = farmer.landArea || "";
  if (eCentre) eCentre.value = farmer.preferredCentre || "Sanwer Procurement Centre";

  if (eBankName) eBankName.value = farmer.bankName || "";
  if (eHolder) eHolder.value = farmer.accountHolderName || farmer.name || "";
  if (eAccount) eAccount.value = farmer.accountNumber || "";
  if (eIfsc) eIfsc.value = farmer.ifscCode || "";
  if (eBranch) eBranch.value = farmer.branchName || "";
  if (eAadhar) eAadhar.value = farmer.aadharNumber || "";
}
