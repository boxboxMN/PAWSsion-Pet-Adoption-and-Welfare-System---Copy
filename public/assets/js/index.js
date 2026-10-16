
let organizationsData = [];
let currentQrSrc = "";        
let currentQrOrgName = "";    
let currentQrMethod = "";     
// ==========================================
// ⭐ IN-KIND CATEGORY → ALLOWED UNITS
// ==========================================
const INKIND_CATEGORY_UNITS = {
    "Food & Treats":          ["kg", "sacks", "packs", "boxes", "cans", "pcs"],
    "Toys":                   ["pcs", "packs", "boxes", "sets"],
    "Medicine & Health":      ["bottles", "boxes", "packs", "pcs", "tubes"],
    "Grooming & Hygiene":     ["bottles", "packs", "pcs", "liters"],
    "Accessories & Supplies": ["pcs", "packs", "boxes", "sets"],
    "Bedding & Housing":      ["pcs", "packs", "boxes"],
    "Other":                  ["pcs", "kg", "packs", "boxes", "sacks", "bottles", "liters"]
};

const INKIND_CATEGORY_PLACEHOLDERS = {
    "Food & Treats":          "e.g., Dry dog food, Cat treats, Canned tuna",
    "Toys":                   "e.g., Chew toy, Cat teaser, Rubber ball",
    "Medicine & Health":      "e.g., Deworming tablets, Vitamins, Antibiotic ointment",
    "Grooming & Hygiene":     "e.g., Pet shampoo, Litter sand, Flea spray",
    "Accessories & Supplies": "e.g., Leash, Collar, Food bowl, Pet cage",
    "Bedding & Housing":      "e.g., Pet bed, Blanket, Crate mat",
    "Other":                  "e.g., Any pet supply item"
};

// ⭐ Repopulate unit dropdown + unlock item name when category changes
function applyInkindCategoryRules() {
    const categorySelect = document.getElementById("inkindCategory");
    const unitSelect     = document.getElementById("inkindUnit");
    const itemInput      = document.getElementById("inkindItemName");

    if (!categorySelect || !unitSelect || !itemInput) return;

    const category = categorySelect.value;

    // ---- Reset unit dropdown ----
    unitSelect.innerHTML = "";

    if (!category || !INKIND_CATEGORY_UNITS[category]) {
        unitSelect.disabled = true;
        unitSelect.innerHTML = `<option value="">-- Select category first --</option>`;

        itemInput.disabled = true;
        itemInput.placeholder = "Select a category first...";
        itemInput.value = "";
        return;
    }

    // ---- Populate units for the chosen category ----
    unitSelect.disabled = false;
    unitSelect.innerHTML = `<option value="">-- Select unit --</option>`;
    INKIND_CATEGORY_UNITS[category].forEach(u => {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = u;
        unitSelect.appendChild(opt);
    });

    // ---- Unlock item input + set placeholder ----
    itemInput.disabled = false;
    itemInput.placeholder = INKIND_CATEGORY_PLACEHOLDERS[category] || "Enter item name";
    itemInput.value = "";
}

// Attach listener after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("inkindCategory");
    if (categorySelect) {
        categorySelect.addEventListener("change", applyInkindCategoryRules);
        applyInkindCategoryRules(); // run once at start
    }
});
// ==========================================
// CUSTOM MESSAGE BOX
// ==========================================

const messageBox = document.getElementById("messageBox");
const messageIcon = document.getElementById("messageIcon");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");
const messageCancelBtn = document.getElementById("messageCancelBtn");
const messageConfirmBtn = document.getElementById("messageConfirmBtn");

let messageResolver = null;

const messageStyles = {
    success: {
        title: "Success",
        icon: "fa-check",
        iconBg: "bg-emerald-100",
        iconText: "text-emerald-600"
    },
    error: {
        title: "Error",
        icon: "fa-xmark",
        iconBg: "bg-red-100",
        iconText: "text-red-600"
    },
    warning: {
        title: "Warning",
        icon: "fa-exclamation",
        iconBg: "bg-amber-100",
        iconText: "text-amber-600"
    },
    info: {
        title: "Information",
        icon: "fa-info",
        iconBg: "bg-blue-100",
        iconText: "text-blue-600"
    }
};

function openMessageBox() {
    if (!messageBox) return;

    messageBox.classList.remove("hidden");
    messageBox.classList.add("flex");
    messageBox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeMessageBox(result = false) {
    if (!messageBox) return;

    if (document.activeElement && messageBox.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    messageBox.classList.remove("flex");
    messageBox.classList.add("hidden");
    messageBox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (messageResolver) {
        messageResolver(result);
        messageResolver = null;
    }
}
function showMessage(message, type = "info") {
    return new Promise((resolve) => {
        if (!messageBox) {
            resolve(false);
            return;
        }

        messageResolver = resolve;

        const style = messageStyles[type] || messageStyles.info;

        messageTitle.textContent = style.title;
        messageText.textContent = message;

        messageIcon.className =
            `mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${style.iconBg}`;

        messageIcon.innerHTML =
            `<i class="fa-solid ${style.icon} text-2xl ${style.iconText}"></i>`;

        messageCancelBtn.classList.add("hidden");

        messageConfirmBtn.textContent = "OK";
        messageConfirmBtn.className =
            "flex-1 rounded-xl bg-[#0151ff] px-5 py-3 font-semibold text-white transition hover:bg-[#003fe0]";

        openMessageBox();
    });
}

function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        if (!messageBox) {
            resolve(false);
            return;
        }

        messageResolver = resolve;

        messageTitle.textContent = options.title || "Are you sure?";
        messageText.textContent = message;

        messageIcon.className =
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100";

        messageIcon.innerHTML =
            '<i class="fa-solid fa-question text-2xl text-amber-600"></i>';

        messageCancelBtn.classList.remove("hidden");
        messageCancelBtn.textContent = "Cancel";

        messageConfirmBtn.textContent = options.confirmText || "Confirm";

        messageConfirmBtn.className = options.danger
            ? "flex-1 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            : "flex-1 rounded-xl bg-[#0151ff] px-5 py-3 font-semibold text-white transition hover:bg-[#003fe0]";

        openMessageBox();
    });
}

if (messageConfirmBtn) {
    messageConfirmBtn.addEventListener("click", () => {
        closeMessageBox(true);
    });
}

if (messageCancelBtn) {
    messageCancelBtn.addEventListener("click", () => {
        closeMessageBox(false);
    });
}

if (messageBox) {
    messageBox.addEventListener("click", (event) => {
        if (event.target === messageBox) {
            closeMessageBox(false);
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && messageBox?.classList.contains("flex")) {
        closeMessageBox(false);
    }
});
document.addEventListener("DOMContentLoaded", () => {
    fetchOrganizationsData();
     startStatsPolling();

      const donationForm = document.getElementById("donationForm");
    if (donationForm) {
        donationForm.addEventListener("submit", handlePublicDonationSubmit);
    }

    const receiptInput = document.getElementById("receiptInput");
    if (receiptInput) {
        receiptInput.addEventListener("change", handleReceiptUpload);
    }
    // ⭐ Amount — whole numbers only (no decimals, no negatives)
    const amountInput = document.getElementById("donationAmountInput")
        || document.querySelector('#donationForm input[name="amount"]');

    if (amountInput) {
        amountInput.addEventListener("input", function () {
            // Strip anything that isn't a digit
            this.value = this.value.replace(/[^0-9]/g, "");
            // Block 0
            if (this.value === "0") this.value = "";
        });
        amountInput.addEventListener("keydown", function (e) {
            const blockedKeys = ["-", ".", "e", "E", "+", "Subtract", "Decimal"];
            if (blockedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
        amountInput.addEventListener("paste", function (e) {
            const pasted = (e.clipboardData || window.clipboardData).getData("text");
            // Reject if pasted content contains anything other than whole digits
            if (!/^\d+$/.test(pasted.trim())) {
                e.preventDefault();
            }
        });
    }

    (async function loadContactInfo() {
        try {
            const res = await fetch("/api/contact-info");
            const data = await res.json();
            if (data.success && data.contactInfo) {
                document.getElementById("contactEmail").textContent = data.contactInfo.support_email || "pawpon@gmail.com";
                document.getElementById("contactPhone").textContent = data.contactInfo.support_phone || "(+63) 992 487 4712";
            }
        } catch (err) {
            console.error("Failed to load contact info:", err);
            // Panatilihin na lang ang static fallback na laman ng span kung nabigo ang fetch
        }
    })();
});
async function fetchOrganizationsData() {
    try {
        const response = await fetch('/api/organizations');
        const data = await response.json();

        let rawOrgs = [];
        if (Array.isArray(data)) {
            rawOrgs = data;
        } else if (data.success && data.organizations) {
            rawOrgs = data.organizations;
        }

       
        organizationsData = rawOrgs.filter(org => 
            (org.gcash_number && org.gcash_number.trim() !== '') || 
            (org.maya_number && org.maya_number.trim() !== '')
        );

        populateOrgDropdown();
    } catch (err) {
        console.error("Error fetching organizations for index:", err);
    }
}

function populateOrgDropdown() {
    const select = document.getElementById('orgSelect');
    if (!select) return;

    select.innerHTML = '';

    if (organizationsData.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No partner organizations with payment details available";
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    select.disabled = false;
    organizationsData.forEach(org => {
        const option = document.createElement('option');
        option.value = org.organization_id;
        option.textContent = org.organization_name;
        option.setAttribute('data-name', org.organization_name);
        option.setAttribute('data-number', org.gcash_number || org.maya_number || 'N/A');
        option.setAttribute('data-desc', org.description || 'Dedicated animal welfare organization.');
        option.setAttribute('data-gcashqr', org.qr_code || '');
        option.setAttribute('data-mayaqr', org.maya_qr_code || '');
        
        //  Drop-off details — kuhanin lahat ng kailangan mula sa database
const dropoffAddr = (org.dropoff_address && String(org.dropoff_address).trim())
    || [org.city, org.province].filter(Boolean).join(', ')
    || 'Address not specified';

option.setAttribute('data-dropoff-location', dropoffAddr);
option.setAttribute('data-dropoff-hours',    org.dropoff_hours || 'Standard shelter hours apply');
option.setAttribute('data-dropoff-name',     org.dropoff_location_name || org.organization_name || 'Partner Shelter');
option.setAttribute('data-dropoff-image',    org.dropoff_image || '');
option.setAttribute('data-dropoff-notes',    org.dropoff_notes || '');
        select.appendChild(option);
    });

    updateOrgDetails();
}
function updateOrgDetails() {
    const select = document.getElementById('orgSelect');
    if (!select || select.selectedIndex === -1 || !select.value) return;

    const selectedOption = select.options[select.selectedIndex];

    const orgName  = selectedOption.getAttribute('data-name');
    const orgNumber = selectedOption.getAttribute('data-number');
    const orgDesc   = selectedOption.getAttribute('data-desc');

    //  Org info
    document.getElementById('displayOrgName').textContent   = orgName;
    document.getElementById('displayOrgNumber').textContent = orgNumber;
    document.getElementById('orgDescriptionBox').textContent = orgDesc;

    const dropoffLoc   = selectedOption.getAttribute('data-dropoff-location') || 'Address not specified';
    const dropoffHours = selectedOption.getAttribute('data-dropoff-hours')    || 'Standard shelter hours apply';
    const dropoffName  = selectedOption.getAttribute('data-dropoff-name')     || 'Partner Shelter';
    const dropoffImg   = selectedOption.getAttribute('data-dropoff-image')    || '';
    const dropoffNotes = selectedOption.getAttribute('data-dropoff-notes')    || '';

    const nameElem  = document.getElementById('displayDropoffName');
    const locElem   = document.getElementById('displayDropoffLocation');
    const hoursElem = document.getElementById('displayDropoffHours');
    const notesElem = document.getElementById('displayDropoffNotes');
    const notesWrap = document.getElementById('dropoffNotesWrapper');
    const imgWrap   = document.getElementById('dropoffImageContainer');

    if (nameElem)  nameElem.textContent  = dropoffName;
    if (locElem)   locElem.textContent   = dropoffLoc;
    if (hoursElem) hoursElem.textContent = dropoffHours;

    if (notesElem && notesWrap) {
        if (dropoffNotes && dropoffNotes.trim() !== '') {
            notesElem.textContent = dropoffNotes;
            notesWrap.classList.remove('hidden');
        } else {
            notesWrap.classList.add('hidden');
        }
    }

    if (imgWrap) {
        if (dropoffImg) {
            imgWrap.innerHTML =
                `<img src="${dropoffImg}" alt="Drop-off location" class="w-full h-full object-cover">`;
        } else {
            imgWrap.innerHTML =
                `<div class="text-center">
                    <i class="fa-solid fa-image text-[42px] text-[#cbd5e1]"></i>
                    <span class="text-[11px] text-[#94a3b8] block font-semibold mt-1">No image available</span>
                 </div>`;
        }
    }
    // Notes — itago kung blangko
if (notesElem && notesWrap) {
    if (dropoffNotes && dropoffNotes.trim() !== '') {
        notesElem.textContent = dropoffNotes;
        notesWrap.classList.remove('hidden');
    } else {
        notesWrap.classList.add('hidden');
    }
}

    updatePaymentDetails();
}
function updatePaymentDetails() {
    const methodSelect = document.getElementById('paymentMethodSelect');
    const selectOrg = document.getElementById('orgSelect');
    if (!methodSelect || !selectOrg || selectOrg.selectedIndex === -1 || !selectOrg.value) return;

    const selectedMethodText = methodSelect.options[methodSelect.selectedIndex].text;
    const selectedOrgOption = selectOrg.options[selectOrg.selectedIndex];

    document.getElementById('qrHeadingTitle').textContent = `Scan to Donate via ${selectedMethodText}`;
    document.getElementById('qrCodeLabel').textContent = `[ ${selectedMethodText} QR Code ]`;

    const qrContainer = document.getElementById('qrImageContainer');
    const viewQrBtn = document.getElementById('viewQrBtn');

    const gcashQR = selectedOrgOption.getAttribute('data-gcashqr');
    const mayaQR  = selectedOrgOption.getAttribute('data-mayaqr');
    const orgName = selectedOrgOption.getAttribute('data-name');

    let activeQR = methodSelect.value.toLowerCase() === 'maya' ? mayaQR : gcashQR;

    currentQrSrc     = activeQR || "";
    currentQrOrgName = orgName  || "Organization";
    currentQrMethod  = selectedMethodText;

    if (qrContainer) {
        if (activeQR) {
            qrContainer.innerHTML = `<img id="qrInlineImg" src="" alt="Payment QR Code" class="w-full h-full object-contain rounded-[12px]">`;
            const imgEl = document.getElementById("qrInlineImg");

            // ⭐ IPASA ang method name sa crop function
            cropQrToSquare(activeQR, selectedMethodText).then(croppedSrc => {
                if (imgEl) imgEl.src = croppedSrc;
            });

            if (viewQrBtn) viewQrBtn.style.display = 'inline-flex';
        } else {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <i class="fa-solid fa-qrcode text-[50px] text-[#94a3b8] mb-1"></i>
                    <span class="text-[11px] text-[#64748b] block font-semibold">[ No QR Available ]</span>
                </div>`;
            if (viewQrBtn) viewQrBtn.style.display = 'none';
        }
    }
}
function toggleDonorFields() {
    const isAnonymous = document.getElementById('anonymousCheck').checked;
    const fieldsContainer = document.getElementById('donorDetailsFields');
    const nameInput = document.getElementById('donorName');

    if (!fieldsContainer) return;

    if (isAnonymous) {
        fieldsContainer.style.opacity = '0.4';
        fieldsContainer.style.pointerEvents = 'none';
        if (nameInput) nameInput.required = false;
    } else {
        fieldsContainer.style.opacity = '1';
        fieldsContainer.style.pointerEvents = 'auto';
        if (nameInput) nameInput.required = true;
    }
}

async function handlePublicDonationSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const orgId = document.getElementById('orgSelect').value;
    const paymentMethod = document.getElementById('paymentMethodSelect').value;
    const isAnonymous = document.getElementById('anonymousCheck').checked;

    // ⭐ Pre-check bago pa mag-fetch
    if (!orgId) {
        await showMessage("Please select an organization first.", "warning");
        return;
    }
        // ⭐ Amount validation — block zero at negative
    const amountField = document.getElementById("donationAmountInput")
        || document.querySelector('#donationForm input[name="amount"]');
    const amountValue = amountField ? parseFloat(amountField.value) : NaN;

    if (!amountField || amountField.value.trim() === "" || isNaN(amountValue)) {
        await showMessage("Please enter a donation amount.", "warning");
        return;
    }
    if (amountValue <= 0) {
        await showMessage("Donation amount must be greater than zero. Negative amounts are not allowed.","warning");
        if (amountField) amountField.value = "";
        return;
    }

    formData.append('organization_id', orgId);
    formData.append('payment_method', paymentMethod);
    formData.append('is_anonymous', isAnonymous ? 'true' : 'false');

    if (isAnonymous) {
        formData.set('donor_name', 'Anonymous Donor');
        formData.set('gcash_account_name', 'Anonymous Donor');
    } else {
        const nameInput = document.getElementById('donorName');
        const typedName = (nameInput?.value || '').trim();
        if (!typedName) {
            await showMessage(
                'Please enter your name or check "Donate Anonymously".',
                "warning"
            );
            return;
        }
        formData.set('donor_name', typedName);
        formData.set('gcash_account_name', typedName);
    }

    formData.set('donor_email', '');
    console.log("[Donation] payload:", {
        organization_id: orgId,
        payment_method: paymentMethod,
        is_anonymous: isAnonymous,
        reference_number: formData.get('reference_number'),
        amount: formData.get('amount'),
        donor_name: formData.get('donor_name'),
        receipt: formData.get('receipt')?.name || '(no file)'
    });

    try {
        const response = await fetch('/api/donations/cash', {
            method: 'POST',
            body: formData
        });

        const raw = await response.text();
        console.log("[Donation] raw response:", response.status, raw);

        let result;
        try {
            result = JSON.parse(raw);
        } catch (parseErr) {
            await showMessage(
                `Server error (${response.status}). Please check the console.`,
                "error"
            );
            return;
        }

                if (result.success) {
            // ⭐ Capture values BEFORE reset, para maipasok sa modal summary
            const summaryRows = [
                { label: "Donor", value: isAnonymous ? "Anonymous Donor" : formData.get('donor_name') },
                { label: "Amount", value: `₱${Number(formData.get('amount')).toLocaleString()}` },
                { label: "Payment Method", value: paymentMethod },
                { label: "Reference No.", value: formData.get('reference_number') }
            ];

            event.target.reset();

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
            if (fileNameEl) fileNameEl.textContent = "Accepted file type: jpg, png, webp";

            document.getElementById('anonymousCheck').checked = false;
            toggleDonorFields();
            unlockOcrFields();
            // ⭐ Show success modal
            showDonateSuccessModal({
                type: "cash",
                title: "Thank You for Your Donation!",
                message: "Your cash donation receipt has been submitted successfully and is pending verification by the organization.",
                rows: summaryRows
            });
        } else {
            await showMessage(
                result.error || "Failed to submit donation.",
                "error"
            );
        }
    } catch (err) {
        console.error("Donation submit error:", err);
        await showMessage(
            "An unexpected error occurred. Please try again later.",
            "error"
        );
    }
}
function switchDonationType(type) {
    const cashForm      = document.getElementById("donationForm");
    const inkindForm    = document.getElementById("inkindForm");
    const cashBtn       = document.getElementById("cashTabBtn");
    const inkindBtn     = document.getElementById("inkindTabBtn");

    // ⭐ Side panels
    const cashPanel     = document.getElementById("cashQrPanel");
    const inkindPanel   = document.getElementById("inkindDropoffPanel");

    // ⭐ NEW: Payment method wrapper (para mahide sa In-Kind tab)
    const paymentWrapper = document.getElementById("paymentMethodWrapper");

    if (type === 'cash') {
        cashForm.classList.remove('hidden');
        inkindForm.classList.add('hidden');

        cashBtn.className   = "flex-1 py-2.5 px-4 rounded-xl font-bold text-sm bg-[#0151ff] text-white transition-all shadow-sm";
        inkindBtn.className = "flex-1 py-2.5 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all";

        // ⭐ Ipakita ang QR panel, itago ang drop-off panel
        if (cashPanel)   cashPanel.classList.remove('hidden');
        if (inkindPanel) inkindPanel.classList.add('hidden');

        // ⭐ Ipakita ang Payment Method kapag Cash
        if (paymentWrapper) paymentWrapper.classList.remove('hidden');

    } else {
        cashForm.classList.add('hidden');
        inkindForm.classList.remove('hidden');

        inkindBtn.className = "flex-1 py-2.5 px-4 rounded-xl font-bold text-sm bg-[#ffa500] text-white transition-all shadow-sm";
        cashBtn.className   = "flex-1 py-2.5 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all";

        // ⭐ Ipakita ang drop-off panel, itago ang QR panel
        if (cashPanel)   cashPanel.classList.add('hidden');
        if (inkindPanel) inkindPanel.classList.remove('hidden');

        // ⭐ ITAGO ang Payment Method kapag In-Kind (hindi na kailangan)
        if (paymentWrapper) paymentWrapper.classList.add('hidden');
    }
}
async function handleInKindSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const orgId = document.getElementById('orgSelect').value;
    const isAnonymous = document.getElementById('inkindAnonymousCheck').checked;

    if (!orgId) {
        await showMessage("Please select an organization first.", "warning");
        return;
    }
    
    const categoryValue = (document.getElementById('inkindCategory')?.value || '').trim();
    if (!categoryValue || !INKIND_CATEGORY_UNITS[categoryValue]) {
        await showMessage("Please select a donation category.", "warning");
        return;
    }
    const itemNameValue = (document.getElementById('inkindItemName')?.value || '').trim();
    const itemCheck = validateItemName(itemNameValue);
    if (!itemCheck.valid) {
        await showMessage(itemCheck.reason, "warning");
        return;
    }
    const unitValue = (document.getElementById('inkindUnit')?.value || '').trim();
    if (!unitValue || !INKIND_CATEGORY_UNITS[categoryValue].includes(unitValue)) {
        await showMessage("Please select a valid unit for the chosen category.", "warning");
        return;
    }

    formData.append('organization_id', orgId);
    formData.append('is_anonymous', isAnonymous ? 'true' : 'false');
    formData.set('category', categoryValue);   // ⭐ Explicitly add category
    formData.set('unit', unitValue);           // ⭐ Explicitly add unit

    // Anonymous handling
    if (isAnonymous) {
        formData.set('donor_name', 'Anonymous Donor');
        formData.set('contact_info', 'N/A (Anonymous)');
    } else {
        const nameInput = document.getElementById('inkindDonorName');
        const typedName = (nameInput?.value || '').trim();
        if (!typedName) {
            await showMessage('Please enter your name or check "Donate Anonymously".', "warning");
            return;
        }
        formData.set('donor_name', typedName);
    }
    console.log("[In-Kind] payload:", {
        organization_id: orgId,
        is_anonymous: isAnonymous,
        donor_name: formData.get('donor_name'),
        category: formData.get('category'),
        item_name: formData.get('item_name'),
        quantity: formData.get('quantity'),
        unit: formData.get('unit'),
        contact_info: formData.get('contact_info')
    });

    try {
        const response = await fetch('/api/donations/inkind', {
            method: 'POST',
            body: formData
        });

        const raw = await response.text();
        console.log("[In-Kind] raw response:", response.status, raw);

        let result;
        try {
            result = JSON.parse(raw);
        } catch (parseErr) {
            await showMessage(`Server error (${response.status}). Please check console.`, "error");
            return;
        }

                if (result.success) {
           
            const summaryRows = [
                { label: "Donor", value: isAnonymous ? "Anonymous Donor" : formData.get('donor_name') },
                { label: "Category", value: formData.get('category') },
                { label: "Item", value: formData.get('item_name') },
                { label: "Quantity", value: `${formData.get('quantity')} ${formData.get('unit') || ''}`.trim() }
            ];

            event.target.reset();
            const anonCheck = document.getElementById('inkindAnonymousCheck');
            if (anonCheck) anonCheck.checked = false;
            toggleInKindDonorFields();
            applyInkindCategoryRules();

            showDonateSuccessModal({
                type: "inkind",
                title: "Thank You for Your Pledge!",
                message: "Your in-kind donation pledge has been submitted successfully. The organization will contact you for drop-off details.",
                rows: summaryRows
            });
        } else {
            await showMessage('Error: ' + (result.error || 'Failed to submit in-kind donation.'));
        }
    } catch (err) {
        console.error("In-kind submit error:", err);
        await showMessage('An unexpected error occurred. Please try again later.');
    }
}

// ==========================================
// QR MODAL — View Full Size QR Code
// ==========================================
function openQrModal() {
    if (!currentQrSrc) return;

    const modal = document.getElementById('qrModal');
    const img   = document.getElementById('qrModalImage');
    const title = document.getElementById('qrModalTitle');
    const sub   = document.getElementById('qrModalSubtitle');
    const org   = document.getElementById('qrModalOrg');
    if (!modal || !img) return;

    // ⭐ IPASA ang method name para tamang crop sa modal
    cropQrToSquare(currentQrSrc, currentQrMethod).then(croppedSrc => {
        img.src = croppedSrc;
    });

    title.textContent = `Scan to Donate via ${currentQrMethod}`;
    sub.textContent   = `[ ${currentQrMethod} QR Code ]`;
    org.textContent   = currentQrOrgName;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}
function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (!modal) return;

    if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQrModal();
});
// ==========================================
// RECEIPT OCR — Auto-fill Ref No., Name, Amount
// ==========================================
async function handleReceiptUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    unlockOcrFields();
  
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

  
    await runReceiptOCR(file);

      lockReceiptFields();
}
function cropQrToSquare(src, method = "gcash") {
    return new Promise((resolve) => {
        if (!src) {
            resolve(src);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const ratio = w / h;

            let cropX = 0, cropY = 0, cropW = w, cropH = h;

            if (ratio < 0.95) {
                let widthPct, topPct, bottomPct;

                if (String(method).toLowerCase().includes("maya")) {
                    widthPct  = 0.55;
                    topPct    = 0.31;
                    bottomPct = 0.79;
                } else {
                    widthPct  = 0.52;
                    topPct    = 0.19;
                    bottomPct = 0.46;
                }

                cropW = w * widthPct;
                cropX = (w - cropW) / 2;
                cropY = h * topPct;
                cropH = (h * bottomPct) - cropY;

                const referenceAspect = (0.52 * w) / (0.27 * h); 
                const targetH = cropW / referenceAspect;
                const centerY = cropY + cropH / 2;

                cropH = targetH;
                cropY = centerY - cropH / 2;

                if (cropH <= 0 || cropH > h) cropH = cropW;
                if (cropY + cropH > h) cropY = h - cropH;
                if (cropY < 0) cropY = 0;
            }

            const outWidth  = 600;
            const outHeight = Math.round(outWidth * (cropH / cropW));

            const canvas = document.createElement("canvas");
            canvas.width  = outWidth;
            canvas.height = outHeight;
            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, outWidth, outHeight);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outWidth, outHeight);

            try {
                resolve(canvas.toDataURL("image/png"));
            } catch (e) {
                console.warn("[QR Crop] Export failed:", e);
                resolve(src);
            }
        };

        img.onerror = () => resolve(src);
        img.src = src;
    });
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
function parseReceiptText(text) {
    const out = { reference: "", amount: "", name: "" };

    const raw   = String(text).replace(/\r/g, "").trim();
    const flat  = raw.replace(/[ \t]+/g, " ");
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

    const fixDigits = (s) => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");

    // ⭐ Check kung mukhang PHONE NUMBER (para hindi ito maging Ref No.)
    const looksLikePhone = (numStr) => {
        const n = String(numStr).replace(/\D/g, "");
        if (/^09\d{9}$/.test(n))   return true;   // 09171234567 (11 digits)
        if (/^639\d{9}$/.test(n))  return true;   // 639171234567 (12 digits)
        if (/^63\d{10}$/.test(n))  return true;   // 63XXXXXXXXXX
        return false;
    };

    // ============================================================
    // STEP 1: Hanapin ang "Ref No." label (PINAKA-PRIORITY)
    // ============================================================
    const refLabelRx = /ref(?:erence)?\.?\s*(?:no\.?|number|num\.?|#)?/gi;
    let m;
    while ((m = refLabelRx.exec(flat)) !== null) {
        const after = flat.substring(
            m.index + m[0].length,
            m.index + m[0].length + 40
        );
        const normalized = fixDigits(after).replace(/[\s\-]/g, "");
        const dm = normalized.match(/^(\d{10,16})/);
        if (dm && !looksLikePhone(dm[1])) {
            out.reference = dm[1];
            break;
        }
    }

    // ============================================================
    // STEP 2: Fallback — spaced pattern (3-3-3-3 / 3-3-3-4),
    // kunin ang HULING match (nasa ilalim ng receipt ang ref)
    // ============================================================
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

    // ============================================================
    // STEP 3: Fallback — solid 12–15 digits, HULING match,
    // i-exclude ang phone numbers
    // ============================================================
    if (!out.reference) {
        const solid = [...flat.matchAll(/\b(\d{12,15})\b/g)];
        for (let i = solid.length - 1; i >= 0; i--) {
            if (!looksLikePhone(solid[i][1])) {
                out.reference = solid[i][1];
                break;
            }
        }
    }
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

    // ---------- Amount ----------
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
    const refInput    = document.querySelector('#donationForm input[name="reference_number"]');
    const amountInput = document.querySelector('#donationForm input[name="amount"]');
    const donorInput  = document.getElementById('donorName');

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

    // Your Name (fill lang kung blangko — hindi ito kino-correct)
    if (parsed.name && donorInput && !donorInput.value) {
        const anon = document.getElementById('anonymousCheck');
        if (!anon || !anon.checked) {
            donorInput.value = parsed.name;
            highlightOcrField(donorInput, "blue");
            filled++;
        }
    }

    return { filled, corrected };
}
// ==========================================
// OCR FIELD LOCKING
// Once a receipt is scanned & fields are auto-filled,
// those inputs become read-only. Re-uploading a receipt
// unlocks them again (so a fresh scan can refill).
// ==========================================
function lockOcrFilledFields(parsed) {
    const fields = [
        { el: document.querySelector('#donationForm input[name="reference_number"]'), has: !!parsed.reference },
        { el: document.querySelector('#donationForm input[name="amount"]'),           has: !!parsed.amount },
        { el: document.getElementById('donorName'),                                    has: !!parsed.name }
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
        document.querySelector('#donationForm input[name="reference_number"]'),
        document.querySelector('#donationForm input[name="amount"]'),
        document.getElementById('donorName')
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

function validateItemName(name) {
    const value = (name || '').trim();

    if (!value)
        return { valid: false, reason: 'Please enter the item you wish to donate.' };

    if (value.length < 3)
        return { valid: false, reason: 'Item name is too short. Please enter a valid item name.' };

    if (value.length > 100)
        return { valid: false, reason: 'Item name is too long (max 100 characters).' };

    if (!/^[a-zA-Z0-9\s\-',.()\/&+]+$/.test(value))
        return { valid: false, reason: 'Item name contains invalid characters.' };

    if (!/[a-zA-Z]/.test(value))
        return { valid: false, reason: 'Item name must contain letters.' };

    if (!/[aeiouAEIOU]/.test(value))
        return { valid: false, reason: 'Please enter a valid item name.' };

    // ⭐ RESTORED: No character repeated 4+ times in a row
    if (/(.)\1{3,}/i.test(value))
        return { valid: false, reason: 'Please enter a valid item name.' };

    // No 5+ consecutive consonants
    if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(value))
        return { valid: false, reason: 'Please enter a valid item name.' };

    // Keyboard mash
    if (/(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuiop|zxcv|xcvb|cvbn|vbnm)/i
            .test(value.replace(/\s+/g, '')))
        return { valid: false, reason: 'Please enter a valid item name.' };

    // Bawat word (3+ letters) dapat may vowel
    const words = value.split(/[\s\-',.()\/&+]+/).filter(Boolean);
    for (const w of words) {
        const letters = w.replace(/[^a-zA-Z]/g, '');
        if (letters.length >= 3 && !/[aeiouAEIOU]/.test(letters)) {
            return { valid: false, reason: 'Please enter a valid item name.' };
        }
    }

    return { valid: true };
}
function highlightOcrField(el, color = "blue") {
    if (!el) return;

    const cls = color === "orange" ? "ocr-highlight-orange" : "ocr-highlight-blue";
    el.classList.add("ocr-highlight-transition", cls);
    setTimeout(() => {
        el.classList.remove("ocr-highlight-transition", cls);
    }, 2600);
}
/** Scale the image up to a max width for better OCR on small GCash fonts. */
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
function toggleInKindDonorFields() {
    const isAnonymous = document.getElementById('inkindAnonymousCheck').checked;
    const fieldsContainer = document.getElementById('inkindDonorDetailsFields');
    const nameInput = document.getElementById('inkindDonorName');
    const contactInput = document.getElementById('inkindContactInfo');

    if (!fieldsContainer) return;

    if (isAnonymous) {
        fieldsContainer.style.opacity = '0.4';
        fieldsContainer.style.pointerEvents = 'none';
        if (nameInput) nameInput.required = false;
        if (contactInput) contactInput.required = false;
    } else {
        fieldsContainer.style.opacity = '1';
        fieldsContainer.style.pointerEvents = 'auto';
        if (nameInput) nameInput.required = true;
        if (contactInput) contactInput.required = true;
    }
}
// ==========================================
// DONATION SUCCESS MODAL
// ==========================================
function showDonateSuccessModal(options = {}) {
    const {
        type = "cash",                 // "cash" | "inkind"
        title = "Thank You!",
        message = "Your donation has been submitted successfully.",
        rows = []                      // [{ label, value }, ...]
    } = options;

    const modal       = document.getElementById("donateSuccessModal");
    const icon        = document.getElementById("donateSuccessIcon");
    const iconInner   = document.getElementById("donateSuccessIconInner");
    const titleEl     = document.getElementById("donateSuccessTitle");
    const textEl      = document.getElementById("donateSuccessText");
    const summaryEl   = document.getElementById("donateSuccessSummary");
    const btn         = document.getElementById("donateSuccessBtn");

    if (!modal) return;

    // Icon color + symbol
    if (type === "inkind") {
        if (icon) icon.classList.add("inkind");
        if (iconInner) iconInner.className = "fa-solid fa-box-archive";
        if (btn) btn.classList.add("inkind");
    } else {
        if (icon) icon.classList.remove("inkind");
        if (iconInner) iconInner.className = "fa-solid fa-check";
        if (btn) btn.classList.remove("inkind");
    }

    if (titleEl) titleEl.textContent = title;
    if (textEl)  textEl.textContent  = message;

    // Summary rows
    if (summaryEl) {
        const cleanRows = (rows || []).filter(r => r && r.value !== undefined && r.value !== null && String(r.value).trim() !== "");
        if (cleanRows.length > 0) {
            summaryEl.innerHTML = cleanRows.map(r => `
                <div class="donate-success-summary-row">
                    <span class="donate-success-summary-label">${r.label}</span>
                    <span class="donate-success-summary-value">${r.value}</span>
                </div>
            `).join("");
            summaryEl.style.display = "block";
        } else {
            summaryEl.innerHTML = "";
            summaryEl.style.display = "none";
        }
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}
function closeDonateSuccessModal() {
    const modal = document.getElementById("donateSuccessModal");
    if (!modal) return;

    // ⭐ Blur kung ang active element ay nasa loob ng modal
    if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

// Close on overlay click + Escape
document.addEventListener("click", (e) => {
    const modal = document.getElementById("donateSuccessModal");
    if (modal && e.target === modal) closeDonateSuccessModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDonateSuccessModal();
});
// ==========================================
// LIVE IMPACT COUNTERS (public landing page)
// ==========================================
let statsPollingInterval = null;
const STATS_POLL_INTERVAL_MS = 8000;   // refresh every 8 seconds

async function fetchPublicStats() {
    try {
        const res = await fetch('/api/public/stats', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success && data.stats) {
            updateStatsDisplay(data.stats);
        }
    } catch (err) {
        console.warn("[Stats] Failed to fetch public stats:", err.message);
    }
}

function updateStatsDisplay(stats) {
    const amountEl   = document.getElementById('totalDonatedAmount');
    const countEl    = document.getElementById('totalDonationsCount');
    const petsEl     = document.getElementById('totalAdoptedPets');
    const pluralEl   = document.getElementById('donationPlural');

    // ---------- Total donated amount ----------
    if (amountEl) {
        const newVal = Math.round(Number(stats.totalDonatedAmount) || 0);
        const oldVal = parseInt(amountEl.dataset.value || '0', 10);
        if (newVal !== oldVal) {
            animateCount(amountEl, oldVal, newVal, 900);
            amountEl.dataset.value = newVal;
        } else if (!amountEl.textContent || amountEl.textContent === '0') {
            amountEl.textContent = newVal.toLocaleString();
        }
    }

    // ---------- Total approved donation count (cash + in-kind) ----------
    if (countEl) {
        const newCount = (Number(stats.totalCashDonations) || 0)
                       + (Number(stats.totalInKindDonations) || 0);
        const oldCount = parseInt(countEl.dataset.value || '0', 10);
        if (newCount !== oldCount) {
            animateCount(countEl, oldCount, newCount, 900);
            countEl.dataset.value = newCount;
        } else if (!countEl.textContent || countEl.textContent === '0') {
            countEl.textContent = newCount.toLocaleString();
        }
        if (pluralEl) pluralEl.textContent = newCount === 1 ? '' : 's';
    }

    // ---------- Total adopted pets ----------
    if (petsEl) {
        const newPets = Number(stats.totalAdoptedPets) || 0;
        const oldPets = parseInt(petsEl.dataset.value || '0', 10);
        if (newPets !== oldPets) {
            animateCount(petsEl, oldPets, newPets, 900);
            petsEl.dataset.value = newPets;
        } else if (!petsEl.textContent || petsEl.textContent === '0') {
            petsEl.textContent = newPets.toLocaleString();
        }
    }
}

function animateCount(el, from, to, duration = 900) {
    if (!el) return;
    const start = performance.now();
    const diff  = to - from;

    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic
        el.textContent = Math.round(from + diff * eased).toLocaleString();
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = to.toLocaleString();
    }
    requestAnimationFrame(step);
}

function startStatsPolling() {
    if (!document.getElementById('totalDonatedAmount')) return; // section wala sa page

    fetchPublicStats();     // immediate first fetch
    if (statsPollingInterval) clearInterval(statsPollingInterval);
    statsPollingInterval = setInterval(fetchPublicStats, STATS_POLL_INTERVAL_MS);
}

function stopStatsPolling() {
    if (statsPollingInterval) {
        clearInterval(statsPollingInterval);
        statsPollingInterval = null;
    }
}

// Pause polling kapag nakatago ang tab (resource-saving)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopStatsPolling();
    } else {
        startStatsPolling();
    }
});