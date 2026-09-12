/**
 * Mandisathi - Authentication Handlers (Login & Register)
 */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // Role Tabs Switcher on Login Page
  const tabFarmer = document.getElementById("tabFarmer");
  const tabOfficer = document.getElementById("tabOfficer");
  const tabAdmin = document.getElementById("tabAdmin");
  const loginPortalType = document.getElementById("loginPortalType");
  const loginCardTitle = document.getElementById("loginCardTitle");
  const loginCardSubtitle = document.getElementById("loginCardSubtitle");
  const loginIdentifierLabel = document.getElementById("loginIdentifierLabel");
  const mobileInput = document.getElementById("mobile");
  const loginSubmitBtn = document.getElementById("loginSubmitBtn");
  const newFarmerRow = document.getElementById("newFarmerRow");

  function setRoleTab(role) {
    [tabFarmer, tabOfficer, tabAdmin].forEach(tab => {
      if (tab) {
        tab.style.background = "transparent";
        tab.style.color = "#64748b";
        tab.style.boxShadow = "none";
        tab.classList.remove("active");
      }
    });

    if (role === "centre_officer") {
      if (tabOfficer) {
        tabOfficer.style.background = "#ffffff";
        tabOfficer.style.color = "var(--secondary)";
        tabOfficer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        tabOfficer.classList.add("active");
      }
      if (loginPortalType) loginPortalType.value = "centre_officer";
      if (loginCardTitle) loginCardTitle.textContent = "Procurement Centre Officer Login";
      if (loginCardSubtitle) loginCardSubtitle.textContent = "Authorized Centre Officers & Weighment Staff";
      if (loginIdentifierLabel) loginIdentifierLabel.textContent = "Officer Mobile or Staff ID";
      if (mobileInput) mobileInput.placeholder = "e.g. 9893011111 or OFF001";
      if (loginSubmitBtn) loginSubmitBtn.textContent = "Secure Centre Officer Login →";
      if (newFarmerRow) newFarmerRow.style.display = "none";
    } else if (role === "admin") {
      if (tabAdmin) {
        tabAdmin.style.background = "#ffffff";
        tabAdmin.style.color = "#1e40af";
        tabAdmin.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        tabAdmin.classList.add("active");
      }
      if (loginPortalType) loginPortalType.value = "admin";
      if (loginCardTitle) loginCardTitle.textContent = "State Government Admin Login";
      if (loginCardSubtitle) loginCardSubtitle.textContent = "Directorate of Food & Civil Supplies Mandi Board";
      if (loginIdentifierLabel) loginIdentifierLabel.textContent = "Admin ID or Mobile Number";
      if (mobileInput) mobileInput.placeholder = "e.g. 9999999999 or ADM001";
      if (loginSubmitBtn) loginSubmitBtn.textContent = "Secure Govt Admin Login →";
      if (newFarmerRow) newFarmerRow.style.display = "none";
    } else {
      if (tabFarmer) {
        tabFarmer.style.background = "#ffffff";
        tabFarmer.style.color = "var(--primary)";
        tabFarmer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        tabFarmer.classList.add("active");
      }
      if (loginPortalType) loginPortalType.value = "farmer";
      if (loginCardTitle) loginCardTitle.textContent = "Farmer Login (किसान लॉगिन)";
      if (loginCardSubtitle) loginCardSubtitle.textContent = "Login with your registered mobile or Farmer ID";
      if (loginIdentifierLabel) loginIdentifierLabel.textContent = "Mobile Number / Farmer ID";
      if (mobileInput) mobileInput.placeholder = "e.g. 9876543210 or FMR1001";
      if (loginSubmitBtn) loginSubmitBtn.textContent = "Secure Farmer Login →";
      if (newFarmerRow) newFarmerRow.style.display = "block";
    }
  }

  if (tabFarmer) tabFarmer.addEventListener("click", () => setRoleTab("farmer"));
  if (tabOfficer) tabOfficer.addEventListener("click", () => setRoleTab("centre_officer"));
  if (tabAdmin) tabAdmin.addEventListener("click", () => setRoleTab("admin"));

  // Direct Instant 1-Click Login Helper
  async function fastDirectLogin(identifier, password, portalType = "farmer", triggeringBtn = null) {
    const originalContent = triggeringBtn ? triggeringBtn.innerHTML : null;
    if (triggeringBtn) {
      triggeringBtn.disabled = true;
      triggeringBtn.innerHTML = "<span>⚡ Authenticating...</span>";
    }

    try {
      const endpoint = (portalType === "admin" && !document.getElementById("loginForm")) 
        ? "/api/auth/admin-login" 
        : "/api/auth/login";

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ mobile: identifier, password, portalType })
      });

      if (res.success && res.data) {
        const userRole = (res.data.role || (res.data.user && res.data.user.role) || (res.data.farmer && res.data.farmer.role) || "").toUpperCase();
        setAuthToken(res.data.token);
        setUser(res.data.user || res.data.farmer);

        if (triggeringBtn) {
          triggeringBtn.innerHTML = "<span>✓ Verified! Redirecting...</span>";
        }

        if (userRole === "CENTRE_OFFICER") {
          showToast("⚡ Mandi Officer Verified! Redirecting...", "success");
          window.location.href = "centre-officer.html";
        } else if (userRole === "GOVERNMENT_ADMIN") {
          showToast("⚡ Govt Admin Verified! Redirecting...", "success");
          window.location.href = "admin.html";
        } else {
          showToast("⚡ Farmer Verified! Redirecting to Dashboard...", "success");
          window.location.href = "dashboard.html";
        }
      } else {
        if (triggeringBtn) {
          triggeringBtn.disabled = false;
          triggeringBtn.innerHTML = originalContent;
        }
        showToast(res.message || "Login failed. Please check credentials.", "error");
      }
    } catch (err) {
      if (triggeringBtn) {
        triggeringBtn.disabled = false;
        triggeringBtn.innerHTML = originalContent;
      }
      showToast("Connection error: " + err.message, "error");
    }
  }

  // Password Visibility Toggles
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (input.type === "password") {
          input.type = "text";
          btn.textContent = "🙈";
        } else {
          input.type = "password";
          btn.textContent = "👁️";
        }
      });
    }
  }

  setupPasswordToggle("togglePasswordBtn", "password");
  setupPasswordToggle("toggleAdminPasswordBtn", "adminPassword");
  setupPasswordToggle("toggleRegPasswordBtn", "password");

  // Direct 1-Click Login Event Listeners
  const directFarmerLoginBtn = document.getElementById("directFarmerLoginBtn");
  if (directFarmerLoginBtn) {
    directFarmerLoginBtn.addEventListener("click", () => {
      fastDirectLogin("9876543210", "123456", "farmer", directFarmerLoginBtn);
    });
  }

  const directOfficerLoginBtn = document.getElementById("directOfficerLoginBtn");
  if (directOfficerLoginBtn) {
    directOfficerLoginBtn.addEventListener("click", () => {
      fastDirectLogin("9893011111", "officer123", "centre_officer", directOfficerLoginBtn);
    });
  }

  const directAdminLoginBtn = document.getElementById("directAdminLoginBtn");
  if (directAdminLoginBtn) {
    directAdminLoginBtn.addEventListener("click", () => {
      fastDirectLogin("9999999999", "admin123", "admin", directAdminLoginBtn);
    });
  }

  const directAdminOfficerLoginBtn = document.getElementById("directAdminOfficerLoginBtn");
  if (directAdminOfficerLoginBtn) {
    directAdminOfficerLoginBtn.addEventListener("click", () => {
      fastDirectLogin("9893011111", "officer123", "centre_officer", directAdminOfficerLoginBtn);
    });
  }

  const directAdminGovtLoginBtn = document.getElementById("directAdminGovtLoginBtn");
  if (directAdminGovtLoginBtn) {
    directAdminGovtLoginBtn.addEventListener("click", () => {
      fastDirectLogin("9999999999", "admin123", "admin", directAdminGovtLoginBtn);
    });
  }

  // Quick Demo Buttons for filling credentials only
  const fillFarmerDemoBtn = document.getElementById("fillFarmerDemoBtn");
  const fillAdminDemoBtn = document.getElementById("fillAdminDemoBtn");
  const fillRegisterDemoBtn = document.getElementById("fillRegisterDemoBtn");
  const fillOfficerDemoBtn = document.getElementById("fillOfficerDemoBtn");

  if (fillFarmerDemoBtn) {
    fillFarmerDemoBtn.addEventListener("click", () => {
      setRoleTab("farmer");
      const mob = document.getElementById("mobile");
      const pass = document.getElementById("password");
      if (mob) mob.value = "9876543210";
      if (pass) pass.value = "123456";
      showToast("Farmer credentials filled: Ramesh Patel (9876543210 / 123456)", "info");
    });
  }

  if (fillOfficerDemoBtn) {
    fillOfficerDemoBtn.addEventListener("click", () => {
      setRoleTab("centre_officer");
      const adminMobileEl = document.getElementById("adminMobile") || document.getElementById("mobile");
      const adminPasswordEl = document.getElementById("adminPassword") || document.getElementById("password");
      if (adminMobileEl) adminMobileEl.value = "9893011111";
      if (adminPasswordEl) adminPasswordEl.value = "officer123";
      showToast("Procurement Officer credentials filled: Sanwer Mandi (9893011111 / officer123)", "info");
    });
  }

  if (fillAdminDemoBtn) {
    fillAdminDemoBtn.addEventListener("click", () => {
      setRoleTab("admin");
      const adminMobileEl = document.getElementById("adminMobile") || document.getElementById("mobile");
      const adminPasswordEl = document.getElementById("adminPassword") || document.getElementById("password");
      if (adminMobileEl) adminMobileEl.value = "9999999999";
      if (adminPasswordEl) adminPasswordEl.value = "admin123";
      showToast("Govt Admin credentials filled: State Mandi Board (9999999999 / admin123)", "info");
    });
  }

  if (fillRegisterDemoBtn) {
    fillRegisterDemoBtn.addEventListener("click", async () => {
      // Generate a true 10-digit valid Indian mobile number (e.g. 98XXXXXXXX)
      const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
      const sampleMobile = "98" + random8;
      const samplePart1 = Math.floor(1000 + Math.random() * 9000);
      const samplePart2 = Math.floor(1000 + Math.random() * 9000);

      document.getElementById("name").value = "Kailash Verma";
      const mobileInput = document.getElementById("mobile");
      if (mobileInput) {
        mobileInput.value = sampleMobile;
      }
      const aadharEl = document.getElementById("aadharNumber");
      if (aadharEl) aadharEl.value = `7894 ${samplePart1} ${samplePart2}`;
      document.getElementById("password").value = "123456";
      const farmerIdEl = document.getElementById("farmerId");
      if (farmerIdEl) farmerIdEl.value = "FMR" + samplePart1;
      document.getElementById("village").value = "Sanwer";
      document.getElementById("district").value = "Indore";
      document.getElementById("state").value = "Madhya Pradesh";
      document.getElementById("crop").value = "Wheat";
      document.getElementById("landArea").value = "4.5 Acres";
      document.getElementById("preferredCentre").value = "Sanwer Procurement Centre";

      // Update Aadhaar validation UI
      updateAadharFormatStatus();

      showToast(`⚡ नया टेस्ट किसान डेटा सेट: +91 ${sampleMobile}`, "info");
    });
  }

  // ⚡ Instant 1-Click Fast Register & Get E-Token Handler
  const btnFastRegister = document.getElementById("btnFastRegister");
  if (btnFastRegister) {
    btnFastRegister.addEventListener("click", async () => {
      btnFastRegister.disabled = true;
      const originalHtml = btnFastRegister.innerHTML;
      btnFastRegister.innerHTML = "<span>⚡ Generating E-Token...</span>";

      // Generate a true fresh 10-digit valid Indian mobile and 12-digit Aadhaar
      const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
      const freshMobile = "98" + random8;
      const part1 = Math.floor(1000 + Math.random() * 9000);
      const part2 = Math.floor(1000 + Math.random() * 9000);
      const freshAadhar = `7894${part1}${part2}`;
      const freshFarmerId = "FMR" + part1;

      const sampleNames = ["Vikram Singh", "Sunil Choudhary", "Raju Verma", "Devendra Patidar", "Suresh Yadav"];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];

      const payload = {
        name: randomName,
        mobile: freshMobile,
        aadharNumber: freshAadhar,
        password: "123456",
        farmerId: freshFarmerId,
        village: "Sanwer",
        district: "Indore",
        state: "Madhya Pradesh",
        crop: "Wheat",
        landArea: "5.0 Acres",
        preferredCentre: "Sanwer Procurement Centre",
        bankName: "Aadhaar Linked Primary Bank (NPCI / PFMS)",
        accountHolderName: randomName,
        accountNumber: `Aadhaar-Seeded (${freshAadhar.slice(-4)})`,
        ifscCode: "APBS0000001",
        branchName: "Indore Sanwer Branch"
      };

      try {
        const res = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (res.success && res.data) {
          btnFastRegister.innerHTML = "<span>✓ Registered! Redirecting...</span>";
          setAuthToken(res.data.token);
          setUser(res.data.farmer || res.data.user);
          showToast(`⚡ किसान ${randomName} (${freshFarmerId}) पंजीकृत! टोकन आवंटित!`, "success");
          setTimeout(() => {
            window.location.href = res.data.redirectUrl || "dashboard.html";
          }, 400);
        } else {
          btnFastRegister.disabled = false;
          btnFastRegister.innerHTML = originalHtml;
          showToast(res.message || "Fast registration failed. Try again.", "error");
        }
      } catch (err) {
        btnFastRegister.disabled = false;
        btnFastRegister.innerHTML = originalHtml;
        showToast("Error during fast registration: " + err.message, "error");
      }
    });
  }

  // 🎲 Generate New Test Mobile button
  const btnNewTestNumber = document.getElementById("btnNewTestNumber");
  if (btnNewTestNumber) {
    btnNewTestNumber.addEventListener("click", () => {
      const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
      const sampleMobile = "98" + random8;
      const mobileInput = document.getElementById("mobile");
      if (mobileInput) {
        mobileInput.value = sampleMobile;
      }
      const aadharEl = document.getElementById("aadharNumber");
      if (aadharEl) {
        aadharEl.value = `7894 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const farmerIdEl = document.getElementById("farmerId");
      if (farmerIdEl) {
        farmerIdEl.value = "FMR" + Math.floor(1000 + Math.random() * 9000);
      }

      const alertBox = document.getElementById("registerAlertBox");
      if (alertBox) alertBox.style.display = "none";

      updateAadharFormatStatus();
      showToast(`🎲 नया टेस्ट मोबाइल नंबर: +91 ${sampleMobile}`, "info");
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
  const btnAutoFillRegOtp = document.getElementById("btnAutoFillRegOtp");
  const otpInput = document.getElementById("otpInput");
  const otpVerificationBox = document.getElementById("otpVerificationBox");
  const otpMaskedPhone = document.getElementById("otpMaskedPhone");
  const otpMaskedAadhar = document.getElementById("otpMaskedAadhar");
  const otpAadhaarNotice = document.getElementById("otpAadhaarNotice");
  const otpTimerCount = document.getElementById("otpTimerCount");
  const otpCountdownWrapper = document.getElementById("otpCountdownWrapper");
  const demoOtpChip = document.getElementById("demoOtpChip");
  const demoOtpValue = document.getElementById("demoOtpValue");
  const demoOtpValueSmall = document.getElementById("demoOtpValueSmall");
  const otpSuccessBanner = document.getElementById("otpSuccessBanner");
  const mobileVerifiedBadge = document.getElementById("mobileVerifiedBadge");
  const dbtMobileStatus = document.getElementById("dbtMobileStatus");
  const verifiedMobileDisplay = document.getElementById("verifiedMobileDisplay");
  const stepIndicator1 = document.getElementById("stepIndicator1");
  const stepIndicator2 = document.getElementById("stepIndicator2");
  const stepIndicator3 = document.getElementById("stepIndicator3");
  const aadharInputEl = document.getElementById("aadharNumber");
  const aadharValidBadgeEl = document.getElementById("aadharValidBadge");
  const aadharFormatHintEl = document.getElementById("aadharFormatHint");

  // Format and Validate Aadhaar live
  function updateAadharFormatStatus() {
    if (!aadharInputEl) return;
    const raw = aadharInputEl.value.replace(/[^0-9]/g, "").slice(0, 12);
    // Format 4-4-4
    const chunks = [];
    for (let i = 0; i < raw.length; i += 4) {
      chunks.push(raw.slice(i, i + 4));
    }
    aadharInputEl.value = chunks.join(" ");

    if (raw.length === 12) {
      if (aadharValidBadgeEl) {
        aadharValidBadgeEl.style.display = "inline-flex";
        aadharValidBadgeEl.textContent = "✓ मान्य आधार (12-Digit Valid)";
        aadharValidBadgeEl.style.background = "#dcfce7";
        aadharValidBadgeEl.style.color = "#166534";
        aadharValidBadgeEl.style.borderColor = "#86efac";
      }
      if (aadharFormatHintEl) {
        aadharFormatHintEl.innerHTML = "✅ 12-अंकीय आधार संख्या मान्य है (NPCI डीबीटी बैंक खाते से स्वतः लिंक)।";
        aadharFormatHintEl.style.color = "#15803d";
      }
    } else if (raw.length > 0) {
      if (aadharValidBadgeEl) {
        aadharValidBadgeEl.style.display = "inline-flex";
        aadharValidBadgeEl.textContent = `${raw.length}/12 अंक`;
        aadharValidBadgeEl.style.background = "#fef3c7";
        aadharValidBadgeEl.style.color = "#92400e";
        aadharValidBadgeEl.style.borderColor = "#fde68a";
      }
      if (aadharFormatHintEl) {
        aadharFormatHintEl.innerHTML = `🔒 12 अंकों में से ${raw.length} अंक दर्ज किए गए हैं (बाकी ${12 - raw.length})।`;
        aadharFormatHintEl.style.color = "#64748b";
      }
    } else {
      if (aadharValidBadgeEl) aadharValidBadgeEl.style.display = "none";
      if (aadharFormatHintEl) {
        aadharFormatHintEl.innerHTML = "🔒 12-अंकीय आधार नंबर (NPCI डीबीटी बैंक खाते से स्वतः लिंक)";
        aadharFormatHintEl.style.color = "#64748b";
      }
    }
  }

  if (aadharInputEl) {
    aadharInputEl.addEventListener("input", updateAadharFormatStatus);
  }

  const mobileInputEl = document.getElementById("mobile");
  if (mobileInputEl && registerForm) {
    mobileInputEl.addEventListener("input", () => {
      let val = mobileInputEl.value.replace(/[^0-9]/g, "");
      if (val.length > 10 && (val.startsWith("91") || val.startsWith("0"))) {
        val = val.slice(-10);
      } else if (val.length > 10) {
        val = val.slice(0, 10);
      }
      mobileInputEl.value = val;
    });
  }

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

  async function handleSendOtp(options = {}) {
    const rawMobile = (document.getElementById("mobile")?.value || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);
    const rawAadhar = (document.getElementById("aadharNumber")?.value || "").trim();
    const cleanAadhar = rawAadhar.replace(/[^0-9]/g, "").slice(0, 12);
    const farmerName = (document.getElementById("name")?.value || "").trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      showToast("कृपया 10-अंकीय आधार से लिंक मोबाइल नंबर दर्ज करें (Please enter a valid 10-digit mobile).", "error");
      const mobileEl = document.getElementById("mobile");
      if (mobileEl) mobileEl.focus();
      return;
    }

    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      if (btnSendOtpText) btnSendOtpText.textContent = "ओटीपी भेजा जा रहा है (Sending)...";
    }

    try {
      const res = await apiFetch("/api/auth/send-registration-otp", {
        method: "POST",
        body: JSON.stringify({
          mobile: cleanMobile,
          aadharNumber: cleanAadhar,
          name: farmerName,
          isDemo: true // Guarantee OTP generation in demo/testing
        })
      });

      if (btnSendOtp) {
        btnSendOtp.disabled = false;
        if (btnSendOtpText) btnSendOtpText.textContent = "नया आधार OTP भेजें (Resend OTP)";
      }

      if (res.success) {
        if (otpVerificationBox) otpVerificationBox.style.display = "block";
        if (otpMaskedPhone) otpMaskedPhone.textContent = res.maskedMobile || `+91 ${cleanMobile.slice(0, 2)}*****${cleanMobile.slice(-3)}`;
        
        if (res.maskedAadhar && otpMaskedAadhar && otpAadhaarNotice) {
          otpMaskedAadhar.textContent = res.maskedAadhar;
          otpAadhaarNotice.style.display = "inline";
        }

        // Update live demo OTP display with the fresh unique code
        const freshOtp = res.demoOtp || "123456";
        if (demoOtpValue) demoOtpValue.textContent = freshOtp;
        if (demoOtpValueSmall) demoOtpValueSmall.textContent = freshOtp;

        // Automatically pre-fill the OTP box for frictionless testing
        if (otpInput) {
          otpInput.value = freshOtp;
          otpInput.focus();
        }

        startOtpTimer(30);

        if (res.alreadyRegistered) {
          showToast(`⚡ लाइव आधार OTP: [ ${freshOtp} ] (नोट: यह नंबर पहले से ID ${res.farmerId} पर है)`, "info");
        } else {
          showToast(`⚡ नया लाइव आधार OTP: [ ${freshOtp} ] - कोड स्वतः भर दिया गया!`, "success");
        }
        
        // Update stepper
        if (stepIndicator1) stepIndicator1.className = "reg-step-item completed";
        if (stepIndicator2) stepIndicator2.className = "reg-step-item active";
      } else {
        showToast(res.message || "Failed to send OTP. Please check the number.", "error");
      }
    } catch (err) {
      if (btnSendOtp) {
        btnSendOtp.disabled = false;
        if (btnSendOtpText) btnSendOtpText.textContent = "आधार ओटीपी भेजें (Send Aadhaar OTP)";
      }
      showToast("OTP request error: " + err.message, "error");
    }
  }

  async function handleVerifyOtp() {
    const rawMobile = (document.getElementById("mobile")?.value || "").trim();
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "").slice(-10);
    const rawAadhar = (document.getElementById("aadharNumber")?.value || "").trim();
    const cleanAadhar = rawAadhar.replace(/[^0-9]/g, "").slice(0, 12);
    const enteredOtp = (otpInput?.value || "").trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      showToast("कृपया मान्य 10-अंकीय मोबाइल नंबर दर्ज करें।", "error");
      return;
    }

    if (!enteredOtp || enteredOtp.length < 4) {
      showToast("कृपया स्क्रीन पर दिखाया गया 6-अंकीय ओटीपी दर्ज करें।", "error");
      if (otpInput) otpInput.focus();
      return;
    }

    if (btnVerifyOtp) {
      btnVerifyOtp.disabled = true;
      btnVerifyOtp.innerHTML = "<span>⏳</span> <span>सत्यापित हो रहा है...</span>";
    }

    const res = await apiFetch("/api/auth/verify-registration-otp", {
      method: "POST",
      body: JSON.stringify({
        mobile: cleanMobile,
        aadharNumber: cleanAadhar,
        otp: enteredOtp
      })
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
      
      // Update badges
      if (mobileVerifiedBadge) {
        mobileVerifiedBadge.style.display = "inline-flex";
        mobileVerifiedBadge.textContent = "✓ आधार एवं मोबाइल सत्यापित";
      }
      if (aadharValidBadgeEl) {
        aadharValidBadgeEl.style.display = "inline-flex";
        aadharValidBadgeEl.textContent = "✓ आधार सत्यापित (Aadhaar Verified)";
        aadharValidBadgeEl.style.background = "#dcfce7";
        aadharValidBadgeEl.style.color = "#166534";
        aadharValidBadgeEl.style.borderColor = "#86efac";
      }

      if (btnSendOtp) {
        btnSendOtp.disabled = true;
        btnSendOtp.style.background = "#166534";
        if (btnSendOtpText) btnSendOtpText.textContent = "✓ आधार सत्यापित (Verified)";
      }
      const mobileInput = document.getElementById("mobile");
      if (mobileInput) {
        mobileInput.readOnly = true;
        mobileInput.style.background = "#f0fdf4";
        mobileInput.style.borderColor = "#86efac";
      }
      if (aadharInputEl) {
        aadharInputEl.style.borderColor = "#86efac";
        aadharInputEl.style.background = "#f0fdf4";
      }
      if (verifiedMobileDisplay) {
        const aadharMask = cleanAadhar.length === 12 ? `XXXX-XXXX-${cleanAadhar.slice(-4)}` : "";
        verifiedMobileDisplay.textContent = `आधार (${aadharMask}) एवं मोबाइल +91 ${cleanMobile} सफलतापूर्वक सत्यापित व NPCI DBT से लिंक हैं।`;
      }
      if (dbtMobileStatus) {
        dbtMobileStatus.textContent = "✓ आधार एवं मोबाइल ओटीपी सत्यापित (NPCI Active)";
        dbtMobileStatus.style.color = "#16a34a";
      }

      // Update stepper to step 3
      if (stepIndicator2) stepIndicator2.className = "reg-step-item completed";
      if (stepIndicator3) stepIndicator3.className = "reg-step-item active";

      showToast("✓ आधार संख्या एवं मोबाइल नंबर सफलतापूर्वक सत्यापित हो गया!", "success");
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

  if (btnAutoFillRegOtp) {
    btnAutoFillRegOtp.addEventListener("click", () => {
      const code = demoOtpValue ? demoOtpValue.textContent.trim() : "123456";
      if (otpInput) {
        otpInput.value = code;
        handleVerifyOtp();
      }
    });
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

  // =========================================================================
  // Forgot Password / Account Recovery Logic (Farmer ID or Mobile)
  // =========================================================================
  let currentRecoveryIdentifier = "";

  const forgotModal = document.getElementById("forgotPasswordModal");
  const btnOpenForgotPassword = document.getElementById("btnOpenForgotPassword");
  const btnCloseForgotModal = document.getElementById("btnCloseForgotModal");
  const btnFillDemoRecovery = document.getElementById("btnFillDemoRecovery");
  const btnSendRecoveryOtp = document.getElementById("btnSendRecoveryOtp");
  const btnSendRecoveryOtpText = document.getElementById("btnSendRecoveryOtpText");
  const btnAutoFillRecoveryOtp = document.getElementById("btnAutoFillRecoveryOtp");
  const btnResendRecoveryOtp = document.getElementById("btnResendRecoveryOtp");
  const btnChangeRecoveryUser = document.getElementById("btnChangeRecoveryUser");
  const btnSubmitPasswordReset = document.getElementById("btnSubmitPasswordReset");
  const btnGoToLoginAfterReset = document.getElementById("btnGoToLoginAfterReset");

  const forgotStep1 = document.getElementById("forgotStep1");
  const forgotStep2 = document.getElementById("forgotStep2");
  const forgotStep3 = document.getElementById("forgotStep3");
  const recoveryIdentifierInput = document.getElementById("recoveryIdentifier");
  const recoveryOtpInput = document.getElementById("recoveryOtpInput");
  const recoveryNewPasswordInput = document.getElementById("recoveryNewPassword");
  const recoveryConfirmPasswordInput = document.getElementById("recoveryConfirmPassword");
  const recoveryFarmerName = document.getElementById("recoveryFarmerName");
  const recoveryFarmerId = document.getElementById("recoveryFarmerId");
  const recoveryMaskedPhone = document.getElementById("recoveryMaskedPhone");
  const recoveryDemoOtpVal = document.getElementById("recoveryDemoOtpVal");

  function openForgotModal() {
    if (!forgotModal) return;
    forgotModal.style.display = "flex";
    if (forgotStep1) forgotStep1.style.display = "block";
    if (forgotStep2) forgotStep2.style.display = "none";
    if (forgotStep3) forgotStep3.style.display = "none";
    if (recoveryIdentifierInput) {
      // Pre-fill from login input if already typed
      const loginMobile = document.getElementById("mobile")?.value || "";
      if (loginMobile) recoveryIdentifierInput.value = loginMobile;
      recoveryIdentifierInput.focus();
    }
  }

  function closeForgotModal() {
    if (!forgotModal) return;
    forgotModal.style.display = "none";
  }

  if (btnOpenForgotPassword) {
    btnOpenForgotPassword.addEventListener("click", (e) => {
      e.preventDefault();
      openForgotModal();
    });
  }

  if (btnCloseForgotModal) {
    btnCloseForgotModal.addEventListener("click", closeForgotModal);
  }

  if (forgotModal) {
    forgotModal.addEventListener("click", (e) => {
      if (e.target === forgotModal) closeForgotModal();
    });
  }

  if (btnFillDemoRecovery) {
    btnFillDemoRecovery.addEventListener("click", () => {
      if (recoveryIdentifierInput) {
        recoveryIdentifierInput.value = "FMR1001";
        showToast("⚡ किसान आईडी FMR1001 दर्ज की गई।", "info");
      }
    });
  }

  async function requestRecoveryOtp() {
    const rawId = (recoveryIdentifierInput?.value || "").trim();
    if (!rawId) {
      showToast("कृपया अपनी किसान आईडी (उदा. FMR1001) या मोबाइल नंबर दर्ज करें।", "error");
      if (recoveryIdentifierInput) recoveryIdentifierInput.focus();
      return;
    }

    if (btnSendRecoveryOtp) {
      btnSendRecoveryOtp.disabled = true;
      if (btnSendRecoveryOtpText) btnSendRecoveryOtpText.textContent = "ओटीपी भेजा जा रहा है...";
    }

    try {
      const res = await apiFetch("/api/auth/forgot-password/request", {
        method: "POST",
        body: JSON.stringify({ identifier: rawId })
      });

      if (btnSendRecoveryOtp) {
        btnSendRecoveryOtp.disabled = false;
        if (btnSendRecoveryOtpText) btnSendRecoveryOtpText.textContent = "रिकवरी ओटीपी भेजें (Send Recovery OTP)";
      }

      if (res.success) {
        currentRecoveryIdentifier = res.farmerId || res.mobile || rawId;
        if (recoveryFarmerName) recoveryFarmerName.textContent = res.farmerName || "Farmer";
        if (recoveryFarmerId) recoveryFarmerId.textContent = res.farmerId || rawId;
        if (recoveryMaskedPhone) recoveryMaskedPhone.textContent = res.maskedMobile || "";
        
        const freshOtp = res.demoOtp || "123456";
        if (recoveryDemoOtpVal) recoveryDemoOtpVal.textContent = freshOtp;
        if (recoveryOtpInput) {
          recoveryOtpInput.value = freshOtp;
        }

        if (forgotStep1) forgotStep1.style.display = "none";
        if (forgotStep2) forgotStep2.style.display = "block";
        if (recoveryNewPasswordInput) recoveryNewPasswordInput.focus();

        showToast(`⚡ नया लाइव रिकवरी OTP: [ ${freshOtp} ] - कोड भर दिया गया है!`, "success");
      } else {
        showToast(res.message || "रिकवरी अनुरोध विफल रहा। कृपया विवरण जांचें।", "error");
      }
    } catch (err) {
      if (btnSendRecoveryOtp) {
        btnSendRecoveryOtp.disabled = false;
        if (btnSendRecoveryOtpText) btnSendRecoveryOtpText.textContent = "रिकवरी ओटीपी भेजें (Send Recovery OTP)";
      }
      showToast("Error requesting recovery OTP: " + err.message, "error");
    }
  }

  if (btnSendRecoveryOtp) {
    btnSendRecoveryOtp.addEventListener("click", requestRecoveryOtp);
  }

  if (btnAutoFillRecoveryOtp) {
    btnAutoFillRecoveryOtp.addEventListener("click", () => {
      const code = recoveryDemoOtpVal ? recoveryDemoOtpVal.textContent.trim() : "123456";
      if (recoveryOtpInput) {
        recoveryOtpInput.value = code;
        showToast(`⚡ OTP कोड ${code} भर दिया गया।`, "info");
      }
    });
  }

  if (btnResendRecoveryOtp) {
    btnResendRecoveryOtp.addEventListener("click", async () => {
      if (!currentRecoveryIdentifier) {
        showToast("कृपया पुनः प्रयास करें।", "error");
        return;
      }
      btnResendRecoveryOtp.disabled = true;
      btnResendRecoveryOtp.textContent = "भेजा जा रहा है...";
      try {
        const res = await apiFetch("/api/auth/forgot-password/request", {
          method: "POST",
          body: JSON.stringify({ identifier: currentRecoveryIdentifier })
        });
        btnResendRecoveryOtp.disabled = false;
        btnResendRecoveryOtp.textContent = "🔄 नया OTP (Resend)";

        if (res.success) {
          const freshOtp = res.demoOtp || "123456";
          if (recoveryDemoOtpVal) recoveryDemoOtpVal.textContent = freshOtp;
          if (recoveryOtpInput) recoveryOtpInput.value = freshOtp;
          showToast(`🔄 नया रिकवरी OTP जनरेट हुआ: [ ${freshOtp} ]`, "success");
        } else {
          showToast(res.message || "नया OTP जनरेट नहीं हो सका।", "error");
        }
      } catch (e) {
        btnResendRecoveryOtp.disabled = false;
        btnResendRecoveryOtp.textContent = "🔄 नया OTP (Resend)";
        showToast("Resend error: " + e.message, "error");
      }
    });
  }

  if (btnChangeRecoveryUser) {
    btnChangeRecoveryUser.addEventListener("click", () => {
      if (forgotStep2) forgotStep2.style.display = "none";
      if (forgotStep1) forgotStep1.style.display = "block";
      if (recoveryIdentifierInput) recoveryIdentifierInput.focus();
    });
  }

  if (btnSubmitPasswordReset) {
    btnSubmitPasswordReset.addEventListener("click", async () => {
      const rawId = (recoveryIdentifierInput?.value || "").trim();
      const newPass = (recoveryNewPasswordInput?.value || "").trim();
      const confirmPass = (recoveryConfirmPasswordInput?.value || "").trim();

      if (!rawId) {
        showToast("कृपया अपनी किसान आईडी (उदा. FMR1001) या मोबाइल नंबर दर्ज करें।", "error");
        if (recoveryIdentifierInput) recoveryIdentifierInput.focus();
        return;
      }

      if (!newPass || newPass.length < 4) {
        showToast("पासवर्ड कम से कम 4 अक्षरों या अंकों का होना चाहिए।", "error");
        if (recoveryNewPasswordInput) recoveryNewPasswordInput.focus();
        return;
      }

      if (newPass !== confirmPass) {
        showToast("नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।", "error");
        if (recoveryConfirmPasswordInput) recoveryConfirmPasswordInput.focus();
        return;
      }

      btnSubmitPasswordReset.disabled = true;
      btnSubmitPasswordReset.innerHTML = "<span>⏳</span> <span>सहेजा जा रहा है...</span>";

      try {
        const res = await apiFetch("/api/auth/forgot-password/verify-and-reset", {
          method: "POST",
          body: JSON.stringify({
            identifier: rawId,
            newPassword: newPass
          })
        });

        btnSubmitPasswordReset.disabled = false;
        btnSubmitPasswordReset.innerHTML = "<span>✓</span> <span>पासवर्ड रीसेट करें (Reset Password)</span>";

        if (res.success) {
          if (forgotStep1) forgotStep1.style.display = "none";
          if (forgotStep2) forgotStep2.style.display = "none";
          if (forgotStep3) forgotStep3.style.display = "block";

          // Auto-fill login form with new credentials!
          const loginMobileInput = document.getElementById("mobile");
          const loginPassInput = document.getElementById("password");
          if (loginMobileInput && res.mobile) loginMobileInput.value = res.mobile;
          if (loginPassInput) loginPassInput.value = newPass;

          showToast("✓ पासवर्ड सफलतापूर्वक बदल दिया गया है!", "success");
        } else {
          showToast(res.message || "पासवर्ड रीसेट विफल रहा।", "error");
        }
      } catch (err) {
        btnSubmitPasswordReset.disabled = false;
        btnSubmitPasswordReset.innerHTML = "<span>✓</span> <span>पासवर्ड रीसेट करें (Reset Password)</span>";
        showToast("Reset error: " + err.message, "error");
      }
    });
  }

  if (btnGoToLoginAfterReset) {
    btnGoToLoginAfterReset.addEventListener("click", () => {
      closeForgotModal();
      const loginBtn = document.querySelector("#loginForm button[type='submit']");
      if (loginBtn) loginBtn.focus();
    });
  }

  // Handle Login Submit (Unified & Role-Adaptive)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      const mobile = document.getElementById("mobile").value.trim();
      const password = document.getElementById("password").value;
      const portalType = (document.getElementById("loginPortalType")?.value || "farmer").toLowerCase();

      if (!mobile || !password) {
        showToast("Please enter your identifier (Mobile or Staff/Farmer ID) and password", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Authenticating...";

      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ mobile, password, portalType })
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        const userRole = (res.data.role || (res.data.user && res.data.user.role) || (res.data.farmer && res.data.farmer.role) || "").toUpperCase();
        setAuthToken(res.data.token);
        setUser(res.data.user || res.data.farmer);

        if (userRole === "CENTRE_OFFICER") {
          showToast("Procurement Centre Officer verified! Redirecting to Centre Portal...", "success");
          setTimeout(() => {
            window.location.href = "centre-officer.html";
          }, 350);
        } else if (userRole === "GOVERNMENT_ADMIN") {
          showToast("Government Administrator verified! Redirecting to Mandi Board...", "success");
          setTimeout(() => {
            window.location.href = "admin.html";
          }, 350);
        } else {
          showToast("Farmer login successful! Redirecting to Dashboard...", "success");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 350);
        }
      } else {
        showToast(res.message || "Invalid credentials or password", "error");
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
        showToast("Please enter officer staff ID/mobile and password", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Verifying Credentials...";

      const res = await apiFetch("/api/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ mobile, password, portalType: "admin" })
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        const userRole = (res.data.role || (res.data.user && res.data.user.role) || "").toUpperCase();
        setAuthToken(res.data.token);
        setUser(res.data.user);

        if (userRole === "CENTRE_OFFICER") {
          showToast("Procurement Centre Officer login successful!", "success");
          setTimeout(() => {
            window.location.href = "centre-officer.html";
          }, 350);
        } else {
          showToast("Government Administrator login successful!", "success");
          setTimeout(() => {
            window.location.href = "admin.html";
          }, 350);
        }
      } else {
        showToast(res.message || "Invalid credentials or password", "error");
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

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>⏳</span> <span>पंजीकरण हो रहा है (Registering & Linking DBT)...</span>";

        const res = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (res.success && res.data) {
          if (stepIndicator1) stepIndicator1.className = "reg-step-item completed";
          if (stepIndicator2) stepIndicator2.className = "reg-step-item completed";
          if (stepIndicator3) stepIndicator3.className = "reg-step-item completed";
          setAuthToken(res.data.token);
          setUser(res.data.farmer || res.data.user);
          showToast("✓ पंजीकरण एवं आधार डीबीटी सत्यापन सफल! डैशबोर्ड खुल रहा है...", "success");

          setTimeout(() => {
            window.location.href = res.data.redirectUrl || "dashboard.html";
          }, 600);
        } else {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          const alertBox = document.getElementById("registerAlertBox");

          if (res.alreadyRegistered) {
            showToast(`यह मोबाइल नंबर (+91 ${cleanMobile}) पहले से किसान आईडी ${res.farmerId || ""} पर पंजीकृत है।`, "error");
            if (alertBox) {
              alertBox.style.display = "block";
              alertBox.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 8px; padding: 0.85rem; color: #9f1239;">
                  <div>
                    ⚠️ <strong>मोबाइल नंबर +91 ${cleanMobile} पहले से पंजीकृत है!</strong>
                    <div style="font-size: 0.78rem; color: #be123c; margin-top: 0.2rem;">
                      किसान: <strong>${res.farmerName || "पंजीकृत किसान"}</strong> (ID: <strong>${res.farmerId || "FMR1001"}</strong>)
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                    <button type="button" id="btnAlertDirectLogin" class="btn btn-sm btn-primary" style="background: #059669; border: none; font-weight: 700; padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                      ⚡ इस खाते से तत्काल लॉगिन करें
                    </button>
                    <button type="button" id="btnAlertNewNumber" class="btn btn-sm btn-secondary" style="border: 1px solid #fda4af; padding: 0.4rem 0.7rem; font-size: 0.8rem;">
                      🎲 नया नंबर बनाएं
                    </button>
                  </div>
                </div>
              `;

              const btnAlertDirectLogin = document.getElementById("btnAlertDirectLogin");
              if (btnAlertDirectLogin) {
                btnAlertDirectLogin.addEventListener("click", () => {
                  fastDirectLogin(cleanMobile, password || "123456", "farmer", btnAlertDirectLogin);
                });
              }

              const btnAlertNewNumber = document.getElementById("btnAlertNewNumber");
              if (btnAlertNewNumber) {
                btnAlertNewNumber.addEventListener("click", () => {
                  if (btnNewTestNumber) btnNewTestNumber.click();
                });
              }
            }
          } else {
            showToast(res.message || "पंजीकरण विफल रहा। कृपया सभी अनिवार्य विवरण जांचें।", "error");
            if (alertBox) {
              alertBox.style.display = "block";
              alertBox.innerHTML = `
                <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 8px; padding: 0.75rem 1rem; color: #9f1239;">
                  ⚠️ ${res.message || "पंजीकरण में त्रुटि हुई। कृपया सभी फील्ड जांचें।"}
                </div>
              `;
            }
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        showToast("Registration error: " + (err.message || "Failed to process request"), "error");
      }
    });
  }
});
