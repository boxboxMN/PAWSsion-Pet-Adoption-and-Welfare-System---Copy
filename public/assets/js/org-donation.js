//Fallback placeholder for QR code if none is available 
const NO_QR_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="%239ca3af">No QR Code</text></svg>';

// Global state
let activeTab = 'cash';
let allDonations = [];
let allInKindDonations = [];
let selectedDonationId = null;
let selectedInKindId = null;
let currentReceiptPath = null;

// Number of rows to display per page
const ROWS_PER_PAGE = 5;
let cashCurrentPage    = 1;
let inkindCurrentPage  = 1;
let cashFilteredData   = [];
let inkindFilteredData = [];

let cashStatusFilter   = 'ALL'; 
let inkindStatusFilter = 'ALL';

let inkindProofFile = null;

// Initial state of the payment form (used for reset)
const MAX_INKIND_PROOF_SIZE = 5 * 1024 * 1024; 

// Allowed file types for in-kind proof upload
const ALLOWED_INKIND_PROOF_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
];
//Runs the page setup after the HtML document has been fully loaded and parsed
document.addEventListener("DOMContentLoaded", async () => {

    await loadTopbar({
        title: "Donations Overview",
        subtitle: "Track funds and in-kind resources submitted by sponsors"
    });
    await loadSidebar("donation");

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown-btn') && !e.target.closest('.action-dropdown-menu')) {
            document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    
    const methodSelect = document.getElementById('inputPaymentMethod');
    if (methodSelect) {
        methodSelect.addEventListener('change', togglePaymentMethodFields);
        togglePaymentMethodFields(); // trigger initially
    }

  
    restrictToDigitsOnly("inputAccountNum", 11);
    restrictToDigitsOnly("inputMayaNum", 11);

    initInkindProofUpload();

    
    fetchPaymentDetails();
    fetchDonations();
    fetchInKindDonations();
});

// Show or hide the payment method fields based on the selected payment method
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

// allows only numeric characters in the specified input and limits the number of digits to a maximum length (default is 11)
function restrictToDigitsOnly(inputId, maxLength = 11) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("input", function () {
        const cleaned = this.value.replace(/\D/g, "").slice(0, maxLength);
        if (this.value !== cleaned) {
            this.value = cleaned;
        }
    });

 
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

// converts the database status into the status category used for filtering and counting
function getStatusCategory(rawStatus) {
    const s = String(rawStatus || 'Pending').toLowerCase().trim();
    if (s === 'approved' || s === 'verified') return 'Confirmed';
    if (s === 'rejected')                    return 'Rejected';
    return 'Pending';
}

//Counts the number of donations in each status category (ALL, Pending, Confirmed, Rejected) from the provided list of donations
function countByStatus(list) {
    const counts = { ALL: 0, Pending: 0, Confirmed: 0, Rejected: 0 };
    (list || []).forEach(item => {
        counts.ALL++;
        counts[getStatusCategory(item.status)]++;
    });
    return counts;
}

// Updates the status pills in the UI with the counts and highlights the active filter
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

//refreshes the status pills for cash donations based on the current filter and counts
function updateCashStatusPills() {
    paintStatusPills('cash', countByStatus(allDonations), cashStatusFilter);
}

//Refreshes the status pills for in-kind donations based on the current filter and counts
function updateInkindStatusPills() {
    paintStatusPills('inkind', countByStatus(allInKindDonations), inkindStatusFilter);
}

//Changes the active cash donation filter and refreshes the table and pills accordingly
function setCashStatusFilter(filter) {
    cashStatusFilter = filter;
    cashCurrentPage = 1;
    updateCashStatusPills();
    filterDonations();
}

//changes the active in-kind donation filter and refreshes the table and pills accordingly
function setInkindStatusFilter(filter) {
    inkindStatusFilter = filter;
    inkindCurrentPage = 1;
    updateInkindStatusPills();
    filterDonations();
}

//clears the selected proof image and resets the upload preview and error message.
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

//displays an error message in the in-kind proof upload section and makes the error visible
function showInkindProofError(msg) {
    const errorEl = document.getElementById("inkindProofError");
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
}

//Hides and clears the in-kind proof upload error message, restoring the section to its default state 
function clearInkindProofError() {
    const errorEl = document.getElementById("inkindProofError");
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
}

//checks whether the proof image exists, uses an allowed image type, and is within the maximum size limit. Returns an error message if invalid, or null if valid.
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

// Stores the selected proof image and displays its preview and filename.

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

// Sets up the in-kind proof upload area, file selection, validation, and remove button.

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

// Switches between the cash and in-kind donation tables.

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
     
    if (tab === 'cash') cashCurrentPage = 1;
    else inkindCurrentPage = 1;

    
    filterDonations();
}


// Switches between the cash payment settings and in-kind drop-off settings sections.

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

// Requests the organization's payment and drop-off information and fills the settings form.

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

// Loads cash donation records from the server and updates the total and donation table.
    
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

// Builds the cash donation table for the current page and adds pagination controls.

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

    //  Compute current page slice
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
                <td class="py-4 px-6 text-center">
                    <button onclick="openReviewModal(${donationId})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 mx-auto">
                        <i class="fa-regular fa-eye"></i> Review
                    </button>
                    
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

// Loads in-kind donation records from the server and updates the total and table.

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

// Builds the in-kind donation table for the current page and adds pagination controls.

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

// Loads the selected in-kind donation into the review modal and adjusts the available actions based on its status.

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

        if (proofSection) proofSection.classList.add("hidden");

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

// Closes the in-kind donation review modal and clears the selected donation ID.

function closeInKindModal() {
    const modal = document.getElementById("reviewInKindModal");
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.add("scale-95");
    selectedInKindId = null;
}
// Displays the in-kind rejection form and hides the initial action buttons.

function showInKindRejectionFlow() {
    document.getElementById("inkindRejectionSection").classList.remove("hidden");
    document.getElementById("inkindInitialActionButtons").classList.add("hidden");
    document.getElementById("inkindRejectionActionButtons").classList.remove("hidden");
    updateInKindRejectionText();
}

// Hides the in-kind rejection form and restores the initial action buttons.

function hideInKindRejectionFlow() {
    document.getElementById("inkindRejectionSection").classList.add("hidden");
    document.getElementById("inkindInitialActionButtons").classList.remove("hidden");
    document.getElementById("inkindRejectionActionButtons").classList.add("hidden");
}
// Sets the rejection explanation based on the selected in-kind rejection reason.

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
 */
async function submitInKindRejection() {
    const reasonText = document.getElementById("inkindRejectionReasonText").textContent;
    await updateInKindStatus('Rejected', reasonText);
}

/**
 * Updates the status of the selected
 */
async function updateInKindStatus(newStatus, reason = null) {
    if (!selectedInKindId) return;

    // Require proof photo for BOTH approve & reject
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
        formData.append("proof_image", inkindProofFile);   

        const res = await fetch(`/org/donations/in-kind/${selectedInKindId}/status`, {
            method: "PUT",
            body: formData
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

// Filters the active donation table using the search text and selected status.

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

// Opens the selected action dropdown and closes any other open dropdown menus.

function toggleActionDropdown(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.action-dropdown-menu').forEach(menu => {
        if (menu.id !== `actionMenu-${id}`) menu.classList.add('hidden');
    });
    const targetMenu = document.getElementById(`actionMenu-${id}`);
    if (targetMenu) targetMenu.classList.toggle('hidden');
}

// Displays which records are currently shown and the total number of matching records.

function updatePaginationInfo(elementId, start, end, total) {
    const pagInfo = document.getElementById(elementId);
    if (!pagInfo) return;

    if (total === 0) {
        pagInfo.textContent = "Showing 0 results";
    } else {
        pagInfo.textContent = `Showing ${start} to ${end} of ${total} results`;
    }
}

// Creates the Previous, page number, and Next buttons for a table.

function renderPaginationButtons(containerId, currentPage, totalPages, onPageClick, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

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

    container.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-left text-xs"></i>',
        currentPage - 1,
        { disabled: currentPage === 1 }
    ));

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

    container.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-right text-xs"></i>',
        currentPage + 1,
        { disabled: currentPage === totalPages }
    ));
}

// Calculates which page numbers and ellipses should appear in the pagination controls.

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


// Opens the receipt image in the preview modal and sets its download and external-view links.

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
        modalImg.className = "max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md mx-auto";
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
// Opens the donor's in-kind proof image in the larger image preview modal.

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


// Closes the receipt or proof image preview modal.

function closeReceiptModal() {
    const modal = document.getElementById("receiptModal");
    if (modal) {
        modal.classList.add("opacity-0", "pointer-events-none");
        modal.querySelector("div")?.classList.add("scale-95");
    }
}

/**
 * Opens the receipt lightbox
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
 * Closes the cash donation review modal
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

// Displays the cash donation rejection form and hides the initial action buttons.

function showRejectionFlow() {
    document.getElementById("rejectionSection").classList.remove("hidden");
    document.getElementById("initialActionButtons").classList.add("hidden");
    document.getElementById("rejectionActionButtons").classList.remove("hidden");
    updateRejectionText();
}

// Hides the cash donation rejection form and restores the initial action buttons.

function hideRejectionFlow() {
    document.getElementById("rejectionSection").classList.add("hidden");
    document.getElementById("initialActionButtons").classList.remove("hidden");
    document.getElementById("rejectionActionButtons").classList.add("hidden");
}

// Sets the cash donation rejection explanation based on the selected reason.

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

// Sends an approval status update for the selected cash donation to the server.

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

// Sends a rejection status and its explanation for the selected cash donation to the server.

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

// Opens the donation settings modal and fills the organization address when the field is empty.

async function openConfigModal() {
    const modal = document.getElementById('paymentConfigModal');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('div').classList.remove('scale-95');
    }

    fetchDropoffHours();
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

// Closes the donation settings modal.

function closeConfigModal() {
    const modal = document.getElementById('paymentConfigModal');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('div').classList.add('scale-95');
    }
}

// Reads a selected image file and displays it in the specified preview element.

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

// Validates and saves the organization's payment details and in-kind drop-off information.

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
let cachedOrganizationName = null;


// Retrieves the logged-in organization's name for use in exported reports.

async function getLoggedInOrganizationName() {
    if (cachedOrganizationName) return cachedOrganizationName;

    const domIds = [
        'orgName', 'organizationName', 'org-name', 'organization-name',
        'greetingOrgName', 'topbarOrgName', 'welcomeOrgName', 'headerOrgName',
        'sidebarOrgName', 'userOrgName', 'profileOrgName'
    ];
    for (const id of domIds) {
        const el = document.getElementById(id);
        if (el) {
            const txt = (el.dataset?.orgName || el.textContent || '').trim();
            if (txt) { cachedOrganizationName = txt; return txt; }
        }
    }

    const domSelectors = [
        '.org-name', '.organization-name', '.greeting-name',
        '[data-org-name]', '.topbar-org-name', '.sidebar-org-name'
    ];
    for (const sel of domSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            const txt = (el.dataset?.orgName || el.textContent || '').trim();
            if (txt) { cachedOrganizationName = txt; return txt; }
        }
    }

    try {
        const res = await fetch('/api/organization/profile', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const name =
                data?.name ||
                data?.organization_name ||
                data?.org_name ||
                data?.orgName ||
                data?.data?.name ||
                data?.data?.organization_name ||
                data?.data?.org_name;
            if (name && String(name).trim()) {
                cachedOrganizationName = String(name).trim();
                return cachedOrganizationName;
            }
        }
    } catch (err) {
        console.warn('Unable to fetch organization name from profile:', err);
    }

    return 'Organization';
}

// Cleans a text value so it can safely be used as part of an exported filename.

function sanitizeFilenamePart(str) {
    return String(str || '')
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim() || 'report';
}

// Creates the readable report period label based on the selected filter and date.

function getReportPeriodLabel(filterType, dateValue) {
    if (!dateValue) return 'All Records';
    if (filterType === 'year') return `Year ${dateValue}`;
    if (filterType === 'month') {
        const [y, m] = String(dateValue).split('-').map(n => parseInt(n, 10));
        if (y && m) {
            return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
                month: 'long', year: 'numeric'
            });
        }
    }
    return String(dateValue);
}

// Converts a date value into the date format used in exported reports.

function formatExportDate(raw) {
    if (!raw) return 'N/A';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Prepares the filtered cash or in-kind donation records for exporting.

function buildExportData(tab, filterType, dateValue) {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const source = tab === 'cash' ? allDonations : allInKindDonations;

    return (source || []).filter(item => {
        // Date filter
        if (filterType && dateValue) {
            const raw = item.created_at || item.date_created;
            if (!raw) return false;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return false;
            if (filterType === 'year') {
                if (d.getFullYear() !== parseInt(dateValue, 10)) return false;
            } else if (filterType === 'month') {
                const [y, m] = String(dateValue).split('-').map(n => parseInt(n, 10));
                if (d.getFullYear() !== y || (d.getMonth() + 1) !== m) return false;
            }
        }

        // Status sub-tab filter
        if (tab === 'cash' && cashStatusFilter !== 'ALL' &&
            getStatusCategory(item.status) !== cashStatusFilter) return false;
        if (tab === 'inkind' && inkindStatusFilter !== 'ALL' &&
            getStatusCategory(item.status) !== inkindStatusFilter) return false;

        // Search filter
        if (searchTerm) {
            const haystack = tab === 'cash'
                ? `${item.donor_name || ''} ${item.reference_number || ''} ${item.amount || ''}`
                : `${item.donor_name || ''} ${item.item_name || ''}`;
            if (!haystack.toLowerCase().includes(searchTerm)) return false;
        }

        return true;
    });
}

// Creates a PDF report containing the selected donation records and report details.

function generateDonationPDF(orgName, tab, data, reportPeriod) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast('PDF library not loaded.', 'error');
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const generatedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const reportTitle = tab === 'cash'
        ? 'Cash Donations Report'
        : 'In-Kind Donations Report';

    // ---- Header ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text(orgName, pageWidth / 2, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text(reportTitle, pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${reportPeriod}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Generated on: ${generatedAt}`, pageWidth / 2, 33, { align: 'center' });

    // ---- Table data ----
    let head, body;
    if (tab === 'cash') {
        head = [['Date', 'Donor', 'Amount (PHP)', 'Method', 'Reference No.', 'Status']];
        body = data.map(d => {
            const amount = parseFloat(d.amount || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
            return [
                formatExportDate(d.created_at),
                d.donor_name || 'N/A',
                amount,
                String(d.payment_method || d.gateway || 'gcash').toUpperCase(),
                d.reference_number || '—',
                getStatusCategory(d.status)
            ];
        });
    } else {
       
        head = [['Date', 'Donor', 'Item Name', 'Quantity', 'Status']];
        body = data.map(d => [
            formatExportDate(d.created_at),
            d.donor_name || 'Anonymous',
            d.item_name || 'N/A',
            String(d.quantity ?? 'N/A'),
            getStatusCategory(d.status)
        ]);
    }

     doc.autoTable({
        head,
        body,
        startY: 38,
        styles: { 
            fontSize: 9, 
            cellPadding: 4, 
            overflow: 'linebreak', 
            valign: 'middle',
            halign: 'center' // Center lahat ng data
        },
        headStyles: { 
            fillColor: [79, 70, 229], 
            textColor: 255, 
            fontStyle: 'bold', 
            halign: 'center',
            valign: 'middle'
        },
        bodyStyles: {
            halign: 'center',
            valign: 'middle'
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 15, right: 15, top: 38, bottom: 14 },
        didDrawPage: (hookData) => {
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(orgName, 15, pageHeight - 8, { align: 'left' });
            doc.text(
                `Page ${hookData.pageNumber} of ${pageCount}`,
                pageWidth - 15, pageHeight - 8, { align: 'right' }
            );
        }
    });

    const filename = `${sanitizeFilenamePart(orgName)}_${tab}_donations_${sanitizeFilenamePart(reportPeriod)}.pdf`;
    doc.save(filename);
    showToast(`${tab === 'cash' ? 'Cash' : 'In-Kind'} report downloaded!`, 'success');
}

// Creates an Excel report containing the selected donation records.

function generateDonationExcel(orgName, tab, data, reportPeriod) {
    let headers, rows;
    if (tab === 'cash') {
        
        headers = ['Date', 'Donor', 'Amount (PHP)', 'Method', 'Reference No.', 'Status'];
        rows = data.map(d => [
            formatExportDate(d.created_at),
            d.donor_name || 'N/A',
            parseFloat(d.amount || 0).toFixed(2),
            String(d.payment_method || d.gateway || 'gcash').toUpperCase(),
            d.reference_number || '',
            getStatusCategory(d.status)
        ]);
    } else {
        headers = ['Date', 'Donor', 'Item Name', 'Quantity', 'Category', 'Status'];
        rows = data.map(d => [
            formatExportDate(d.created_at),
            d.donor_name || 'Anonymous',
            d.item_name || 'N/A',
            String(d.quantity ?? ''),
            d.category || '',
            getStatusCategory(d.status)
        ]);
    }

    const escapeHtml = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const colCount = headers.length;
    const title = tab === 'cash' ? 'Cash Donations Report' : 'In-Kind Donations Report';

    // ⭐ DATE ONLY — walang oras
    const generatedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]>
<xml>
<x:ExcelWorkbook>
<x:ExcelWorksheets>
<x:ExcelWorksheet>
<x:Name>${tab === 'cash' ? 'Cash Donations' : 'In-Kind Donations'}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet>
</x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
  .org-title    { font-size: 16pt; font-weight: bold; color: #1f2937; padding: 2px 6px; }
  .report-title { font-size: 13pt; font-weight: bold; color: #4f46e5; padding: 2px 6px; }
  .meta         { font-size: 9pt;  color: #6b7280; padding: 2px 6px; }
  th { background: #4f46e5; color: #ffffff; text-align: left; padding: 6px 10px; border: 1px solid #3730a3; }
  td { padding: 5px 10px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
</style>
</head>
<body>
  <table>
    <tr><td colspan="${colCount}" class="org-title">${escapeHtml(orgName)}</td></tr>
    <tr><td colspan="${colCount}" class="report-title">${escapeHtml(title)}</td></tr>
    <tr><td colspan="${colCount}" class="meta">Period: ${escapeHtml(reportPeriod)}</td></tr>
    <tr><td colspan="${colCount}" class="meta">Generated on: ${escapeHtml(generatedAt)}</td></tr>
    <tr><td colspan="${colCount}"></td></tr>
    <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${sanitizeFilenamePart(orgName)}_${tab}_donations_${sanitizeFilenamePart(reportPeriod)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${tab === 'cash' ? 'Cash' : 'In-Kind'} report downloaded!`, 'success');
}

// Collects the report data and starts the selected PDF or Excel export process.

async function exportFile(format) {
    const exportMenu = document.getElementById('exportMenu');
    if (exportMenu) exportMenu.classList.add('hidden');

    try {
        const filterType = document.getElementById('filterType')?.value || '';
        const dateValue  = document.getElementById('datePicker')?.value || '';
        const currentTab = activeTab || 'cash';

        //  Fetch the logged-in org name dynamically 
        const orgName = await getLoggedInOrganizationName();

        const reportPeriod = getReportPeriodLabel(filterType, dateValue);
        const data = buildExportData(currentTab, filterType, dateValue);

        if (!data.length) {
            let msg = 'No records found for the selected period.';
            if (filterType === 'month') msg = 'No records found for this month.';
            else if (filterType === 'year') msg = 'No records found for this year.';
            showToast(msg, 'warning');
            return;
        }

        if (format === 'pdf') {
            generateDonationPDF(orgName, currentTab, data, reportPeriod);
        } else {
            generateDonationExcel(orgName, currentTab, data, reportPeriod);
        }
    } catch (err) {
        console.error('Export error:', err);
        showToast('Failed to download file: ' + (err.message || 'Unknown error'), 'error');
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

// Converts a time value into a readable AM/PM format.

function formatTimeToAMPM(timeStr) {
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
}

// Creates a readable summary of the organization's selected drop-off days and hours.

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

// Retrieves the organization's drop-off schedule from the server.

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

// Opens the modal used to edit the organization's drop-off schedule.

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

// Closes the drop-off schedule editing modal.

function closeEditDropoffHoursModal() {
    document.getElementById("editDropoffHoursModal").classList.add("hidden");
}

// Enables or disables the time fields for the selected day of the week.

function toggleDropoffDayRow(dow) {
    const row = document.querySelector(`#dropoffHoursFormBody .dropoff-day-row[data-day="${dow}"]`);
    if (!row) return;
    const isOpen = row.querySelector('.dropoff-day-open-toggle').checked;
    row.querySelector('.dropoff-day-start-input').disabled = !isOpen;
    row.querySelector('.dropoff-day-end-input').disabled = !isOpen;
}

// Saves the updated drop-off schedule and refreshes the displayed schedule summary.

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