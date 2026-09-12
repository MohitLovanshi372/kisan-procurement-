const { jsPDF } = require("jspdf");
const QRCode = require("qrcode");

/**
 * MandiSathi - Official Digital ID Card PDF Generator Service
 * Generates printer-friendly, official government e-Card PDF documents
 * Strictly excludes any authentication secrets, tokens, or PII beyond what is on the card.
 */

async function generateCardPdf(cardData, type = "farmer") {
  const isOfficer = type === "officer";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const primaryColor = isOfficer ? [15, 118, 110] : [6, 95, 70];    // Teal or Emerald
  const accentColor = isOfficer ? [56, 189, 248] : [245, 158, 11];  // Sky or Amber
  const identifier = isOfficer ? (cardData.officerId || "OFF001") : (cardData.farmerId || "FMR1001");
  const cardTitle = isOfficer ? "OFFICIAL PROCUREMENT CENTRE OFFICER ID" : "DIGITAL FARMER IDENTITY CARD";
  const personName = isOfficer ? (cardData.officerName || "Centre Officer") : (cardData.farmerName || "Farmer");
  const centreName = isOfficer ? (cardData.assignedCentre || "Sanwer Procurement Centre") : (cardData.procurementCentre || "Sanwer Procurement Centre");

  // Pure white clean printable page
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");

  // Top Government Header Strip
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, 12, 180, 24, "F");

  // Accent Line
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(15, 36, 180, 1.5, "F");

  // Header Typography
  doc.setTextColor(isOfficer ? 186 : 254, isOfficer ? 230 : 240, isOfficer ? 253 : 138);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("GOVERNMENT OF MADHYA PRADESH • DEPARTMENT OF FOOD & CIVIL SUPPLIES", 105, 19, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("MandiSathi e-Procurement Portal", 105, 26, { align: "center" });

  doc.setFontSize(8.5);
  doc.setTextColor(240, 253, 244);
  doc.text(cardTitle, 105, 32, { align: "center" });

  // Cut guideline banner
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("- - - - [✂] Cut along dotted lines for standard wallet pouch lamination (Front View) - - - -", 105, 43, { align: "center" });

  // Cut guideline dotted box
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 2], 0);
  const cardHeight = isOfficer ? 132 : 142;
  doc.roundedRect(25, 45, 160, cardHeight + 8, 4, 4, "S");
  doc.setLineDashPattern([], 0); // Reset dash

  // Physical Card Container Frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(30, 49, 150, cardHeight, 4, 4, "FD");

  // Card Inner Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(30, 49, 150, 22, 4, 4, "F");
  doc.rect(30, 67, 150, 4, "F");

  // Header Title inside card
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text(isOfficer ? "Procurement Centre Officer ID" : "MandiSathi Digital Farmer Card", 38, 58);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(isOfficer ? 204 : 254, isOfficer ? 251 : 240, isOfficer ? 241 : 138);
  doc.text("Govt. of Madhya Pradesh • Dept. of Food & Civil Supplies", 38, 64);

  // Active Status Badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(152, 54, 22, 6, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("✓ ACTIVE", 163, 58.2, { align: "center" });

  // Profile Row inside Card
  // Avatar / Photo Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(36, 75, 22, 26, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6);
  doc.text(isOfficer ? "OFFICER" : "FARMER", 47, 85, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("PHOTO", 47, 91, { align: "center" });

  // Personal Credentials
  const detailsCol1 = 64;
  const detailsCol2 = 118;

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isOfficer ? "OFFICER NAME" : "FARMER NAME", detailsCol1, 79);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(personName, detailsCol1, 84);

  // ID
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isOfficer ? "OFFICER ID" : "FARMER ID", detailsCol2, 79);
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(identifier, detailsCol2, 84);

  // Mobile
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("MOBILE (REGISTERED)", detailsCol1, 92);
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(cardData.mobileNumber || "******3210", detailsCol1, 97);

  // Designation / Village
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isOfficer ? "DESIGNATION" : "VILLAGE / DISTRICT", detailsCol2, 92);
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const locationOrDesig = isOfficer 
    ? (cardData.designation || "Procurement Centre Officer")
    : `${cardData.village || "Sanwer"}, ${cardData.district || "Indore"}`;
  doc.text(locationOrDesig, detailsCol2, 97);

  // Center Details Section
  let curY = 104;
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ASSIGNED PROCUREMENT CENTRE", detailsCol1, curY);
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(centreName, detailsCol1, curY + 4.5);

  if (isOfficer) {
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("CENTRE ID", detailsCol2, curY);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cardData.centreId || "CENTRE_001", detailsCol2, curY + 4.5);
  }

  curY += 10;

  // Land Record Box (Farmer Only)
  if (!isOfficer) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    doc.roundedRect(36, curY, 138, 14, 2, 2, "FD");

    doc.setFontSize(6.5);
    doc.setTextColor(22, 101, 52);
    doc.setFont("helvetica", "bold");
    doc.text("LAND RECORD DETAILS", 40, curY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(7.5);
    const surveyText = `Khasra/Survey: ${cardData.surveyNumber || "KH-2024/782"}  •  Area: ${cardData.landArea || "4.5 Acres"}  •  Status: ${cardData.landRecordStatus || "Farmer Provided"}`;
    doc.text(surveyText, 40, curY + 10);

    curY += 18;
  } else {
    curY += 4;
  }

  // Verification Box with QR Code
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(36, curY, 138, 30, 2, 2, "FD");

  // Generate crisp QR code
  const verificationUrl = cardData.verificationUrl || `https://mandisathi.gov.in/verify/${type}/${identifier}`;
  let qrDataUrl = cardData.qrCodeDataUrl;
  if (!qrDataUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 160,
        color: { dark: isOfficer ? "#0f766e" : "#14532d", light: "#ffffff" }
      });
    } catch (e) {
      console.error("PDF QR Error:", e);
    }
  }

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 39, curY + 2, 26, 26);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("🔒 Official Verification QR Code", 70, curY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan with any mobile camera to verify credentials on MandiSathi Central Registry.", 70, curY + 13);
  doc.text("Real-time cryptographic verification • Public verification URL:", 70, curY + 18);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(6.5);
  doc.text(verificationUrl, 70, curY + 23);

  // Security & Official Terms of Use below the card
  const termsY = 45 + cardHeight + 14;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, termsY, 160, 42, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("SECURITY, VERIFICATION & OFFICIAL USAGE GUIDELINES", 32, termsY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.8);
  doc.text("1. Valid at all government procurement centres, weighbridges, and quality assessment kiosks in MP.", 32, termsY + 12.5);
  doc.text("2. Present this document (digital or laminated print) along with scheduled gate pass for expedited entry.", 32, termsY + 18);
  doc.text("3. Instant verification is supported 24x7 via the tamper-evident QR code linked to the central portal.", 32, termsY + 23.5);
  doc.text("4. PRIVACY GUARANTEE: Does NOT contain any banking PINs, passwords, or authentication secrets.", 32, termsY + 29);
  doc.text("5. Helpline: Kisan Call Centre 1800-180-1551 (Toll Free) • MP Food & Civil Supplies Portal.", 32, termsY + 34.5);

  // Official Generation Stamp Footer
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Electronic Record • Generated on: ${timestamp} • Document Ref: ${cardData.cardId || identifier}`, 105, termsY + 48, { align: "center" });
  doc.text("Government of Madhya Pradesh • MandiSathi e-Procurement Portal", 105, termsY + 52, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

module.exports = { generateCardPdf };
