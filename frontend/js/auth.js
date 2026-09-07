/**
 * Mandisathi - Authentication Handlers (Login & Register)
 */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // Quick Demo Buttons for easy 1-click evaluation
  const fillFarmerDemoBtn = document.getElementById("fillFarmerDemoBtn");
  const fillAdminDemoBtn = document.getElementById("fillAdminDemoBtn");
  const fillRegisterDemoBtn = document.getElementById("fillRegisterDemoBtn");

  if (fillFarmerDemoBtn) {
    fillFarmerDemoBtn.addEventListener("click", () => {
      document.getElementById("mobile").value = "9876543210";
      document.getElementById("password").value = "123456";
      showToast("Farmer credentials filled (Ramesh Patel)", "info");
    });
  }

  if (fillAdminDemoBtn) {
    fillAdminDemoBtn.addEventListener("click", () => {
      const adminMobileEl = document.getElementById("adminMobile") || document.getElementById("mobile");
      const adminPasswordEl = document.getElementById("adminPassword") || document.getElementById("password");
      if (adminMobileEl) adminMobileEl.value = "9999999999";
      if (adminPasswordEl) adminPasswordEl.value = "admin123";
      showToast("Officer credentials filled (Mandi Officer)", "info");
    });
  }

  if (fillRegisterDemoBtn) {
    fillRegisterDemoBtn.addEventListener("click", () => {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      document.getElementById("name").value = "Kailash Verma";
      document.getElementById("mobile").value = "98260" + randomNum;
      const aadharEl = document.getElementById("aadharNumber");
      if (aadharEl) aadharEl.value = "7894 5612 " + randomNum;
      document.getElementById("password").value = "123456";
      document.getElementById("farmerId").value = "FMR" + randomNum;
      document.getElementById("village").value = "Sanwer";
      document.getElementById("district").value = "Indore";
      document.getElementById("state").value = "Madhya Pradesh";
      document.getElementById("crop").value = "Wheat";
      document.getElementById("landArea").value = "4.5 Acres";
      document.getElementById("preferredCentre").value = "Sanwer Procurement Centre";

      // Fill Bank DBT Fields
      const bankNameEl = document.getElementById("bankName");
      if (bankNameEl) bankNameEl.value = "State Bank of India";
      const holderEl = document.getElementById("accountHolderName");
      if (holderEl) holderEl.value = "Kailash Verma";
      const accEl = document.getElementById("accountNumber");
      if (accEl) accEl.value = "30982451928";
      const confirmAccEl = document.getElementById("confirmAccountNumber");
      if (confirmAccEl) confirmAccEl.value = "30982451928";
      const ifscEl = document.getElementById("ifscCode");
      if (ifscEl) ifscEl.value = "SBIN0001234";
      const branchEl = document.getElementById("branchName");
      if (branchEl) branchEl.value = "Sanwer Mandi Branch";

      showToast("Sample registration & DBT bank data populated", "info");
    });
  }

  // Handle Farmer Login Submit
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      const mobile = document.getElementById("mobile").value.trim();
      const password = document.getElementById("password").value;

      if (!mobile || !password) {
        showToast("Please enter both mobile number and password", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Logging in...";

      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ mobile, password, portalType: "farmer" })
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        if (res.data.farmer.role !== "farmer") {
          showToast("Access Denied: This portal is exclusively for Farmers. Mandi Officers please use the Procurement Centre Login.", "error");
          return;
        }
        setAuthToken(res.data.token);
        setUser(res.data.farmer);
        showToast("Farmer login successful!", "success");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 400);
      } else {
        showToast(res.message || "Invalid mobile number or password", "error");
      }
    });
  }

  // Handle Admin / Procurement Centre Login Submit
  const adminLoginForm = document.getElementById("adminLoginForm");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = adminLoginForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      const mobile = document.getElementById("adminMobile").value.trim();
      const password = document.getElementById("adminPassword").value;

      if (!mobile || !password) {
        showToast("Please enter officer mobile/staff ID and password", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Verifying Officer Credentials...";

      const res = await apiFetch("/api/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ mobile, password, portalType: "admin" })
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        if (res.data.farmer.role !== "admin") {
          showToast("Access Denied: This portal is strictly for Mandi Officers. Farmers please use the Farmer Login portal.", "error");
          return;
        }
        setAuthToken(res.data.token);
        setUser(res.data.farmer);
        showToast("Officer authentication successful! Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "admin.html";
        }, 400);
      } else {
        showToast(res.message || "Access Denied: Invalid Mandi Officer credentials.", "error");
      }
    });
  }

  // Handle Registration Submit
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = registerForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      const name = document.getElementById("name").value.trim();
      const rawMobile = document.getElementById("mobile").value.trim();
      const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);

      const aadharInput = document.getElementById("aadharNumber");
      const rawAadhar = aadharInput ? aadharInput.value.trim() : "";
      const cleanAadhar = rawAadhar.replace(/[^0-9]/g, "");

      const password = document.getElementById("password").value;
      const farmerId = document.getElementById("farmerId") ? document.getElementById("farmerId").value.trim() : "";
      const preferredCentre = document.getElementById("preferredCentre").value;
      const village = document.getElementById("village").value.trim();
      const district = document.getElementById("district").value.trim();
      const state = document.getElementById("state").value.trim();
      const crop = document.getElementById("crop").value.trim();
      const landArea = document.getElementById("landArea").value.trim();
      const consentEl = document.getElementById("dbtAadharConsent");

      if (cleanMobile.length < 10) {
        showToast(t("validMobileRequired") || "Please enter a valid 10-digit Aadhaar-linked mobile number", "error");
        return;
      }

      if (cleanAadhar.length < 12) {
        showToast(t("validAadharRequired") || "Please enter a valid 12-digit Aadhaar number for DBT routing", "error");
        return;
      }

      if (consentEl && !consentEl.checked) {
        showToast("Please confirm that your mobile is linked with your Aadhaar card for DBT payments", "error");
        return;
      }

      const payload = {
        name,
        mobile: cleanMobile,
        aadharNumber: cleanAadhar,
        password,
        farmerId,
        village,
        district,
        state,
        crop,
        landArea,
        preferredCentre,
        bankName: "Aadhaar Linked Primary Bank (NPCI / PFMS)",
        accountHolderName: name,
        accountNumber: `Aadhaar-Seeded (${cleanAadhar.slice(-4)})`,
        ifscCode: "APBS0000001",
        branchName: district ? `${district} Branch` : "Aadhaar Seeding Branch"
      };

      if (!payload.name || !payload.mobile || !payload.password || !payload.village || !payload.district || !payload.crop) {
        showToast("Please complete all required fields", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Registering & Linking Aadhaar DBT...";

      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        setAuthToken(res.data.token);
        setUser(res.data.farmer);
        showToast("Registration & DBT account verification successful!", "success");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 500);
      } else {
        showToast(res.message || "Registration failed. Please check your inputs.", "error");
      }
    });
  }
});
