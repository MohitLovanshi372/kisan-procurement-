/**
 * Kisan Procurement Mitra - Authentication Handlers (Login & Register)
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
      document.getElementById("mobile").value = "9999999999";
      document.getElementById("password").value = "admin123";
      showToast("Admin credentials filled (Officer)", "info");
    });
  }

  if (fillRegisterDemoBtn) {
    fillRegisterDemoBtn.addEventListener("click", () => {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      document.getElementById("name").value = "Kailash Verma";
      document.getElementById("mobile").value = "98260" + randomNum;
      document.getElementById("password").value = "123456";
      document.getElementById("farmerId").value = "FMR" + randomNum;
      document.getElementById("village").value = "Sanwer";
      document.getElementById("district").value = "Indore";
      document.getElementById("state").value = "Madhya Pradesh";
      document.getElementById("crop").value = "Wheat";
      document.getElementById("landArea").value = "4.5 Acres";
      document.getElementById("preferredCentre").value = "Sanwer Procurement Centre";
      showToast("Sample registration data populated", "info");
    });
  }

  // Handle Login Submit
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
        body: JSON.stringify({ mobile, password })
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        setAuthToken(res.data.token);
        setUser(res.data.farmer);
        showToast("Login successful!", "success");

        setTimeout(() => {
          if (res.data.farmer.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }, 400);
      } else {
        showToast(res.message || "Invalid mobile number or password", "error");
      }
    });
  }

  // Handle Registration Submit
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = registerForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      const payload = {
        name: document.getElementById("name").value.trim(),
        mobile: document.getElementById("mobile").value.trim(),
        password: document.getElementById("password").value,
        farmerId: document.getElementById("farmerId") ? document.getElementById("farmerId").value.trim() : "",
        village: document.getElementById("village").value.trim(),
        district: document.getElementById("district").value.trim(),
        state: document.getElementById("state").value.trim(),
        crop: document.getElementById("crop").value.trim(),
        landArea: document.getElementById("landArea").value.trim(),
        preferredCentre: document.getElementById("preferredCentre").value
      };

      if (!payload.name || !payload.mobile || !payload.password || !payload.village || !payload.district || !payload.crop) {
        showToast("Please complete all required fields", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Registering...";

      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      if (res.success && res.data) {
        setAuthToken(res.data.token);
        setUser(res.data.farmer);
        showToast("Registration successful! Token generated.", "success");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 500);
      } else {
        showToast(res.message || "Registration failed. Please check your inputs.", "error");
      }
    });
  }
});
