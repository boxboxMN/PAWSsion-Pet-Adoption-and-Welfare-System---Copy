const NO_QR_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="%239ca3af">No QR Code</text></svg>';

// Global state
let activeTab = 'cash';
let allDonations = [];
let allInKindDonations = [];
let selectedDonationId = null;
let selectedInKindId = null;
let currentReceiptPath = null;

// ⭐ PAGINATION STATE
const ROWS_PER_PAGE = 5;
let cashCurrentPage    = 1;
let inkindCurrentPage  = 1;
let cashFilteredData   = [];
let inkindFilteredData = [];

let cashStatusFilter   = 'ALL'; 
let inkindStatusFilter = 'ALL';

let inkindProofFile = null;
const MAX_INKIND_PROOF_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_INKIND_PROOF_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
];
document.addEventListener("DOMContentLoaded", async () => {
    // Load Shared Layout Components
    await loadTopbar({
        title: "Donations Overview",
        subtitle: "Track funds and in-kind resources submitted by sponsors"
    });
    await loadSidebar("donation");

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown-btn') && !e.target.closest('.action-dropdown-menu')) {
            document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    // Add event listener for active payment method dropdown change
    const methodSelect = document.getElementById('inputPaymentMethod');
    if (methodSelect) {
        methodSelect.addEventListener('change', togglePaymentMethodFields);
        togglePaymentMethodFields(); // trigger initially
    }

    //restrict input fields to digits only
    restrictToDigitsOnly("inputAccountNum", 11);
    restrictToDigitsOnly("inputMayaNum", 11);

    initInkindProofUpload();

    // Load Initial Data
    fetchPaymentDetails();
    fetchDonations();
    fetchInKindDonations();
});

// Toggle visibility of GCash vs Maya configuration inputs inside the modal
function togglePaymentMethodFields() {
    const methodSelect = document.getElementById('inputPaymentMethod');
    const gcashGroup = document.getElementById('gcashFieldsGroup');
    const mayaGroup = document.getElementById('mayaFieldsGroup');

    if (!methodSelect || !gcashGroup || !mayaGroup) {
        return;
    }

    const selectedMethod = (methodSelect.value || 'gcash').toLowerCase();

    if (selectedMethod === 'maya') {
        mayaGroup.classList.remove('hidden');
        gcashGroup.classList.add('hidden');
    } else {
        gcashGroup.classList.remove('hidden');
        mayaGroup.classList.add('hidden');
    }
}

//restricts input to digits only and limits length
function restrictToDigitsOnly(inputId, maxLength = 11) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("input", function () {
        const cleaned = this.value.replace(/\D/g, "").slice(0, maxLength);
        if (this.value !== cleaned) {
            this.value = cleaned;
        }
    });

    // Pinipigilan din ang pag-paste ng hindi-numeric na text
    input.addEventListener("paste", function (e) {
        const pastedText = (e.clipboardData || window.clipboardData).getData("text");
        if (/\D/.test(pastedText)) {
            e.preventDefault();
            const cleaned = pastedText.replace(/\D/g, "").slice(0, maxLength);
            const cursorPos = this.selectionStart;
            this.value = this.value.slice(0, cursorPos) + cleaned + this.value.slice(this.selectionEnd);
        }
    });
}

// =====================================================
// ⭐ STATUS CATEGORY HELPERS
// =====================================================
function getStatusCategory(rawStatus) {
    const s = String(rawStatus || 'Pending').toLowerCase().trim();
    if (s === 'approved' || s === 'verified') return 'Confirmed';
    if (s === 'rejected')                    return 'Rejected';
    return 'Pending';
}

function countByStatus(list) {
    const counts = { ALL: 0, Pending: 0, Confirmed: 0, Rejected: 0 };
    (list || []).forEach(item => {
        counts.ALL++;
        counts[getStatusCategory(item.status)]++;
    });
    return counts;
}

function paintStatusPills(prefix, counts, activeFilter) {
    const labels = { ALL: 'All', Pending: 'Pending', Confirmed: 'Confirmed', Rejected: 'Rejected' };
    Object.keys(labels).forEach(key => {
        const el = document.getElementById(`${prefix}Status${key}`);
        if (!el) return;
        const isActive = activeFilter === key;
        el.classList.toggle('active', isActive);
        el.innerHTML = `${labels[key]} <span class="pill-count">${counts[key] || 0}</span>`;
    });
}

function updateCashStatusPills() {
    paintStatusPills('cash', countByStatus(allDonations), cashStatusFilter);
}

function updateInkindStatusPills() {
    paintStatusPills('inkind', countByStatus(allInKindDonations), inkindStatusFilter);
}

function setCashStatusFilter(filter) {
    cashStatusFilter = filter;
    cashCurrentPage = 1;
    updateCashStatusPills();
    filterDonations();
}

function setInkindStatusFilter(filter) {
    inkindStatusFilter = filter;
    inkindCurrentPage = 1;
    updateInkindStatusPills();
    filterDonations();
}

// =====================================================
// ⭐ IN-KIND PROOF PHOTO HELPERS
// =====================================================
function resetInkindProof() {
    inkindProofFile = null;

    const input       = document.getElementById("inkindProofInput");
    const placeholder = document.getElementById("inkindProofPlaceholder");
    const previewWrap = document.getElementById("inkindProofPreviewWrap");
    const preview     = document.getElementById("inkindProofPreview");
    const fileName    = document.getElementById("inkindProofFileName");
    const errorEl     = document.getElementById("inkindProofError");

    if (input) input.value = "";
    if (preview) preview.src = "";
    if (fileName) fileName.textContent = "";
    if (previewWrap) previewWrap.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
    if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
    }
}

function showInkindProofError(msg) {
    const errorEl = document.getElementById("inkindProofError");
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
}

function clearInkindProofError() {
    const errorEl = document.getElementById("inkindProofError");
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
}

function validateInkindProofFile(file) {
    if (!file) {
        return "Please upload a photo as proof that the item was received or used.";
    }
    if (!ALLOWED_INKIND_PROOF_TYPES.includes(file.type)) {
        return "Only JPG, PNG, or WEBP images are allowed.";
    }
    if (file.size > MAX_INKIND_PROOF_SIZE) {
        return "Image is too large. Maximum size is 5MB.";
    }
    return null;
}

function setInkindProofFile(file) {
    inkindProofFile = file;

    const placeholder = document.getElementById("inkindProofPlaceholder");
    const previewWrap = document.getElementById("inkindProofPreviewWrap");
    const preview     = document.getElementById("inkindProofPreview");
    const fileName    = document.getElementById("inkindProofFileName");

    if (!file) {
        if (preview) preview.src = "";
        if (fileName) fileName.textContent = "";
        if (previewWrap) previewWrap.classList.add("hidden");
        if (placeholder) placeholder.classList.remove("hidden");
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        if (preview) preview.src = ev.target.result;
        if (fileName) fileName.textContent = file.name;
        if (placeholder) placeholder.classList.add("hidden");
        if (previewWrap) previewWrap.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

function initInkindProofUpload() {
    const dropZone    = document.getElementById("inkindProofDropZone");
    const input       = document.getElementById("inkindProofInput");
    const removeBtn   = document.getElementById("removeInkindProofBtn");

    if (dropZone && input) {
        dropZone.addEventListener("click", (e) => {
            if (e.target.closest("#removeInkindProofBtn")) return;
            input.click();
        });

        input.addEventListener("change", function () {
            clearInkindProofError();
            const file = this.files && this.files[0];
            if (!file) return;

            const err = validateInkindProofFile(file);
            if (err) {
                showInkindProofError(err);
                this.value = "";
                setInkindProofFile(null);
                return;
            }
            setInkindProofFile(file);
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            clearInkindProofError();
            setInkindProofFile(null);
            if (input) input.value = "";
        });
    }
}

/**
 * Switches between the Cash Donations and In-Kind Donations tabs.
 */
/**
 * Switches between the Cash Donations and In-Kind Donations main tables.
 */
function switchDonationTab(tab) {
    activeTab = tab;
    
    const cashTab = document.getElementById("tabCash");
    const inkindTab = document.getElementById("tabInKind");
    const cashContainer = document.getElementById("cashTableContainer");
    const inkindContainer = document.getElementById("inkindTableContainer");

    if (tab === 'cash') {
        cashTab.className = "flex-1 py-3 px-6 text-sm font-bold rounded-lg border-b-2 border-indigo-600 text-indigo-600 flex items-center justify-center gap-2 transition-all";
        inkindTab.className = "flex-1 py-3 px-6 text-sm font-bold rounded-lg border-b-2 border-transparent text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-all";
        
        cashContainer.classList.remove("hidden");
        inkindContainer.classList.add("hidden");
    } else {
        inkindTab.className = "flex-1 py-3 px-6 text-sm font-bold rounded-lg border-b-2 border-indigo-600 text-indigo-600 flex items-center justify-center gap-2 transition-all";
        cashTab.className = "flex-1 py-3 px-6 text-sm font-bold rounded-lg border-b-2 border-transparent text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-all";
        
        inkindContainer.classList.remove("hidden");
        cashContainer.classList.add("hidden");
    }
     // Reset page para sa tab na pinasok
    if (tab === 'cash') cashCurrentPage = 1;
    else inkindCurrentPage = 1;

    // Optional: i-clear o i-retrigger ang filter para sumakto sa napiling tab
    filterDonations();
}

/**
 * Switches between the Cash and In-Kind configuration
 * sections inside the settings modal.
 */
/**
 * Switches between the Cash and In-Kind configuration
 * sections inside the settings modal.
 */
function switchModalConfigTab(type) {
    const modalTabCash = document.getElementById("modalTabCash");
    const modalTabInKind = document.getElementById("modalTabInKind");
    const modalCashSection = document.getElementById("modalCashSection");
    const modalInKindSection = document.getElementById("modalInKindSection");
    const sectionInput = document.getElementById("settingsSection");

    if (type === 'cash') {
        modalTabCash.className = "flex-1 py-2 text-xs font-bold rounded-lg text-indigo-600 bg-white shadow-sm transition-all";
        modalTabInKind.className = "flex-1 py-2 text-xs font-bold rounded-lg text-gray-500 transition-all";
        modalCashSection.classList.remove("hidden");
        modalInKindSection.classList.add("hidden");
        if (sectionInput) sectionInput.value = "cash";
    } else {
        modalTabInKind.className = "flex-1 py-2 text-xs font-bold rounded-lg text-indigo-600 bg-white shadow-sm transition-all";
        modalTabCash.className = "flex-1 py-2 text-xs font-bold rounded-lg text-gray-500 transition-all";
        modalInKindSection.classList.remove("hidden");
        modalCashSection.classList.add("hidden");
        if (sectionInput) sectionInput.value = "inkind";
    }
}

async function fetchPaymentDetails() {
    try {

        const res = await fetch("/org/payment-info");
        const result = await res.json();

        if (!result.success || !result.data) {
            console.error(
                "Unable to fetch payment details:",
                result.message
            );
            return;
        }

        const data = result.data;

        // =====================================================
        // PAYMENT METHOD
        // =====================================================

        const paymentMethod =
            String(data.payment_method || "gcash")
                .toLowerCase()
                .trim();

        const paymentMethodInput =
            document.getElementById("inputPaymentMethod");

        if (paymentMethodInput) {
            paymentMethodInput.value = paymentMethod;
        }

        // =====================================================
        // SHOW / HIDE PAYMENT FIELDS
        // =====================================================

        if (typeof togglePaymentMethodFields === "function") {
            togglePaymentMethodFields();
        }

        // =====================================================
        // GCASH DATA
        // =====================================================

        const gcashNameInput =
            document.getElementById("inputAccountName");

        const gcashNumberInput =
            document.getElementById("inputAccountNum");

        if (gcashNameInput) {
            gcashNameInput.value =
                data.gcash_name || "";
        }

        if (gcashNumberInput) {
            gcashNumberInput.value =
                data.gcash_number || "";
        }

        // =====================================================
        // MAYA DATA
        // =====================================================

        const mayaNameInput =
            document.getElementById("inputMayaName");

        const mayaNumberInput =
            document.getElementById("inputMayaNum");

        if (mayaNameInput) {
            mayaNameInput.value =
                data.maya_name || "";
        }

        if (mayaNumberInput) {
            mayaNumberInput.value =
                data.maya_number || "";
        }

        // =====================================================
        // DISPLAY ACTIVE PAYMENT ACCOUNT
        // =====================================================

        const displayAccountName =
            document.getElementById(
                "displayAccountName"
            );

        const displayAccountNum =
            document.getElementById(
                "displayAccountNum"
            );

        if (
            displayAccountName &&
            displayAccountNum
        ) {

            if (paymentMethod === "maya") {

                // ---------------------------------------------
                // MAYA
                // ---------------------------------------------

                displayAccountName.textContent =
                    data.maya_name ||
                    "N/A";

                displayAccountNum.textContent =
                    data.maya_number
                        ? `${data.maya_number} (Maya)`
                        : "No Maya account set";

            } else {

                // ---------------------------------------------
                // GCASH
                // ---------------------------------------------

                displayAccountName.textContent =
                    data.gcash_name ||
                    "N/A";

                displayAccountNum.textContent =
                    data.gcash_number
                        ? `${data.gcash_number} (GCash)`
                        : "No GCash account set";
            }
        }

        // =====================================================
        // GCASH QR
        // =====================================================

        const qrPreview =
            document.getElementById("qrPreview");

        if (qrPreview) {

            if (data.qr_code) {

                qrPreview.src =
                    data.qr_code;

                qrPreview.classList.remove(
                    "hidden"
                );

            } else {

                qrPreview.removeAttribute("src");

                qrPreview.classList.add(
                    "hidden"
                );
            }
        }

        // =====================================================
        // MAYA QR
        // =====================================================

        const mayaQrPreview =
            document.getElementById(
                "mayaQrPreview"
            );

        if (mayaQrPreview) {

            if (data.maya_qr_code) {

                mayaQrPreview.src =
                    data.maya_qr_code;

                mayaQrPreview.classList.remove(
                    "hidden"
                );

            } else {

                mayaQrPreview.removeAttribute(
                    "src"
                );

                mayaQrPreview.classList.add(
                    "hidden"
                );
            }
        }

        // =====================================================
// IN-KIND INFORMATION
// =====================================================

const locationName =
    document.getElementById(
        "inputLocationName"
    );

const locationAddress =
    document.getElementById(
        "inputLocationAddress"
    );

const operatingHours =
    document.getElementById(
        "inputOperatingHours"
    );

const importantNotes =
    document.getElementById(
        "inputImportantNotes"
    );


// =====================================================
// LOCATION NAME
// =====================================================

if (locationName) {

    locationName.value =
        data.dropoff_location_name || "";
}


// =====================================================
// ADDRESS
// =====================================================

if (locationAddress) {

    locationAddress.value =
        data.dropoff_address || "";
}


// =====================================================
// HOURS
// =====================================================

if (operatingHours) {

    operatingHours.value =
        data.dropoff_hours || "";
}


// =====================================================
// NOTES
// =====================================================

if (importantNotes) {

    importantNotes.value =
        data.dropoff_notes || "";
}


// =====================================================
// INITIAL STATE
// =====================================================

initialPaymentFormState = {

    payment_method:
        paymentMethod,

    gcash_name:
        data.gcash_name || "",

    gcash_number:
        data.gcash_number || "",

    maya_name:
        data.maya_name || "",

    maya_number:
        data.maya_number || "",

    dropoff_location_name:
        data.dropoff_location_name || "",

    dropoff_address:
        data.dropoff_address || "",

    dropoff_hours:
        data.dropoff_hours || "",

    dropoff_notes:
        data.dropoff_notes || ""
};
        

        console.log(
            "Payment details loaded:",
            {
                payment_method:
                    paymentMethod,

                gcash_name:
                    data.gcash_name,

                gcash_number:
                    data.gcash_number,

                maya_name:
                    data.maya_name,

                maya_number:
                    data.maya_number,

                maya_qr_code:
                    data.maya_qr_code,

                dropoff_address:
                    data.dropoff_address
            }
        );

    } catch (error) {

        console.error(
            "fetchPaymentDetails error:",
            error
        );
    }
}
async function fetchDonations() {
    try {
        const res = await fetch("/org/donations");
        const result = await res.json();

        if (result.success) {
            allDonations = result.donations || [];

            const totalAmount = parseFloat(result.totalDonations || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            const totalDisplay = document.getElementById("displayTotalDonation");
            if (totalDisplay) {
                totalDisplay.textContent = `₱${totalAmount}`;
            }

            cashCurrentPage = 1;  
            updateCashStatusPills();               
            renderDonationsTable(allDonations);
        }
    } catch (error) {
        console.error("Error fetching donations:", error);
        const tbody = document.getElementById("donationsTableBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-500">Failed to load cash donations.</td></tr>`;
        }
    }
}
function renderDonationsTable(donations) {
    const tbody = document.getElementById("donationsTableBody");
    if (!tbody) return;

    cashFilteredData = donations || [];

    // Empty state
    if (cashFilteredData.length === 0) {
        let emptyMsg = 'No cash donations recorded yet.';
        if (cashStatusFilter === 'Pending')        emptyMsg = 'No pending cash donations — you\'re all caught up!';
        else if (cashStatusFilter === 'Confirmed') emptyMsg = 'No confirmed cash donations yet.';
        else if (cashStatusFilter === 'Rejected')  emptyMsg = 'No rejected cash donations.';

        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-400">No cash donations recorded yet.</td></tr>`;
        updatePaginationInfo("paginationInfo", 0, 0, 0);
        renderPaginationButtons("paginationButtons", 1, 1, () => {}, 0);
        return;
    }

    // ⭐ Compute current page slice
    const totalPages = Math.max(1, Math.ceil(cashFilteredData.length / ROWS_PER_PAGE));
    if (cashCurrentPage > totalPages) cashCurrentPage = totalPages;
    if (cashCurrentPage < 1) cashCurrentPage = 1;

    const startIdx = (cashCurrentPage - 1) * ROWS_PER_PAGE;
    const endIdx   = startIdx + ROWS_PER_PAGE;
    const pageData = cashFilteredData.slice(startIdx, endIdx);

    tbody.innerHTML = pageData.map((d) => {
        const dateObj = new Date(d.created_at);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let statusBadge = '';
        const status = (d.status || 'Pending').toLowerCase();

        if (status === 'approved' || status === 'verified') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-100/70 text-emerald-600 rounded-full"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Verified</span>`;
        } else if (status === 'rejected') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-rose-100/70 text-rose-600 rounded-full"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Rejected</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-100/70 text-amber-600 rounded-full"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Pending</span>`;
        }

        const formattedAmount = parseFloat(d.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const donationId = d.cash_donation_id || d.id;

        const rawMethod = (d.payment_method || d.gateway || d.type || 'gcash').toLowerCase();
        let methodLabel = 'GCASH';
        if (rawMethod.includes('maya') || rawMethod.includes('paymaya')) {
            methodLabel = 'MAYA';
        } else if (rawMethod.includes('gcash')) {
            methodLabel = 'GCASH';
        } else {
            methodLabel = rawMethod.toUpperCase();
        }

        return `
            <tr class="hover:bg-gray-50/30 transition-colors">
                <td class="py-4 px-6">
                    <span class="font-semibold text-gray-900 block">${dateStr}</span>
                    <span class="text-xs text-gray-400 block mt-0.5">${timeStr}</span>
                </td>
                <td class="py-4 px-6 font-medium text-gray-900">
                    ${d.donor_name}
                    <span class="text-xs text-gray-400 block">${d.donor_email || 'No Email Provided'}</span>
                </td>
                <td class="py-4 px-6 font-semibold text-gray-900">₱ ${formattedAmount}</td>
                <td class="py-4 px-6">
                    <span class="font-semibold text-gray-900 block">${methodLabel}</span>
                    <span class="text-xs text-gray-400 block mt-0.5">ref no: ${d.reference_number || 'N/A'}</span>
                </td>
                <td class="py-4 px-6">${statusBadge}</td>
                <td class="py-4 px-6 text-center relative">
                    <button onclick="toggleActionDropdown(event, ${donationId})" class="action-dropdown-btn text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                    </button>
                    <div id="actionMenu-${donationId}" class="action-dropdown-menu hidden absolute right-6 top-12 z-50 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 text-left text-xs font-medium">
                        <button onclick="openReviewModal(${donationId})" class="w-full px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                            <i class="fa-regular fa-eye text-indigo-600"></i> Review Details
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    updatePaginationInfo("paginationInfo", startIdx + 1, Math.min(endIdx, cashFilteredData.length), cashFilteredData.length);
    renderPaginationButtons("paginationButtons", cashCurrentPage, totalPages, (p) => {
        cashCurrentPage = p;
        renderDonationsTable(cashFilteredData);
    }, cashFilteredData.length);
}

async function fetchInKindDonations() {
    try {
        const res = await fetch("/org/donations/in-kind");
        const result = await res.json();

        if (result.success) {
            allInKindDonations = result.donations || [];
            
            const displayTotal = document.getElementById("displayInKindTotal");
            if (displayTotal) {
                displayTotal.textContent = result.totalInKind || 0; 
            }

            inkindCurrentPage = 1; 
            updateInkindStatusPills();                 
            renderInKindTable(allInKindDonations);
        }
    } catch (error) {
        console.error("Error fetching in-kind donations:", error);
        const tbody = document.getElementById("inkindTableBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-500">Failed to load in-kind donations.</td></tr>`;
        }
    }
}
function renderInKindTable(donations) {
    const tbody = document.getElementById("inkindTableBody");
    if (!tbody) return;

    inkindFilteredData = donations || [];

    if (inkindFilteredData.length === 0) {
        let emptyMsg = 'No in-kind donations submitted yet.';
        if (inkindStatusFilter === 'Pending')        emptyMsg = 'No pending in-kind donations — you\'re all caught up!';
        else if (inkindStatusFilter === 'Confirmed') emptyMsg = 'No confirmed in-kind donations yet.';
        else if (inkindStatusFilter === 'Rejected')  emptyMsg = 'No rejected in-kind donations.';

        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-400">No in-kind donations submitted yet.</td></tr>`;
        updatePaginationInfo("inkindPaginationInfo", 0, 0, 0);
        renderPaginationButtons("inkindPaginationButtons", 1, 1, () => {}, 0);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(inkindFilteredData.length / ROWS_PER_PAGE));
    if (inkindCurrentPage > totalPages) inkindCurrentPage = totalPages;
    if (inkindCurrentPage < 1) inkindCurrentPage = 1;

    const startIdx = (inkindCurrentPage - 1) * ROWS_PER_PAGE;
    const endIdx   = startIdx + ROWS_PER_PAGE;
    const pageData = inkindFilteredData.slice(startIdx, endIdx);

    tbody.innerHTML = pageData.map((d) => {
        const dateObj = new Date(d.created_at || Date.now());
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        let statusBadge = '';
        const status = (d.status || 'Pending').toLowerCase();

        if (status === 'approved' || status === 'verified') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-100/70 text-emerald-600 rounded-full"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Approved</span>`;
        } else if (status === 'rejected') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-rose-100/70 text-rose-600 rounded-full"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Rejected</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-100/70 text-amber-600 rounded-full"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Pending</span>`;
        }

        const inkindId = d.inkind_donation_id || d.id;

        return `
            <tr class="hover:bg-gray-50/30 transition-colors">
                <td class="py-4 px-6 font-semibold text-gray-900">${dateStr}</td>
                <td class="py-4 px-6 font-medium text-gray-900">${d.donor_name || 'Anonymous'}</td>
                <td class="py-4 px-6 font-semibold text-gray-800">${d.item_name}</td>
                <td class="py-4 px-6 text-gray-600">${d.quantity}</td>
                <td class="py-4 px-6">${statusBadge}</td>
                <td class="py-4 px-6 text-center">
                    <button onclick="openInKindModal(${inkindId})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 mx-auto">
                        <i class="fa-regular fa-eye"></i> Review
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    updatePaginationInfo("inkindPaginationInfo", startIdx + 1, Math.min(endIdx, inkindFilteredData.length), inkindFilteredData.length);
    renderPaginationButtons("inkindPaginationButtons", inkindCurrentPage, totalPages, (p) => {
        inkindCurrentPage = p;
        renderInKindTable(inkindFilteredData);
    }, inkindFilteredData.length);
}
/**
 * Opens the in-kind donation review modal
 * and displays the selected donation details[cite: 5].
 */
function openInKindModal(id) {
    selectedInKindId = id;
    const donation = allInKindDonations.find(item => (item.inkind_donation_id || item.id) == id);
    if (!donation) return;

    hideInKindRejectionFlow();
    resetInkindProof();
    clearInkindProofError();

    document.getElementById("inkindDonorName").value = donation.donor_name || "N/A";
    document.getElementById("inkindItemName").value  = donation.item_name  || "N/A";
    document.getElementById("inkindQuantity").value  = donation.quantity   || "N/A";

     const categoryInput = document.getElementById("inkindCategory");
    if (categoryInput) {
        categoryInput.value = donation.category || "—";
    }

    // Donor's submitted photo of the item
    const donorProofWrap = document.getElementById("inkindDonorProofSection");
    const donorProofImg  = document.getElementById("inkindDonorProofImg");

    if (donation.proof_image_path && donorProofImg && donorProofWrap) {
        let donorProofPath = donation.proof_image_path;
        if (!donorProofPath.startsWith("/") && !donorProofPath.startsWith("http")) {
            donorProofPath = `/uploads/inkind-proof/${donorProofPath}`;
        }
        donorProofImg.src = donorProofPath;
        donorProofWrap.classList.remove("hidden");
    } else if (donorProofWrap) {
        donorProofWrap.classList.add("hidden");
    }

    const banner       = document.getElementById("inkindStatusBanner");
    const approveBtn   = document.getElementById("inkindApproveBtn");
    const rejectBtn    = document.getElementById("inkindRejectBtn");
    const proofSection = document.getElementById("inkindProofSection");
    const status       = (donation.status || 'Pending').toLowerCase();

    if (status === 'approved' || status === 'verified') {
        banner.className = "mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-semibold";
        banner.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                <span>This in-kind donation has been approved & received.</span>
            </div>
            <span class="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-full text-[11px]">Approved</span>
        `;
        banner.classList.remove("hidden");

        approveBtn.disabled = true;
        approveBtn.className = "px-4 py-2 bg-gray-300 text-gray-500 text-xs font-semibold rounded-lg cursor-not-allowed";
        rejectBtn.classList.add("hidden");

        // Walang action → itago ang proof upload section
        if (proofSection) proofSection.classList.add("hidden");

        // Kung approved na at may org proof na, ipakita ito sa donor proof area na naman
        if (donation.org_proof_image_path && donorProofImg && donorProofWrap) {
            let orgProofPath = donation.org_proof_image_path;
            if (!orgProofPath.startsWith("/") && !orgProofPath.startsWith("http")) {
                orgProofPath = `/uploads/inkind-proof/${orgProofPath}`;
            }
            donorProofImg.src = orgProofPath;
            donorProofWrap.classList.remove("hidden");
        }

    } else if (status === 'rejected') {
        banner.className = "mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-1";
        banner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-xmark text-rose-600 text-base"></i>
                    <span>This in-kind donation was rejected.</span>
                </div>
                <span class="px-2.5 py-0.5 bg-rose-200/60 text-rose-800 rounded-full text-[11px]">Rejected</span>
            </div>
            ${donation.rejection_reason ? `<p class="text-[11px] font-normal text-rose-700 pl-6">Reason: ${donation.rejection_reason}</p>` : ''}
        `;
        banner.classList.remove("hidden");

        approveBtn.disabled = false;
        approveBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition";
        approveBtn.textContent = "Re-approve & Receive";
        rejectBtn.classList.add("hidden");

        if (proofSection) proofSection.classList.remove("hidden");

    } else {
        banner.classList.add("hidden");
        approveBtn.disabled = false;
        approveBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition";
        approveBtn.textContent = "Approve / Received";
        rejectBtn.classList.remove("hidden");

        if (proofSection) proofSection.classList.remove("hidden");
    }

    const modal = document.getElementById("reviewInKindModal");
    modal.classList.remove("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.remove("scale-95");
}


/**
 * Closes the in-kind donation review modal[cite: 5].
 */
function closeInKindModal() {
    const modal = document.getElementById("reviewInKindModal");
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.add("scale-95");
    selectedInKindId = null;
}

/**
 * Displays the rejection section
 * for an in-kind donation[cite: 5].
 */
function showInKindRejectionFlow() {
    document.getElementById("inkindRejectionSection").classList.remove("hidden");
    document.getElementById("inkindInitialActionButtons").classList.add("hidden");
    document.getElementById("inkindRejectionActionButtons").classList.remove("hidden");
    updateInKindRejectionText();
}

/**
 * Hides the in-kind rejection section
 * and restores the default action buttons[cite: 5].
 */
function hideInKindRejectionFlow() {
    document.getElementById("inkindRejectionSection").classList.add("hidden");
    document.getElementById("inkindInitialActionButtons").classList.remove("hidden");
    document.getElementById("inkindRejectionActionButtons").classList.add("hidden");
}

/**
 * Updates the rejection reason message
 * based on the selected rejection option[cite: 5].
 */
function updateInKindRejectionText() {
    const selectedRadio = document.querySelector('input[name="inkindRejectReason"]:checked');
    const reasonBox = document.getElementById("inkindRejectionReasonText");
    
    if (selectedRadio) {
        const val = selectedRadio.value;
        if (val === "Damaged or Unusable Condition") {
            reasonBox.textContent = "Verification failed. The donated items are damaged or unusable upon physical inspection.";
        } else if (val === "Inappropriate / Unaccepted Item Category") {
            reasonBox.textContent = "Verification failed. The donated items fall under categories not currently accepted or needed by the shelter.";
        } else if (val === "Item Not Received at Drop-off") {
            reasonBox.textContent = "Verification failed. The items were not delivered or dropped off within the designated period.";
        } else {
            reasonBox.textContent = "Verification failed. This in-kind donation appears to be a duplicate entry.";
        }
    }
}

/**
 * Submits the rejection reason
 * for an in-kind donation[cite: 5].
 */
async function submitInKindRejection() {
    const reasonText = document.getElementById("inkindRejectionReasonText").textContent;
    await updateInKindStatus('Rejected', reasonText);
}

/**
 * Updates the status of the selected
 * in-kind donation[cite: 5].
 */
async function updateInKindStatus(newStatus, reason = null) {
    if (!selectedInKindId) return;

    // ⭐ Require proof photo for BOTH approve & reject
    const proofErr = validateInkindProofFile(inkindProofFile);
    if (proofErr) {
        showInkindProofError(proofErr);
        showToast(proofErr, 'error');
        return;
    }
    clearInkindProofError();

    try {
        const formData = new FormData();
        formData.append("status", newStatus);
        if (reason) formData.append("reason", reason);
        formData.append("proof_image", inkindProofFile);   // must match multer's field name

        const res = await fetch(`/org/donations/in-kind/${selectedInKindId}/status`, {
            method: "PUT",
            body: formData
            // NOTE: DO NOT set Content-Type — browser sets multipart boundary automatically
        });

        const result = await res.json();

        if (result.success) {
            showToast(`In-kind donation marked as ${newStatus}!`, 'success');
            closeInKindModal();
            fetchInKindDonations();
        } else {
            showToast("Failed: " + (result.message || "Unable to update status."), 'error');
        }
    } catch (err) {
        console.error("updateInKindStatus error:", err);
        showToast("An error occurred while updating status.", 'error');
    }
}

/**
 * Filters the current table based on search input + active status sub-tab.
 */
function filterDonations() {
    const searchInput = document.getElementById("searchInput");
    const searchTerm  = searchInput ? searchInput.value.toLowerCase() : "";

    if (activeTab === 'cash') {
        cashCurrentPage = 1;

        const filtered = allDonations.filter(d => {
            const matchesSearch =
                (d.donor_name       && d.donor_name.toLowerCase().includes(searchTerm)) ||
                (d.reference_number && d.reference_number.toLowerCase().includes(searchTerm)) ||
                (d.amount           && d.amount.toString().includes(searchTerm));

            const matchesStatus =
                cashStatusFilter === 'ALL' ||
                getStatusCategory(d.status) === cashStatusFilter;

            return matchesSearch && matchesStatus;
        });

        renderDonationsTable(filtered);

    } else {
        inkindCurrentPage = 1;

        const filtered = allInKindDonations.filter(d => {
            const matchesSearch =
                (d.donor_name && d.donor_name.toLowerCase().includes(searchTerm)) ||
                (d.item_name  && d.item_name.toLowerCase().includes(searchTerm));

            const matchesStatus =
                inkindStatusFilter === 'ALL' ||
                getStatusCategory(d.status) === inkindStatusFilter;

            return matchesSearch && matchesStatus;
        });

        renderInKindTable(filtered);
    }
}

/**
 * Shows or hides the action dropdown menu
 * for the selected cash donation[cite: 5].
 */
function toggleActionDropdown(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.action-dropdown-menu').forEach(menu => {
        if (menu.id !== `actionMenu-${id}`) menu.classList.add('hidden');
    });
    const targetMenu = document.getElementById(`actionMenu-${id}`);
    if (targetMenu) targetMenu.classList.toggle('hidden');
}

/**
 * Updates the "Showing X to Y of Z results" text.
 */
function updatePaginationInfo(elementId, start, end, total) {
    const pagInfo = document.getElementById(elementId);
    if (!pagInfo) return;

    if (total === 0) {
        pagInfo.textContent = "Showing 0 results";
    } else {
        pagInfo.textContent = `Showing ${start} to ${end} of ${total} results`;
    }
}

/**
 * Renders prev / page numbers / next inside the given container.
 */
function renderPaginationButtons(containerId, currentPage, totalPages, onPageClick, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    // Kung 1 page lang o walang laman, itago ang lahat ng buttons
    if (total === 0 || totalPages <= 1) {
        return;
    }

    const makeBtn = (label, page, { disabled = false, active = false } = {}) => {
        const btn = document.createElement("button");
        btn.type = "button";

        let cls = "min-w-[36px] h-9 px-3 rounded-lg text-sm font-semibold border transition flex items-center justify-center";

        if (active) {
            cls += " bg-indigo-600 text-white border-indigo-600 shadow-sm";
        } else if (disabled) {
            cls += " bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed";
        } else {
            cls += " bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-indigo-700";
        }

        btn.className = cls;
        btn.innerHTML = label;
        btn.disabled = disabled;

        if (!disabled && !active) {
            btn.addEventListener("click", () => onPageClick(page));
        }
        return btn;
    };

    // Prev
    container.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-left text-xs"></i>',
        currentPage - 1,
        { disabled: currentPage === 1 }
    ));

    // Page numbers with ellipsis
    const pages = getPaginationRange(currentPage, totalPages);
    pages.forEach(p => {
        if (p === "...") {
            const span = document.createElement("span");
            span.className = "px-1 text-gray-400 text-sm font-semibold select-none";
            span.textContent = "...";
            container.appendChild(span);
        } else {
            container.appendChild(makeBtn(p, p, { active: p === currentPage }));
        }
    });

    // Next
    container.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-right text-xs"></i>',
        currentPage + 1,
        { disabled: currentPage === totalPages }
    ));
}

/**
 * Helper para sa page numbers with ellipsis (hal. 1 … 4 5 6 … 20)
 */
function getPaginationRange(current, total) {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    let last;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

    range.forEach(i => {
        if (last) {
            if (i - last === 2) {
                rangeWithDots.push(last + 1);
            } else if (i - last > 2) {
                rangeWithDots.push("...");
            }
        }
        rangeWithDots.push(i);
        last = i;
    });

    return rangeWithDots;
}

/**
 * Opens the receipt image
 * in a lightbox modal[cite: 5].
 */
function viewReceiptDirect(receiptPathRaw) {
    let fullPath = NO_QR_PLACEHOLDER;
    
    if (receiptPathRaw) {
        fullPath = (receiptPathRaw.startsWith('/') || receiptPathRaw.startsWith('http')) 
            ? receiptPathRaw 
            : `/uploads/receipts/${receiptPathRaw}`;
    }

    const modalImg = document.getElementById("modalReceiptImg");
    const downloadBtn = document.getElementById("downloadReceiptBtn");
    const openBtn = document.getElementById("openReceiptExternal");
    const titleEl = document.getElementById("receiptModalTitle");

    if (modalImg) {
        modalImg.src = fullPath;
        modalImg.classList.add("max-h-[85vh]", "w-auto", "object-contain", "mx-auto");
    }

    if (titleEl) {
        titleEl.textContent = "Proof of Payment Receipt";
    }

    if (downloadBtn) downloadBtn.href = fullPath;
    if (openBtn) openBtn.href = fullPath;

    const modal = document.getElementById("receiptModal");
    if (modal) {
        modal.classList.remove("opacity-0", "pointer-events-none");
        modal.querySelector("div")?.classList.remove("scale-95");
    }
}


/**
 * Opens the in-kind proof image in the same lightbox modal.
 */
function openInkindProofLightbox() {
    const img = document.getElementById("inkindDonorProofImg");
    if (!img || !img.src) return;

    const modalImg = document.getElementById("modalReceiptImg");
    const downloadBtn = document.getElementById("downloadReceiptBtn");
    const openBtn = document.getElementById("openReceiptExternal");
    const titleEl = document.getElementById("receiptModalTitle");

    if (modalImg) modalImg.src = img.src;
    if (titleEl) titleEl.textContent = "Donor's Photo of Donated Item";
    if (downloadBtn) downloadBtn.href = img.src;
    if (openBtn) openBtn.href = img.src;

    const modal = document.getElementById("receiptModal");
    if (modal) {
        modal.classList.remove("opacity-0", "pointer-events-none");
        modal.querySelector("div")?.classList.remove("scale-95");
    }
}

/**
 * vvdfdsdsfdsfdfsfdsfdsf
 */
function closeReceiptModal() {
    const modal = document.getElementById("receiptModal");
    if (modal) {
        modal.classList.add("opacity-0", "pointer-events-none");
        modal.querySelector("div")?.classList.add("scale-95");
    }
}

/**
 * Opens the receipt lightbox
 * from the review modal[cite: 5].
 */
function triggerViewReceiptFromReview() {
    const img = document.getElementById("reviewReceiptImg");
    const rawPath = img?.getAttribute("data-raw-path") || currentReceiptPath || img?.src;

    if (rawPath) {
        viewReceiptDirect(rawPath);
    }
}

/**
 * Opens the cash donation review modal
 * and displays the selected donation details[cite: 5].
 */
function openReviewModal(id) {
    selectedDonationId = id; 
    const donation = allDonations.find(item => (item.cash_donation_id || item.id) == id);
    if (!donation) return;

    closeInKindModal();

    document.getElementById("reviewDonorName").value = donation.donor_name || "N/A";
    document.getElementById("reviewAmount").value = parseFloat(donation.amount || 0).toFixed(2);
    document.getElementById("reviewRefNo").value = donation.reference_number || donation.reference_no || "N/A";
    document.getElementById("reviewMethod").value = (donation.payment_method || 'GCASH').toUpperCase();
    document.getElementById("reviewAccountName").value = donation.gcash_account_name || "N/A";
    
    let receiptPath = "";
    if (donation.receipt_path) {
        receiptPath = (
            donation.receipt_path.startsWith('/') ||
            donation.receipt_path.startsWith('http')
        )
            ? donation.receipt_path
            : `/uploads/receipts/${donation.receipt_path}`;
    } else {
        receiptPath = NO_QR_PLACEHOLDER;
    }

    currentReceiptPath = receiptPath;
    const reviewImg = document.getElementById("reviewReceiptImg");
    if (reviewImg) {
        reviewImg.src = receiptPath;
        reviewImg.setAttribute("data-raw-path", receiptPath);
    }

    const bannerContainer = document.getElementById("statusVerificationBanner");
    const confirmBtn = document.getElementById("confirmVerifyBtn");
    const rejectBtn = document.getElementById("rejectBtnInModal");

    const status = (donation.status || 'Pending').toLowerCase();

    if (status === 'approved' || status === 'verified') {
        bannerContainer.className = "mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-semibold";
        bannerContainer.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                <span>This donation has been verified and approved.</span>
            </div>
            <span class="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-full text-[11px]">Verified</span>
        `;
        bannerContainer.classList.remove("hidden");
        confirmBtn.disabled = true;
        confirmBtn.className = "px-4 py-2 bg-gray-300 text-gray-500 text-xs font-semibold rounded-lg cursor-not-allowed";
        rejectBtn.classList.add("hidden");
    } else if (status === 'rejected') {
        bannerContainer.className = "mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-1";
        bannerContainer.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-xmark text-rose-600 text-base"></i>
                    <span>This donation was rejected.</span>
                </div>
                <span class="px-2.5 py-0.5 bg-rose-200/60 text-rose-800 rounded-full text-[11px]">Rejected</span>
            </div>
            ${donation.rejection_reason ? `<p class="text-[11px] font-normal text-rose-700 pl-6">Reason: ${donation.rejection_reason}</p>` : ''}
        `;
        bannerContainer.classList.remove("hidden");
        confirmBtn.disabled = false;
        confirmBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition";
        confirmBtn.textContent = "Re-verify & Approve";
        rejectBtn.classList.add("hidden");
    } else {
        bannerContainer.classList.add("hidden");
        confirmBtn.disabled = false;
        confirmBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition";
        confirmBtn.textContent = "Confirm & Verify";
        rejectBtn.classList.remove("hidden");
    }

    const modal = document.getElementById("reviewDonationModal");
    if (modal) {
        modal.classList.remove("opacity-0", "pointer-events-none");
        modal.querySelector("div").classList.remove("scale-95");
    }
}

/**
 * Closes the cash donation review modal[cite: 5].
 */
function closeReviewModal() {
    const modal = document.getElementById("reviewDonationModal");
    if (modal) {
        modal.classList.add("opacity-0", "pointer-events-none");
        modal.querySelector("div").classList.add("scale-95");
    }
    selectedDonationId = null;
    currentReceiptPath = null;
}

/**
 * Displays the rejection form
 * for a cash donation[cite: 5].
 */
function showRejectionFlow() {
    document.getElementById("rejectionSection").classList.remove("hidden");
    document.getElementById("initialActionButtons").classList.add("hidden");
    document.getElementById("rejectionActionButtons").classList.remove("hidden");
    updateRejectionText();
}

/**
 * Hides the rejection form
 * and restores the default action buttons[cite: 5].
 */
function hideRejectionFlow() {
    document.getElementById("rejectionSection").classList.add("hidden");
    document.getElementById("initialActionButtons").classList.remove("hidden");
    document.getElementById("rejectionActionButtons").classList.add("hidden");
}

/**
 * Updates the rejection message
 * based on the selected reason[cite: 5].
 */
function updateRejectionText() {
    const selectedRadio = document.querySelector('input[name="rejectReason"]:checked');
    const reasonBox = document.getElementById("rejectionReasonText");
    
    if (selectedRadio) {
        const val = selectedRadio.value;
        if (val === "Amount Mismatch") {
            reasonBox.textContent = "Verification failed. There is a mismatch in the reference numbers and a significant discrepancy in the total; the declared amount does not match the amount shown on the receipt.";
        } else if (val === "Blurry/Unreadable Screenshot") {
            reasonBox.textContent = "Verification failed. The uploaded proof of payment image is blurry or unreadable. Please upload a clear screenshot.";
        } else if (val === "Transaction not found in Records.") {
            reasonBox.textContent = "Verification failed. No matching transaction was found in the official account records for the provided reference number.";
        } else {
            reasonBox.textContent = "Verification failed. This transaction appears to be a duplicate submission.";
        }
    }
}

/**
 * Approves and verifies
 * the selected cash donation[cite: 5].
 */
async function approveDonation() {
    if (!selectedDonationId) return;
    
    try {
        const res = await fetch(`/org/donations/${selectedDonationId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Approved" })
        });
        const result = await res.json();

        if (result.success) {
            showToast("Donation successfully verified and approved!", 'success'); 
            closeReviewModal();
            fetchDonations();
        } else {
            showToast("Failed: " + result.message, 'error'); 
        }
    } catch (err) {
        showToast("An error occurred while approving the donation.", 'error');
    }
}

/**
 * Rejects the selected cash donation
 * and records the rejection reason[cite: 5].
 */
async function rejectDonation() {
    if (!selectedDonationId) return;
    const reasonText = document.getElementById("rejectionReasonText").textContent;

    try {
        const res = await fetch(`/org/donations/${selectedDonationId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Rejected", reason: reasonText })
        });
        const result = await res.json();

        if (result.success) {
            showToast("Donation rejected.", 'success'); 
            closeReviewModal();
            fetchDonations();
        } else {
            showToast("Failed: " + result.message, 'error');
        }
    } catch (err) {
        showToast("An error occurred while rejecting the donation.", 'error'); 
    }
}

/**
 * Opens the donation settings
 * configuration modal[cite: 5].
 */
async function openConfigModal() {
    const modal = document.getElementById('paymentConfigModal');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('div').classList.remove('scale-95');
    }

    fetchDropoffHours();
    // Auto-fill ang Complete Address galing sa Org Profile, pero LANG kung wala pa itong laman
    // (hindi papatungan ang address na sadyang na-customize na ng org para sa drop-off)
    const addressInput = document.getElementById("inputLocationAddress");
    if (addressInput && !addressInput.value.trim()) {
        try {
            const res = await fetch("/api/organization/profile");
            if (res.ok) {
                const data = await res.json();
                const addressParts = [
                    data.address,
                    data.barangay ? `Brgy. ${data.barangay}` : "",
                    data.city,
                    data.province,
                    data.zip_code
                ].filter(part => part && String(part).trim() !== "");

                if (addressParts.length > 0) {
                    addressInput.value = addressParts.join(", ");
                }
            }
        } catch (err) {
            console.error("Unable to auto-fill address from profile:", err);
        }
    }
}

/**
 * Closes the donation settings
 * configuration modal[cite: 5].
 */
function closeConfigModal() {
    const modal = document.getElementById('paymentConfigModal');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('div').classList.add('scale-95');
    }
}

/**
 * Displays a preview of the selected
 * image before uploading[cite: 5].
 */
function previewImage(event, previewId) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById(previewId).src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Saves the organization's payment information and in-kind drop-off settings.
 */
async function savePaymentDetails(e) {
    e.preventDefault();

    const saveBtn = document.getElementById("saveBtn");

    if (!saveBtn) {
        console.error("Save button #saveBtn was not found.");
        return;
    }

    const originalBtnText = saveBtn.innerHTML;

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...`;

    try {
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element && element.value !== undefined
                ? String(element.value).trim()
                : "";
        };

        const phMobileRegex = /^09\d{9}$/;

        const validateMobileNumber = (value, label, errorElId) => {
            const errorEl = document.getElementById(errorElId);
            const digitsOnly = value.replace(/\D/g, "");

            if (!digitsOnly) {
                if (errorEl) errorEl.classList.add("hidden");
                return { valid: true, value: "" };
            }

            if (!phMobileRegex.test(digitsOnly)) {
                if (errorEl) errorEl.classList.remove("hidden");
                return { valid: false, value: digitsOnly };
            }

            if (errorEl) errorEl.classList.add("hidden");
            return { valid: true, value: digitsOnly };
        };

        const current = {
            payment_method: getValue("inputPaymentMethod"),
            gcash_name:     getValue("inputAccountName"),
            gcash_number:   getValue("inputAccountNum"),
            maya_name:      getValue("inputMayaName"),
            maya_number:    getValue("inputMayaNum"),
            dropoff_location_name: getValue("inputLocationName"),
            dropoff_address:       getValue("inputLocationAddress"),
            dropoff_hours:         getValue("inputOperatingHours"),
            dropoff_notes:         getValue("inputImportantNotes")
        };

        const gcashCheck = validateMobileNumber(current.gcash_number, "GCash", "gcashNumError");
        const mayaCheck = validateMobileNumber(current.maya_number, "Maya", "mayaNumError");

        if (!gcashCheck.valid || !mayaCheck.valid) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
            showToast("Please enter a valid 11-digit GCash/Maya number starting with 09 (e.g., 09123456789).", "error");
            return;
        }

        current.gcash_number = gcashCheck.value;
        current.maya_number = mayaCheck.value;

        const qrPreviewEl = document.getElementById("qrPreview");
        const mayaQrPreviewEl = document.getElementById("mayaQrPreview");
        const qrInputEl = document.getElementById("qrInput");
        const mayaQrInputEl = document.getElementById("mayaQrInput");

        const hasGcashQr =
            (qrInputEl && qrInputEl.files && qrInputEl.files.length > 0) ||
            (qrPreviewEl && !qrPreviewEl.classList.contains("hidden"));

        const hasMayaQr =
            (mayaQrInputEl && mayaQrInputEl.files && mayaQrInputEl.files.length > 0) ||
            (mayaQrPreviewEl && !mayaQrPreviewEl.classList.contains("hidden"));

        const missingFields = [];

        if (current.payment_method === "maya") {
            if (!current.maya_name) missingFields.push("Maya Account Name");
            if (!current.maya_number) missingFields.push("Maya Number");
            if (!hasMayaQr) missingFields.push("Maya QR Code Image");
        } else {
            if (!current.gcash_name) missingFields.push("GCash Account Name");
            if (!current.gcash_number) missingFields.push("GCash Number");
            if (!hasGcashQr) missingFields.push("GCash QR Code Image");
        }

        if (missingFields.length > 0) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
            showToast(
                `Incomplete ${current.payment_method === "maya" ? "Maya" : "GCash"} details — missing: ${missingFields.join(", ")}. All fields, including the QR code, are required.`,
                "error"
            );
            return;
        }

        const locationPreviewEl = document.getElementById("locationPreview");
        const locationImgInputEl = document.getElementById("locationImgInput");

        const hasLocationPhoto =
            (locationImgInputEl && locationImgInputEl.files && locationImgInputEl.files.length > 0) ||
            (locationPreviewEl && locationPreviewEl.src && !locationPreviewEl.src.startsWith("data:image/svg+xml"));

        const inkindValues = {
            locationName: current.dropoff_location_name,
            address: current.dropoff_address,
            hours: current.dropoff_hours,
            hasPhoto: hasLocationPhoto
        };

        const anyInkindFilled =
            !!inkindValues.locationName ||
            !!inkindValues.address ||
            !!inkindValues.hours ||
            inkindValues.hasPhoto;

        if (activeTab === "inkind" && anyInkindFilled) {
            const missingInkindFields = [];
            if (!inkindValues.locationName) missingInkindFields.push("Location Name");
            if (!inkindValues.address) missingInkindFields.push("Complete Address");
            if (!inkindValues.hours) missingInkindFields.push("Drop-Off Days & Hours");
            if (!inkindValues.hasPhoto) missingInkindFields.push("Drop-Off Location Photo");

            if (missingInkindFields.length > 0) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnText;
                showToast(
                    `You've started setting up In-Kind Drop-Off — please also complete: ${missingInkindFields.join(", ")}.`,
                    "error"
                );
                return;
            }
        }

        const form = document.getElementById("paymentConfigForm");
        if (!form) {
            showToast("Payment configuration form was not found.", "error");
            return;
        }

        const formData = new FormData(form);
        formData.set("active_tab", activeTab);
        formData.set("payment_method", current.payment_method);
        formData.set("gcash_name", current.gcash_name);
        formData.set("gcash_number", current.gcash_number);
        formData.set("maya_name", current.maya_name);
        formData.set("maya_number", current.maya_number);
        formData.set("dropoff_location_name", current.dropoff_location_name);
        formData.set("dropoff_address", current.dropoff_address);
        formData.set("dropoff_hours", current.dropoff_hours);
        formData.set("dropoff_notes", current.dropoff_notes);

        formData.delete("dropoff_image");
        formData.delete("location_image");

        if (locationImgInputEl && locationImgInputEl.files && locationImgInputEl.files.length > 0) {
            formData.append("location_image", locationImgInputEl.files[0]);
        }

        const response = await fetch("/org/payment-info", {
            method: "POST",
            body: formData
        });

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error("Invalid server response:", jsonError);
            const text = await response.text();
            console.error("Server response:", text);
            throw new Error("Server returned an invalid response.");
        }

        if (!response.ok || !result.success) {
            showToast(result.message || "Unable to save settings.", "error");
            return;
        }

        showToast("Settings saved successfully!", "success");

        if (typeof closeConfigModal === "function") {
            closeConfigModal();
        }

        if (typeof fetchPaymentDetails === "function") {
            await fetchPaymentDetails();
        }

        await loadInKindSettings();

    } catch (error) {
        console.error("Save settings error:", error);
        showToast(error.message || "An unexpected error occurred while saving.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

/**
 * Toast notification
 */
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) {
        console.warn("Toast container not found.");
        return;
    }

    const toast = document.createElement("div");
    const isSuccess = type === "success";

    toast.className =
        `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all duration-300 transform translate-y-5 opacity-0 ${
            isSuccess
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
        }`;

    toast.innerHTML = `
        <i class="fa-solid ${
            isSuccess
                ? "fa-circle-check text-emerald-600"
                : "fa-circle-xmark text-rose-600"
        } text-base"></i>

        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-5", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

/**
 * Export menu
 */
function toggleExportMenu() {
    const exportMenu = document.getElementById("exportMenu");
    if (!exportMenu) return;
    exportMenu.classList.toggle("hidden");
}

window.addEventListener("click", function(event) {
    if (
        !event.target.matches(".dropdown-toggle") &&
        !event.target.closest(".dropdown-toggle")
    ) {
        const exportMenu = document.getElementById("exportMenu");
        if (exportMenu && !exportMenu.classList.contains("hidden")) {
            exportMenu.classList.add("hidden");
        }
    }
});

/**
 * Date filter
 */
function toggleDateInput() {
    const filterType = document.getElementById("filterType")?.value;
    const datePicker = document.getElementById("datePicker");
    if (!datePicker) return;

    if (filterType === "year") {
        datePicker.type = "number";
        datePicker.placeholder = "YYYY";
        datePicker.value = new Date().getFullYear();
        datePicker.min = "2000";
        datePicker.max = "2100";
    } else {
        datePicker.type = "month";
        datePicker.value = "2026-08";
    }
}

/**
 * Refresh data
 */
function refreshData() {
    if (typeof fetchPaymentDetails === "function") fetchPaymentDetails();
    if (typeof fetchDonations === "function") fetchDonations();
    if (typeof fetchInKindDonations === "function") fetchInKindDonations();
    showToast("Donation list refreshed!", "success");
}

async function exportFile(format) {
    const filterType = document.getElementById("filterType")?.value || "";
    const dateValue = document.getElementById("datePicker")?.value || "";
    const currentTab = typeof activeTab !== "undefined" ? activeTab : "cash";

    const url =
        `/org/donations/export?format=${encodeURIComponent(format)}` +
        `&tab=${encodeURIComponent(currentTab)}` +
        `&type=${encodeURIComponent(filterType)}` +
        `&date=${encodeURIComponent(dateValue)}`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: "Bearer " + (localStorage.getItem("token") || "")
            }
        });

        if (!response.ok) {
            const serverError = await response.json().catch(() => null);

            if (
                response.status === 404 &&
                serverError?.message?.includes("No verified/approved")
            ) {
                let noRecordMessage = "No records found for the selected period.";
                if (filterType === "month") {
                    noRecordMessage = "No records found for this month.";
                } else if (filterType === "year") {
                    noRecordMessage = "No records found for this year.";
                }
                showToast(noRecordMessage, "warning");
                return;
            }

            throw new Error(
                serverError?.message ||
                `Server error ${response.status}: ${response.statusText}`
            );
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error("The server returned an empty file.");

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;

        const fileExtension = format === "excel" ? "xlsx" : "pdf";
        link.download = `${currentTab}_donations_report_${dateValue || "all"}.${fileExtension}`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(downloadUrl);

        showToast(
            `${currentTab.toUpperCase()} report successfully downloaded!`,
            "success"
        );
    } catch (error) {
        console.error("Export error:", error);
        showToast("Failed to download file: " + error.message, "error");
    }
}

/**
 * Load in-kind settings
 */
async function loadInKindSettings() {
    try {
        const response = await fetch("/org/payment-info");
        if (!response.ok) throw new Error(`Unable to load payment information (${response.status}).`);

        const result = await response.json();
        if (!result.success || !result.data) return;

        const data = result.data;

        const locationNameInput = document.getElementById("inputLocationName");
        const addressInput = document.getElementById("inputLocationAddress");
        const hoursInput = document.getElementById("inputOperatingHours");
        const notesInput = document.getElementById("inputImportantNotes");
        const preview = document.getElementById("locationPreview");

        if (locationNameInput) locationNameInput.value = data.dropoff_location_name || "";
        if (addressInput) addressInput.value = data.dropoff_address || "";
        if (hoursInput) hoursInput.value = data.dropoff_hours || "";
        if (notesInput) notesInput.value = data.dropoff_notes || "";

        if (preview && data.dropoff_image) {
            let imageUrl = data.dropoff_image;
            if (!imageUrl.startsWith("/") && !imageUrl.startsWith("http")) {
                imageUrl = `/uploads/qr/${imageUrl}`;
            }
            preview.src = imageUrl;
        }

        if (typeof initialPaymentFormState !== "undefined") {
            initialPaymentFormState = {
                ...initialPaymentFormState,
                dropoff_location_name: data.dropoff_location_name || "",
                dropoff_address: data.dropoff_address || "",
                dropoff_hours: data.dropoff_hours || "",
                dropoff_notes: data.dropoff_notes || ""
            };
        }
    } catch (error) {
        console.error("Error loading drop-off details:", error);
    }
}

// Initial load
document.addEventListener("DOMContentLoaded", function() {
    loadInKindSettings();
});

// ==========================================
// DROP-OFF HOURS EDITOR
// ==========================================

const DROPOFF_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let ORG_DROPOFF_HOURS = DROPOFF_DAY_NAMES.map((_, i) => ({
    day_of_week: i,
    is_open: i !== 0,
    start_time: "08:00:00",
    end_time: "18:00:00"
}));

function formatTimeToAMPM(timeStr) {
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
}

function generateDropoffHoursSummary(days) {
    const sorted = [...days].sort((a, b) => a.day_of_week - b.day_of_week);
    const groups = [];

    for (const d of sorted) {
        const key = d.is_open ? `${d.start_time}-${d.end_time}` : "closed";
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
            last.endDow = d.day_of_week;
        } else {
            groups.push({ key, startDow: d.day_of_week, endDow: d.day_of_week, is_open: !!d.is_open, start_time: d.start_time, end_time: d.end_time });
        }
    }

    const openGroups = groups.filter(g => g.is_open);
    if (openGroups.length === 0) return "Closed";

    return openGroups.map(g => {
        const dayLabel = g.startDow === g.endDow
            ? DROPOFF_DAY_NAMES[g.startDow]
            : `${DROPOFF_DAY_NAMES[g.startDow]} - ${DROPOFF_DAY_NAMES[g.endDow]}`;
        return `${dayLabel} ${formatTimeToAMPM(g.start_time)} - ${formatTimeToAMPM(g.end_time)}`;
    }).join(", ");
}

async function fetchDropoffHours() {
    try {
        const res = await fetch('/api/organization/dropoff-hours', { credentials: 'include' });
        const data = await res.json();
        if (data.success && Array.isArray(data.hours) && data.hours.length === 7) {
            ORG_DROPOFF_HOURS = data.hours;
        }
    } catch (err) {
        console.error("Failed to load drop-off hours:", err);
    }

    const summaryEl = document.getElementById("dropoffHoursSummary");
    const hiddenInput = document.getElementById("inputOperatingHours");
    const summary = generateDropoffHoursSummary(ORG_DROPOFF_HOURS);
    if (summaryEl) summaryEl.textContent = summary;
    if (hiddenInput) hiddenInput.value = summary;
}

function openEditDropoffHoursModal() {
    const body = document.getElementById("dropoffHoursFormBody");
    body.innerHTML = DROPOFF_DAY_NAMES.map((name, dow) => {
        const day = ORG_DROPOFF_HOURS.find(d => d.day_of_week === dow) || ORG_DROPOFF_HOURS[dow];
        const startVal = (day.start_time || "08:00:00").slice(0, 5);
        const endVal = (day.end_time || "18:00:00").slice(0, 5);
        return `
            <div class="dropoff-day-row flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50" data-day="${dow}">
                <label class="flex items-center gap-2 w-28 shrink-0 cursor-pointer">
                    <input type="checkbox" class="dropoff-day-open-toggle w-4 h-4 accent-indigo-600 cursor-pointer" data-day="${dow}" ${day.is_open ? 'checked' : ''} onchange="toggleDropoffDayRow(${dow})">
                    <span class="text-sm font-semibold text-gray-700">${name.slice(0, 3)}</span>
                </label>
                <input type="time" class="dropoff-day-start-input flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" data-day="${dow}" value="${startVal}" ${day.is_open ? '' : 'disabled'}>
                <span class="text-gray-400 text-sm">to</span>
                <input type="time" class="dropoff-day-end-input flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" data-day="${dow}" value="${endVal}" ${day.is_open ? '' : 'disabled'}>
            </div>
        `;
    }).join('');

    document.getElementById("editDropoffHoursModal").classList.remove("hidden");
}

function closeEditDropoffHoursModal() {
    document.getElementById("editDropoffHoursModal").classList.add("hidden");
}

function toggleDropoffDayRow(dow) {
    const row = document.querySelector(`#dropoffHoursFormBody .dropoff-day-row[data-day="${dow}"]`);
    if (!row) return;
    const isOpen = row.querySelector('.dropoff-day-open-toggle').checked;
    row.querySelector('.dropoff-day-start-input').disabled = !isOpen;
    row.querySelector('.dropoff-day-end-input').disabled = !isOpen;
}

async function saveDropoffHours() {
    const rows = document.querySelectorAll('#dropoffHoursFormBody .dropoff-day-row');
    const days = [];

    for (const row of rows) {
        const dow = parseInt(row.dataset.day, 10);
        const isOpen = row.querySelector('.dropoff-day-open-toggle').checked;
        const startTime = row.querySelector('.dropoff-day-start-input').value;
        const endTime = row.querySelector('.dropoff-day-end-input').value;

        if (isOpen && (!startTime || !endTime || startTime >= endTime)) {
            showToast(`${DROPOFF_DAY_NAMES[dow]}: Start time must be earlier than end time.`, "error");
            return;
        }

        days.push({
            day_of_week: dow,
            is_open: isOpen,
            start_time: startTime ? `${startTime}:00` : "08:00:00",
            end_time: endTime ? `${endTime}:00` : "18:00:00"
        });
    }

    const saveBtn = document.getElementById("saveDropoffHoursBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const res = await fetch('/api/organization/dropoff-hours', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ days })
        });
        const data = await res.json();

        if (data.success) {
            ORG_DROPOFF_HOURS = days;
            const summary = generateDropoffHoursSummary(days);
            document.getElementById("dropoffHoursSummary").textContent = summary;
            document.getElementById("inputOperatingHours").value = summary;
            closeEditDropoffHoursModal();
        } else {
            showToast(data.message || "Failed to save drop-off hours.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Something went wrong while saving drop-off hours.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Hours";
    }
}