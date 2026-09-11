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

  if (fillOfficerDemoBtn) {
    fillOfficerDemoBtn.addEventListener("click", () => {
      const adminMobileEl = document.getElementById("adminMobile") || document.getElementById("mobile");
      const adminPasswordEl = document.getElementById("adminPassword") || document.getElementById("password");
      if (adminMobileEl) adminMobileEl.value = "9893011111";
      if (adminPasswordEl) adminPasswordEl.value = "officer123";
      showToast("Centre Officer credentials filled (Sanwer Mandi)", "info");
    });
  }

  if (fillAdminDemoBtn) {
    fillAdminDemoBtn.addEventListener("click", () => {
      const adminMobileEl = document.getElementById("adminMobile") || document.getElementById("mobile");
      const adminPasswordEl = document.getElementById("adminPassword") || document.getElementById("password");
      if (adminMobileEl) adminMobileEl.value = "9999999999";
      if (adminPasswordEl) adminPasswordEl.value = "admin123";
      showToast("Govt Admin credentials filled (State Mandi Board)", "info");
    });
  }

  if (fillRegisterDemoBtn) {
    fillRegisterDemoBtn.addEventListener("click", async () => {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      document.getElementById("name").value = "Kailash Verma";
      const mobileInput = document.getElementById("mobile");
      const sampleMobile = "98260" + randomNum;
      if (mobileInput) mobileInput.value = sampleMobile;
      const aadharEl = document.getElementById("aadharNumber");
      if (aadharEl) aadharEl.value = "7894 5612 " + randomNum;
      document.getElementById("password").value = "123456";
      const farmerIdEl = document.getElementById("farmerId");
      if (farmerIdEl) farmerIdEl.value = "FMR" + randomNum;
      document.getElementById("village").value = "Sanwer";
      document.getElementById("district").value = "Indore";
      document.getElementById("state").value = "Madhya Pradesh";
      document.getElementById("crop").value = "Wheat";
      document.getElementById("landArea").value = "4.5 Acres";
      document.getElementById("preferredCentre").value = "Sanwer Procurement Centre";

      showToast("Sample registration data populated. Sending Aadhaar OTP...", "info");

      // Auto-trigger OTP send for smooth 1-click test
      try {
        const res = await apiFetch("/api/auth/send-registration-otp", {
          method: "POST",
          body: JSON.stringify({ mobile: sampleMobile, name: "Kailash Verma" })
        });
        if (res.success) {
          const otpBox = document.getElementById("otpVerificationBox");
          const maskedPhoneEl = document.getElementById("otpMaskedPhone");
          const demoOtpValEl = document.getElementById("demoOtpValue");
          const otpInput = document.getElementById("otpInput");
          if (otpBox) otpBox.style.display = "block";
          if (maskedPhoneEl) maskedPhoneEl.textContent = res.maskedMobile || `+91 ${sampleMobile}`;
          if (demoOtpValEl && res.demoOtp) demoOtpValEl.textContent = res.demoOtp;
          if (otpInput) {
            otpInput.value = res.demoOtp || "123456";
            otpInput.focus();
          }
          showToast(`⚡ Demo OTP generated: ${res.demoOtp || "123456"} (Click 'Verify' or complete form)`, "info");
        }
      } catch (err) {
        console.warn("Auto OTP request notice:", err.message);
      }
    });
  }

  // Registration OTP State Variables
  let isMobileVerified = false;
  let verifiedOtp = "";
  let otpTimerInterval = null;

  const btnSendOtp = document.getElementById("btnSendOtp");
  const btnSendOtpText = document.getElementById("btnSendOtpText");
  const btnVerifyOtp = document.getElementById("btnVerifyOtp");
  const btnResendOtp = document.getElementById("btnResendOtp");
  const otpInput = document.getElementById("otpInput");
  const otpVerificationBox = document.getElementById("otpVerificationBox");
  const otpMaskedPhone = document.getElementById("otpMaskedPhone");
  const otpTimerCount = document.getElementById("otpTimerCount");
  const otpCountdownWrapper = document.getElementById("otpCountdownWrapper");
  const demoOtpChip = document.getElementById("demoOtpChip");
  const demoOtpValue = document.getElementById("demoOtpValue");
  const otpSuccessBanner = document.getElementById("otpSuccessBanner");
  const mobileVerifiedBadge = document.getElementById("mobileVerifiedBadge");
  const dbtMobileStatus = document.getElementById("dbtMobileStatus");
  const verifiedMobileDisplay = document.getElementById("verifiedMobileDisplay");
  const stepIndicator1 = document.getElementById("stepIndicator1");
  const stepIndicator2 = document.getElementById("stepIndicator2");
  const stepIndicator3 = document.getElementById("stepIndicator3");

  function startOtpTimer(seconds = 30) {
    if (otpTimerInterval) clearInterval(otpTimerInterval);
    let remaining = seconds;
    if (otpCountdownWrapper) otpCountdownWrapper.style.display = "inline";
    if (btnResendOtp) btnResendOtp.style.display = "none";
    if (otpTimerCount) otpTimerCount.textContent = remaining;

    otpTimerInterval = setInterval(() => {
      remaining -= 1;
      if (otpTimerCount) otpTimerCount.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(otpTimerInterval);
        otpTimerInterval = null;
        if (otpCountdownWrapper) otpCountdownWrapper.style.display = "none";
        if (btnResendOtp) {
          btnResendOtp.style.display = "inline";
          btnResendOtp.disabled = false;
        }
      }
    }, 1000);
  }

  async function handleSendOtp() {
    const rawMobile = (document.getElementById("mobile")?.value || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);
    const farmerName = (document.getElementById("name")?.value || "").trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      showToast("Please enter a valid 10-digit Aadhaar-linked mobile number first.", "error");
      const mobileEl = document.getElementById("mobile");
      if (mobileEl) mobileEl.focus();
      return;
    }

    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      if (btnSendOtpText) btnSendOtpText.textContent = "Sending OTP...";
    }

    const res = await apiFetch("/api/auth/send-registration-otp", {
      method: "POST",
      body: JSON.stringify({ mobile: cleanMobile, name: farmerName })
    });

    if (btnSendOtp) {
      btnSendOtp.disabled = false;
      if (btnSendOtpText) btnSendOtpText.textContent = "Resend OTP (पुनः भेजें)";
    }

    if (res.success) {
      if (otpVerificationBox) otpVerificationBox.style.display = "block";
      if (otpMaskedPhone) otpMaskedPhone.textContent = res.maskedMobile || `+91 ${cleanMobile.slice(0, 2)}*****${cleanMobile.slice(-3)}`;
      if (demoOtpValue && res.demoOtp) demoOtpValue.textContent = res.demoOtp;
      if (otpInput) {
        otpInput.value = "";
        otpInput.focus();
      }
      startOtpTimer(30);
      showToast(res.message || "OTP sent successfully to your mobile & WhatsApp!", "info");
      
      // Update stepper
      if (stepIndicator1) stepIndicator1.className = "reg-step-item completed";
      if (stepIndicator2) stepIndicator2.className = "reg-step-item active";
    } else {
      showToast(res.message || "Failed to send OTP. Please check the number.", "error");
    }
  }

  async function handleVerifyOtp() {
    const rawMobile = (document.getElementById("mobile")?.value || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);
    const enteredOtp = (otpInput?.value || "").trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      showToast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    if (!enteredOtp || enteredOtp.length < 4) {
      showToast("Please enter the 6-digit OTP received on your mobile.", "error");
      if (otpInput) otpInput.focus();
      return;
    }

    if (btnVerifyOtp) {
      btnVerifyOtp.disabled = true;
      btnVerifyOtp.innerHTML = "<span>⏳</span> <span>सत्यापित हो रहा है...</span>";
    }

    const res = await apiFetch("/api/auth/verify-registration-otp", {
      method: "POST",
      body: JSON.stringify({ mobile: cleanMobile, otp: enteredOtp })
    });

    if (btnVerifyOtp) {
      btnVerifyOtp.disabled = false;
      btnVerifyOtp.innerHTML = "<span>✓</span> <span>ओटीपी सत्यापित करें (Verify)</span>";
    }

    if (res.success) {
      isMobileVerified = true;
      verifiedOtp = enteredOtp;

      if (otpTimerInterval) clearInterval(otpTimerInterval);
      if (otpVerificationBox) otpVerificationBox.style.display = "none";
      if (otpSuccessBanner) otpSuccessBanner.style.display = "flex";
      if (mobileVerifiedBadge) mobileVerifiedBadge.style.display = "inline-flex";
      if (btnSendOtp) {
        btnSendOtp.disabled = true;
        btnSendOtp.style.background = "#166534";
        if (btnSendOtpText) btnSendOtpText.textContent = "✓ Verified (सत्यापित)";
      }
      const mobileInput = document.getElementById("mobile");
      if (mobileInput) {
        mobileInput.readOnly = true;
        mobileInput.style.background = "#f0fdf4";
        mobileInput.style.borderColor = "#86efac";
      }
      if (verifiedMobileDisplay) {
        verifiedMobileDisplay.textContent = `Aadhaar Mobile +91 ${cleanMobile} successfully verified & mapped with NPCI.`;
      }
      if (dbtMobileStatus) {
        dbtMobileStatus.textContent = "✓ आधार ओटीपी सत्यापित (NPCI Active)";
        dbtMobileStatus.style.color = "#16a34a";
      }

      // Update stepper to step 3
      if (stepIndicator2) stepIndicator2.className = "reg-step-item completed";
      if (stepIndicator3) stepIndicator3.className = "reg-step-item active";

      showToast("Aadhaar mobile successfully verified via OTP!", "success");
    } else {
      showToast(res.message || "Invalid OTP. Please check the code and retry.", "error");
    }
  }

  if (btnSendOtp) {
    btnSendOtp.addEventListener("click", handleSendOtp);
  }

  if (btnResendOtp) {
    btnResendOtp.addEventListener("click", handleSendOtp);
  }

  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener("click", handleVerifyOtp);
  }

  if (demoOtpChip) {
    demoOtpChip.addEventListener("click", () => {
      const code = demoOtpValue ? demoOtpValue.textContent.trim() : "123456";
      if (otpInput) {
        otpInput.value = code;
        handleVerifyOtp();
      }
    });
  }

  // Quick auto-verify when typing 6 digits in OTP input
  if (otpInput) {
    otpInput.addEventListener("input", (e) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      e.target.value = val;
      if (val.length === 6) {
        handleVerifyOtp();
      }
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
        const userRole = (res.data.role || (res.data.farmer && res.data.farmer.role) || "").toUpperCase();
        if (userRole !== "FARMER") {
          showToast("Access Denied: This portal is exclusively for Farmers. Mandi Officers and Admins please use the Officer Login portal.", "error");
          return;
        }
        setAuthToken(res.data.token);
        setUser(res.data.user || res.data.farmer);
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
        const userRole = (res.data.role || (res.data.farmer && res.data.farmer.role) || "").toUpperCase();
        if (userRole === "FARMER") {
          showToast("Access Denied: This portal is strictly for Mandi Officers and Admins. Farmers please use the Farmer Login portal.", "error");
          return;
        }

        setAuthToken(res.data.token);
        setUser(res.data.user || res.data.farmer);
        
        const destination = res.data.redirectUrl || (userRole === "CENTRE_OFFICER" ? "centre-officer.html" : "admin.html");
        const greetingRole = userRole === "CENTRE_OFFICER" ? "Centre Officer" : "Administrator";
        showToast(`${greetingRole} authentication successful! Redirecting...`, "success");

        setTimeout(() => {
          window.location.href = destination;
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

      // Aadhaar Mobile OTP verification guard
      if (!isMobileVerified) {
        const pendingOtp = (otpInput?.value || "").trim();
        if (pendingOtp && pendingOtp.length >= 4) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "Verifying OTP & Registering...";
          const verifyRes = await apiFetch("/api/auth/verify-registration-otp", {
            method: "POST",
            body: JSON.stringify({ mobile: cleanMobile, otp: pendingOtp })
          });
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;

          if (verifyRes.success) {
            isMobileVerified = true;
            verifiedOtp = pendingOtp;
            if (otpSuccessBanner) otpSuccessBanner.style.display = "flex";
            if (otpVerificationBox) otpVerificationBox.style.display = "none";
          } else {
            showToast(verifyRes.message || "Invalid OTP. Please check the code received on your mobile.", "error");
            if (otpVerificationBox) otpVerificationBox.style.display = "block";
            if (otpInput) otpInput.focus();
            return;
          }
        } else {
          showToast("Aadhaar Mobile OTP verification required. Sending OTP to your mobile...", "info");
          handleSendOtp();
          if (otpVerificationBox) {
            otpVerificationBox.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
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
        otp: verifiedOtp || "123456",
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
        if (stepIndicator1) stepIndicator1.className = "reg-step-item completed";
        if (stepIndicator2) stepIndicator2.className = "reg-step-item completed";
        if (stepIndicator3) stepIndicator3.className = "reg-step-item completed";
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
