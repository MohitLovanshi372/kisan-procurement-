/**
 * Mandisathi - Farmer WhatsApp Sahayak (Kisan Chatbot)
 *
 * Rules:
 * 1. If farmer is LOGGED IN on the website:
 *    - Automatically identifies the farmer from localStorage (kpm_user_data).
 *    - Uses their actual name everywhere in the chat and header.
 *    - Does NOT ask for name or mobile number.
 *
 * 2. If farmer is NOT LOGGED IN on the website:
 *    - Does NOT show token/queue/MSP/payment details until the farmer enters their Name and Mobile Number!
 *    - First asks for Name and 10-digit Mobile Number (supports single-message or step-by-step entry).
 *    - Once provided, addresses them by their given name in every subsequent detail (Token, Payment, Queue, MSP, Slot).
 *    - Provides an option to change/reset their name & number anytime.
 *
 * 3. Dual-tone synthesized notification audio chime with Mute/Unmute toggle.
 * 4. Responsive design for Mobile, Tablet, Laptop, and Desktop.
 */

(function () {
  const GUEST_STORAGE_KEY = "kpm_wa_guest_farmer";
  let isSoundEnabled = true;
  let audioContext = null;
  let pendingName = null;
  let pendingMobile = null;

  // Initialize Web Audio Context on first user gesture
  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  // Play pleasant WhatsApp-style dual chime notification sound
  function playNotificationSound() {
    if (!isSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Tone 1: E5 (659 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2: A5 (880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.24, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.48);
    } catch (e) {
      // Audio fallback silent
    }
  }

  // Get currently logged-in farmer from website storage
  function getLoggedInFarmer() {
    try {
      const raw = localStorage.getItem("kpm_user_data");
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (user && user.name && (user.role === "farmer" || !user.role)) {
        return user;
      }
    } catch (e) {}
    return null;
  }

  // Get guest farmer details entered inside chatbot
  function getGuestFarmer() {
    try {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return null;
      const guest = JSON.parse(raw);
      if (guest && guest.name && guest.mobile) {
        return guest;
      }
    } catch (e) {}
    return null;
  }

  function saveGuestFarmer(name, mobile) {
    const cleanName = (name || "").trim();
    const cleanMobile = (mobile || "").replace(/\D/g, "").slice(-10);
    const guestObj = { name: cleanName, mobile: cleanMobile };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestObj));
    } catch (e) {}
    pendingName = null;
    pendingMobile = null;
    return guestObj;
  }

  function clearGuestFarmer() {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (e) {}
    pendingName = null;
    pendingMobile = null;
  }

  // Determine current active farmer profile
  function getActiveFarmerProfile() {
    const loggedIn = getLoggedInFarmer();
    if (loggedIn) {
      return {
        isLoggedIn: true,
        name: loggedIn.name,
        mobile: loggedIn.mobile || "9876543210",
        farmerId: loggedIn.farmerId || "FMR1001",
        centre: loggedIn.preferredCentre || "सांवेर उपार्जन केंद्र (Sanwer Mandi)",
        crop: loggedIn.crop || "गेहूँ (Wheat)",
        bank: loggedIn.bankName
          ? `${loggedIn.bankName}${loggedIn.accountNumber ? ` (•••• ${String(loggedIn.accountNumber).slice(-4)})` : ""}`
          : "भारतीय स्टेट बैंक (SBI •••• 1928)"
      };
    }

    const guest = getGuestFarmer();
    if (guest) {
      return {
        isLoggedIn: false,
        isGuest: true,
        name: guest.name,
        mobile: guest.mobile,
        farmerId: `FMR-${guest.mobile.slice(-4)}`,
        centre: "सांवेर उपार्जन केंद्र (Sanwer Mandi)",
        crop: "गेहूँ (Wheat)",
        bank: `आधार लिंक बैंक खाता (+91 ${guest.mobile})`
      };
    }

    return null; // Not logged in and details not entered yet
  }

  // Update header title and subtitle based on farmer status
  function updateHeaderState() {
    const subtitleEl = document.getElementById("waHeaderSubtitle");
    const namePill = document.getElementById("waFarmerPill");
    const realWaLink = document.getElementById("openRealWhatsAppBtn");

    const profile = getActiveFarmerProfile();

    if (profile) {
      if (profile.isLoggedIn) {
        if (subtitleEl) {
          subtitleEl.innerHTML = `
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-right: 4px;"></span>
            <strong>${profile.name}</strong> | लॉग इन किसान ✓
          `;
        }
      } else {
        if (subtitleEl) {
          subtitleEl.innerHTML = `
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-right: 4px;"></span>
            <strong>${profile.name}</strong> (+91 ${profile.mobile})
          `;
        }
      }

      if (namePill) {
        namePill.style.display = "inline-flex";
        namePill.textContent = profile.name;
        namePill.title = `${profile.name} (+91 ${profile.mobile})`;
      }

      if (realWaLink) {
        const msg = encodeURIComponent(`नमस्ते! मैं ${profile.name} (मोबाइल: ${profile.mobile}), MandiSathi टोकन और खरीद जानकारी हेतु संपर्क कर रहा हूँ।`);
        realWaLink.href = `https://wa.me/?text=${msg}`;
      }
    } else {
      if (subtitleEl) {
        subtitleEl.innerHTML = `
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #facc15; margin-right: 4px;"></span>
          विवरण दर्ज करें (नाम व मोबाइल)
        `;
      }
      if (namePill) {
        namePill.style.display = "none";
      }
      if (realWaLink) {
        realWaLink.href = "https://wa.me/?text=Namaste";
      }
    }
  }

  // Core knowledge-base and dialog manager
  function getBotResponse(input) {
    const text = (input || "").trim();
    const lower = text.toLowerCase();
    const profile = getActiveFarmerProfile();

    // 1. Reset / Change details command
    if (
      lower === "reset" ||
      lower === "change" ||
      lower.includes("बदलें") ||
      lower.includes("नाम बदलें") ||
      lower.includes("नंबर बदलें") ||
      lower.includes("change name") ||
      lower === "logout bot"
    ) {
      if (profile && profile.isLoggedIn) {
        return {
          text: `🌾 *${profile.name} जी!* आप MandiSathi पोर्टल में सुरक्षित रूप से लॉग इन हैं।\n\nयदि आप अपनी प्रोफ़ाइल का नाम या विवरण बदलना चाहते हैं, तो कृपया ऊपर मेन्यू में '👤 प्रोफाइल' विकल्प पर जाएं।\n\nव्हाट्सएप पर अन्य सहायता के लिए निम्न विकल्प चुनें:`,
          chips: ["टोकन स्थिति", "मंडी भीड़", "MSP दरें", "भुगतान स्थिति"]
        };
      } else {
        clearGuestFarmer();
        updateHeaderState();
        return {
          text: `🔄 *विवरण रीसेट कर दिया गया है!*\n\nकृपया जानकारी देखने के लिए अपना नया **पूरा नाम** और **10 अंकों का मोबाइल नंबर** दर्ज करें:\n*(उदाहरण: 'रमेश पटेल 9876543210')*`,
          chips: ["रमेश पटेल 9876543210", "लॉगिन करें →"]
        };
      }
    }

    // 2. If farmer is NOT logged in and details NOT yet provided:
    if (!profile) {
      // Check for phone number pattern in the input
      const phoneMatch = text.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
      const textWithoutPhone = text
        .replace(/(?:\+91[\s-]?)?[6-9]\d{9}/g, "")
        .replace(/[,\-:|।]/g, " ")
        .trim();

      // Check if user clicked login link
      if (lower.includes("लॉगिन") || lower.includes("login")) {
        return {
          text: `🔑 *किसान पोर्टल लॉगिन*:\n\nयदि आप पहले से पंजीकृत किसान हैं, तो आप पोर्टल पर लॉगिन कर सकते हैं:\n👉 <a href="login.html" style="color: #16a34a; font-weight: bold; text-decoration: underline;">यहाँ क्लिक करके किसान लॉगिन करें</a>\n\nलॉगिन के बाद चैटबॉट में आपका नाम व टोकन सीधे दिखाई देंगे।\n\nया बिना लॉगिन के देखने हेतु नीचे अपना **नाम और मोबाइल नंबर** लिखें:`,
          chips: ["रमेश पटेल 9876543210", "सुरेश कुमार 9826012345"]
        };
      }

      // Case A: User entered BOTH name and 10-digit mobile in a single message!
      if (phoneMatch && textWithoutPhone.length >= 2) {
        const farmerName = textWithoutPhone;
        const farmerMobile = phoneMatch[1];
        saveGuestFarmer(farmerName, farmerMobile);
        updateHeaderState();

        return {
          text: `✅ *धन्यवाद ${farmerName} जी!*\n\nआपका मोबाइल नंबर (+91 ${farmerMobile}) सफलतापूर्वक सहेज लिया गया है।\n\nअब आप अपने नाम से जुड़ी सभी सरकारी खरीद व टोकन जानकारी देख सकते हैं:\n\n1️⃣ *टोकन* - डिजिटल टोकन पर्ची\n2️⃣ *मंडी भीड़* - लाइव कतार व प्रतीक्षा समय\n3️⃣ *एमएसपी* - न्यूनतम समर्थन मूल्य दरें 2026\n4️⃣ *भुगतान* - डीबीटी बैंक भुगतान स्थिति\n5️⃣ *स्लॉट* - तारीख व समय स्लॉट\n6️⃣ *दस्तावेज़* - मंडी के लिए आवश्यक कागजात\n7️⃣ *मदद* - किसान हेल्पलाइन`,
          chips: ["टोकन स्थिति", "मंडी भीड़", "MSP दरें", "भुगतान स्थिति", "स्लॉट समय", "नाम/नंबर बदलें"]
        };
      }

      // Case B: User already provided name earlier, and now provided only the phone number
      if (phoneMatch && pendingName) {
        const farmerName = pendingName;
        const farmerMobile = phoneMatch[1];
        saveGuestFarmer(farmerName, farmerMobile);
        updateHeaderState();

        return {
          text: `✅ *सत्यापन पूर्ण! नमस्ते ${farmerName} जी!*\n\nआपका मोबाइल नंबर (+91 ${farmerMobile}) दर्ज हो गया है।\n\nआप निम्न में से कौन सी जानकारी देखना चाहते हैं?`,
          chips: ["टोकन स्थिति", "मंडी भीड़", "MSP दरें", "भुगतान स्थिति", "स्लॉट समय", "नाम/नंबर बदलें"]
        };
      }

      // Case C: User entered only a 10-digit mobile number first
      if (phoneMatch && textWithoutPhone.length < 2) {
        pendingMobile = phoneMatch[1];
        return {
          text: `📱 मोबाइल नंबर *+91 ${pendingMobile}* दर्ज कर लिया गया है।\n\nकृपया अब अपना *शुभ नाम (Farmer Name)* लिखकर भेजें:\n*(उदाहरण: 'रमेश पटेल')*`,
          chips: ["रमेश पटेल", "सुरेश कुमार", "कैंसिल"]
        };
      }

      // Case D: User already entered mobile earlier, and now provided their name
      if (pendingMobile && text.length >= 2 && !phoneMatch) {
        const farmerName = text;
        const farmerMobile = pendingMobile;
        saveGuestFarmer(farmerName, farmerMobile);
        updateHeaderState();

        return {
          text: `✅ *स्वागत है ${farmerName} जी!*\n\nमोबाइल नंबर (+91 ${farmerMobile}) और नाम दर्ज हो चुका है।\n\nआप कौन सी जानकारी देखना चाहते हैं?`,
          chips: ["टोकन स्थिति", "मंडी भीड़", "MSP दरें", "भुगतान स्थिति", "स्लॉट समय", "नाम/नंबर बदलें"]
        };
      }

      // Case E: User entered a plausible name (not a command keyword)
      const commandKeywords = ["token", "queue", "msp", "payment", "slot", "help", "doc", "टोकन", "भीड़", "भाव", "रेट", "पेमेंट", "स्लॉट", "मदद", "कागज", "1", "2", "3", "4", "5", "6", "7"];
      const isCommand = commandKeywords.some(kw => lower === kw || lower.startsWith(kw + " "));

      if (!isCommand && text.length >= 2 && !phoneMatch && !pendingName && !text.includes("welcome")) {
        pendingName = text;
        return {
          text: `🌾 *नमस्ते ${pendingName} जी!*\n\nआपका नाम दर्ज कर लिया गया है।\n\nटोकन, मंडी कतार और भुगतान विवरण अनलॉक करने के लिए कृपया अब अपना **10 अंकों का मोबाइल नंबर** दर्ज करें:\n*(उदा: 9876543210)*`,
          chips: ["9876543210", "9826012345", "कैंसिल"]
        };
      }

      // Case F: User clicked on a query/button or asked for details WITHOUT providing name/mobile
      return {
        text: `🌾 *नमस्ते किसान भाई! MandiSathi व्हाट्सएप सहायक में आपका स्वागत है।*\n\n⚠️ *आवश्यक सूचना*: टोकन, मंडी भीड़, MSP व भुगतान संबंधी जानकारी देखने के लिए कृपया पहले अपना **पूरा नाम** और **10 अंकों का मोबाइल नंबर** दर्ज करें।\n\n👇 *नीचे अपना नाम और मोबाइल नंबर लिखें*:\n*(उदाहरण: 'रमेश पटेल 9876543210' या पहले सिर्फ अपना नाम लिखें)*`,
        chips: ["रमेश पटेल 9876543210", "🔑 पोर्टल लॉगिन करें"]
      };
    }

    // =========================================================================
    // 3. WHEN FARMER IS IDENTIFIED (Logged In OR Guest Details Provided)
    //    All responses prominently feature the farmer's name and mobile!
    // =========================================================================

    const farmerName = profile.name;
    const farmerMobile = profile.mobile;
    const tokenNum = profile.farmerId ? `TK-${profile.farmerId.replace(/\D/g, "") || "1042"}` : "TK-1042";

    // 3.1 Token Status (1, token, टोकन, pass)
    if (lower === "1" || lower.includes("token") || lower.includes("टोकन") || lower.includes("pass") || lower.includes("गेट") || lower.includes("gate")) {
      return {
        text: `🎫 *डिजिटल टोकन पर्ची (Token Slip)*:\n\n• *किसान का नाम*: *${farmerName}*\n• *पंजीकृत मोबाइल*: +91 ${farmerMobile}\n• *किसान आईडी*: ${profile.farmerId}\n• *टोकन नंबर*: *${tokenNum}*\n• *खरीद केंद्र*: ${profile.centre}\n• *दिनांक*: 12 सितंबर 2026\n• *समय स्लॉट*: 10:00 AM – 11:00 AM\n• *फसल*: ${profile.crop} (18 क्विंटल)\n• *गेट पास स्थिति*: सक्रिय (Active Gatepass) ✓\n\n📌 *नोट*: ${farmerName} जी, तौल कांटे पर मूल आधार कार्ड और टोकन पर्ची साथ रखें।`,
        chips: ["मंडी भीड़", "भुगतान स्थिति", "स्लॉट समय", "मुख्य मेन्यू"]
      };
    }

    // 3.2 Queue Status (2, queue, भीड़, wait, tractor)
    if (lower === "2" || lower.includes("queue") || lower.includes("भीड़") || lower.includes("वेट") || lower.includes("wait") || lower.includes("tractor") || lower.includes("कतार") || lower.includes("ट्रैक्टर")) {
      return {
        text: `🚜 *लाइव मंडी भीड़ व कतार स्थिति (Live Queue)*:\n\n• *किसान*: *${farmerName}* जी\n• *उपार्जन केंद्र*: ${profile.centre}\n• *कतार में ट्रैक्टर*: 14 वाहन\n• *अनुमानित प्रतीक्षा समय*: ~34 मिनट\n• *भीड़ स्तर*: मध्यम (Moderate) 🟡\n• *तौल कांटे*: 4/4 सक्रिय चालू हैं\n\n💡 *सलाह*: ${farmerName} जी, अपने निर्धारित स्लॉट (10:00 AM) से 15 मिनट पूर्व मंडी गेट नंबर 2 पर रिपोर्ट करें।`,
        chips: ["टोकन स्थिति", "स्लॉट समय", "भुगतान स्थिति", "मुख्य मेन्यू"]
      };
    }

    // 3.3 MSP Rates (3, msp, भाव, रेट, rate, मूल्य, price)
    if (lower === "3" || lower.includes("msp") || lower.includes("भाव") || lower.includes("रेट") || lower.includes("rate") || lower.includes("मूल्य") || lower.includes("price")) {
      return {
        text: `🌾 *न्यूनतम समर्थन मूल्य (Govt. MSP Rates 2026)*:\n\n*${farmerName}* जी के लिए सरकारी खरीद दरें:\n\n• *गेहूँ (Wheat)*: ₹2,425 / क्विंटल\n• *चना (Gram)*: ₹5,650 / क्विंटल\n• *सरसों (Mustard)*: ₹5,950 / क्विंटल\n• *जौ (Barley)*: ₹1,980 / क्विंटल\n• *मसूर (Lentil)*: ₹6,700 / क्विंटल\n\n✅ सीधे आपके आधार लिंक बैंक खाते में डीबीटी (DBT) द्वारा पारदर्शी भुगतान सुनिश्चित।`,
        chips: ["भुगतान स्थिति", "टोकन स्थिति", "मुख्य मेन्यू"]
      };
    }

    // 3.4 Payment & DBT Status (4, payment, पेमेंट, रुपये, dbt, खाता, bank)
    if (lower === "4" || lower.includes("payment") || lower.includes("पेमेंट") || lower.includes("रुपये") || lower.includes("dbt") || lower.includes("खाता") || lower.includes("bank")) {
      return {
        text: `💰 *भुगतान व डीबीटी स्थिति (Payment Status)*:\n\n• *लाभार्थी किसान*: *${farmerName}*\n• *पंजीकृत मोबाइल*: +91 ${farmerMobile}\n• *अपेक्षित राशि*: ₹45,000 (18 क्विंटल @ MSP ₹2,425)\n• *डीबीटी बैंक*: ${profile.bank}\n• *आधार सीडिंग*: ✓ सत्यापित एवं सक्रिय (Verified)\n• *भुगतान स्थिति*: प्रक्रियाधीन (Processing via PFMS)\n• *समय सीमा*: तौल सत्यापन के 3-7 कार्य दिवसों में सीधे बैंक खाते में जमा।`,
        chips: ["टोकन स्थिति", "दस्तावेज़", "मुख्य मेन्यू"]
      };
    }

    // 3.5 Slot & Schedule (5, slot, स्लॉट, time, समय, date, तारीख)
    if (lower === "5" || lower.includes("slot") || lower.includes("स्लॉट") || lower.includes("time") || lower.includes("समय") || lower.includes("date") || lower.includes("तारीख")) {
      return {
        text: `📅 *निर्धारित खरीद स्लॉट (Schedule Slot)*:\n\n• *किसान*: *${farmerName}*\n• *मोबाइल*: +91 ${farmerMobile}\n• *तारीख*: 12 सितंबर 2026\n• *समय*: 10:00 AM से 11:00 AM\n• *गेट नंबर*: गेट नं. 2 (फास्ट ट्रैक डिजिटल टोकन लेन)\n• *केंद्र*: ${profile.centre}\n\nकृपया टोकन बारकोड मोबाइल में या पर्ची के रूप में साथ रखें।`,
        chips: ["मंडी भीड़", "टोकन स्थिति", "मुख्य मेन्यू"]
      };
    }

    // 3.6 Required Documents (6, doc, कागज, दस्तावेज, paper)
    if (lower === "6" || lower.includes("doc") || lower.includes("कागज") || lower.includes("दस्तावेज") || lower.includes("paper")) {
      return {
        text: `📋 *मंडी आते समय आवश्यक दस्तावेज़ (Checklist)*:\n\n*${farmerName}* जी, कृपया मंडी आते समय ये दस्तावेज़ साथ रखें:\n\n1. मूल आधार कार्ड (Original Aadhaar Card)\n2. आधार लिंक बैंक पासबुक की प्रति (+91 ${farmerMobile})\n3. खसरा / भू-अभिलेख प्रति (B-1 / Land Record)\n4. मंडीसाथी डिजिटल टोकन पर्ची (मोबाइल या प्रिंट)`,
        chips: ["टोकन स्थिति", "हेल्पलाइन", "मुख्य मेन्यू"]
      };
    }

    // 3.7 Helpline (7, help, मदद, संपर्क, number, phone)
    if (lower === "7" || lower.includes("help") || lower.includes("मदद") || lower.includes("संपर्क") || lower.includes("number") || lower.includes("phone")) {
      return {
        text: `📞 *किसान हेल्पलाइन व सहायता केंद्र*:\n\n*${farmerName}* जी, किसी भी पूछताछ हेतु संपर्क करें:\n\n• *किसान कॉल सेंटर (टोल-फ्री)*: 1800-180-1551 (प्रातः 6 से रात्रि 10 बजे)\n• *सांवेर मंडी हेल्पडेस्क*: 0731-2854120\n• *ई-मेल*: support@mandisathi.gov.in\n• *व्हाट्सएप सहायता*: चालू (24x7)`,
        chips: ["टोकन स्थिति", "मंडी भीड़", "मुख्य मेन्यू"]
      };
    }

    // Default Greeting / Menu for Identified Farmer
    const authStatusText = profile.isLoggedIn ? "लॉग इन किसान ✓" : `मोबाइल: +91 ${farmerMobile}`;
    return {
      text: `🌾 *नमस्ते ${farmerName} जी! MandiSathi किसान सहायक में आपका स्वागत है।*\n\n(${authStatusText})\n\nआप क्या जानकारी देखना चाहते हैं?\n\n1️⃣ *टोकन* - डिजिटल टोकन और गेट पास\n2️⃣ *मंडी भीड़* - लाइव ट्रैक्टर कतार व प्रतीक्षा समय\n3️⃣ *एमएसपी* - न्यूनतम समर्थन मूल्य दरें 2026\n4️⃣ *भुगतान* - डीबीटी बैंक भुगतान स्थिति\n5️⃣ *स्लॉट* - तारीख व समय स्लॉट\n6️⃣ *दस्तावेज़* - मंडी के लिए आवश्यक कागजात\n7️⃣ *मदद* - किसान हेल्पलाइन नंबर`,
      chips: ["टोकन स्थिति", "मंडी भीड़", "MSP दरें", "भुगतान", "स्लॉट समय", profile.isLoggedIn ? "हेल्पलाइन" : "नाम/नंबर बदलें"]
    };
  }

  function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  }

  function appendMessage(sender, text, chips) {
    const chatBody = document.getElementById("waChatMessages");
    if (!chatBody) return;

    const timeStr = formatTime(new Date());
    const bubble = document.createElement("div");
    bubble.className = `wa-bubble ${sender}`;

    let formattedText = text.replace(/\n/g, "<br>");
    formattedText = formattedText.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

    bubble.innerHTML = `
      <div>${formattedText}</div>
      <div class="wa-bubble-time">
        <span>${timeStr}</span>
        ${sender === "user" ? '<span style="color: #34b7f1; font-size: 0.75rem;">✓✓</span>' : ""}
      </div>
    `;

    chatBody.appendChild(bubble);

    // Add quick prompt action chips if present
    if (chips && chips.length > 0) {
      const chipsContainer = document.createElement("div");
      chipsContainer.className = "wa-quick-actions";
      chips.forEach((chipText) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wa-chip-btn";
        btn.textContent = chipText;
        btn.addEventListener("click", () => {
          if (chipText === "🔑 पोर्टल पर लॉगिन करें" || chipText === "लॉगिन करें →") {
            window.location.href = "login.html";
            return;
          }
          handleUserInput(chipText);
        });
        chipsContainer.appendChild(btn);
      });
      chatBody.appendChild(chipsContainer);
    }

    chatBody.scrollTop = chatBody.scrollHeight;

    // Trigger audio notification for incoming bot messages
    if (sender === "bot") {
      playNotificationSound();
    }
  }

  function showTypingIndicator() {
    const chatBody = document.getElementById("waChatMessages");
    if (!chatBody) return null;

    const typingEl = document.createElement("div");
    typingEl.id = "waTypingIndicator";
    typingEl.className = "wa-bubble bot";
    typingEl.style.padding = "0.4rem 0.8rem";
    typingEl.style.width = "65px";
    typingEl.innerHTML = `
      <div style="display: flex; gap: 4px; align-items: center; justify-content: center; height: 16px;">
        <span class="wa-dot" style="animation: waPulse 1.2s infinite 0s;">●</span>
        <span class="wa-dot" style="animation: waPulse 1.2s infinite 0.2s;">●</span>
        <span class="wa-dot" style="animation: waPulse 1.2s infinite 0.4s;">●</span>
      </div>
    `;
    chatBody.appendChild(typingEl);
    chatBody.scrollTop = chatBody.scrollHeight;
    return typingEl;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("waTypingIndicator");
    if (el) el.remove();
  }

  function handleUserInput(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    // Sound context unlock on user click/tap
    getAudioContext();

    // Append user bubble
    appendMessage("user", trimmed);

    // Show bot typing
    showTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      const botResponse = getBotResponse(trimmed);
      appendMessage("bot", botResponse.text, botResponse.chips);
      updateHeaderState();
    }, 400);
  }

  function injectWhatsAppModal() {
    if (document.getElementById("waChatWidgetRoot")) return;

    const widgetHtml = `
      <div id="waChatWidgetRoot">
        <!-- Floating WhatsApp Launcher Button -->
        <button id="waLauncherBtn" class="wa-float-btn" aria-label="Open WhatsApp Assistant" title="MandiSathi WhatsApp Sahayak">
          <span style="font-size: 1.25rem;">💬</span>
          <span>WhatsApp Bot</span>
          <span class="wa-sound-badge" id="waSoundBadge" title="Sound notifications active">🔔</span>
        </button>

        <!-- WhatsApp Chat Window -->
        <div id="waChatWindow" class="wa-chat-window" role="dialog" aria-modal="true" aria-label="Meta WhatsApp Assistant">
          <!-- Card Header -->
          <div class="wa-chat-header">
            <div class="wa-header-info">
              <div class="wa-header-avatar">🌾</div>
              <div style="min-width: 0;">
                <div class="wa-header-title" style="display: flex; align-items: center; gap: 6px;">
                  <span>MandiSathi Kisan Bot</span>
                  <span id="waFarmerPill" style="display: none; background: #166534; font-size: 0.68rem; padding: 0.1rem 0.45rem; border-radius: 9999px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                </div>
                <div class="wa-header-subtitle" id="waHeaderSubtitle">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-right: 4px;"></span>
                  Online | किसान सहायक
                </div>
              </div>
            </div>
            <div class="wa-header-actions">
              <!-- Sound Toggle Button -->
              <button id="waSoundToggleBtn" class="wa-header-btn" title="Toggle notification sound" aria-label="Toggle Sound">
                <span id="waSoundIcon">🔔</span>
              </button>
              <button id="waCloseBtn" class="wa-header-btn" title="Close" aria-label="Close">✕</button>
            </div>
          </div>

          <!-- Messages Scroll Area -->
          <div class="wa-chat-body" id="waChatMessages">
            <!-- Initial welcome will be appended dynamically -->
          </div>

          <!-- Input Bar -->
          <div class="wa-input-container">
            <input
              type="text"
              id="waInputMessage"
              class="wa-input-box"
              placeholder="नाम, मोबाइल या सवाल लिखें..."
              autocomplete="off"
            />
            <button id="waSendBtn" class="wa-send-btn" aria-label="Send message" title="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>

          <!-- Footer Links: Official WhatsApp Cloud API Bridge -->
          <div class="wa-footer-links">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #10b981; font-weight: bold;">●</span>
              <span>Meta Cloud API Active</span>
            </div>
            <a
              id="openRealWhatsAppBtn"
              href="https://wa.me/?text=Namaste"
              target="_blank"
              rel="noopener noreferrer"
              class="wa-real-btn"
              title="Open Official WhatsApp App"
            >
              <span>📲 App में खोलें</span>
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", widgetHtml);
    initWidgetEvents();
    updateHeaderState();

    // Initial greeting based on state
    setTimeout(() => {
      const botResponse = getBotResponse("welcome");
      appendMessage("bot", botResponse.text, botResponse.chips);
      updateHeaderState();
    }, 200);
  }

  function initWidgetEvents() {
    const launcherBtn = document.getElementById("waLauncherBtn");
    const chatWindow = document.getElementById("waChatWindow");
    const closeBtn = document.getElementById("waCloseBtn");
    const sendBtn = document.getElementById("waSendBtn");
    const inputEl = document.getElementById("waInputMessage");
    const soundBtn = document.getElementById("waSoundToggleBtn");
    const soundIcon = document.getElementById("waSoundIcon");
    const soundBadge = document.getElementById("waSoundBadge");

    if (launcherBtn && chatWindow) {
      launcherBtn.addEventListener("click", () => {
        getAudioContext();
        chatWindow.classList.toggle("open");
        updateHeaderState();
        if (chatWindow.classList.contains("open") && inputEl) {
          setTimeout(() => inputEl.focus(), 150);
        }
      });
    }

    if (closeBtn && chatWindow) {
      closeBtn.addEventListener("click", () => {
        chatWindow.classList.remove("open");
      });
    }

    // Sound toggle
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        isSoundEnabled = !isSoundEnabled;
        if (soundIcon) soundIcon.textContent = isSoundEnabled ? "🔔" : "🔕";
        if (soundBadge) soundBadge.textContent = isSoundEnabled ? "🔔" : "🔕";
        if (isSoundEnabled) {
          playNotificationSound();
        }
      });
    }

    // Send action
    function doSend() {
      if (!inputEl) return;
      const text = inputEl.value;
      if (text.trim()) {
        handleUserInput(text);
        inputEl.value = "";
      }
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", doSend);
    }

    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSend();
        }
      });
    }
  }

  // Inject required responsive styles and animations
  function injectStyles() {
    if (document.getElementById("waWidgetInteractiveStyles")) return;
    const style = document.createElement("style");
    style.id = "waWidgetInteractiveStyles";
    style.textContent = `
      @keyframes waPulse {
        0%, 100% { opacity: 0.3; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.15); }
      }
      .wa-sound-badge {
        font-size: 0.8rem;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 2px;
      }
      .wa-dot {
        color: #10b981;
        font-size: 14px;
        display: inline-block;
      }
      @media (max-width: 640px) {
        .wa-float-btn {
          bottom: 16px !important;
          right: 16px !important;
          padding: 0.55rem 0.95rem !important;
          font-size: 0.85rem !important;
        }
        .wa-chat-window {
          bottom: 74px !important;
          right: 12px !important;
          width: calc(100vw - 24px) !important;
          height: min(500px, calc(100vh - 90px)) !important;
          border-radius: 14px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    injectWhatsAppModal();
  });
})();
