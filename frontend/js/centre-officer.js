/**
 * Mandisathi - Centre Officer Portal Logic
 * Strictly isolated for the officer's assigned procurement centre.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Enforce Centre Officer or Admin authentication
  if (!requireAuth(["CENTRE_OFFICER", "officer", "GOVERNMENT_ADMIN", "admin"])) {
    return;
  }

  // Initialize Officer ID Card
  if (window.MandiSathiIDCard) {
    MandiSathiIDCard.init({
      type: "officer",
      openBtnId: "openOfficerModalBtn",
      modalId: "digitalOfficerCardModal"
    });
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Load Dashboard Stats
  async function loadDashboard() {
    try {
      const res = await apiFetch("/api/officer/dashboard");
      if (res.success && res.data) {
        const { officer, centre, stats } = res.data;
        centreData = centre;

        if (officerNameHeader) {
          officerNameHeader.textContent = `${officer.name} (${centre?.name || "Procurement Centre"})`;
        }
        if (officerCentreTitle) {
          officerCentreTitle.textContent = centre?.name || "Procurement Centre";
        }
        if (officerCentreMeta) {
          if (centre?.centreId && centre?.name !== "No Centre Assigned") {
            officerCentreMeta.innerHTML = `
              District: ${escapeHtml(centre.district || "Indore")} • Hours: ${escapeHtml(centre.workingHours || "09:00 AM – 05:00 PM")} • Status: <span style="color: #a7f3d0; font-weight: 700;">${escapeHtml(centre.status || "Open")}</span>
            `;
          } else {
            officerCentreMeta.innerHTML = `
              <span style="color: #fde68a; font-weight: 600;">⚠️ No Mandi Procurement Centre assigned to this officer account. Please contact Mandi Board Administrator.</span>
            `;
          }
        }

        if (statCentreFarmers) statCentreFarmers.textContent = stats?.centreFarmersCount || 0;
        if (statWaitingFarmers) statWaitingFarmers.textContent = stats?.waitingNow || 0;
        if (statEstimatedWait) statEstimatedWait.textContent = centre?.estimatedWait || "N/A";
        if (statCompletedProcurement) statCompletedProcurement.textContent = stats?.completedProcurement || 0;
        if (statTotalDisbursed) statTotalDisbursed.textContent = "₹" + (stats?.totalDisbursed || 0).toLocaleString("en-IN");
        if (statPendingPayments) statPendingPayments.textContent = `${stats?.pendingPayments || 0} Pending DBT`;

        if (ctrlWaitingFarmers) ctrlWaitingFarmers.value = centre?.waitingFarmers || 0;
        if (ctrlEstimatedWait) ctrlEstimatedWait.value = centre?.estimatedWait || "30 minutes";
        if (ctrlActiveWeighbridges) ctrlActiveWeighbridges.value = centre?.activeWeighbridges || 2;
      } else {
        const errMsg = res?.message || "Unable to load Procurement Centre dashboard";
        if (officerCentreTitle) {
          officerCentreTitle.textContent = "Unable to load Procurement Centre dashboard";
        }
        if (officerCentreMeta) {
          officerCentreMeta.innerHTML = `<span style="color: #fca5a5; font-weight: 600;">⚠️ ${escapeHtml(errMsg)}</span>`;
        }
        showToast(errMsg, "error");
      }
    } catch (e) {
      console.error("Error loading officer dashboard:", e);
      const errMsg = e?.message || "Unable to load Procurement Centre dashboard";
      if (officerCentreTitle) {
        officerCentreTitle.textContent = "Unable to load Procurement Centre dashboard";
      }
      if (officerCentreMeta) {
        officerCentreMeta.innerHTML = `<span style="color: #fca5a5; font-weight: 600;">⚠️ ${escapeHtml(errMsg)}</span>`;
      }
      showToast("Unable to load Procurement Centre dashboard", "error");
    }
  }

  // Load Farmers for THIS centre
  async function loadFarmers(newlyValidatedToken) {
    try {
      const res = await apiFetch("/api/officer/farmers");
      if (res.success && res.data) {
        farmersList = res.data;
        renderFarmersTable(farmersList, newlyValidatedToken);
      } else {
        if (officerFarmersTableBody) {
          officerFarmersTableBody.innerHTML = `
            <tr>
              <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">
                Unable to load centre farmers: ${escapeHtml(res?.message || "Error")}
              </td>
            </tr>
          `;
        }
      }
    } catch (e) {
      console.error("Error loading centre farmers:", e);
      if (officerFarmersTableBody) {
        officerFarmersTableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">
              Unable to load centre farmers: ${escapeHtml(e?.message || "Connection error")}
            </td>
          </tr>
        `;
      }
    }
  }

  function renderFarmersTable(list, newlyValidatedToken) {
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
      const isNewlyValidated = Boolean(
        newlyValidatedToken &&
        (f.tokenNumber === newlyValidatedToken || f.farmerId === newlyValidatedToken || (f.tokenNumber && newlyValidatedToken.includes(f.tokenNumber)))
      );

      const statusBadge = isProcDone
        ? `<span class="badge badge-green">✓ Completed</span>`
        : f.procurementStatus === "Arrived"
        ? (isNewlyValidated ? `<span class="badge badge-blue badge-just-verified">⚡ At Gate (Arrived)</span>` : `<span class="badge badge-blue">⏳ At Gate</span>`)
        : `<span class="badge badge-amber">📅 Scheduled</span>`;

      const paymentBadge = isPaid
        ? `<span class="badge badge-green">✓ Paid (DBT)</span>`
        : `<span class="badge badge-amber">Pending</span>`;

      const rowClass = isNewlyValidated ? ' class="row-slide-in"' : "";

      return `
        <tr${rowClass}>
          <td>
            <strong style="color: var(--primary-dark);">${f.tokenNumber || "TK-1042"}</strong>
            ${isNewlyValidated ? `<div style="font-size: 0.68rem; color: #059669; font-weight: 700;">QR Validated</div>` : ""}
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

  // Sub-tabs in Scanner Card
  const tabCameraScan = document.getElementById("tabCameraScan");
  const tabUploadScan = document.getElementById("tabUploadScan");
  const tabManualToken = document.getElementById("tabManualToken");
  const tabPassedPasses = document.getElementById("tabPassedPasses");

  const viewCameraScan = document.getElementById("viewCameraScan");
  const viewUploadScan = document.getElementById("viewUploadScan");
  const viewManualToken = document.getElementById("viewManualToken");
  const viewPassedPasses = document.getElementById("viewPassedPasses");

  const officerPassedPassesCount = document.getElementById("officerPassedPassesCount");
  const tablePassedCount = document.getElementById("tablePassedCount");
  const officerPassedPassesTbody = document.getElementById("officerPassedPassesTbody");
  const btnRefreshPassedPasses = document.getElementById("btnRefreshPassedPasses");

  // Camera Elements
  const cameraStatusPill = document.getElementById("cameraStatusPill");
  const btnToggleCamera = document.getElementById("btnToggleCamera");
  const btnToggleCameraIcon = document.getElementById("btnToggleCameraIcon");
  const btnToggleCameraText = document.getElementById("btnToggleCameraText");
  const btnSwitchCameraFacing = document.getElementById("btnSwitchCameraFacing");
  const cameraViewport = document.getElementById("cameraViewport");
  const officerCameraVideo = document.getElementById("officerCameraVideo");
  const cameraOverlayMsg = document.getElementById("cameraOverlayMsg");
  const cameraScanCanvas = document.getElementById("cameraScanCanvas");

  // File Upload Elements
  const officerQrFileInput = document.getElementById("officerQrFileInput");
  const btnPickQrFile = document.getElementById("btnPickQrFile");
  const uploadFileStatus = document.getElementById("uploadFileStatus");

  let mediaStream = null;
  let isCameraActive = false;
  let currentFacingMode = "environment";
  let scanAnimFrame = null;
  let isProcessingCode = false;
  let passedGatePassesList = [];

  // Audio tone synthesizer for scanning feedback
  function playTone(freq = 880, type = "sine", duration = 0.15) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  // Switch Sub-tabs
  function switchScannerTab(tabName) {
    const tabs = [tabCameraScan, tabUploadScan, tabManualToken, tabPassedPasses];
    const views = [viewCameraScan, viewUploadScan, viewManualToken, viewPassedPasses];

    tabs.forEach(t => t && t.classList.remove("active"));
    views.forEach(v => v && (v.style.display = "none"));

    if (tabName === "camera") {
      if (tabCameraScan) tabCameraScan.classList.add("active");
      if (viewCameraScan) viewCameraScan.style.display = "block";
    } else if (tabName === "upload") {
      if (tabUploadScan) tabUploadScan.classList.add("active");
      if (viewUploadScan) viewUploadScan.style.display = "block";
    } else if (tabName === "manual") {
      if (tabManualToken) tabManualToken.classList.add("active");
      if (viewManualToken) viewManualToken.style.display = "block";
    } else if (tabName === "passed") {
      if (tabPassedPasses) tabPassedPasses.classList.add("active");
      if (viewPassedPasses) viewPassedPasses.style.display = "block";
      loadPassedGatePasses();
    }
  }

  if (tabCameraScan) tabCameraScan.addEventListener("click", () => switchScannerTab("camera"));
  if (tabUploadScan) tabUploadScan.addEventListener("click", () => switchScannerTab("upload"));
  if (tabManualToken) tabManualToken.addEventListener("click", () => switchScannerTab("manual"));
  if (tabPassedPasses) tabPassedPasses.addEventListener("click", () => switchScannerTab("passed"));
  if (btnRefreshPassedPasses) btnRefreshPassedPasses.addEventListener("click", () => loadPassedGatePasses());

  // Camera Management
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Camera is not supported on this browser or device", "error");
      if (cameraStatusPill) {
        cameraStatusPill.className = "badge badge-amber";
        cameraStatusPill.textContent = "⚠️ Camera Unsupported";
      }
      return;
    }

    try {
      if (cameraStatusPill) {
        cameraStatusPill.className = "badge badge-blue";
        cameraStatusPill.textContent = "⏳ Accessing Camera...";
      }
      if (cameraOverlayMsg) {
        cameraOverlayMsg.textContent = "Starting camera video feed...";
      }

      const constraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to generic video if ideal facingMode fails
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (officerCameraVideo) {
        officerCameraVideo.srcObject = mediaStream;
        await officerCameraVideo.play();
      }

      isCameraActive = true;
      isProcessingCode = false;

      if (cameraStatusPill) {
        cameraStatusPill.className = "badge badge-green";
        cameraStatusPill.textContent = "🟢 Live Scanning Active";
      }
      if (btnToggleCameraIcon) btnToggleCameraIcon.textContent = "⏹️";
      if (btnToggleCameraText) btnToggleCameraText.textContent = "Stop Camera";
      if (cameraOverlayMsg) {
        cameraOverlayMsg.textContent = "Hold farmer's QR code steadily inside the green reticle";
      }

      // Start continuous scanning loop
      scanAnimFrame = requestAnimationFrame(scanVideoFrame);
      showToast("📷 Camera started! Point at QR pass to issue Gate Pass.", "success");
    } catch (err) {
      console.error("Camera access error:", err);
      isCameraActive = false;
      if (cameraStatusPill) {
        cameraStatusPill.className = "badge badge-amber";
        cameraStatusPill.textContent = "⚠️ Camera Denied / Inactive";
      }
      if (cameraOverlayMsg) {
        cameraOverlayMsg.textContent = "Camera permission denied or camera in use. Please allow camera permissions or use Manual Token Entry.";
      }
      showToast("Unable to start camera. Please check permissions or enter token manually.", "error");
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (scanAnimFrame) {
      cancelAnimationFrame(scanAnimFrame);
      scanAnimFrame = null;
    }
    isCameraActive = false;
    isProcessingCode = false;

    if (officerCameraVideo) {
      officerCameraVideo.srcObject = null;
    }
    if (cameraStatusPill) {
      cameraStatusPill.className = "badge badge-slate";
      cameraStatusPill.textContent = "⚪ Camera Inactive";
    }
    if (btnToggleCameraIcon) btnToggleCameraIcon.textContent = "📷";
    if (btnToggleCameraText) btnToggleCameraText.textContent = "Start Camera";
    if (cameraOverlayMsg) {
      cameraOverlayMsg.textContent = 'Click "Start Camera" & hold farmer\'s QR code within the green reticle';
    }
  }

  if (btnToggleCamera) {
    btnToggleCamera.addEventListener("click", () => {
      if (isCameraActive) {
        stopCamera();
      } else {
        startCamera();
      }
    });
  }

  if (btnSwitchCameraFacing) {
    btnSwitchCameraFacing.addEventListener("click", async () => {
      currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
      if (isCameraActive) {
        stopCamera();
        await startCamera();
      } else {
        showToast(`Camera mode set to: ${currentFacingMode === "environment" ? "Rear (Environment)" : "Front (User)"}`, "info");
      }
    });
  }

  // Scanning loop for video frames
  function scanVideoFrame() {
    if (!isCameraActive || !officerCameraVideo) return;

    if (isProcessingCode) {
      scanAnimFrame = requestAnimationFrame(scanVideoFrame);
      return;
    }

    if (officerCameraVideo.readyState === officerCameraVideo.HAVE_ENOUGH_DATA) {
      // 1. Try BarcodeDetector if natively supported by browser
      if ("BarcodeDetector" in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          detector.detect(officerCameraVideo)
            .then(barcodes => {
              if (barcodes && barcodes.length > 0 && !isProcessingCode) {
                handleDetectedQrCode(barcodes[0].rawValue);
              } else {
                decodeFrameWithJsQR();
              }
            })
            .catch(() => {
              decodeFrameWithJsQR();
            });
        } catch (e) {
          decodeFrameWithJsQR();
        }
      } else {
        decodeFrameWithJsQR();
      }
    } else {
      scanAnimFrame = requestAnimationFrame(scanVideoFrame);
    }
  }

  function decodeFrameWithJsQR() {
    if (!cameraScanCanvas || !officerCameraVideo || isProcessingCode) {
      if (isCameraActive) scanAnimFrame = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const width = officerCameraVideo.videoWidth || 640;
    const height = officerCameraVideo.videoHeight || 480;

    cameraScanCanvas.width = width;
    cameraScanCanvas.height = height;
    const ctx = cameraScanCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      if (isCameraActive) scanAnimFrame = requestAnimationFrame(scanVideoFrame);
      return;
    }

    ctx.drawImage(officerCameraVideo, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    if (typeof jsQR === "function") {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });

      if (code && code.data && !isProcessingCode) {
        handleDetectedQrCode(code.data);
        return;
      }
    }

    if (isCameraActive) {
      scanAnimFrame = requestAnimationFrame(scanVideoFrame);
    }
  }

  // Handle detected QR Code payload
  async function handleDetectedQrCode(decodedData) {
    if (isProcessingCode) return;
    isProcessingCode = true;

    // Immediate Audio Beep
    playTone(880, "sine", 0.18);

    // Visual camera viewport pulse
    if (cameraViewport) {
      cameraViewport.style.borderColor = "#10b981";
      cameraViewport.style.boxShadow = "0 0 25px rgba(16, 185, 129, 0.9)";
      setTimeout(() => {
        if (cameraViewport) {
          cameraViewport.style.borderColor = "#334155";
          cameraViewport.style.boxShadow = "none";
        }
      }, 700);
    }

    if (cameraOverlayMsg) {
      cameraOverlayMsg.textContent = "⚡ QR Code Decoded! Verifying gate pass authorization...";
    }

    await verifyAndIssueGatePass(decodedData);

    // Debounce next frame detection
    setTimeout(() => {
      isProcessingCode = false;
      if (cameraOverlayMsg && isCameraActive) {
        cameraOverlayMsg.textContent = "Hold farmer's QR code steadily inside the green reticle";
      }
    }, 2500);
  }

  // File Upload Scanner
  if (btnPickQrFile && officerQrFileInput) {
    btnPickQrFile.addEventListener("click", () => officerQrFileInput.click());

    officerQrFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (uploadFileStatus) {
        uploadFileStatus.innerHTML = `<span style="color: var(--text-muted);">⏳ Scanning image for QR code...</span>`;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);

          let detected = false;
          if (typeof jsQR === "function") {
            const qr = jsQR(imgData.data, imgData.width, imgData.height);
            if (qr && qr.data) {
              detected = true;
              playTone(880, "sine", 0.2);
              if (uploadFileStatus) {
                uploadFileStatus.innerHTML = `<span style="color: #16a34a; font-weight: 700;">✅ QR Code detected successfully! Verifying...</span>`;
              }
              verifyAndIssueGatePass(qr.data);
            }
          }

          if (!detected) {
            playTone(220, "sawtooth", 0.3);
            if (uploadFileStatus) {
              uploadFileStatus.innerHTML = `<span style="color: #dc2626; font-weight: 700;">❌ No QR code found in this photo. Please try a clearer picture or enter the token manually.</span>`;
            }
            showToast("No valid QR code found in the uploaded image", "error");
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Manual Token Gate Pass Verification
  if (verifyTokenBtn && verifyTokenInput) {
    const handleManualVerify = () => {
      const tokenVal = verifyTokenInput.value.trim().toUpperCase();
      if (!tokenVal) {
        showToast("Please enter a token number to verify", "error");
        return;
      }
      verifyAndIssueGatePass(tokenVal);
    };

    verifyTokenBtn.addEventListener("click", handleManualVerify);
    verifyTokenInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleManualVerify();
      }
    });
  }

  // Visual Toast Notification System for Validated Gate Passes
  function showGatePassToast(data) {
    if (!data) return;
    let toastStack = document.getElementById("officerGatePassToastContainer");
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.id = "officerGatePassToastContainer";
      toastStack.style.cssText = "position: fixed; top: 1.25rem; right: 1.25rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.75rem; max-width: 420px; width: calc(100% - 2.5rem); pointer-events: none;";
      document.body.appendChild(toastStack);
    }

    const toastId = "gp-toast-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.style.cssText = "pointer-events: auto; position: relative; overflow: hidden; background: #ffffff; border: 2px solid #10b981; border-radius: 12px; padding: 1rem; box-shadow: 0 20px 25px -5px rgba(6, 78, 59, 0.2), 0 8px 10px -6px rgba(6, 78, 59, 0.2); animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); transition: opacity 0.2s, transform 0.2s;";

    const farmerName = escapeHtml(data.farmerName || "Registered Farmer");
    const gatePassNumber = escapeHtml(data.gatePassNumber || "GP-PASSED");
    const tokenNumber = escapeHtml(data.tokenNumber || "TK-0000");
    const crop = escapeHtml(data.crop || "Wheat");
    const quantity = escapeHtml(data.quantity || "25 Qtl");
    const gate = escapeHtml(data.assignedGate || "Gate 1 (Scale 1)");
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: #d1fae5; color: #047857; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; font-weight: bold;">
            ✓
          </div>
          <div>
            <div style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #047857; letter-spacing: 0.5px;">
              GATE PASS VALIDATED • ${timeStr}
            </div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; line-height: 1.2;">
              ${farmerName}
            </div>
          </div>
        </div>
        <button type="button" class="close-gp-toast" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 0.1rem 0.35rem; border-radius: 4px; line-height: 1;" title="Dismiss">&times;</button>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div>
          <span style="font-size: 0.65rem; font-weight: 700; color: #166534; text-transform: uppercase;">Pass Number</span>
          <div style="font-family: monospace; font-size: 0.95rem; font-weight: 900; color: #064e3b;">${gatePassNumber}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Token</span>
          <div style="font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #0f172a;">${tokenNumber}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #475569; margin-bottom: 0.5rem;">
        <span>🌾 <strong>${crop}</strong> (${quantity})</span>
        <span>🚛 <strong>${gate}</strong></span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; border-top: 1px solid #f1f5f9; padding-top: 0.4rem;">
        <button type="button" class="copy-gp-num" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0.2rem 0.5rem; font-weight: 700; color: #334155; cursor: pointer; font-size: 0.7rem;">📋 Copy Pass #</button>
        <span style="color: #059669; font-weight: 700;">✓ Official Slip Ready</span>
      </div>

      <div class="gp-toast-progress" style="position: absolute; bottom: 0; left: 0; height: 3px; background: #10b981; width: 100%; transition: width 6000ms linear;"></div>
    `;

    toastStack.appendChild(toast);

    // Progress bar animation
    const progressBar = toast.querySelector(".gp-toast-progress");
    setTimeout(() => {
      if (progressBar) progressBar.style.width = "0%";
    }, 50);

    const closeBtn = toast.querySelector(".close-gp-toast");
    const copyBtn = toast.querySelector(".copy-gp-num");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => dismissToast(toast));
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.gatePassNumber || "");
          copyBtn.textContent = "✓ Copied!";
          setTimeout(() => (copyBtn.textContent = "📋 Copy Pass #"), 2000);
        }
      });
    }

    let dismissTimeout = setTimeout(() => dismissToast(toast), 6500);

    toast.addEventListener("mouseenter", () => {
      clearTimeout(dismissTimeout);
      if (progressBar) progressBar.style.transition = "none";
    });

    toast.addEventListener("mouseleave", () => {
      dismissTimeout = setTimeout(() => dismissToast(toast), 3000);
    });

    function dismissToast(el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      setTimeout(() => el.remove(), 250);
    }
  }

  // Listen for real-time gate:pass_passed events
  window.addEventListener("gate:pass_passed", (e) => {
    if (e.detail) {
      showGatePassToast(e.detail);
      loadDashboard();
      loadFarmers();
      loadPassedGatePasses();
    }
  });

  // Central Gate Pass Verification & Issuance API Call
  async function verifyAndIssueGatePass(tokenOrPayload) {
    if (!verifyResultContainer) return;

    verifyResultContainer.style.display = "block";
    verifyResultContainer.innerHTML = `
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: var(--radius-md); padding: 1.25rem; text-align: center; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">⏳</div>
        <strong>Verifying Token & Issuing Official Gate Pass...</strong>
        <div style="font-size: 0.8rem; margin-top: 0.25rem;">Checking centre assignment and queue status</div>
      </div>
    `;
    verifyResultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
      const res = await apiFetch("/api/officer/verify-token", {
        method: "POST",
        body: JSON.stringify({
          tokenNumber: typeof tokenOrPayload === "string" ? tokenOrPayload : undefined,
          qrPayload: tokenOrPayload
        })
      });

      if (res.success && res.valid) {
        playTone(1046, "triangle", 0.35); // Joyful high chime
        renderPassedGatePassCertificate(res.data);
        showGatePassToast(res.data);
        showToast(`✅ Gate Pass PASSED (${res.data.gatePassNumber}) for ${res.data.farmerName}!`, "success");
        loadFarmers(res.data.tokenNumber);
        loadDashboard();
        loadPassedGatePasses(res.data.gatePassNumber);
      } else if (res.isCentreMismatch) {
        playTone(220, "sawtooth", 0.4); // Warning buzz
        renderCentreMismatchError(res);
        showToast(res.message || "Centre Mismatch: Token belongs to another centre", "error");
      } else {
        playTone(220, "sawtooth", 0.3);
        renderTokenNotFoundError(res, tokenOrPayload);
        showToast(res.message || "Token not found in registry", "error");
      }
    } catch (err) {
      console.error("Verification API error:", err);
      verifyResultContainer.innerHTML = `
        <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: var(--radius-md); padding: 1.25rem; color: #991b1b;">
          <strong>⚠️ Verification Server Error:</strong> Please try scanning again or verify network connection.
        </div>
      `;
    }
  }

  // Render Official PASSED GATE PASS Certificate
  function renderPassedGatePassCertificate(data) {
    if (!verifyResultContainer) return;

    const timeStr = data.gatePassPassedAt || new Date().toLocaleString("en-IN");
    const gatePassNum = data.gatePassNumber || `GP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const assignedLane = data.assignedGate || "Gate 1 (Weighbridge Scale 1)";

    verifyResultContainer.innerHTML = `
      <div class="gate-pass-slip">
        <!-- Top Banner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #047857; letter-spacing: 0.5px;">
              Government of Madhya Pradesh • Krishi Upaj Mandi Samiti
            </div>
            <h3 style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin: 0.2rem 0;">
              OFFICIAL MANDI GATE PASS (प्रवेश पत्र)
            </h3>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Mandi Centre: <strong>${escapeHtml(data.centre || (centreData ? centreData.name : "Indore Mandi"))}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="gate-pass-stamp">
              ✓ PASSED (स्वीकृत)
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem;">
              Fast-Track Entry Authorized
            </div>
          </div>
        </div>

        <!-- Highlighted Gate Pass Number Bar -->
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: #ffffff; padding: 0.85rem 1.25rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span style="font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">GATE PASS SERIAL NO.</span>
            <div style="font-size: 1.4rem; font-weight: 900; letter-spacing: 1px;">${gatePassNum}</div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.75rem; opacity: 0.9;">PROCURING TOKEN</span>
            <div style="font-size: 1.2rem; font-weight: 800;">${escapeHtml(data.tokenNumber)}</div>
          </div>
        </div>

        <!-- 4-Column Grid Details -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; background: #f8fafc; padding: 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Farmer Name</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${escapeHtml(data.farmerName)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(data.farmerId || "FMR1001")} • ${escapeHtml(data.farmerVillage || "Local Village")}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Crop & Quantity</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #166534;">${escapeHtml(data.crop)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Registered Lot: <strong>${escapeHtml(data.quantity)}</strong></div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Assigned Weighbridge Scale</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #1e40af;">${escapeHtml(assignedLane)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Status: <strong>Arrived at Gate</strong></div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Time of Verification</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${timeStr}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Officer: ${escapeHtml(data.officerName || "Mandi Gate Officer")}</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;" class="no-print">
          <button id="btnViewInPassedLedger" class="btn btn-outline-primary" style="display: inline-flex; align-items: center; gap: 0.4rem;" title="View in Gate Passes Ledger">
            <span>📋</span> <span>View in Passes Ledger (पंजी देखें)</span>
          </button>
          <button id="btnScanNextVehicle" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>🔄</span> <span>Scan Next Vehicle (अगला वाहन)</span>
          </button>
          <button id="btnPrintGatePassSlip" class="btn btn-outline-primary" style="display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>🖨️</span> <span>Print Gate Pass Slip (पर्ची प्रिंट करें)</span>
          </button>
          <button id="btnDirectToWeighbridge" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>⚖️</span> <span>Proceed to Weighbridge (तौल रिकॉर्ड करें)</span>
          </button>
        </div>
      </div>
    `;

    // Hook up buttons
    const btnViewLedger = document.getElementById("btnViewInPassedLedger");
    const btnScanNext = document.getElementById("btnScanNextVehicle");
    const btnPrint = document.getElementById("btnPrintGatePassSlip");
    const btnDirectWeigh = document.getElementById("btnDirectToWeighbridge");

    if (btnViewLedger) {
      btnViewLedger.addEventListener("click", () => {
        switchScannerTab("passed");
        const newlyAddedRow = officerPassedPassesTbody?.querySelector(".row-slide-in");
        if (newlyAddedRow) {
          newlyAddedRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    if (btnScanNext) {
      btnScanNext.addEventListener("click", () => {
        verifyResultContainer.style.display = "none";
        switchScannerTab("camera");
        if (!isCameraActive) startCamera();
        if (cameraOverlayMsg) {
          cameraOverlayMsg.textContent = "Ready for next vehicle: Hold farmer's QR code in reticle";
        }
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        printGatePassSlip(data);
      });
    }

    if (btnDirectWeigh) {
      btnDirectWeigh.addEventListener("click", () => {
        if (typeof window.openWeighModal === "function") {
          window.openWeighModal(
            data.procurementId || data.id,
            data.farmerName,
            data.tokenNumber,
            "Procurement Completed",
            data.quantity,
            data.amount || 37500
          );
        }
      });
    }
  }

  // Print Gate Pass Slip via browser print
  function printGatePassSlip(data) {
    const printContainer = document.getElementById("printableGatePassSlip");
    if (!printContainer) {
      window.print();
      return;
    }

    const timeStr = data.gatePassPassedAt || new Date().toLocaleString("en-IN");
    const gatePassNum = data.gatePassNumber || `GP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    printContainer.innerHTML = `
      <div style="padding: 24px; font-family: sans-serif; color: #000; border: 3px double #000; max-width: 650px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 1.3rem;">DEPARTMENT OF FOOD & CIVIL SUPPLIES, MADHYA PRADESH</h2>
          <h3 style="margin: 4px 0; font-size: 1.15rem;">KRISHI UPAJ MANDI SAMITI • ${escapeHtml(data.centre || "Mandi Centre")}</h3>
          <div style="font-weight: bold; font-size: 1.25rem; margin-top: 8px; text-decoration: underline;">
            MANDI VEHICLE GATE ENTRY PASS (प्रवेश पत्र)
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 0.95rem;">
          <div><strong>GATE PASS NO:</strong> <span style="font-size: 1.15rem; font-weight: 900;">${gatePassNum}</span></div>
          <div><strong>TOKEN NO:</strong> <span style="font-size: 1.15rem; font-weight: 900;">${escapeHtml(data.tokenNumber)}</span></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.95rem;" border="1" cellpadding="6">
          <tr>
            <td style="width: 35%; background: #f0f0f0;"><strong>Farmer Name (किसान का नाम):</strong></td>
            <td>${escapeHtml(data.farmerName)} (${escapeHtml(data.farmerId || "FMR")})</td>
          </tr>
          <tr>
            <td style="background: #f0f0f0;"><strong>Village / Tehsil:</strong></td>
            <td>${escapeHtml(data.farmerVillage || "Local Village")}</td>
          </tr>
          <tr>
            <td style="background: #f0f0f0;"><strong>Crop & Quantity:</strong></td>
            <td><strong>${escapeHtml(data.crop)}</strong> — Lot: ${escapeHtml(data.quantity)}</td>
          </tr>
          <tr>
            <td style="background: #f0f0f0;"><strong>Assigned Scale (तौल कांटा):</strong></td>
            <td><strong>${escapeHtml(data.assignedGate || "Gate 1 (Weighbridge Scale 1)")}</strong></td>
          </tr>
          <tr>
            <td style="background: #f0f0f0;"><strong>Passed Date & Time:</strong></td>
            <td>${timeStr}</td>
          </tr>
          <tr>
            <td style="background: #f0f0f0;"><strong>Status:</strong></td>
            <td><strong style="color: #065f46;">ENTRY PASSED & AUTHORIZED (अधिकृत प्रवेश)</strong></td>
          </tr>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; font-size: 0.85rem;">
          <div>
            <div>Security Verification: <strong>QR CODE VERIFIED ✓</strong></div>
            <div>Valid for direct entry to Tare Weighment.</div>
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #000; width: 180px; padding-top: 4px;">
              <strong>Authorized Signatory</strong><br>
              Gate Incharge / Centre Officer
            </div>
          </div>
        </div>
      </div>
    `;

    printContainer.style.display = "block";
    window.print();
    setTimeout(() => {
      printContainer.style.display = "none";
    }, 1000);
  }

  // Render Centre Mismatch Error Box
  function renderCentreMismatchError(res) {
    if (!verifyResultContainer) return;
    verifyResultContainer.innerHTML = `
      <div style="background: #fef2f2; border: 2px solid #f87171; border-radius: var(--radius-md); padding: 1.5rem; color: #991b1b;">
        <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 800; font-size: 1.15rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.5rem;">⛔</span>
          <span>ENTRY DENIED — CENTRE MISMATCH (गलत उपार्जन केंद्र)</span>
        </div>
        <div style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
          This procurement token is scheduled strictly for: <strong>${escapeHtml(res.tokenCentre || "Another Centre")}</strong>.<br>
          You are currently stationed at: <strong>${escapeHtml(res.officerCentre || (centreData ? centreData.name : "Your Centre"))}</strong>.
        </div>
        <div style="background: #fee2e2; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.85rem; margin-bottom: 1rem;">
          ⚠️ <strong>Mandisathi Strict Policy:</strong> Farmers can only pass the gate at their scheduled procurement centre to prevent traffic congestion and guarantee MSP slot reservation.
        </div>
        <button id="btnDismissMismatch" class="btn btn-danger btn-sm">
          ✕ Dismiss & Return to Scanner
        </button>
      </div>
    `;

    const btnDismiss = document.getElementById("btnDismissMismatch");
    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => {
        verifyResultContainer.style.display = "none";
      });
    }
  }

  // Render Token Not Found Warning Box
  function renderTokenNotFoundError(res, query) {
    if (!verifyResultContainer) return;
    verifyResultContainer.innerHTML = `
      <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: var(--radius-md); padding: 1.25rem; color: #92400e;">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 1.05rem; margin-bottom: 0.35rem;">
          <span>⚠️</span> <span>Token Not Found in Mandi Registry</span>
        </div>
        <div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 0.75rem;">
          ${escapeHtml(res.message || "No active procurement record matched query: " + query)}
        </div>
        <div style="font-size: 0.8rem; color: #78350f;">
          💡 Tip: Ensure the farmer has registered and has a valid token beginning with <code>TK-</code>.
        </div>
      </div>
    `;
  }

  // Load Today's Passed Gate Passes for THIS centre
  async function loadPassedGatePasses(newlyAddedGatePassNumber) {
    try {
      const res = await apiFetch("/api/officer/passed-gate-passes");
      if (res.success && Array.isArray(res.data)) {
        passedGatePassesList = res.data;
        renderPassedGatePassesTable(passedGatePassesList, newlyAddedGatePassNumber);
      }
    } catch (err) {
      console.error("Failed to load passed gate passes:", err);
    }
  }

  function renderPassedGatePassesTable(list, newlyAddedGatePassNumber) {
    const count = list ? list.length : 0;
    if (officerPassedPassesCount) officerPassedPassesCount.textContent = count;
    if (tablePassedCount) tablePassedCount.textContent = count;

    if (!officerPassedPassesTbody) return;

    if (count === 0) {
      officerPassedPassesTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No vehicles passed yet today. Scan a QR pass to issue the first gate pass!
          </td>
        </tr>
      `;
      return;
    }

    let displayList = list ? [...list] : [];
    if (newlyAddedGatePassNumber) {
      const newIdx = displayList.findIndex(item =>
        item.gatePassNumber === newlyAddedGatePassNumber ||
        item.tokenNumber === newlyAddedGatePassNumber ||
        (item.gatePassNumber && newlyAddedGatePassNumber.includes(item.gatePassNumber))
      );
      if (newIdx > 0) {
        const [target] = displayList.splice(newIdx, 1);
        displayList.unshift(target);
      }
    }

    officerPassedPassesTbody.innerHTML = displayList.map(item => {
      const isNewlyAdded = Boolean(
        newlyAddedGatePassNumber &&
        (item.gatePassNumber === newlyAddedGatePassNumber || item.tokenNumber === newlyAddedGatePassNumber || (item.gatePassNumber && newlyAddedGatePassNumber.includes(item.gatePassNumber)))
      );
      const rowClass = isNewlyAdded ? ' class="row-slide-in"' : "";
      const statusBadge = isNewlyAdded
        ? `<span class="badge badge-green badge-just-verified">⚡ PASSED ✓ (NEW)</span>`
        : `<span class="badge badge-green">PASSED ✓</span>`;

      return `
      <tr${rowClass}>
        <td>
          <span style="font-weight: 800; color: #065f46; font-size: 0.88rem;">${escapeHtml(item.gatePassNumber)}</span>
          ${isNewlyAdded ? `<span style="display: block; font-size: 0.68rem; color: #059669; font-weight: 700;">Just Validated</span>` : ""}
        </td>
        <td>
          <code>${escapeHtml(item.tokenNumber)}</code>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(item.farmerName)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.farmerMobile || item.farmerId)}</div>
        </td>
        <td>
          <div>${escapeHtml(item.crop)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${escapeHtml(item.quantity)}</div>
        </td>
        <td>
          <span class="badge badge-blue" style="font-size: 0.75rem;">${escapeHtml(item.assignedGate || "Gate 1")}</span>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">
          ${escapeHtml(item.passedAt || "Today")}
        </td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <button class="action-btn-sm action-btn-weigh btn-print-pass-row" data-pass-idx="${list.indexOf(item)}" title="Print Gate Pass Slip">
            <span>🖨️</span> <span>Print</span>
          </button>
        </td>
      </tr>
      `;
    }).join("");

    // Attach print click handlers
    officerPassedPassesTbody.querySelectorAll(".btn-print-pass-row").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(btn.getAttribute("data-pass-idx"), 10);
        if (list[idx]) {
          printGatePassSlip(list[idx]);
        }
      });
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
    socket.on("gate:pass_passed", (payload) => {
      const gatePassNumber = payload?.gatePassNumber || payload?.data?.gatePassNumber;
      const tokenNumber = payload?.tokenNumber || payload?.data?.tokenNumber;
      loadPassedGatePasses(gatePassNumber);
      loadFarmers(tokenNumber);
      loadDashboard();
    });
  }

  // Initial Load
  loadDashboard();
  loadFarmers();
  loadPassedGatePasses();
});
