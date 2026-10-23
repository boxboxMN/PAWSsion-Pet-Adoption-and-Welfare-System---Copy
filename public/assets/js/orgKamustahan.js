let allUpdatesData = [];
let filteredUpdatesData = []; 
const itemsPerPage = 5; 
let currentTab = 'active'; 
let currentStatusFilter = 'all'; 
let currentView = 'table';
let currentDate = new Date();
let currentUpdateIdForReply = null;
let currentOrgName = "Organization Name"; 

// ⭐ RETURN REQUEST STATE
let currentReturnRequestId = null;

// ==========================================
// DATE HELPERS
// ==========================================
function toLocalDateKey(dateInput) {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        return String(dateInput).slice(0, 10);
    }
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getTodayLocalKey() {
    return toLocalDateKey(new Date());
}

function formatReadableDate(dateInput) {
    if (!dateInput) return 'N/A';
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, day] = dateInput.split('-').map(Number);
        d = new Date(y, m - 1, day);
    } else {
        d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ==========================================
// HTML ESCAPE
// ==========================================
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// CONFIRM MODAL
// ==========================================
function showModal({
    title = "Are you sure?",
    message = "",
    type = "warning",
    okText = "Confirm",
    cancelText = "Cancel",
    onOk = null,
    onCancel = null
} = {}) {
    const modal = document.getElementById('customConfirmModal');
    const box   = document.getElementById('customConfirmBox');

    if (!modal || !box) {
        if (confirm(message)) onOk && onOk();
        else onCancel && onCancel();
        return;
    }

    const themes = {
        warning: { bg: '#fffbeb', color: '#d97706', icon: 'fa-triangle-exclamation' },
        error:   { bg: '#fff1f2', color: '#e11d48', icon: 'fa-circle-exclamation' },
        info:    { bg: '#eff6ff', color: '#2563eb', icon: 'fa-circle-info' },
        success: { bg: '#ecfdf5', color: '#059669', icon: 'fa-circle-check' }
    };
    const theme = themes[type] || themes.warning;

    const iconWrap = box.querySelector('.custom-modal-icon');
    if (iconWrap) {
        iconWrap.style.background = theme.bg;
        iconWrap.style.color = theme.color;
        const iconEl = iconWrap.querySelector('i');
        if (iconEl) iconEl.className = `fas ${theme.icon}`;
    }

    document.getElementById('customConfirmTitle').textContent    = title;
    document.getElementById('customConfirmMessage').textContent  = message;
    document.getElementById('customConfirmOkBtn').textContent    = okText;
    document.getElementById('customConfirmCancelBtn').textContent = cancelText;

    document.getElementById('customConfirmOkBtn').onclick = () => {
        closeModal(modal, box);
        onOk && onOk();
    };
    document.getElementById('customConfirmCancelBtn').onclick = () => {
        closeModal(modal, box);
        onCancel && onCancel();
    };

    modal.classList.add('is-open');
    requestAnimationFrame(() => {
        box.classList.add('is-visible');
    });
}

function closeModal(modal, box) {
    box.classList.remove('is-visible');
    setTimeout(() => {
        modal.classList.remove('is-open');
    }, 180);
}

function showConfirm(message, onOk, onCancel = null, opts = {}) {
    showModal({
        title: opts.title || 'Are you sure?',
        message,
        type: opts.type || 'warning',
        okText: opts.okText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        onOk, onCancel
    });
}

// ==========================================
// TOAST NOTIFICATION
// ==========================================
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const themes = {
        success: { classes: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: "fa-circle-check text-emerald-600" },
        error:   { classes: "bg-rose-50 border-rose-200 text-rose-800", icon: "fa-circle-xmark text-rose-600" },
        warning: { classes: "bg-amber-50 border-amber-200 text-amber-800", icon: "fa-triangle-exclamation text-amber-600" }
    };

    const theme = themes[type] || themes.success;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all duration-300 transform translate-y-5 opacity-0 ${theme.classes}`;

    toast.innerHTML = `
        <i class="fa-solid ${theme.icon} text-base"></i>
        <span></span>
    `;
    toast.querySelector("span").textContent = message;

    container.appendChild(toast);

    setTimeout(() => { toast.classList.remove("translate-y-5", "opacity-0"); }, 10);
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => { toast.remove(); }, 300);
    }, 3500);
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
function toggleExportMenu() {
    const menu = document.getElementById('exportDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof loadTopbar === "function") {
        await loadTopbar({ title: "Kamustahan", subtitle: "" });
    }
    if (typeof loadSidebar === "function") {
        await loadSidebar("dashboard");
    }

    await fetchKamustahanData();
    await fetchReturnRequests(); 

    window.addEventListener('click', function(e) {
        const menu = document.getElementById('exportDropdownMenu');
        const button = e.target.closest('button');
        if (menu && !e.target.closest('#exportDropdownMenu') && (!button || !button.getAttribute('onclick')?.includes('toggleExportMenu'))) {
            menu.classList.add('hidden');
        }
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => filterAndRenderTable(true));
    }

     const tabActive = document.getElementById("tabActive");
    const tabArchive = document.getElementById("tabArchive");
    const tabReturns = document.getElementById("tabReturns");
    const tableView = document.getElementById("tableViewContainer");
    const calendarView = document.getElementById("calendarViewContainer");
    const returnTable = document.getElementById("returnTableContainer");
    const viewToggleBtn = document.querySelector('.bg-gray-100.p-1');

    function switchTab(tabName) {
        [tabActive, tabArchive, tabReturns].forEach(t => {
            t.className = "text-sm font-medium text-gray-500 hover:text-gray-800 pb-3 px-1 transition-colors flex items-center gap-2";
        });
        
        tableView.classList.add("hidden");
        calendarView.classList.add("hidden");
        returnTable.classList.add("hidden");

        if (tabName === 'active') {
            tabActive.className = "text-sm font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 px-1 transition-colors";
            currentTab = 'active';
            tableView.classList.remove("hidden");
            if(viewToggleBtn) viewToggleBtn.classList.remove("hidden");
            filterAndRenderTable(true);
        } else if (tabName === 'archive') {
            tabArchive.className = "text-sm font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 px-1 transition-colors";
            currentTab = 'archive';
            tableView.classList.remove("hidden");
            if(viewToggleBtn) viewToggleBtn.classList.remove("hidden");
            filterAndRenderTable(true);
        } else if (tabName === 'returns') {
            tabReturns.className = "text-sm font-semibold text-rose-600 border-b-2 border-rose-600 pb-3 px-1 transition-colors flex items-center gap-2";
            returnTable.classList.remove("hidden");
            if(viewToggleBtn) viewToggleBtn.classList.add("hidden");
            fetchReturnRequests();
        }
    }

    if(tabActive) tabActive.addEventListener("click", () => switchTab('active'));
    if(tabArchive) tabArchive.addEventListener("click", () => switchTab('archive'));
    if(tabReturns) tabReturns.addEventListener("click", () => switchTab('returns'));

    // Status Filter Dropdown Logic
    const statusFilterSelect = document.getElementById("statusFilterSelect");
    if(statusFilterSelect) {
        statusFilterSelect.addEventListener("change", (e) => {
            currentStatusFilter = e.target.value;
            filterAndRenderTable(true);
        });
    }
});

// ==========================================
// ⭐ RETURN REQUESTS LOGIC
// ==========================================
async function fetchReturnRequests() {
    try {
        const res = await fetch('/org/return-requests');
        const data = await res.json();

        const badge = document.getElementById('returnCountBadge');
        
        if (data.success) {
            if (data.requests.length > 0) {
                if(badge) {
                    badge.textContent = data.requests.length;
                    badge.classList.remove('hidden');
                }
            } else {
                if(badge) badge.classList.add('hidden');
            }
            renderReturnList(data.requests);
        }
    } catch (err) {
        console.error("Error loading return requests:", err);
    }
}

function renderReturnList(requests) {
    const container = document.getElementById('orgReturnList');
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-gray-400">
                <i class="fa-solid fa-check-circle text-4xl mb-3 text-emerald-400"></i>
                <p class="text-sm">No pending pet returns. All good!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = requests.map(req => {
    const isApproved = req.status === 'Approved';
    const badge = isApproved
        ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><i class="fas fa-truck-fast mr-1"></i>Awaiting Handover</span>`
        : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><i class="fas fa-clock mr-1"></i>Pending Review</span>`;

    return `
        <div class="flex items-center justify-between p-4 hover:bg-rose-50/30 transition">
            <div class="flex items-center gap-4">
                <img src="${req.pet_image ? (req.pet_image.startsWith('/') ? req.pet_image : '/uploads/pets/' + req.pet_image) : '/assets/images/default-pet.png'}" class="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0" />
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="font-bold text-gray-800 text-sm">${escapeHtml(req.pet_name)}</h4>
                        ${badge}
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">Adopter: <strong>${escapeHtml(req.first_name)} ${escapeHtml(req.last_name)}</strong></p>
                    <p class="text-[11px] text-rose-600 font-semibold mt-1">Reason: ${escapeHtml(req.reason)}</p>
                </div>
            </div>
            <button onclick="openReviewReturnModal(${req.id})" class="px-4 py-2 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200 transition flex items-center gap-2">
                <i class="fa-regular fa-eye"></i> ${isApproved ? 'Manage' : 'Review'}
            </button>
        </div>`;
}).join('');
    
    window.allReturnRequests = requests;
}
// ==========================================
// RETURN MODAL — OPEN
// ==========================================
function openReviewReturnModal(returnId) {
    // ⭐ Safety: force-close any leftover confirm modal (z-2147483646)
    const confirmModal = document.getElementById('customConfirmModal');
    if (confirmModal) confirmModal.classList.remove('is-open');

    const req = window.allReturnRequests.find(r => r.id === returnId);
    if (!req) {
        console.error('Return request not found:', returnId);
        return;
    }

    currentReturnRequestId = returnId;

    document.getElementById('modalReturnPetName').textContent = req.pet_name;
    document.getElementById('modalReturnAdopterName').textContent = `${req.first_name} ${req.last_name}`;
    document.getElementById('modalReturnAdopterEmail').textContent = req.email;
    document.getElementById('modalReturnReason').textContent = req.reason;
    document.getElementById('modalReturnDetails').textContent = `"${req.details}"`;

    const imgSrc = req.pet_image
        ? (req.pet_image.startsWith('/') ? req.pet_image : '/uploads/pets/' + req.pet_image)
        : '/assets/images/default-pet.png';
    document.getElementById('modalReturnPetImage').src = imgSrc;

    const responseInput = document.getElementById('modalReturnOrgResponse');
    const statusLabel   = document.getElementById('modalReturnStatusLabel');
    const actions       = document.getElementById('returnModalActions');

    // ⭐ Reset state bago mag-render
    responseInput.disabled = false;
    responseInput.classList.remove('bg-gray-100', 'cursor-not-allowed');

    if (req.status === 'Approved') {
        statusLabel.innerHTML = `<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 inline-flex items-center"><i class="fas fa-truck-fast mr-1"></i>Approved — Waiting for Handover</span>`;
        responseInput.disabled = true;
        responseInput.classList.add('bg-gray-100', 'cursor-not-allowed');
        responseInput.value = req.org_response || '';
        actions.innerHTML = `
            <button type="button" onclick="closeReviewReturnModal()" class="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition">Close</button>
            <button type="button" onclick="completeReturn(${req.id})" class="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm">
                <i class="fas fa-check-circle mr-1"></i> Mark as Received
            </button>`;
    } else if (req.status === 'Pending') {
        statusLabel.innerHTML = `<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 inline-flex items-center"><i class="fas fa-clock mr-1"></i>Pending Review</span>`;
        responseInput.value = '';
        actions.innerHTML = `
            <button type="button" onclick="closeReviewReturnModal()" class="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition">Cancel</button>
            <button type="button" onclick="processReturn('Rejected')" class="flex-1 px-4 py-2.5 bg-gray-800 text-white text-sm font-bold rounded-xl hover:bg-gray-900 transition shadow-sm">Decline</button>
            <button type="button" onclick="processReturn('Approved')" class="flex-1 px-4 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition shadow-sm">Accept Return</button>`;
    } else {
        // Rejected / Completed — read-only
        statusLabel.innerHTML = `<span class="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-700 inline-flex items-center"><i class="fas fa-lock mr-1"></i>${req.status}</span>`;
        responseInput.disabled = true;
        responseInput.classList.add('bg-gray-100', 'cursor-not-allowed');
        responseInput.value = req.org_response || '';
        actions.innerHTML = `
            <button type="button" onclick="closeReviewReturnModal()" class="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition">Close</button>`;
    }

    const modal = document.getElementById('reviewReturnModal');
    if (modal) {
        modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        modal.querySelector('div').classList.remove('scale-95');
    }
}

// ==========================================
// RETURN MODAL — CLOSE (improved safety)
// ==========================================
function closeReviewReturnModal() {
    const modal = document.getElementById('reviewReturnModal');
    if (!modal) return;

    modal.classList.add('opacity-0', 'pointer-events-none');
    const whiteBox = modal.querySelector('div');
    if (whiteBox) whiteBox.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);

    currentReturnRequestId = null;
}

// ==========================================
// BACKDROP CLICK + ESC HANDLERS
// ==========================================
function handleReviewReturnBackdropClick(event) {
    // Only close if click is directly on the backdrop (not on white box)
    if (event.target.id === 'reviewReturnModal') {
        closeReviewReturnModal();
    }
}

// ESC key handler
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    // Close whichever modal is open (priority: confirm > return)
    const confirmModal = document.getElementById('customConfirmModal');
    if (confirmModal && confirmModal.classList.contains('is-open')) {
        confirmModal.classList.remove('is-open');
        return;
    }

    const returnModal = document.getElementById('reviewReturnModal');
    if (returnModal && !returnModal.classList.contains('hidden') && !returnModal.classList.contains('opacity-0')) {
        closeReviewReturnModal();
    }
});
async function completeReturn(returnId) {
    showConfirm(
        "Confirm that you have physically received the pet. This will finalize the return and remove the pet from the adopter's Kamustahan list.",
        async () => {
            try {
                const res = await fetch(`/org/return-requests/${returnId}/complete`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();

                if (data.success) {
                    closeReviewReturnModal();
                    showToast('Pet return completed successfully.', 'success');
                    fetchReturnRequests();
                    fetchKamustahanData();
                } else {
                    showToast(data.message || 'Failed to complete return.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('An error occurred.', 'error');
            }
        },
        null,
        { title: 'Complete Pet Return', okText: 'Confirm Received', type: 'warning' }
    );
}
async function processReturn(action) {
    if (!currentReturnRequestId) return;
    
    const orgResponseInput = document.getElementById('modalReturnOrgResponse').value.trim();
    
    // Validation: Kailangan may nakasulat na mensahe
    if (!orgResponseInput) {
        showToast("Please provide a message or reason for the adopter.", "warning");
        return;
    }

    const msg = action === 'Approved' 
        ? "Are you sure? This will mark the pet as Available." 
        : "Are you sure you want to decline this return request?";
        
    showConfirm(msg, async () => {
        try {
            const res = await fetch(`/org/return-requests/${currentReturnRequestId}/respond`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: action, org_response: orgResponseInput })
            });
            const data = await res.json();

            if (data.success) {
                closeReviewReturnModal();
                showToast(`Return request ${action.toLowerCase()} successfully.`, 'success');
                fetchReturnRequests(); // I-refresh ang listahan
                fetchKamustahanData(); // I-refresh ang pets data
            } else {
                showToast(data.message || 'Failed to process request.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred.', 'error');
        }
    }, null, { title: action === 'Approved' ? 'Accept Return' : 'Decline Return', okText: 'Confirm', type: action === 'Approved' ? 'warning' : 'error' });
}
// ==========================================
// EVENT DELEGATION
// ==========================================
document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action][data-update-id]");
    if (!btn) return;

    const action = btn.dataset.action;
    const updateId = Number(btn.dataset.updateId);
    const item = allUpdatesData.find(i => Number(i.update_id) === updateId);
    if (!item) return;

    if (action === "view") {
        openUpdateModal(item);
    } else if (action === "schedule") {
        openScheduleModal(updateId);
    }
});

async function fetchKamustahanData() {
    try {
        const response = await fetch("/org/kamustahan-updates");
        const result = await response.json();

        if (result.success && result.updates) {
            allUpdatesData = result.updates;
            
            if (result.organization_name) {
                currentOrgName = result.organization_name;
            }
            
            filterAndRenderTable(true);
            updateStatistics(allUpdatesData);
        } else {
            document.getElementById("updatesTableBody").innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400 italic">No updates found in database.</td></tr>`;
        }
    } catch (error) {
        console.error("Error fetching updates:", error);
        document.getElementById("updatesTableBody").innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-400 italic">Failed to connect to database server.</td></tr>`;
    }
}

function filterAndRenderTable(resetPage = false) {
    if (resetPage) currentPage = 1;

    const searchInputEl = document.getElementById("searchInput");
    const searchQuery = searchInputEl ? (searchInputEl.value || "").toLowerCase() : "";

    filteredUpdatesData = allUpdatesData.filter(item => {
        const isArchived = item.is_archived == 1;
        const matchesTab = currentTab === 'archive' ? isArchived : !isArchived;
        
        if (!matchesTab) return false;

        const petName = (item.pet_name || "").toLowerCase();
        const adopterName = (item.adopter_name || "").toLowerCase();
        const matchesSearch = petName.includes(searchQuery) || adopterName.includes(searchQuery);
        
        if (!matchesSearch) return false;

        if (currentStatusFilter !== 'all') {
            const isUpdated = item.formatted_date && item.update_status !== 'For Update';
            const isScheduled = !isUpdated && !!item.scheduled_date;
            const isForUpdate = !isUpdated && !isScheduled;

            if (currentStatusFilter === 'updated' && !isUpdated) return false;
            if (currentStatusFilter === 'scheduled' && !isScheduled) return false;
            if (currentStatusFilter === 'for_update' && !isForUpdate) return false;
        }

        return true;
    });

    filteredUpdatesData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderTable(); 
}

function renderTable() {
    const tbody = document.getElementById("updatesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const totalItems = filteredUpdatesData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    const paginatedData = filteredUpdatesData.slice(startIndex, endIndex);

    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400 italic">No matching records found.</td></tr>`;
        updatePaginationUI(0, 0, 0);
        return;
    }

    const todayKey = getTodayLocalKey();

    paginatedData.forEach((item) => {
        let displayPhoto = "https://images.unsplash.com/photo-1543466835-00a7907e9de1";
        
        if (item.update_photos) {
            try {
                let parsed = JSON.parse(item.update_photos);
                if (Array.isArray(parsed) && parsed.length > 0) displayPhoto = parsed[0];
            } catch (e) { displayPhoto = item.update_photos; }
            if (!displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) displayPhoto = `/uploads/${displayPhoto}`;
        } else if (item.pet_image) {
            displayPhoto = item.pet_image;
            if (!displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) displayPhoto = `/uploads/pets/${displayPhoto}`;
        }

        let statusBadge = '';

        if (item.is_archived == 1 || item.update_status === 'Archived') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full border border-gray-200 whitespace-nowrap"><i class="fa-solid fa-box-archive text-[10px]"></i> Archived</span>`;
        } else if (item.formatted_date && item.update_status !== 'For Update') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 whitespace-nowrap"><i class="fa-solid fa-check text-[10px]"></i> Updated</span>`;
        } else if (item.scheduled_date) {
            const deadlineKey = toLocalDateKey(item.scheduled_date);
            const isPast = todayKey > deadlineKey;

            if (isPast) {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-600 rounded-full border border-rose-100 whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation text-[10px]"></i> Overdue</span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100 whitespace-nowrap"><i class="fa-regular fa-calendar-check text-[10px]"></i> Scheduled</span>`;
            }
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-600 rounded-full border border-amber-100 whitespace-nowrap"><i class="fa-regular fa-clock text-[10px]"></i> For Update</span>`;
        }

        const combinedStatus = `<div class="flex flex-col items-start gap-1.5 min-w-[130px]">${statusBadge}</div>`;
        
        let actionButtons = `
            <button data-action="view" data-update-id="${Number(item.update_id)}"
                class="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-1 transition-colors ${item.is_archived == 1 ? '' : 'border-r border-slate-200'}"
                title="View Details">
                <i class="fa-regular fa-eye text-[11px]"></i> View
            </button>
        `;

        if (item.is_archived != 1) {
            actionButtons += `
                <button data-action="schedule" data-update-id="${Number(item.update_id)}"
                    class="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-amber-600 hover:bg-slate-50 flex items-center gap-1 transition-colors"
                    title="Set Schedule">
                    <i class="fa-regular fa-calendar-days text-[11px]"></i> Schedule
                </button>
            `;
        }

        const dateDisplay = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : 'N/A');

        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50/60 transition-colors";
        
        row.innerHTML = `
            <td class="py-4 px-3 align-middle">
                <div class="flex items-center gap-3">
                    <img src="${displayPhoto}" alt="${escapeHtml(item.pet_name)}" class="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                    <div>
                        <span class="font-semibold text-slate-900 block text-sm">${escapeHtml(item.pet_name || 'Unnamed Pet')}</span>
                        <span class="text-xs text-slate-400 font-medium block mt-0.5">${escapeHtml(item.species || 'Pet')}</span>
                    </div>
                </div>
            </td>
            <td class="py-4 px-3 align-middle">
                <span class="font-semibold text-slate-900 block text-sm">${escapeHtml(item.adopter_name || 'Adopter')}</span>
                <span class="text-xs text-slate-400 block mt-0.5">${escapeHtml(item.adopter_email || '')}</span>
            </td>
            <td class="py-4 px-3 align-middle">
                <span class="font-medium text-slate-800 block text-sm">${dateDisplay}</span>
                <span class="text-xs text-slate-400 block mt-0.5">${item.formatted_date ? 'Submitted Update' : 'Scheduled Date'}</span>
            </td>
            <td class="py-4 px-3 align-middle">${combinedStatus}</td>
            <td class="py-4 px-3 align-middle text-right pr-4 whitespace-nowrap">
                <div class="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden align-middle">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    updatePaginationUI(startIndex, endIndex, totalItems);
}

function updatePaginationUI(startIndex, endIndex, totalItems) {
    const paginationInfo = document.getElementById("tablePaginationInfo");
    if (paginationInfo) {
        paginationInfo.textContent = totalItems === 0 
            ? "Showing 0 results" 
            : `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} results`;
    }

    const buttonsContainer = document.getElementById('paginationButtons');
    if (!buttonsContainer) return;
    
    buttonsContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = `w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg transition-colors ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'text-gray-700 hover:bg-gray-50 bg-white'}`;
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left text-[11px]"></i>`;
    if (currentPage > 1) {
        prevBtn.onclick = () => { currentPage--; renderTable(); };
    }
    buttonsContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `w-8 h-8 flex items-center justify-center border rounded-lg text-sm font-bold shadow-sm transition-colors ${
            currentPage === i 
                ? 'bg-white border-blue-600 text-blue-600' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderTable(); };
        buttonsContainer.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg transition-colors ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'text-gray-700 hover:bg-gray-50 bg-white'}`;
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right text-[11px]"></i>`;
    if (currentPage < totalPages) {
        nextBtn.onclick = () => { currentPage++; renderTable(); };
    }
    buttonsContainer.appendChild(nextBtn);
}

function updateStatistics(data) {
    const total = data.filter(i => i.is_archived != 1).length;
    const forUpdateCount = data.filter(i => i.update_status === 'For Update' && i.is_archived != 1).length;
    const updatedCount = data.filter(i => i.update_status !== 'For Update' && i.formatted_date && i.is_archived != 1).length;

    const statTotalPets = document.getElementById("statTotalPets");
    const statUpdated = document.getElementById("statUpdated");
    const statForUpdate = document.getElementById("statForUpdate");

    if (statTotalPets) statTotalPets.textContent = total;
    if (statUpdated) statUpdated.textContent = updatedCount;
    if (statForUpdate) statForUpdate.textContent = forUpdateCount; 
}

// ==========================================
// MODAL & CONSULTATION LOGIC
// ==========================================
async function openUpdateModal(item) {
    currentUpdateIdForReply = item.update_id; 

    const modal = document.getElementById("updateModal");
    const modalPetName = document.getElementById("modalPetName");
    const modalPhoto = document.getElementById("modalPhoto");
    const modalText = document.getElementById("modalText");
    const modalAdopter = document.getElementById("modalAdopter");
    const modalDate = document.getElementById("modalDate");
    const modalActionContainer = document.getElementById("modalActionContainer");
    const modalRiskBadge = document.getElementById("modalRiskBadge");

    modalPetName.textContent = item.pet_name || 'Pet Details';
    modalAdopter.innerHTML = `<i class="fa-regular fa-user mr-1"></i> Adopter: ${item.adopter_name || 'N/A'}`;
    
    let photoUrl = "https://images.unsplash.com/photo-1543466835-00a7907e9de1";
    if (item.update_photos) {
        try {
            let parsed = JSON.parse(item.update_photos);
            if (Array.isArray(parsed) && parsed.length > 0) photoUrl = parsed[0];
        } catch (e) { photoUrl = item.update_photos; }
        if (!photoUrl.startsWith('http') && !photoUrl.startsWith('/')) photoUrl = `/uploads/${photoUrl}`;
    }
    modalPhoto.src = photoUrl;

    const displayDate = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : null) || 'N/A';
    modalDate.innerHTML = `<i class="fa-regular fa-calendar mr-1"></i> Date: ${displayDate}`;

    modalText.textContent = item.update_text || "No message provided.";

    if (item.risk_level && item.formatted_date) {
        modalRiskBadge.classList.remove('hidden');
        if (item.risk_level === 'high') {
            modalRiskBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200';
            modalRiskBadge.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> High Risk';
        } else if (item.risk_level === 'medium') {
            modalRiskBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200';
            modalRiskBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Medium Risk';
        } else {
            modalRiskBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200';
            modalRiskBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Low Risk';
        }
    } else {
        modalRiskBadge.classList.add('hidden');
    }

    const renderTags = (jsonData, colorClass) => {
        let html = '';
        if (!jsonData || jsonData === 'null') return '<span class="text-xs text-gray-400 italic">No data provided.</span>';
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (Object.keys(data).length === 0) return '<span class="text-xs text-gray-400 italic">No data provided.</span>';
            
            for (const [key, val] of Object.entries(data)) {
                html += `<span class="text-xs font-bold px-2.5 py-1 rounded-lg border bg-white shadow-sm capitalize ${colorClass}">${key}: ${val}</span>`;
            }
        } catch (e) { return '<span class="text-xs text-rose-400 italic">Error parsing data.</span>'; }
        return html;
    };

    document.getElementById('modalHealthChecklist').innerHTML = renderTags(item.health_checklist, 'text-emerald-700 border-emerald-200');
    document.getElementById('modalBehaviorChecklist').innerHTML = renderTags(item.behavior_checklist, 'text-indigo-700 border-indigo-200');

    const vetContainer = document.getElementById('modalVetContainer');
    if (item.vet_visit == 1 && item.formatted_date) {
        vetContainer.classList.remove('hidden');
        let vDate = 'N/A';
        if (item.vet_visit_date) {
            const d = new Date(item.vet_visit_date);
            vDate = d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });
        }
        document.getElementById('modalVetDate').textContent = vDate;
        document.getElementById('modalVetDiagnosis').textContent = item.vet_diagnosis || 'None specified';
    } else {
        vetContainer.classList.add('hidden');
    }

    if (item.is_archived == 1) {
        modalActionContainer.innerHTML = `<span class="text-xs text-gray-500 font-medium"><i class="fa-solid fa-box-archive mr-1"></i> Archived Record</span>`;
    } else if (item.update_status === 'For Update' || !item.formatted_date) {
        modalActionContainer.innerHTML = `<span class="text-xs text-amber-600 font-medium"><i class="fa-regular fa-clock mr-1"></i> Waiting for update</span>`;
    } else {
        modalActionContainer.innerHTML = `<button onclick='archiveUpdate(${Number(item.update_id)})' class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"><i class="fa-solid fa-box-archive"></i> Archive Record</button>`;
    }

    const prevNoteContainer = document.getElementById('prevOrgNoteContainer');
    const prevNoteText = document.getElementById('prevOrgNoteText');
    const reviewInput = document.getElementById('orgReviewNote');
    const reviewBtn = document.getElementById('markReviewedBtn');

    const isArchived = item.is_archived == 1 || item.update_status === 'Archived';

    if (isArchived) {
        reviewInput.disabled = true;
        reviewInput.value = item.org_response || '';
        reviewInput.placeholder = "This record has been archived. Notes are locked.";
        reviewInput.classList.add('bg-gray-200', 'cursor-not-allowed', 'text-gray-500');
        
        reviewBtn.classList.add('hidden');
        
        if (item.org_response) {
            prevNoteContainer.classList.remove('hidden');
            prevNoteText.textContent = item.org_response;
        } else {
            prevNoteContainer.classList.add('hidden');
        }
    } else {
        reviewInput.disabled = false;
        reviewInput.classList.remove('bg-gray-200', 'cursor-not-allowed', 'text-gray-500');
        reviewBtn.classList.remove('hidden');

        if (item.org_response) {
            prevNoteContainer.classList.remove('hidden');
            prevNoteText.textContent = item.org_response;
            reviewInput.value = item.org_response; 
            reviewBtn.innerHTML = '<i class="fas fa-edit"></i> Update Note';
        } else {
            prevNoteContainer.classList.add('hidden');
            reviewInput.value = '';
            reviewBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Reviewed & Send';
        }
    }
    
    modal.classList.remove("hidden");
}

function closeUpdateModal() {
    const modal = document.getElementById("updateModal");
    if (modal) modal.classList.add("hidden");
    const input = document.getElementById('orgReviewNote');
    if (input) input.value = ''; 
}

async function markAsReviewed() {
    if (!currentUpdateIdForReply) return;
    
    const input = document.getElementById('orgReviewNote');
    const btn = document.getElementById('markReviewedBtn');
    const message = input.value.trim();

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(`/org/kamustahan/${currentUpdateIdForReply}/acknowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Server returned non-JSON response:", text);
            throw new Error("Server error: " + text.substring(0, 100));
        }

        if (data.success) {
            closeUpdateModal();
            fetchKamustahanData(); 
            showToast('Update marked as reviewed.', 'success');
        } else {
            showToast(data.message || 'Failed to save.', 'error');
        }
    } catch (err) {
        console.error("Acknowledge error:", err);
        showToast(err.message || 'Network error.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Reviewed';
    }
}

async function archiveUpdate(update_id) {
    showConfirm(
        "Are you sure you want to archive this update?",
        async () => {
            try {
                const res = await fetch('/org/kamustahan-archive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ update_id })
                });
                const data = await res.json();
                if (data.success) {
                    closeUpdateModal();
                    fetchKamustahanData();
                    showToast("Update archived successfully.", "success");
                } else {
                    showToast(data.message || "Failed to archive update.", "error");
                }
            } catch (err) {
                console.error("Error archiving update:", err);
                showToast("Network error while archiving.", "error");
            }
        },
        null,
        { title: "Archive Update", okText: "Archive", type: "warning" }
    );
}

// ==========================================
// SCHEDULE MODAL LOGIC
// ==========================================
function openScheduleModal(updateId) {
    const schedUpdateIdInput = document.getElementById("schedUpdateId");
    const scheduleModal = document.getElementById("scheduleModal");
    const dateInput = document.getElementById("scheduledDateInput");

    if (schedUpdateIdInput) schedUpdateIdInput.value = updateId;

    const today = getTodayLocalKey();

    if (dateInput) {
        dateInput.setAttribute('min', today);
        dateInput.value = today;
    }

    if (scheduleModal) scheduleModal.classList.remove("hidden");
}

function closeScheduleModal() {
    const scheduleModal = document.getElementById("scheduleModal");
    if (scheduleModal) scheduleModal.classList.add("hidden");
}

function submitSchedule(event) {
    event.preventDefault();

    const update_id = document.getElementById("schedUpdateId").value;
    const scheduled_date = document.getElementById("scheduledDateInput").value;

    if (!update_id) {
        showToast("Missing update record ID. Please refresh the page and try again.", "error");
        return;
    }

    if (!scheduled_date) {
        showToast("Please select a deadline date.", "warning");
        return;
    }

    const todayStr = getTodayLocalKey();

    if (scheduled_date < todayStr) {
        showToast("You cannot set a deadline for a past date.", "warning");
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }

    fetch('/org/kamustahan-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id, scheduled_date })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            closeScheduleModal();
            fetchKamustahanData();
            showToast(data.message || `Deadline set to ${scheduled_date}.`, "success");
        } else {
            showToast(data.message || "Failed to save the deadline.", "error");
        }
    })
    .catch(err => {
        console.error("Error saving schedule:", err);
        showToast("Network error while saving the deadline.", "error");
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || "Save Deadline";
        }
    });
}

// ==========================================
// VIEW SWITCHER & CALENDAR
// ==========================================
function switchView(view) {
    currentView = view;
    const tableContainer = document.getElementById('tableViewContainer');
    const calendarContainer = document.getElementById('calendarViewContainer');
    const tableBtn = document.getElementById('switchToTableBtn');
    const calendarBtn = document.getElementById('switchToCalendarBtn');

    if (view === 'table') {
        tableContainer.classList.remove('hidden');
        calendarContainer.classList.add('hidden');
        tableBtn.className = "px-3 py-1.5 text-xs font-semibold bg-white text-blue-600 rounded-lg shadow-xs transition-all";
        calendarBtn.className = "px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-all";
    } else {
        tableContainer.classList.add('hidden');
        calendarContainer.classList.remove('hidden');
        calendarBtn.className = "px-3 py-1.5 text-xs font-semibold bg-white text-blue-600 rounded-lg shadow-xs transition-all";
        tableBtn.className = "px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-all";
        renderCalendar();
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('calendarMonthYear');
    if (!calendarGrid) return;

    calendarGrid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const todayKey = getTodayLocalKey();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = "h-28 bg-gray-50/50 rounded-xl border border-dashed border-gray-100";
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;
        const isToday = dateString === todayKey;

        const dayCell = document.createElement('div');
        dayCell.className = `h-28 bg-white border rounded-xl p-2 overflow-y-auto flex flex-col justify-between transition-all hover:border-blue-300 ${
            isToday ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
        }`;

        const scheduledItems = allUpdatesData.filter(item => {
            const rawDate = toLocalDateKey(item.scheduled_date);
            return rawDate === dateString && item.is_archived != 1;
        });

        let eventsHtml = '';
        scheduledItems.forEach(item => {
            eventsHtml += `
                <div data-action="view" data-update-id="${Number(item.update_id)}"
                    class="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium p-1 rounded-md mb-1 cursor-pointer truncate hover:bg-amber-100 transition-colors"
                    title="Pet: ${escapeHtml(item.pet_name)} | Adopter: ${escapeHtml(item.adopter_name)}">
                    <i class="fa-regular fa-clock mr-1"></i> ${escapeHtml(item.pet_name)}
                </div>
            `;
        });

        dayCell.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}">${day}</span>
                ${scheduledItems.length > 0 ? `<span class="w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">${scheduledItems.length}</span>` : ''}
            </div>
            <div class="mt-1 flex-1 overflow-y-auto">${eventsHtml}</div>
        `;

        calendarGrid.appendChild(dayCell);
    }
}

// ==========================================
// EXPORT LOGIC
// ==========================================
function exportData(type) {
    const monthFilter = document.getElementById("exportMonthFilter") ? document.getElementById("exportMonthFilter").value : "";
    
    let dataToExport = allUpdatesData.filter(item => {
        const isArchived = item.is_archived == 1;
        const matchesTab = currentTab === 'archive' ? isArchived : !isArchived;
        
        let matchesMonth = true;
        if (monthFilter) {
            const raw = item.update_date || item.scheduled_date || item.formatted_date || "";
            const localKey = toLocalDateKey(raw);
            matchesMonth = localKey.startsWith(monthFilter);
        }
        return matchesTab && matchesMonth;
    });

    if (dataToExport.length === 0) {
        showToast("No data found for the selected month and category.", "warning");
        return;
    }

    if (type === 'csv') {
        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val).trim();
            return `"${str.replace(/"/g, '""')}"`;
        };

        let csvContent = "PET NAME,SPECIES,ADOPTER NAME,ADOPTER EMAIL,DATE SUBMITTED\n";
        
        dataToExport.forEach(item => {
            const petName = escapeCSV(item.pet_name);
            const species = escapeCSV(item.species);
            
            const adopterName = escapeCSV(item.adopter_name && item.adopter_name !== 'N/A' ? item.adopter_name : '');
            const adopterEmail = escapeCSV(item.adopter_email && item.adopter_email !== 'N/A' ? item.adopter_email : '');
            
            let rawDate = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : "");
            if (rawDate) {
                if (rawDate.includes(' • ')) rawDate = rawDate.split(' • ')[0];
                if (rawDate.includes(' at ')) rawDate = rawDate.split(' at ')[0];
            }
            const dateStr = escapeCSV(rawDate);
            
            csvContent += `${petName},${species},${adopterName},${adopterEmail},${dateStr}\n`;
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        const dateToday = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `Kamustahan_${currentTab}_Report_${dateToday}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } else if (type === 'pdf') {
        if (typeof html2pdf === 'undefined') {
            showToast("The PDF library has not been included yet.", "error");
            return;
        }
        renderPrintableReport(dataToExport);
        downloadKamustahanPDF();
    }
    
    const dropdownMenu = document.getElementById('exportDropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.add('hidden');
}

function renderPrintableReport(data) {
    let printContainer = document.getElementById('printableReport');
    if (!printContainer) return;

    function cleanDate(dateString) {
        if (!dateString) return '';
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        const parsedDate = new Date(dateString);
        return isNaN(parsedDate.getTime()) ? dateString : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    const dateGenerated = new Date().toLocaleDateString('en-US', { 
        timeZone: 'Asia/Manila', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let html = `
        <!-- Print Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e293b; padding-bottom: 15px;">
            <h1 style="font-size: 20px; font-weight: bold; color: #1e293b; margin: 0; text-transform: uppercase;">${escapeHtml(currentOrgName)}</h1>
            <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">Adopted Pets Kamustahan Monitoring Report</p>
            <p style="font-size: 10px; color: #94a3b8; margin: 8px 0 0 0;">Date Generated: ${dateGenerated}</p>
        </div>

        <!-- Data Table -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
            <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 10px 8px; color: #334155; font-weight: bold; text-transform: uppercase; width: 35%;">Pets</th>
                    <th style="padding: 10px 8px; color: #334155; font-weight: bold; text-transform: uppercase; width: 35%;">Adopter Details</th>
                    <th style="padding: 10px 8px; color: #334155; font-weight: bold; text-transform: uppercase; width: 30%;">Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((item, index) => {
        const petName = item.pet_name || '';
        const species = item.species || '';
        
        const adopterName = item.adopter_name || '';
        const adopterEmail = item.adopter_email || '';
        
        let rawDate = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : '');
        if (rawDate && rawDate.includes(' • ')) rawDate = rawDate.split(' • ')[0];
        if (rawDate && rawDate.includes(' at ')) rawDate = rawDate.split(' at ')[0];
        const dateVal = cleanDate(rawDate);
        
        let displayPhoto = "";
        if (item.update_photos) {
            try {
                let parsed = JSON.parse(item.update_photos);
                if (Array.isArray(parsed) && parsed.length > 0) displayPhoto = parsed[0];
            } catch (e) { displayPhoto = item.update_photos; }
            if (displayPhoto && !displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) displayPhoto = `/uploads/${displayPhoto}`;
        } else if (item.pet_image) {
            displayPhoto = item.pet_image;
            if (displayPhoto && !displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) displayPhoto = `/uploads/pets/${displayPhoto}`;
        }

        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

        html += `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${bgColor}; page-break-inside: avoid;">
                <td style="padding: 12px 8px; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${displayPhoto ? `<img src="${displayPhoto}" crossorigin="anonymous" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover; border: 1px solid #e2e8f0;" />` : `<div style="width: 45px; height: 45px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8;">No Img</div>`}
                        <div>
                            <span style="font-weight: bold; color: #1e293b; display: block; font-size: 12px;">${escapeHtml(petName)}</span>
                            <span style="font-size: 10px; color: #64748b;">${escapeHtml(species)}</span>
                        </div>
                    </div>
                </td>
                <td style="padding: 12px 8px; vertical-align: middle;">
                    <span style="font-weight: 600; color: #1e293b; display: block;">${escapeHtml(adopterName)}</span>
                    <span style="font-size: 10px; color: #64748b;">${escapeHtml(adopterEmail)}</span>
                </td>
                <td style="padding: 12px 8px; vertical-align: middle; color: #334155;">
                    ${dateVal}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        
        <!-- Footer -->
        <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            <p style="margin: 0;">This report is generated automatically by the Pawpon System.</p>
            <p style="margin: 3px 0 0 0;">Total Records: ${data.length}</p>
        </div>
    `;
    printContainer.innerHTML = html;
}

function downloadKamustahanPDF() {
    const element = document.getElementById('printableReport'); 
    if (!element) {
        showToast("No report container found for download.", "error");
        return;
    }

    const options = {
        margin: 15,
        filename: `Kamustahan_${currentTab}_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };

    showToast("Generating PDF report, please wait...", "info");

    html2pdf().from(element).set(options).save()
        .then(() => {
            if (typeof filterAndRenderTable === 'function') filterAndRenderTable();
        })
        .catch(err => {
            console.error("Error downloading PDF:", err);
            showToast("There was a problem downloading the PDF.", "error");
        });
}

function exportSingleKamustahan() {
    const item = allUpdatesData.find(i => Number(i.update_id) === Number(currentUpdateIdForReply));
    if (!item) {
        showToast("Update data not found.", "error");
        return;
    }

    let healthData = {};
    let behaviorData = {};
    try { if (item.health_checklist) healthData = JSON.parse(item.health_checklist); } catch(e){}
    try { if (item.behavior_checklist) behaviorData = JSON.parse(item.behavior_checklist); } catch(e){}

    let photoUrl = "https://images.unsplash.com/photo-1543466835-00a7907e9de1";
    if (item.update_photos) {
        try {
            let parsed = JSON.parse(item.update_photos);
            if (Array.isArray(parsed) && parsed.length > 0) photoUrl = parsed[0];
        } catch (e) { photoUrl = item.update_photos; }
        if (!photoUrl.startsWith('http') && !photoUrl.startsWith('/')) photoUrl = `/uploads/${photoUrl}`;
    } else if (item.pet_image) {
        photoUrl = item.pet_image;
        if (!photoUrl.startsWith('http') && !photoUrl.startsWith('/')) photoUrl = `/uploads/pets/${photoUrl}`;
    }

    const displayDate = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : 'N/A');
    const generatedDate = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

    let riskColor = '#64748b'; 
    let riskText = 'N/A';
    if (item.risk_level === 'high') { riskColor = '#dc2626'; riskText = 'HIGH RISK'; }
    else if (item.risk_level === 'medium') { riskColor = '#d97706'; riskText = 'MEDIUM RISK'; }
    else if (item.risk_level === 'low') { riskColor = '#059669'; riskText = 'LOW RISK'; }

    const renderTableRows = (data, textColor) => {
        if (Object.keys(data).length === 0) return '<tr><td colspan="2" style="padding: 10px; text-align: center; color: #94a3b8; font-style: italic;">No data provided</td></tr>';
        return Object.entries(data).map(([key, val]) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 12px; font-weight: 600; color: #475569; text-transform: capitalize; width: 40%; background: #fafafa;">${key}</td>
                <td style="padding: 10px 12px; font-weight: 700; color: ${textColor}; text-transform: capitalize;">${val}</td>
            </tr>
        `).join('');
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("Your browser blocked the pop-up window. Please allow pop-ups.", "warning");
        return;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Kamustahan Report - ${escapeHtml(item.pet_name)}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #f1f5f9; color: #1e293b; -webkit-print-color-adjust: exact; }
                    .page { max-width: 800px; margin: 30px auto; background: #ffffff; padding: 50px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
                    
                    .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 0.5px; color: #0f172a; text-transform: uppercase; }
                    .header p { font-size: 14px; color: #64748b; margin: 8px 0 0 0; font-weight: 500; }
                    .header .date-gen { font-size: 11px; color: #94a3b8; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px;}
                    
                    .profile-section { display: flex; gap: 30px; margin-bottom: 40px; align-items: center; }
                    .pet-photo { width: 180px; height: 180px; border-radius: 16px; object-fit: cover; border: 4px solid #f8fafc; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                    .pet-info { flex: 1; }
                    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 1px; margin-bottom: 4px; }
                    .pet-name { font-size: 32px; font-weight: 800; margin: 0 0 15px 0; color: #0f172a; line-height: 1; }
                    .adopter-name { font-size: 18px; font-weight: 600; color: #2563eb; margin-bottom: 15px; }
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 13px; }
                    .meta-item strong { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 2px;}
                    .badge { display: inline-block; padding: 6px 14px; border-radius: 8px; color: white; font-weight: 700; font-size: 11px; background-color: ${riskColor}; letter-spacing: 0.5px;}
                    
                    .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px;}
                    
                    .checklist-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                    .table-box { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                    .table-header { background: #f8fafc; padding: 12px; font-weight: 700; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    
                    .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; line-height: 1.6;}
                    
                    @media print {
                        body { background: #ffffff; }
                        .page { box-shadow: none; margin: 0; padding: 0; max-width: 100%; }
                        .checklist-container { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <h1>${escapeHtml(currentOrgName)}</h1>
                        <p>Official Kamustahan Assessment Report</p>
                        <div class="date-gen">Generated on: ${generatedDate}</div>
                    </div>

                    <div class="profile-section">
                        <img src="${photoUrl}" class="pet-photo" crossorigin="anonymous" alt="Pet Photo">
                        <div class="pet-info">
                            <div class="label">Pet Name</div>
                            <h2 class="pet-name">${escapeHtml(item.pet_name)}</h2>
                            
                            <div class="label">Adopter</div>
                            <div class="adopter-name">${escapeHtml(item.adopter_name || 'Unknown Adopter')}</div>
                            
                            <div class="meta-grid">
                                <div class="meta-item">
                                    <strong>Date Submitted</strong>
                                    ${displayDate}
                                </div>
                                <div class="meta-item">
                                    <strong>Species</strong>
                                    ${escapeHtml(item.species || 'Pet')}
                                </div>
                            </div>
                            
                            <div>
                                <span class="badge">${riskText}</span>
                            </div>
                        </div>
                    </div>

                    <div class="checklist-container">
                        <div class="table-box">
                            <div class="table-header" style="color: #059669;">Health Check</div>
                            <table>
                                <tbody>${renderTableRows(healthData, '#059669')}</tbody>
                            </table>
                        </div>
                        
                        <div class="table-box">
                            <div class="table-header" style="color: #4f46e5;">Behavior Check</div>
                            <table>
                                <tbody>${renderTableRows(behaviorData, '#4f46e5')}</tbody>
                            </table>
                        </div>
                    </div>

                    ${item.vet_visit == 1 ? `
                        <div style="margin-bottom: 30px; page-break-inside: avoid;">
                            <h3 class="section-title">Veterinary Visit Record</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f0f9ff; border: 1px solid #bae6fd; padding: 16px; border-radius: 12px;">
                                <div>
                                    <span class="label" style="color: #0284c7;">Date of Visit</span>
                                    <span style="font-weight: 600; color: #0f172a;">${item.vet_visit_date ? new Date(item.vet_visit_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="label" style="color: #0284c7;">Diagnosis / Findings</span>
                                    <span style="font-weight: 600; color: #0f172a;">${escapeHtml(item.vet_diagnosis || 'No findings recorded')}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="footer">
                        This document is an official record generated by the Pawpon System.<br>
                        &copy; ${new Date().getFullYear()} ${escapeHtml(currentOrgName)}. All rights reserved.
                    </div>
                </div>

                <script>
                    const img = document.querySelector('.pet-photo');
                    const triggerPrint = () => setTimeout(() => window.print(), 500);
                    if(img) {
                        img.onload = triggerPrint;
                        img.onerror = triggerPrint;
                    } else {
                        triggerPrint();
                    }
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
}