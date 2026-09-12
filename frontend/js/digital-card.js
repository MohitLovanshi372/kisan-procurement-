/**
 * MandiSathi - Digital ID Card Client Engine (Farmer & Officer)
 * Handles Fetching, Generating, Rendering, Printing, and PNG Downloading.
 */

const MandiSathiIDCard = {
  currentCardData: null,
  currentType: "farmer", // "farmer" or "officer"

  /**
   * Initialize ID card trigger on Farmer or Officer page
   */
  init({ type, openBtnId, modalId }) {
    this.currentType = type || "farmer";
    const openBtn = document.getElementById(openBtnId);
    const modal = document.getElementById(modalId);

    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        await this.showModal(modalId);
      });
    }

    // Set up close and action listeners inside modal
    if (modal) {
      const closeBtn = modal.querySelector(".js-close-card-modal");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          modal.classList.remove("active");
        });
      }

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      });

      const printBtn = modal.querySelector(".js-print-card-btn");
      if (printBtn) {
        printBtn.addEventListener("click", () => {
          this.printCard();
        });
      }

      const pdfBtn = modal.querySelector(".js-download-pdf-btn");
      if (pdfBtn) {
        pdfBtn.addEventListener("click", () => {
          this.downloadPDF();
        });
      }

      const downloadBtn = modal.querySelector(".js-download-card-btn");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
          this.downloadCard();
        });
      }

      const genBtn = modal.querySelector(".js-generate-card-btn");
      if (genBtn) {
        genBtn.addEventListener("click", async () => {
          await this.generateCard();
        });
      }
    }
  },

  /**
   * Fetch current card data or open modal
   */
  async showModal(modalId = "digitalCardModal") {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add("active");

    const endpoint = this.currentType === "officer" 
      ? "/api/officer/card" 
      : "/api/farmers/card";

    try {
      const res = await apiFetch(endpoint);
      if (res && res.success && res.data) {
        this.currentCardData = res.data;
        this.renderCardInDOM(res.data, modal);
      } else {
        // If not yet generated, render preliminary with "Generate" prompt
        if (window.showToast) {
          showToast(res?.message || "Please generate your official digital card", "info");
        }
      }
    } catch (err) {
      console.error("Error loading card:", err);
      if (window.showToast) {
        showToast("Unable to load digital card details", "error");
      }
    }
  },

  /**
   * Request backend to formally generate or refresh digital card
   */
  async generateCard(modalId = "digitalCardModal") {
    const modal = document.getElementById(modalId);
    const genBtn = modal?.querySelector(".js-generate-card-btn");
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = "Generating...";
    }

    const endpoint = this.currentType === "officer" 
      ? "/api/officer/card/generate" 
      : "/api/farmers/card/generate";

    try {
      const res = await apiFetch(endpoint, { method: "POST" });
      if (res && res.success && res.data) {
        this.currentCardData = res.data;
        this.renderCardInDOM(res.data, modal);
        if (window.showToast) {
          showToast(res.message || "Official ID Card generated successfully", "success");
        }
      } else {
        if (window.showToast) {
          showToast(res?.message || "Generation failed", "error");
        }
      }
    } catch (err) {
      console.error("Card generation failed:", err);
      if (window.showToast) {
        showToast("Error generating card", "error");
      }
    } finally {
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.textContent = "Regenerate Card";
      }
    }
  },

  /**
   * Render the HTML inside the card print/preview frame
   */
  renderCardInDOM(data, container) {
    if (!data || !container) return;

    const frame = container.querySelector(".digital-id-card-frame");
    if (!frame) return;

    if (this.currentType === "officer") {
      frame.className = "digital-id-card-frame officer-theme";
      frame.innerHTML = `
        <!-- Card Header -->
        <div class="card-gov-header">
          <div class="card-gov-topbar">
            <div class="card-emblem-wrap">
              <img src="img/logo.png" alt="MandiSathi Logo" onerror="this.onerror=null; this.src='img/brand-logo.png';">
            </div>
            <div class="card-gov-titles">
              <div class="card-gov-ministry">Govt. of Madhya Pradesh • Dept. of Food & Civil Supplies</div>
              <div class="card-gov-portal">🌾 MandiSathi</div>
            </div>
          </div>
          <div class="card-category-strip">
            <span class="card-category-title">PROCUREMENT CENTRE OFFICER</span>
            <span class="card-status-chip">✓ ACTIVE</span>
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-inner-body">
          <div class="card-identity-row">
            <div class="card-photo-box">
              <div class="card-photo-avatar">👮‍♂️</div>
              <div class="card-photo-label">Official Photo</div>
            </div>
            <div class="card-primary-fields">
              <div class="card-field-group">
                <div class="card-field-label">Officer Name</div>
                <div class="card-field-val-lg">${this.escape(data.officerName || "Officer")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Officer ID</div>
                <div class="card-field-val-id">${this.escape(data.officerId || "OFF001")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Designation</div>
                <div class="card-field-val-text">${this.escape(data.designation || "Procurement Centre Officer")}</div>
              </div>
            </div>
          </div>

          <div class="card-details-grid">
            <div class="card-field-group">
              <div class="card-field-label">Assigned Centre</div>
              <div class="card-field-val-text" style="font-weight: 700; color: #0f766e;">${this.escape(data.assignedCentre || "Sanwer Centre")}</div>
            </div>
            <div class="card-field-group">
              <div class="card-field-label">Centre ID</div>
              <div class="card-field-val-text" style="font-family: monospace;">${this.escape(data.centreId || "CENTRE_001")}</div>
            </div>
            <div class="card-field-group">
              <div class="card-field-label">District</div>
              <div class="card-field-val-text">${this.escape(data.district || "Indore")}</div>
            </div>
            <div class="card-field-group">
              <div class="card-field-label">Mobile Number</div>
              <div class="card-field-val-text" style="font-family: monospace;">${this.escape(data.mobileNumber || "******3210")}</div>
            </div>
          </div>

          <!-- QR Code Section -->
          <div class="card-verification-section">
            <div class="card-qr-wrap">
              ${data.qrCodeDataUrl ? `<img src="${data.qrCodeDataUrl}" alt="Officer Verification QR" class="card-qr-img">` : `<div style="font-size: 0.7rem; color: #94a3b8;">Generating QR...</div>`}
            </div>
            <div class="card-verify-instructions">
              <div class="card-verify-title">🔒 MandiSathi Official Verification</div>
              <div class="card-verify-desc">Scan to verify authorized procurement officer credentials on the official portal.</div>
              <div class="card-verify-url-preview">${this.escape(data.verificationPath || `/verify/officer/${data.officerId}`)}</div>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="card-gov-footer">
          <div class="card-footer-branding">🌾 MandiSathi • Centre Operations</div>
          <div class="card-footer-security">Official Authorized Token</div>
        </div>
      `;
    } else {
      // Farmer Theme
      frame.className = "digital-id-card-frame farmer-theme";
      frame.innerHTML = `
        <!-- Card Header -->
        <div class="card-gov-header">
          <div class="card-gov-topbar">
            <div class="card-emblem-wrap">
              <img src="img/logo.png" alt="MandiSathi Logo" onerror="this.onerror=null; this.src='img/brand-logo.png';">
            </div>
            <div class="card-gov-titles">
              <div class="card-gov-ministry">Govt. of Madhya Pradesh • Dept. of Food & Civil Supplies</div>
              <div class="card-gov-portal">🌾 MandiSathi</div>
            </div>
          </div>
          <div class="card-category-strip">
            <span class="card-category-title">DIGITAL FARMER CARD</span>
            <span class="card-status-chip">✓ REGISTERED</span>
          </div>
        </div>

        <!-- Card Body -->
        <div class="card-inner-body">
          <div class="card-identity-row">
            <div class="card-photo-box">
              <div class="card-photo-avatar">👨‍🌾</div>
              <div class="card-photo-label">Farmer Photo</div>
            </div>
            <div class="card-primary-fields">
              <div class="card-field-group">
                <div class="card-field-label">Farmer Name</div>
                <div class="card-field-val-lg">${this.escape(data.farmerName || "Farmer Name")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Farmer ID</div>
                <div class="card-field-val-id">${this.escape(data.farmerId || "FMR1001")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Mobile Number</div>
                <div class="card-field-val-text" style="font-family: monospace;">${this.escape(data.mobileNumber || "******3210")}</div>
              </div>
            </div>
          </div>

          <div class="card-details-grid">
            <div class="card-field-group">
              <div class="card-field-label">Village</div>
              <div class="card-field-val-text">${this.escape(data.village || "Sanwer")}</div>
            </div>
            <div class="card-field-group">
              <div class="card-field-label">District</div>
              <div class="card-field-val-text">${this.escape(data.district || "Indore")}</div>
            </div>
            <div class="card-field-group" style="grid-column: span 2;">
              <div class="card-field-label">Procurement Centre</div>
              <div class="card-field-val-text" style="font-weight: 700; color: #047857;">${this.escape(data.procurementCentre || "Sanwer Procurement Centre")}</div>
            </div>
          </div>

          <!-- Land Record Section -->
          <div class="card-land-record-box">
            <div class="card-land-record-title">
              <span>🌾 LAND RECORD DETAILS</span>
            </div>
            <div class="card-land-grid">
              <div class="card-field-group">
                <div class="card-field-label">Survey / Khasra No.</div>
                <div class="card-field-val-text" style="font-family: monospace; font-weight: 700;">${this.escape(data.surveyNumber || "KH-2024/782")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Land Area</div>
                <div class="card-field-val-text" style="font-weight: 700;">${this.escape(data.landArea || "4.5 Acres")}</div>
              </div>
              <div class="card-field-group">
                <div class="card-field-label">Land Record Status</div>
                <span class="card-land-status-pill">${this.escape(data.landRecordStatus || "Farmer Provided")}</span>
              </div>
            </div>
          </div>

          <!-- QR Code Section -->
          <div class="card-verification-section">
            <div class="card-qr-wrap">
              ${data.qrCodeDataUrl ? `<img src="${data.qrCodeDataUrl}" alt="Farmer Verification QR" class="card-qr-img">` : `<div style="font-size: 0.7rem; color: #94a3b8;">Generating QR...</div>`}
            </div>
            <div class="card-verify-instructions">
              <div class="card-verify-title">🔒 MandiSathi Official Verification</div>
              <div class="card-verify-desc">Scan with any smartphone camera to verify authenticated farmer identity and procurement eligibility.</div>
              <div class="card-verify-url-preview">${this.escape(data.verificationPath || `/verify/farmer/${data.farmerId}`)}</div>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="card-gov-footer">
          <div class="card-footer-branding">🌾 MandiSathi • Farmer Identity & Support</div>
          <div class="card-footer-security">Official Farmer Credential</div>
        </div>
      `;
    }

    // Toggle Generate vs Regenerate button text
    const genBtn = container.querySelector(".js-generate-card-btn");
    if (genBtn) {
      genBtn.textContent = data.hasGeneratedCard ? "🔄 Regenerate Card" : "✨ Generate Digital Card";
    }

    // Set up clean printer-friendly sheet elements inside print area
    const printArea = container.querySelector("#digitalIdCardPrintArea");
    if (printArea) {
      printArea.querySelectorAll(".card-print-only").forEach(el => el.remove());

      const headerDiv = document.createElement("div");
      headerDiv.className = `card-print-only card-print-official-header ${this.currentType === "officer" ? "officer" : ""}`;
      headerDiv.innerHTML = `
        <div class="card-print-header-top">GOVERNMENT OF MADHYA PRADESH • DEPARTMENT OF FOOD & CIVIL SUPPLIES</div>
        <div class="card-print-header-title">🌾 MandiSathi e-Procurement Portal</div>
        <div class="card-print-header-sub">${this.currentType === "officer" ? "OFFICIAL PROCUREMENT CENTRE OFFICER CREDENTIAL" : "OFFICIAL DIGITAL FARMER IDENTITY CARD"}</div>
      `;
      printArea.insertBefore(headerDiv, frame);

      const cutDiv = document.createElement("div");
      cutDiv.className = "card-print-only card-print-cut-note";
      cutDiv.textContent = "- - - - ✂ Cut along outer border for wallet pouch lamination (Front View) ✂ - - - -";
      printArea.insertBefore(cutDiv, frame);

      const footerDiv = document.createElement("div");
      footerDiv.className = "card-print-only card-print-official-footer";
      const printTime = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const docRef = data.cardId || (this.currentType === "officer" ? (data.officerId || "OFF001") : (data.farmerId || "FMR1001"));
      footerDiv.innerHTML = `
        <div class="card-print-security-title">🔒 OFFICIAL SECURITY & VERIFICATION GUIDELINES</div>
        <div>• Valid at all authorized government procurement centres, weighbridges, and quality assessment kiosks in MP.</div>
        <div>• Present this official credential (digital or physical laminated copy) along with scheduled gate pass for expedited entry.</div>
        <div>• Authenticity can be verified in real-time by scanning the tamper-proof QR code with any smartphone camera.</div>
        <div>• <strong>PRIVACY GUARANTEE:</strong> This official document contains NO banking PINs, passwords, or authentication secrets.</div>
        <div class="card-print-stamp-note">
          Official Electronic Document • Verified against Central MandiSathi Database • Printed on: ${printTime} • Ref: ${this.escape(docRef)}
        </div>
      `;
      printArea.appendChild(footerDiv);
    }
  },

  /**
   * Helper to dynamically load external or local scripts if needed
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  /**
   * Fetch current card data if not yet loaded
   */
  async fetchCardData() {
    const endpoint = this.currentType === "officer" 
      ? "/api/officer/card" 
      : "/api/farmers/card";
    try {
      const res = await apiFetch(endpoint);
      if (res && res.success && res.data) {
        this.currentCardData = res.data;
        return res.data;
      }
    } catch (err) {
      console.error("Error fetching card data:", err);
    }
    return null;
  },

  /**
   * Trigger clean native browser print
   */
  async printCard() {
    if (!this.currentCardData) {
      await this.fetchCardData();
    }
    setTimeout(() => {
      window.print();
    }, 100);
  },

  /**
   * Download the card as an official, printer-friendly PDF document
   * Completely excludes any authentication secrets, tokens, or PII beyond the card.
   */
  async downloadPDF() {
    let data = this.currentCardData;
    if (!data) {
      data = await this.fetchCardData();
    }
    if (!data) {
      if (window.showToast) showToast("Please generate or load your card first", "warning");
      return;
    }

    const isOfficer = this.currentType === "officer";
    const identifier = isOfficer ? (data.officerId || "OFF001") : (data.farmerId || "FMR1001");
    const cleanId = String(identifier).replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `MandiSathi_${isOfficer ? "Officer" : "Farmer"}_Card_${cleanId}.pdf`;

    if (window.showToast) {
      showToast("Generating official PDF...", "info");
    }

    // Try client-side jsPDF for instant high-fidelity download
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        await this.loadScript("js/jspdf.umd.min.js");
      }

      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        const primaryColor = isOfficer ? [15, 118, 110] : [6, 95, 70];
        const accentColor = isOfficer ? [56, 189, 248] : [245, 158, 11];
        const cardTitle = isOfficer ? "OFFICIAL PROCUREMENT CENTRE OFFICER ID" : "DIGITAL FARMER IDENTITY CARD";
        const personName = isOfficer ? (data.officerName || "Centre Officer") : (data.farmerName || "Farmer");
        const centreName = isOfficer ? (data.assignedCentre || "Sanwer Procurement Centre") : (data.procurementCentre || "Sanwer Procurement Centre");

        // Clean white page
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 297, "F");

        // Top Gov Header Bar
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(15, 12, 180, 24, "F");

        // Accent strip
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, 36, 180, 1.5, "F");

        // Header Text
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

        // Cut dashed guideline
        doc.setDrawColor(148, 163, 184);
        doc.setLineDashPattern([2, 2], 0);
        const cardH = isOfficer ? 132 : 142;
        doc.roundedRect(25, 45, 160, cardH + 8, 4, 4, "S");
        doc.setLineDashPattern([], 0);

        // Card Container Frame
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.8);
        doc.roundedRect(30, 49, 150, cardH, 4, 4, "FD");

        // Card Inner Header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.roundedRect(30, 49, 150, 22, 4, 4, "F");
        doc.rect(30, 67, 150, 4, "F");

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

        // Profile Details
        const detailsCol1 = 64;
        const detailsCol2 = 118;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(isOfficer ? "OFFICER NAME" : "FARMER NAME", detailsCol1, 79);
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(personName, detailsCol1, 84);

        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(isOfficer ? "OFFICER ID" : "FARMER ID", detailsCol2, 79);
        doc.setFontSize(9.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(identifier, detailsCol2, 84);

        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text("MOBILE (REGISTERED)", detailsCol1, 92);
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(data.mobileNumber || "******3210", detailsCol1, 97);

        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(isOfficer ? "DESIGNATION" : "VILLAGE / DISTRICT", detailsCol2, 92);
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        const locationOrDesig = isOfficer 
          ? (data.designation || "Procurement Centre Officer")
          : `${data.village || "Sanwer"}, ${data.district || "Indore"}`;
        doc.text(locationOrDesig, detailsCol2, 97);

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
          doc.text(data.centreId || "CENTRE_001", detailsCol2, curY + 4.5);
        }

        curY += 10;

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
          const surveyText = `Khasra/Survey: ${data.surveyNumber || "KH-2024/782"}  •  Area: ${data.landArea || "4.5 Acres"}  •  Status: ${data.landRecordStatus || "Farmer Provided"}`;
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

        const qrDataUrl = data.qrCodeDataUrl;
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
        doc.text("Scan with smartphone to verify credentials on MandiSathi Central Registry.", 70, curY + 13);
        doc.text("Real-time cryptographic verification • Public verification URL:", 70, curY + 18);

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(6.5);
        doc.text(data.verificationUrl || `https://mandisathi.gov.in/verify/${this.currentType}/${identifier}`, 70, curY + 23);

        // Security terms
        const termsY = 45 + cardH + 14;
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

        const timestamp = new Date().toLocaleString("en-IN");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Official Electronic Record • Generated on: ${timestamp} • Document Ref: ${data.cardId || identifier}`, 105, termsY + 48, { align: "center" });
        doc.text("Government of Madhya Pradesh • MandiSathi e-Procurement Portal", 105, termsY + 52, { align: "center" });

        doc.save(fileName);
        if (window.showToast) {
          showToast("Digital ID Card PDF downloaded successfully", "success");
        }
        return;
      }
    } catch (clientPdfErr) {
      console.warn("Client jsPDF failed, falling back to server PDF endpoint:", clientPdfErr);
    }

    // Fallback: server API download
    await this.downloadServerPDF(fileName);
  },

  /**
   * Fallback: download official PDF from server
   */
  async downloadServerPDF(fileName) {
    const endpoint = this.currentType === "officer" 
      ? "/api/officer/card/pdf" 
      : "/api/farmers/card/pdf";

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Server PDF download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      if (window.showToast) {
        showToast("Digital ID Card PDF downloaded successfully", "success");
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      if (window.showToast) {
        showToast("Failed to download PDF card", "error");
      }
    }
  },

  /**
   * Download the card as high-resolution PNG image
   */
  downloadCard() {
    const cardEl = document.querySelector("#digitalIdCardPrintArea");
    if (!cardEl) {
      if (window.showToast) showToast("Card element not found", "error");
      return;
    }

    const data = this.currentCardData;
    const identifier = this.currentType === "officer" 
      ? (data?.officerId || "OFF001") 
      : (data?.farmerId || "FMR1001");
    const fileName = `MandiSathi_${this.currentType === "officer" ? "Officer" : "Farmer"}_Card_${identifier}.png`;

    // Render cleanly to high-res canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const scale = 2; // 2x Retina resolution
    const width = 440;
    const height = this.currentType === "officer" ? 540 : 610;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = "#ffffff";
    this.roundRect(ctx, 0, 0, width, height, 16);
    ctx.fill();

    // Card Header Gradient
    const headerH = 100;
    const gradient = ctx.createLinearGradient(0, 0, width, headerH);
    if (this.currentType === "officer") {
      gradient.addColorStop(0, "#0f766e");
      gradient.addColorStop(1, "#134e4a");
    } else {
      gradient.addColorStop(0, "#065f46");
      gradient.addColorStop(1, "#064e3b");
    }
    ctx.fillStyle = gradient;
    this.roundRect(ctx, 0, 0, width, headerH, [16, 16, 0, 0]);
    ctx.fill();

    // Header Stripe
    ctx.fillStyle = this.currentType === "officer" ? "#38bdf8" : "#f59e0b";
    ctx.fillRect(0, headerH - 4, width, 4);

    // Header Text
    ctx.fillStyle = this.currentType === "officer" ? "#bae6fd" : "#fef08a";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("GOVT. OF MADHYA PRADESH • DEPT. OF FOOD & CIVIL SUPPLIES", 24, 28);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("🌾 MandiSathi", 24, 54);

    // Category banner
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    this.roundRect(ctx, 24, 66, width - 48, 24, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    const categoryTitle = this.currentType === "officer" ? "PROCUREMENT CENTRE OFFICER" : "DIGITAL FARMER CARD";
    ctx.fillText(categoryTitle, 36, 82);

    ctx.fillStyle = "#10b981";
    this.roundRect(ctx, width - 110, 70, 76, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("✓ ACTIVE", width - 96, 82);

    // Profile Identity Row
    let curY = 120;
    // Photo box
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, 24, curY, 80, 96, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "38px sans-serif";
    ctx.fillText(this.currentType === "officer" ? "👮‍♂️" : "👨‍🌾", 44, curY + 60);

    // Primary Details
    const leftTextX = 120;
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(this.currentType === "officer" ? "OFFICER NAME" : "FARMER NAME", leftTextX, curY + 14);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(data?.officerName || data?.farmerName || "Name", leftTextX, curY + 34);

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(this.currentType === "officer" ? "OFFICER ID" : "FARMER ID", leftTextX, curY + 54);
    ctx.fillStyle = this.currentType === "officer" ? "#0f766e" : "#047857";
    ctx.font = "bold 14px monospace";
    ctx.fillText(identifier, leftTextX, curY + 70);

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("MOBILE NUMBER", leftTextX, curY + 86);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px monospace";
    ctx.fillText(data?.mobileNumber || "******3210", leftTextX, curY + 98);

    curY += 114;

    // Details Box
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#e2e8f0";
    this.roundRect(ctx, 24, curY, width - 48, 70, 8);
    ctx.fill();
    ctx.stroke();

    if (this.currentType === "officer") {
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("ASSIGNED CENTRE", 36, curY + 20);
      ctx.fillStyle = "#0f766e";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(data?.assignedCentre || "Sanwer Centre", 36, curY + 36);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("CENTRE ID", 240, curY + 20);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px monospace";
      ctx.fillText(data?.centreId || "CENTRE_001", 240, curY + 36);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("DISTRICT", 36, curY + 52);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(data?.district || "Indore", 36, curY + 64);
      curY += 84;
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("VILLAGE", 36, curY + 20);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(data?.village || "Sanwer", 36, curY + 34);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("DISTRICT", 240, curY + 20);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(data?.district || "Indore", 240, curY + 34);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("PROCUREMENT CENTRE", 36, curY + 50);
      ctx.fillStyle = "#047857";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(data?.procurementCentre || "Sanwer Procurement Centre", 36, curY + 64);

      curY += 84;

      // Land Record Box for Farmer
      ctx.fillStyle = "#f0fdf4";
      ctx.strokeStyle = "#86efac";
      this.roundRect(ctx, 24, curY, width - 48, 64, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#166534";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("🌾 LAND RECORD DETAILS", 36, curY + 18);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("KHASRA / SURVEY", 36, curY + 36);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 11px monospace";
      ctx.fillText(data?.surveyNumber || "KH-2024/782", 36, curY + 52);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("LAND AREA", 160, curY + 36);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(data?.landArea || "4.5 Acres", 160, curY + 52);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("STATUS", 280, curY + 36);
      ctx.fillStyle = "#92400e";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(data?.landRecordStatus || "Farmer Provided", 280, curY + 52);

      curY += 76;
    }

    // QR & Verification Box
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#cbd5e1";
    this.roundRect(ctx, 24, curY, width - 48, 100, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("🔒 Official Verification QR Code", 120, curY + 28);
    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.fillText("Scan with smartphone to verify authenticity on portal", 120, curY + 44);

    ctx.fillStyle = this.currentType === "officer" ? "#0f766e" : "#047857";
    ctx.font = "9px monospace";
    ctx.fillText(data?.verificationPath || `/verify/${this.currentType}/${identifier}`, 120, curY + 68);

    // Draw QR Code Image
    if (data?.qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.onload = () => {
        ctx.drawImage(qrImg, 34, curY + 8, 76, 76);
        this.finishDownload(canvas, fileName);
      };
      qrImg.onerror = () => {
        this.finishDownload(canvas, fileName);
      };
      qrImg.src = data.qrCodeDataUrl;
    } else {
      this.finishDownload(canvas, fileName);
    }
  },

  finishDownload(canvas, fileName) {
    // Outer border
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.strokeStyle = this.currentType === "officer" ? "#0f766e" : "#047857";
    ctx.lineWidth = 4;
    this.roundRect(ctx, 2, 2, canvas.width / 2 - 4, canvas.height / 2 - 4, 16);
    ctx.stroke();
    ctx.restore();

    // Trigger download
    const link = document.createElement("a");
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
    if (window.showToast) {
      showToast("Digital ID Card downloaded successfully", "success");
    }
  },

  roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === "undefined") radius = 5;
    if (typeof radius === "number") {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else if (Array.isArray(radius)) {
      radius = { tl: radius[0], tr: radius[1], br: radius[2], bl: radius[3] };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  },

  escape(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

window.MandiSathiIDCard = MandiSathiIDCard;
