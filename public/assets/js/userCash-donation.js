document.addEventListener("DOMContentLoaded", async () => {
    await loadSidebar();
    
    requestAnimationFrame(() => {
        loadTopbar({
            title: "Donation",
            subtitle: "Support our shelter safely and securely through direct cash donations."
        });

        document.body.style.visibility = "visible";
    });

    let organizations = [];
    let selectedOrganization = null;
    
    const modal = document.getElementById("orgModal");
    const closeBtn = document.getElementById("modalClose");
    const closeBtn2 = document.getElementById("modalCloseBtn");

    const orgName = document.getElementById("modalOrgName");
    const orgAddress = document.getElementById("modalOrgAddress");
    const orgPhone = document.getElementById("modalOrgPhone");
    const orgEmail = document.getElementById("modalOrgEmail");
    const orgMission = document.getElementById("modalOrgMission");

    const donorNameInput = document.querySelector('input[placeholder="Name"]') || document.getElementById("donorName");
    const donorEmailInput = document.querySelector('input[placeholder="Email Address"]');
    
    const paymentMethodSelect = document.getElementById("paymentMethod");
    const accountNameLabel = document.getElementById("accountNameLabel");
    const accountNumberLabel = document.getElementById("accountNumberLabel");
    
    const gcashNameInput = document.getElementById("gcashNameInput");
    const refNumInput = document.getElementById("refNumInput");
    const amountInput = document.getElementById("customAmount");
    
    if (amountInput) {
        amountInput.addEventListener("input", function() {
            if (this.value < 0) {
                this.value = Math.abs(this.value);
            }
        });
        amountInput.addEventListener("keydown", function(e) {
            if (e.key === "-" || e.key === "Subtract") {
                e.preventDefault();
            }
        });
    }
    
    /* =========================================================
       QR MODAL — ROBUST HANDLING
       ========================================================= */
    const qrModal              = document.getElementById("qrModal");
    const qrModalClose         = document.getElementById("qrModalClose");
    const qrModalCloseBtn      = document.getElementById("qrModalCloseBtn");
    const modalQrImage         = document.getElementById("modalQrImage");
    const qrModalAccountName   = document.getElementById("qrModalAccountName");
    const qrModalAccountNumber = document.getElementById("qrModalAccountNumber");

    function openQrModal() {
        const qrImageEl   = document.getElementById("qrImage");
        const gcashNameEl = document.getElementById("gcashName");
        const gcashNumEl  = document.getElementById("gcashNumber");

        const qrImageSrc  = qrImageEl   ? (qrImageEl.src || "") : "";
        const nameText    = gcashNameEl ? gcashNameEl.textContent.trim() : "";
        const numberText  = gcashNumEl  ? gcashNumEl.textContent.trim()  : "";

        if (!qrImageSrc || qrImageSrc === "" || qrImageSrc.endsWith("#")) {
            showToast("No QR code available for this organization.", "error");
            return;
        }

        const method = paymentMethodSelect ? paymentMethodSelect.value : "GCash";

if (modalQrImage) {
    modalQrImage.src = qrImageSrc;   // fallback
    cropQrToSquare(qrImageSrc, method).then(cropped => {
        modalQrImage.src = cropped;
    });
}

if (qrModalAccountName)   qrModalAccountName.textContent   = nameText   || "N/A";
if (qrModalAccountNumber) qrModalAccountNumber.textContent = numberText || "N/A";
        if (qrModal) {
            qrModal.classList.add("active");
            qrModal.style.display = "flex";     // ← guarantees it shows
            document.body.style.overflow = "hidden";
        }
    }

    function closeQrModal() {
        if (qrModal) {
            qrModal.classList.remove("active");
            qrModal.style.display = "";          // ← reset inline style
            document.body.style.overflow = "";
        }
    }

    /* ✅ Event delegation — works even if button is re-rendered */
    document.addEventListener("click", function (e) {
        if (e.target.closest("#viewQrBtn")) {
            e.preventDefault();
            e.stopPropagation();
            openQrModal();
        }
    });

    if (qrModalClose)    qrModalClose.addEventListener("click", closeQrModal);
    if (qrModalCloseBtn) qrModalCloseBtn.addEventListener("click", closeQrModal);

    /* Click outside to close */
    if (qrModal) {
        qrModal.addEventListener("click", function (e) {
            if (e.target === qrModal) closeQrModal();
        });
    }

    /* Esc key closes QR modal */
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && qrModal && qrModal.classList.contains("active")) {
            closeQrModal();
        }
    });

    const privacyCheckbox = document.querySelector('input[type="checkbox"]');
    const receiptFileInput = document.querySelector('input[type="file"]');
    const submitBtn = document.getElementById("submitDonationBtn");

    async function fetchUserProfile() {
        try {
            const res = await fetch("/api/user/profile");
            if (res.ok) {
                const user = await res.json();
                
                if (donorNameInput && (user.first_name || user.last_name)) {
                    donorNameInput.value = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                    donorNameInput.readOnly = true;
                    donorNameInput.classList.add("bg-gray-100", "cursor-not-allowed");
                }
                
                if (donorEmailInput && user.email) {
                    donorEmailInput.value = user.email;
                    donorEmailInput.readOnly = true;
                    donorEmailInput.classList.add("bg-gray-100", "cursor-not-allowed");
                }
            }
        } catch (e) {
            console.log("Guest mode or user profile endpoint unavailable.");
        }
    }

    async function loadOrganizations() {
        try {
            const response = await fetch("/api/organizations");

            if (!response.ok) {
                throw new Error(`Failed to load organizations (${response.status})`);
            }

            const data = await response.json();

            const allOrganizations = Array.isArray(data)
            ? data
            : (data.organizations || data.data || []);

            // Ipakita lang ang mga org na may configured GCash o Maya na payment method
            organizations = allOrganizations.filter(org =>
                (org.gcash_number && org.gcash_number.trim() !== "") ||
                (org.maya_number && org.maya_number.trim() !== "")
            );

            const container = document.getElementById("orgContainer");
            if (!container) return;

            container.innerHTML = "";

            if (!organizations || organizations.length === 0) {
                container.innerHTML = `
                     <p class="text-gray-500 text-center col-span-3">
                        No organizations currently accept cash donations. Please check back later.
                    </p>
                `;
                return;
            }

            organizations.forEach(org => {
                console.log("ORG PROFILE PIC:", org.organization_name, org.profile_pic);
                
                const profileImg = getValidImageUrl(org.profile_pic, "https://via.placeholder.com/64","/uploads/orgs");

                container.innerHTML += `
                    <div
                        class="org-card border rounded-xl p-4 relative cursor-pointer flex flex-col items-center text-center justify-between"
                        data-id="${org.organization_id}"
                    >
                        <div
                            class="checkmark absolute top-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded-bl-lg"
                        >
                            ✓
                        </div>

                        <div class="w-full flex flex-col items-center">
                            <img
                                src="${profileImg}"
                                alt="${org.organization_name || 'Organization'}"
                                onerror="this.onerror=null; this.src='https://via.placeholder.com/64';"
                                class="w-16 h-16 rounded-full object-cover mb-3"
                            >
                            <h3 class="font-semibold text-gray-800 mb-2">
                                ${org.organization_name || "Organization"}
                            </h3>
                        </div>

                        <div class="w-full pt-2 border-t border-gray-100 mt-2">
                            <button type="button" class="view-profile-btn text-xs text-blue-600 hover:text-blue-800 font-medium transition inline-flex items-center gap-1 cursor-pointer">
                                View Profile →
                            </button>
                        </div>
                    </div>
                `;
            });

            initializeCards();

        } catch (error) {
            console.error("Error loading organizations:", error);
        }
    }

    function initializeCards() {
        document.querySelectorAll(".org-card").forEach(card => {
            card.addEventListener("click", function (e) {
                if (e.target.closest(".view-profile-btn")) return;

                document.querySelectorAll(".org-card").forEach(c => c.classList.remove("selected"));
                this.classList.add("selected");

                selectedOrganization = this.dataset.id;
                updateDonationInfo(selectedOrganization);
            });

            const viewBtn = card.querySelector(".view-profile-btn");
            if (viewBtn) {
                viewBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    openModal(card.dataset.id);
                });
            }
        });
    }

    function isValidQrPath(path) {
        if (!path || typeof path !== "string") return false;
        const trimmed = path.trim();
        return (
            trimmed !== "" && 
            trimmed !== "/uploads/qr" && 
            !trimmed.endsWith("/uploads/") &&
            !trimmed.endsWith("/null") &&
            !trimmed.endsWith("/undefined")
        );
    }

    function updateDonationInfo(id) {
        const org = organizations.find(o => String(o.organization_id) === String(id));

        const nameEl = document.getElementById("gcashName");
        const numEl = document.getElementById("gcashNumber");
        const qrEl = document.getElementById("qrImage");

        if (!org) {
            if (nameEl) nameEl.textContent = "Select an organization";
            if (numEl) numEl.textContent = "Select an organization";
            if (qrEl) qrEl.classList.add("hidden");
            return;
        }

        // Ipakita lang sa dropdown ang payment method na talagang naka-configure ng org
        const hasGcash = org.gcash_number && org.gcash_number.trim() !== "";
        const hasMaya = org.maya_number && org.maya_number.trim() !== "";

        if (paymentMethodSelect) {
            const previousValue = paymentMethodSelect.value;
            let optionsHtml = "";
            if (hasGcash) optionsHtml += `<option value="GCash">GCash</option>`;
            if (hasMaya) optionsHtml += `<option value="Maya">Maya</option>`;
            paymentMethodSelect.innerHTML = optionsHtml;

            // Panatilihin ang dating napili kung available pa rin ito, kung hindi, gamitin ang una sa listahan
            if (hasGcash && previousValue === "GCash") {
                paymentMethodSelect.value = "GCash";
            } else if (hasMaya && previousValue === "Maya") {
                paymentMethodSelect.value = "Maya";
            } else {
                paymentMethodSelect.value = paymentMethodSelect.options[0]?.value || "";
            }
        }

        const method = paymentMethodSelect ? paymentMethodSelect.value : "GCash";

        if (method === "Maya") {
            if (accountNameLabel) accountNameLabel.textContent = "Maya Account Name:";
            if (accountNumberLabel) accountNumberLabel.textContent = "Maya Number:";
            
            if (nameEl) nameEl.textContent = org.maya_name ? org.maya_name : "N/A";
            if (numEl) numEl.textContent = org.maya_number ? org.maya_number : "N/A";
            
            if (qrEl) {
                const qrUrl = getValidImageUrl(  org.maya_qr_code, "","/uploads/qr");
                if (qrUrl) {
                    qrEl.onerror = function () {
                        this.onerror = null;
                        this.classList.add("hidden");
                        showToast("The organization's Maya QR code could not be loaded.", "error");
                    };
                    qrEl.src = qrUrl;
                    qrEl.classList.remove("hidden");
                } else {
                    qrEl.onerror = null;
                    qrEl.removeAttribute("src");
                    qrEl.classList.add("hidden");
                }
            }
        } else {
            if (accountNameLabel) accountNameLabel.textContent = "GCASH Account Name:";
            if (accountNumberLabel) accountNumberLabel.textContent = "GCASH Number:";
            
            if (nameEl) nameEl.textContent = org.gcash_name ? org.gcash_name : "N/A";
            if (numEl) numEl.textContent = org.gcash_number ? org.gcash_number : "N/A";
            if (qrEl) {
                const qrUrl = getValidImageUrl( org.qr_code, "", "/uploads/qr");
                if (qrUrl) {
                    qrEl.onerror = function () {
                        this.onerror = null;
                        this.classList.add("hidden");
                        showToast("The organization's GCash QR code could not be loaded.", "error");
                    };
                    qrEl.src = qrUrl;
                    qrEl.classList.remove("hidden");
                } else {
                    qrEl.onerror = null;
                    qrEl.removeAttribute("src");
                    qrEl.classList.add("hidden");
                }
            }
        }
    }

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener("change", function() {
            if (selectedOrganization) {
                updateDonationInfo(selectedOrganization);
            }
        });
    }

    async function openModal(id) {
        const org = organizations.find(o => o.organization_id == id);
        if (!org || !modal) return;

        if (orgName) orgName.textContent = org.organization_name;
        if (orgAddress) orgAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${org.city || ''}, ${org.province || ''}`;
        if (orgPhone) orgPhone.textContent = org.contact_number || "N/A";
        if (orgEmail) orgEmail.textContent = org.email || "N/A";
        if (orgMission) orgMission.textContent = org.description || "No description available.";

        try {
            const response = await fetch(`/api/organizations/${id}`);
            if (response.ok) {
                const fullOrg = await response.json();
                
                if (orgName) orgName.textContent = fullOrg.organization_name || org.organization_name;
                if (orgAddress) {
                    const addressText = fullOrg.city && fullOrg.province 
                        ? `${fullOrg.city}, ${fullOrg.province}` 
                        : (fullOrg.address || `${org.city || ''}, ${org.province || ''}`);
                    orgAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${addressText}`;
                }
                if (orgPhone) orgPhone.textContent = fullOrg.contact_number || fullOrg.phone || "N/A";
                if (orgEmail) orgEmail.textContent = fullOrg.email || fullOrg.org_email || "N/A";
                if (orgMission) orgMission.textContent = fullOrg.description || fullOrg.mission || "No description available.";

                let logoElement = document.getElementById("modalOrgLogo");
                const logoPath = fullOrg.profile_pic || fullOrg.logo || fullOrg.avatar || fullOrg.image || org.profile_pic || org.logo;
                const validLogoUrl = getValidImageUrl(
                    logoPath,
                    "/uploads/default-org.png",
                    "/uploads/orgs"
                );

                if (logoElement && validLogoUrl) {
                    if (logoElement.tagName.toLowerCase() !== "img") {
                        const logoImage = document.createElement("img");
                        logoImage.id = "modalOrgLogo";
                        logoImage.alt = "Organization logo";
                        logoImage.className = "w-full h-full object-cover rounded-full";
                        logoElement.replaceWith(logoImage);
                        logoElement = logoImage;
                    }
                    logoElement.onerror = function () {
                        this.onerror = null;
                        const fallbackIcon = document.createElement("i");
                        fallbackIcon.id = "modalOrgLogo";
                        fallbackIcon.className = "fa-solid fa-building-user";
                        this.replaceWith(fallbackIcon);
                    };
                    logoElement.src = validLogoUrl;
                }
            }
        } catch (err) {
            console.error("Error fetching live organization profile:", err);
        }

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
         if (modal) {
            modal.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (closeBtn2) closeBtn2.addEventListener("click", closeModal);

    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    if (submitBtn) {
        submitBtn.addEventListener("click", async function (e) {
            e.preventDefault();

            if (!selectedOrganization) {
                showToast("Please select an organization to donate to.", "error");
                return;
            }
            
            const org = organizations.find(o => o.organization_id == selectedOrganization);
            const method = paymentMethodSelect ? paymentMethodSelect.value : "GCash";

            if (method === "Maya") {
                if (!org || !org.maya_number || org.maya_number.trim() === "") {
                    showToast("This organization hasn't provided Maya details yet.", "error");
                    return;
                }
            } else {
                if (!org || !org.gcash_number || org.gcash_number.trim() === "") {
                    showToast("This organization hasn't provided GCash details yet.", "error");
                    return;
                }
            }

            if (!donorNameInput || !donorNameInput.value.trim()) {
                showToast("Please enter your full name.", "error");
                return;
            }
            if (!donorEmailInput || !donorEmailInput.value.trim()) {
                showToast("Please enter your email address.", "error");
                return;
            }
            if (!refNumInput || !refNumInput.value.trim()) {
                showToast("Please enter the Reference Number.", "error");
                return;
            }
            const refNumPattern = /^(?=.*[0-9])[a-zA-Z0-9]{10,15}$/;
            if (!refNumPattern.test(refNumInput.value.trim())) {
                showToast("Reference number must be 10-15 characters (letters and numbers) and include at least one digit. Please check your receipt and try again.", "error");
                return;
            }
            if (!amountInput || !amountInput.value.trim() || parseFloat(amountInput.value) <= 0) {
                showToast("Please enter a valid donation amount greater than zero.", "error");
                return;
            }
            if (!receiptFileInput || !receiptFileInput.files.length) {
                showToast("Please upload your payment receipt.", "error");
                return;
            }
            if (privacyCheckbox && !privacyCheckbox.checked) {
                showToast("You must agree to the privacy terms before submitting.", "error");
                return;
            }

            const formData = new FormData();
            formData.append("organization_id", selectedOrganization);
            formData.append("donor_name", donorNameInput.value.trim());
            formData.append("donor_email", donorEmailInput.value.trim());
            formData.append("payment_method", method);
            const accountNameValue = gcashNameInput ? gcashNameInput.value.trim() : "";
            if (accountNameValue) {
                formData.append("gcash_account_name", accountNameValue);
            }
            formData.append("reference_number", refNumInput.value.trim());
            formData.append("amount", amountInput.value.trim());
            formData.append("receipt", receiptFileInput.files[0]);

            const originalBtnText = submitBtn.textContent;

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submitting...";

                const res = await fetch("/api/user/donation/cash", {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (data.success) {
                    showToast(data.message || "Thank you! Your donation was submitted successfully.", "success");
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast(data.error || data.message || "Unable to process donation.", "error");
                }
            } catch (err) {
                console.error("Submission Error:", err);
                showToast("An error occurred while connecting to the server.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    if (receiptFileInput) {
        receiptFileInput.addEventListener("change", function() {
            if (this.files.length > 0) {
                const fileNameSpan = document.getElementById("receiptFileName");
                if (fileNameSpan) {
                    fileNameSpan.textContent = `Selected: ${this.files[0].name}`;
                    fileNameSpan.classList.add("text-blue-600", "font-medium");
                }
            }
        });
    }

    if (receiptFileInput) {
        receiptFileInput.addEventListener("change", handleReceiptUpload);
    }
    
    await fetchUserProfile();
    await loadOrganizations();

    if (organizations.length > 0) {
        const targetOrg = organizations.find(o => o.qr_code && o.qr_code.trim() !== "") || organizations[0];
        
        selectedOrganization = targetOrg.organization_id;
        updateDonationInfo(selectedOrganization);

        const targetCard = document.querySelector(`.org-card[data-id="${selectedOrganization}"]`);
        if (targetCard) {
            targetCard.classList.add("selected");
        }
    }
});

function showToast(message, type = "error") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const isSuccess = type === "success";
    const bgColor = isSuccess ? "bg-emerald-600" : "bg-rose-600";
    const iconClass = isSuccess ? "fa-circle-check" : "fa-circle-exclamation";

    const toast = document.createElement("div");
    toast.className = `${bgColor} text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 transform translate-y-5 opacity-0 pointer-events-auto max-w-md`;
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} text-lg"></i>
        <span class="text-sm font-medium leading-snug">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-auto text-white/70 hover:text-white p-1">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-5", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("translate-y-5", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getValidImageUrl(imagePath, fallbackUrl = "", legacyFolder = "/uploads/") {
    if (typeof imagePath !== "string") {
        return fallbackUrl;
    }
    const image = imagePath.trim();
    if (!image || image === "null" || image === "undefined") {
        return fallbackUrl;
    }

    const cloudinaryMatch = image.match(/https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/i);
    if (cloudinaryMatch) {
        return cloudinaryMatch[0];
    }
    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    const localPath = image.replace(/\\/g, "/");
    if (localPath.startsWith("/")) {
        return localPath;
    }
    if (localPath.startsWith("uploads/")) {
        return `/${localPath}`;
    }
    return `${legacyFolder.replace(/\/+$/, "")}/${encodeURIComponent(localPath)}`;
}
    if (receiptInput) {
        receiptInput.addEventListener("change", handleReceiptUpload);
    }
 async function handleReceiptUpload(event) {
    const file = event.target.files[0];

    // Walang file na pinili → clear preview at wag magpatuloy
    if (!file) {
        const preview = document.getElementById("receiptPreview");
        const wrap    = document.getElementById("receiptPreviewWrap");
        if (preview) preview.src = "";
        if (wrap) wrap.classList.add("hidden");
        return;
    }

    // ⭐ STRICT VALIDATION — JPEG at PNG lang
    const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png"
    ];
    const allowedExtensions = /\.(jpe?g|png)$/i;
    const MAX_SIZE_MB = 5;

    const isMimeAllowed = allowedMimeTypes.includes((file.type || "").toLowerCase());
    const isExtAllowed  = allowedExtensions.test(file.name);

    if (!isMimeAllowed && !isExtAllowed) {
        showToast(
            "Invalid file type. Please upload a JPG, JPEG, or PNG image only.",
            "error"
        );
        event.target.value = "";   // ⭐ reset input

        // Reset preview at status
        const preview = document.getElementById("receiptPreview");
        const wrap    = document.getElementById("receiptPreviewWrap");
        if (preview) preview.src = "";
        if (wrap) wrap.classList.add("hidden");

        const fileNameEl = document.getElementById("receiptFileName");
        if (fileNameEl) {
            fileNameEl.textContent = "Accepted file type: JPG, JPEG, PNG (max 5MB)";
            fileNameEl.classList.remove("text-blue-600", "font-medium");
            fileNameEl.classList.add("text-gray-500");
        }
        return;
    }

    // ⭐ Size check
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`, "error");
        event.target.value = "";

        const fileNameEl = document.getElementById("receiptFileName");
        if (fileNameEl) {
            fileNameEl.textContent = "Accepted file type: JPG, JPEG, PNG (max 5MB)";
            fileNameEl.classList.remove("text-blue-600", "font-medium");
            fileNameEl.classList.add("text-gray-500");
        }
        return;
    }

    // ⭐ UNLOCK muna — para ma-refill ng bagong OCR
    unlockOcrFields();

    // Show filename
    const fileNameEl = document.getElementById("receiptFileName");
    if (fileNameEl) {
        fileNameEl.textContent = `Selected: ${file.name}`;
        fileNameEl.classList.add("text-blue-600", "font-medium");
        fileNameEl.classList.remove("text-gray-500");
    }

    // 1) Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById("receiptPreview");
        const wrap    = document.getElementById("receiptPreviewWrap");
        if (preview && wrap) {
            preview.src = e.target.result;
            wrap.classList.remove("hidden");
        }
    };
    reader.readAsDataURL(file);

    // 2) Run OCR (naglo-lock ito pagkatapos)
    await runReceiptOCR(file);
}

async function runReceiptOCR(file) {
    const statusBox  = document.getElementById("ocrStatus");
    const statusText = document.getElementById("ocrStatusText");

    if (statusBox) {
        statusBox.classList.remove("hidden");
        statusBox.classList.add("flex");
    }
    if (statusText) statusText.textContent = "Scanning receipt...";

    try {
        if (!window.Tesseract) throw new Error("Tesseract.js not loaded");

        // --- Upscale first (GCash screenshots are tiny) ---
        const enhanced = await upscaleImageForOcr(file, 1600);

        const result = await Tesseract.recognize(enhanced, "eng", {
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1",
            logger: (m) => {
                if (m.status === "recognizing text" && statusText) {
                    statusText.textContent =
                        `Scanning receipt... ${Math.round((m.progress || 0) * 100)}%`;
                }
            }
        });

        const text = result?.data?.text || "";
        console.log("[OCR raw text]\n---\n" + text + "\n---");

        const parsed  = parseReceiptText(text);
        const result2 = fillReceiptFields(parsed);

        // ⭐ I-LOCK ang mga na-auto-fill na fields
        if (result2.filled > 0 || result2.corrected > 0) {
            lockOcrFilledFields(parsed);
        }

        if (statusText) {
            if (result2.corrected > 0) {
                statusText.textContent =
                    `Receipt scanned ✓ Corrected ${result2.corrected} field${result2.corrected > 1 ? "s" : ""} to match the receipt. Please double-check.`;
            } else if (result2.filled > 0) {
                statusText.textContent =
                    `Receipt scanned ✓ Auto-filled ${result2.filled} field${result2.filled > 1 ? "s" : ""}. Please double-check.`;
            } else {
                statusText.textContent =
                    "Receipt scanned — no matching details found. Please fill in manually.";
            }
        }
    } catch (err) {
        console.error("OCR error:", err);
        if (statusText) statusText.textContent =
            "Could not read the receipt. Please fill in the details manually.";
    } finally {
        setTimeout(() => {
            if (statusBox) {
                statusBox.classList.add("hidden");
                statusBox.classList.remove("flex");
            }
        }, 4000);
    }
}
// ==========================================
// OCR FIELD LOCKING (user side)
// ==========================================
function lockOcrFilledFields(parsed) {
    const fields = [
        { el: document.getElementById("refNumInput"),  has: !!parsed.reference },
        { el: document.getElementById("customAmount"),  has: !!parsed.amount    }
    ];

    fields.forEach(({ el, has }) => {
        if (!el || !has) return;
        if (!el.value || el.value.trim() === '') return;

        el.readOnly = true;
        el.dataset.ocrLocked = 'true';
        el.classList.add('bg-gray-100', 'cursor-not-allowed');
        el.title = 'Auto-filled from your receipt — cannot be edited. Re-upload a receipt to change.';
    });
}

function unlockOcrFields() {
    const fields = [
        document.getElementById("refNumInput"),
        document.getElementById("customAmount")
    ];

    fields.forEach(el => {
        if (!el) return;
        if (el.dataset.ocrLocked === 'true') {
            el.readOnly = false;
            delete el.dataset.ocrLocked;
            el.classList.remove('bg-gray-100', 'cursor-not-allowed');
            el.removeAttribute('title');
        }
    });
}
function parseReceiptText(text) {
    const out = { reference: "", amount: "", name: "" };

    const raw   = String(text).replace(/\r/g, "").trim();
    const flat  = raw.replace(/[ \t]+/g, " ");
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

    const fixDigits = (s) => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");

    const looksLikePhone = (numStr) => {
        const n = String(numStr).replace(/\D/g, "");
        if (/^09\d{9}$/.test(n))   return true;
        if (/^639\d{9}$/.test(n))  return true;
        if (/^63\d{10}$/.test(n))  return true;
        return false;
    };

    // STEP 1: Ref No. label
    const refLabelRx = /ref(?:erence)?\.?\s*(?:no\.?|number|num\.?|#)?/gi;
    let m;
    while ((m = refLabelRx.exec(flat)) !== null) {
        const after = flat.substring(m.index + m[0].length, m.index + m[0].length + 40);
        const normalized = fixDigits(after).replace(/[\s\-]/g, "");
        const dm = normalized.match(/^(\d{10,16})/);
        if (dm && !looksLikePhone(dm[1])) {
            out.reference = dm[1];
            break;
        }
    }

    // STEP 2: Spaced 3-3-3-3 / 3-3-3-4
    if (!out.reference) {
        const spaced = [...flat.matchAll(/\b(\d{3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]\d{3,4})\b/g)];
        for (let i = spaced.length - 1; i >= 0; i--) {
            const cleaned = fixDigits(spaced[i][1]).replace(/[\s\-]/g, "");
            if (!looksLikePhone(cleaned)) {
                out.reference = cleaned;
                break;
            }
        }
    }

    // STEP 3: Solid 12–15 digits, last match
    if (!out.reference) {
        const solid = [...flat.matchAll(/\b(\d{12,15})\b/g)];
        for (let i = solid.length - 1; i >= 0; i--) {
            if (!looksLikePhone(solid[i][1])) {
                out.reference = solid[i][1];
                break;
            }
        }
    }

    // STEP 4: Scan lines from bottom
    if (!out.reference) {
        for (let i = lines.length - 1; i >= 0; i--) {
            const cleaned = fixDigits(lines[i]).replace(/[\s\-]/g, "");
            const dm = cleaned.match(/(\d{10,16})/);
            if (dm && !looksLikePhone(dm[1])) {
                out.reference = dm[1];
                break;
            }
        }
    }

    // Amount
    const amountPatterns = [
        /(?:total\s+amount\s+sent|amount\s+sent|total\s+amount|amount|total)\s*[:\-]?\s*(?:php|₱|p)?\s*([\d,]+\.\d{2})/i,
        /(?:php|₱)\s*([\d,]+\.?\d{0,2})/i,
        /\bp\s*([\d,]+\.\d{2})\b/i,
        /([\d,]+\.\d{2})/
    ];
    for (const rx of amountPatterns) {
        const mt = flat.match(rx);
        if (mt && mt[1]) {
            out.amount = mt[1].replace(/,/g, "").trim();
            break;
        }
    }

    console.log("[OCR parsed]", out);
    return out;
}

function fillReceiptFields(parsed) {
    // ⭐ Adapted para sa cash-donation.html field IDs
    const refInput    = document.getElementById("refNumInput");
    const amountInput = document.getElementById("customAmount");
    const donorInput  = document.querySelector('input[placeholder="Name"]') || document.getElementById("donorName");

    let filled = 0;
    let corrected = 0;

    // Reference Number
    if (parsed.reference && refInput) {
        const typed = (refInput.value || "").replace(/\s/g, "").trim();
        const ocr   = parsed.reference.replace(/\s/g, "").trim();

        if (!typed) {
            refInput.value = ocr;
            highlightOcrField(refInput, "blue");
            filled++;
        } else if (typed !== ocr) {
            refInput.value = ocr;
            highlightOcrField(refInput, "orange");
            corrected++;
            console.warn(`[OCR] Ref mismatch: "${typed}" → "${ocr}"`);
        }
    }

    // Amount
    if (parsed.amount && amountInput) {
        const typed    = String(amountInput.value || "").trim();
        const ocr      = String(parsed.amount).trim();
        const typedNum = typed ? parseFloat(typed) : NaN;
        const ocrNum   = parseFloat(ocr);

        if (!typed) {
            amountInput.value = ocr;
            highlightOcrField(amountInput, "blue");
            filled++;
        } else if (!isNaN(ocrNum) && typedNum !== ocrNum) {
            amountInput.value = ocr;
            highlightOcrField(amountInput, "orange");
            corrected++;
            console.warn(`[OCR] Amount mismatch: "${typed}" → "${ocr}"`);
        }
    }

    // Your Name (fill only if blank — hindi kino-correct, at readonly kasi)
    if (parsed.name && donorInput && !donorInput.value) {
        donorInput.value = parsed.name;
        highlightOcrField(donorInput, "blue");
        filled++;
    }

    return { filled, corrected };
}
function highlightOcrField(el, color = "blue") {
    if (!el) return;

    const palette = {
        blue:   { bg: "#eef7ff", border: "#0151ff" },
        orange: { bg: "#fff7ed", border: "#f97316" }
    };
    const c = palette[color] || palette.blue;

    el.style.transition = "background-color .3s, border-color .3s";
    el.style.backgroundColor = c.bg;
    el.style.borderColor = c.border;
    setTimeout(() => {
        el.style.backgroundColor = "";
        el.style.borderColor = "";
    }, 2600);
}

function upscaleImageForOcr(file, maxWidth = 1600) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const scale = Math.max(1, Math.min(3, maxWidth / img.width));
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(b => resolve(b || file), "image/png");
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

// Reset receipt preview + OCR status after successful submission
const previewWrap = document.getElementById("receiptPreviewWrap");
if (previewWrap) previewWrap.classList.add("hidden");

const preview = document.getElementById("receiptPreview");
if (preview) preview.src = "";

const statusBox = document.getElementById("ocrStatus");
if (statusBox) {
    statusBox.classList.add("hidden");
    statusBox.classList.remove("flex");
}

const fileNameEl = document.getElementById("receiptFileName");
if (fileNameEl) {
    // ⭐ UPDATED — JPG, JPEG, PNG lang
    fileNameEl.textContent = "Accepted file type: JPG, JPEG, PNG (max 5MB)";
}

/* =========================================================
   GLOBAL QR MODAL — BULLETPROOF (works even if DOMContentLoaded fails)
   ========================================================= */
(function () {
    function initQrHandlers() {
        console.log("[QR] Initializing global handlers...");

        // Global open function — callable via onclick="openQRCodeModal(event)"
        window.openQRCodeModal = function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            console.log("[QR] openQRCodeModal CALLED ✓");

            const modal    = document.getElementById("qrModal");
            const mainImg  = document.getElementById("qrImage");
            const nameEl   = document.getElementById("gcashName");
            const numEl    = document.getElementById("gcashNumber");
            const modalImg = document.getElementById("modalQrImage");
            const modalNm  = document.getElementById("qrModalAccountName");
            const modalNo  = document.getElementById("qrModalAccountNumber");

            if (!modal) {
                console.error("[QR] ❌ #qrModal NOT FOUND");
                return;
            }

            const src = mainImg ? String(mainImg.src || "").trim() : "";
            console.log("[QR] src =", src);

            if (!src || src === "" || src.endsWith("#")) {
                if (typeof window.showToast === "function") {
                    window.showToast("No QR code available for this organization.", "error");
                } else {
                    alert("No QR code available.");
                }
                return;
            }

                            // ⭐ Detect payment method para tamang crop
            const methodSelect = document.getElementById("paymentMethod");
            const currentMethod = methodSelect ? methodSelect.value : "GCash";

            // ⭐ I-crop MUNA bago ipakita — walang fallback, walang glitch
            if (modalImg) {
                modalImg.style.opacity = "0";
                cropQrToSquare(src, currentMethod).then(cropped => {
                    modalImg.src = cropped;
                    modalImg.style.opacity = "1";
                });
            }

            if (modalNm)  modalNm.textContent = (nameEl && nameEl.textContent.trim()) || "N/A";
            if (modalNo)  modalNo.textContent = (numEl  && numEl.textContent.trim())  || "N/A";

                modal.classList.add("active");
            modal.style.cssText = `
                display: flex !important;
                position: fixed !important;
                inset: 0 !important;
                background: rgba(0,0,0,0.5) !important;
                z-index: 99999 !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1rem !important;
            `;
            document.body.style.overflow = "hidden";
            console.log("[QR] ✅ MODAL SHOWN");
        };

        window.closeQRCodeModal = function () {
            const modal = document.getElementById("qrModal");
            if (!modal) return;
            modal.classList.remove("active");
            modal.style.cssText = "";
            document.body.style.overflow = "";
            console.log("[QR] Modal closed");
        };

        // Delegated click — works even if button is re-rendered
        document.addEventListener("click", function (e) {
            if (e.target.closest("#viewQrBtn")) {
                e.preventDefault();
                e.stopPropagation();
                window.openQRCodeModal(e);
                return;
            }
            if (e.target.closest("#qrModalClose") || e.target.closest("#qrModalCloseBtn")) {
                window.closeQRCodeModal();
                return;
            }
            const modal = document.getElementById("qrModal");
            if (modal && e.target === modal) {
                window.closeQRCodeModal();
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") window.closeQRCodeModal();
        });

        console.log("[QR] ✅ Global handlers installed");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initQrHandlers);
    } else {
        initQrHandlers();
    }
})();
function cropQrToSquare(src, method = "gcash") {
    return new Promise((resolve) => {
        if (!src) { resolve(src); return; }

        const img = new Image();
        // ⭐ WALANG crossOrigin — same-origin ang mga images, kailangan ito para gumana ang canvas
        // img.crossOrigin = "anonymous";

        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const ratio = w / h;

            let cropX = 0, cropY = 0, cropW = w, cropH = h;

            if (ratio < 0.95) {
                let widthPct, topPct, bottomPct;

                if (String(method).toLowerCase().includes("maya")) {
                    // Maya: QR is in lower-middle, after green header + logo + name + phone
                    widthPct  = 0.72;
                    topPct    = 0.36;   // ⭐ Start below name/phone
                    bottomPct = 0.72;   // ⭐ End before "Transfer fees may apply"
                } else {
                    // GCash: QR is in upper area, right after blue header bar
                    widthPct  = 0.60;
                    topPct    = 0.22;   // ⭐ Taasan para laktawan ang blue bar
                    bottomPct = 0.46;
                }

                // Compute crop region
                cropW = w * widthPct;
                cropX = (w - cropW) / 2;
                cropY = h * topPct;
                cropH = (h * bottomPct) - cropY;

                // ⭐ Force SQUARE — pantay ang lapad at taas
                const size = Math.max(cropW, cropH);
                cropW = size;
                cropH = size;

                // ⭐ Re-center sa original crop center Y
                const originalCenterY = (h * topPct) + ((h * bottomPct) - (h * topPct)) / 2;
                cropX = (w - cropW) / 2;
                cropY = originalCenterY - (cropH / 2);

                // ⭐ Clamp sa image bounds
                if (cropY < 0) cropY = 0;
                if (cropY + cropH > h) cropY = h - cropH;
                if (cropX < 0) cropX = 0;
                if (cropX + cropW > w) cropX = w - cropW;
            }

            // ⭐ Output — 600×600 square PNG
            const outSize = 600;
            const canvas = document.createElement("canvas");
            canvas.width  = outSize;
            canvas.height = outSize;
            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, outSize, outSize);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outSize, outSize);

            try {
                resolve(canvas.toDataURL("image/png"));
            } catch (e) {
                console.warn("[QR Crop] Canvas export failed:", e);
                resolve(src);
            }
        };

        img.onerror = (e) => {
            console.warn("[QR Crop] Image load failed:", e);
            resolve(src);
        };
        img.src = src;
    });
}