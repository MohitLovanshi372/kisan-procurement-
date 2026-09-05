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
        preferredCentre: document.getElementById("editPreferredCentre").value
      };

      const res = await apiFetch("/api/farmers/profile", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;

      if (res.success && res.data) {
        setUser(res.data);
        showToast(t("profileUpdateSuccess"), "success");
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
  const pVillage = document.getElementById("profVillage");
  const pDistrict = document.getElementById("profDistrict");
  const pState = document.getElementById("profState");
  const pCrop = document.getElementById("profCrop");
  const pLandArea = document.getElementById("profLandArea");
  const pCentre = document.getElementById("profCentre");

  if (pName) pName.textContent = farmer.name || "Ramesh Patel";
  if (pFarmerId) pFarmerId.textContent = farmer.farmerId || "FMR1001";
  if (pMobile) pMobile.textContent = farmer.mobile || "9876543210";
  if (pVillage) pVillage.textContent = farmer.village || "Sanwer";
  if (pDistrict) pDistrict.textContent = farmer.district || "Indore";
  if (pState) pState.textContent = farmer.state || "Madhya Pradesh";
  if (pCrop) pCrop.textContent = farmer.crop || "Wheat";
  if (pLandArea) pLandArea.textContent = farmer.landArea || "4.5 Acres";
  if (pCentre) pCentre.textContent = farmer.preferredCentre || "Sanwer Procurement Centre";

  // Pre-fill edit modal form
  const eName = document.getElementById("editName");
  const eVillage = document.getElementById("editVillage");
  const eDistrict = document.getElementById("editDistrict");
  const eState = document.getElementById("editState");
  const eCrop = document.getElementById("editCrop");
  const eLandArea = document.getElementById("editLandArea");
  const eCentre = document.getElementById("editPreferredCentre");

  if (eName) eName.value = farmer.name || "";
  if (eVillage) eVillage.value = farmer.village || "";
  if (eDistrict) eDistrict.value = farmer.district || "";
  if (eState) eState.value = farmer.state || "";
  if (eCrop) eCrop.value = farmer.crop || "";
  if (eLandArea) eLandArea.value = farmer.landArea || "";
  if (eCentre) eCentre.value = farmer.preferredCentre || "Sanwer Procurement Centre";
}
