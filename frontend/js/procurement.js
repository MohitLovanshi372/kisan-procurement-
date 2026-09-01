/**
 * Kisan Procurement Mitra - Procurement & Payment Status Handler
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  const printBtn = document.getElementById("printTokenBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  await loadProcurementDetails();
});

async function loadProcurementDetails() {
  const loading = document.getElementById("procLoading");
  const container = document.getElementById("procContent");

  try {
    const res = await apiFetch("/api/procurement/my");
    if (loading) loading.style.display = "none";
    if (container) container.style.display = "block";

    if (!res.success || !res.data) {
      showToast("Unable to load procurement details.", "error");
      return;
    }

    const { procurement, centre } = res.data;
    const user = getUser();

    // 1. Populate Token Section
    const tokNumber = document.getElementById("tokNumber");
    const tokFarmerName = document.getElementById("tokFarmerName");
    const tokFarmerId = document.getElementById("tokFarmerId");
    const tokCentre = document.getElementById("tokCentre");
    const tokDate = document.getElementById("tokDate");
    const tokTime = document.getElementById("tokTime");
    const tokQuantity = document.getElementById("tokQuantity");
    const tokCrop = document.getElementById("tokCrop");
    const tokStatus = document.getElementById("tokStatus");

    if (tokNumber) tokNumber.textContent = procurement.tokenNumber || "TK-1042";
    if (tokFarmerName && user) tokFarmerName.textContent = user.name;
    if (tokFarmerId && user) tokFarmerId.textContent = user.farmerId;
    if (tokCentre) tokCentre.textContent = centre.name || "Sanwer Procurement Centre";
    if (tokDate) tokDate.textContent = procurement.scheduleDate || "12 September 2026";
    if (tokTime) tokTime.textContent = procurement.startTime || "10:00 AM";
    if (tokQuantity) tokQuantity.textContent = procurement.quantity || "18 Quintal";
    if (tokCrop) tokCrop.textContent = procurement.crop || "Wheat";
    if (tokStatus) {
      tokStatus.textContent = "Active";
      tokStatus.className = "badge badge-green";
    }

    // Fetch and populate scannable QR Code on the slip
    try {
      const qrRes = await apiFetch("/api/procurement/qr-code");
      const tokQrImage = document.getElementById("tokQrImage");
      const tokQrLoading = document.getElementById("tokQrLoading");
      if (qrRes.success && qrRes.data && qrRes.data.qrDataUrl) {
        if (tokQrImage) {
          tokQrImage.src = qrRes.data.qrDataUrl;
          tokQrImage.style.display = "block";
        }
        if (tokQrLoading) tokQrLoading.style.display = "none";
      }
    } catch (qrErr) {
      console.warn("Slip QR load warning:", qrErr);
    }

    // 2. Populate Procurement Status Section
    const psCrop = document.getElementById("psCrop");
    const psExpQty = document.getElementById("psExpQty");
    const psRecQty = document.getElementById("psRecQty");
    const psStatus = document.getElementById("psStatus");
    const psDate = document.getElementById("psDate");
    const psCentre = document.getElementById("psCentre");
    const psProgressBar = document.getElementById("psProgressBar");
    const psProgressText = document.getElementById("psProgressText");

    if (psCrop) psCrop.textContent = procurement.crop || "Wheat";
    if (psExpQty) psExpQty.textContent = procurement.quantity || "18 Quintal";
    if (psRecQty) psRecQty.textContent = procurement.receivedQuantity || "18 Quintal";
    if (psDate) psDate.textContent = procurement.scheduleDate || "12 September 2026";
    if (psCentre) psCentre.textContent = centre.name || "Sanwer Mandi";

    const procStatus = procurement.procurementStatus || "Scheduled";
    if (psStatus) {
      psStatus.innerHTML = `<span class="badge ${getStatusBadge(procStatus)}">${procStatus}</span>`;
    }

    // Calculate percentage
    let percent = 50;
    if (procStatus === "Procurement Completed" || procStatus === "Completed") percent = 100;
    else if (procStatus === "Arrived") percent = 75;
    else if (procStatus === "Scheduled") percent = 50;
    else if (procStatus === "Token Generated") percent = 30;

    if (psProgressBar) psProgressBar.style.width = `${percent}%`;
    if (psProgressText) psProgressText.textContent = `${percent}% Completed`;

    // 3. Populate Payment Status Section
    const payAmount = document.getElementById("payAmount");
    const payProcStatus = document.getElementById("payProcStatus");
    const payStatus = document.getElementById("payStatus");
    const payDate = document.getElementById("payDate");
    const payTxId = document.getElementById("payTxId");

    const amountVal = procurement.amount || 45000;
    if (payAmount) payAmount.textContent = `₹${amountVal.toLocaleString("en-IN")}`;
    if (payProcStatus) payProcStatus.textContent = procStatus;

    const currentPayStatus = procurement.paymentStatus || "Pending";
    if (payStatus) {
      payStatus.innerHTML = `<span class="badge ${getPaymentBadge(currentPayStatus)}">${currentPayStatus}</span>`;
    }

    if (currentPayStatus === "Paid") {
      if (payDate) payDate.textContent = procurement.paymentDate || "18 September 2026";
      if (payTxId) payTxId.textContent = procurement.transactionId || "PAY-20260918-1001";
    } else {
      if (payDate) payDate.textContent = "Not available (Awaiting procurement settlement)";
      if (payTxId) payTxId.textContent = "Will be generated upon bank transfer";
    }

  } catch (error) {
    console.error("Procurement details error:", error);
    if (loading) loading.textContent = "Unable to load procurement info.";
  }
}

function getStatusBadge(status) {
  switch (status) {
    case "Completed":
    case "Procurement Completed":
      return "badge-green";
    case "Scheduled":
      return "badge-blue";
    case "Arrived":
    case "Pending":
      return "badge-amber";
    default:
      return "badge-gray";
  }
}

function getPaymentBadge(status) {
  switch (status) {
    case "Paid":
      return "badge-green";
    case "Processing":
      return "badge-blue";
    case "Pending":
      return "badge-amber";
    default:
      return "badge-gray";
  }
}
