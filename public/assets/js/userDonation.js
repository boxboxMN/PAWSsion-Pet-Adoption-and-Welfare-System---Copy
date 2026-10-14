// Stores all donation records fetched from the server
let rawDonationsData = [];
// Stores the currently selected receipt path for zoom/view actions
let currentActiveReceiptPath = "";

// ⭐ Pagination state
const ROWS_PER_PAGE = 5;             // ilang rows kada page
let currentPage = 1;
let currentFilteredData = [];        // filtered list para sa pagination
    document.addEventListener("DOMContentLoaded", async () => {
    await loadSidebar();
    // Wait one tick so the header HTML exists
    requestAnimationFrame(() => {
        // Set page title
        loadTopbar({
            title: "Donation",
            subtitle: "Make a difference by supporting rescue organizations and the pets in their care."
        });
        document.body.style.visibility = "visible";
    });

    // 2. I-load ang Profile at Donations Data
    await fetchAndRenderUserProfile();
    await fetchUserDonations();
});

function getReceiptImageUrl(receiptPath) {
    const fallback = "/assets/images/no-image.png";

    if (!receiptPath || typeof receiptPath !== "string") {
        return "";
    }

    const image = receiptPath.trim();

    if (!image || image === "null" || image === "undefined") {
        return "";
    }

    // Cloudinary or another complete image URL
    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    // Existing absolute local path
    if (image.startsWith("/")) {
        return image;
    }

    // Legacy local receipt filename
    return `/uploads/receipts/${encodeURIComponent(image)}`;
}

async function fetchUserDonations() {
    try {
        const response = await fetch('/api/user/donations');
        const result = await response.json();

        if (result.success) {
            rawDonationsData = result.donations;
            currentPage = 1;                   // ⭐ reset
            renderDonations(rawDonationsData);
            calculateStats(rawDonationsData);
        } else {
            showEmptyTable("Failed to load donations.");
        }
    } catch (error) {
        console.error("Error loading donations:", error);
        showEmptyTable("No donations found or error connecting to server.");
    }
}
function renderDonations(data) {
    currentFilteredData = data || [];

    const tbody = document.getElementById("donationTableBody");
    tbody.innerHTML = "";

    if (currentFilteredData.length === 0) {
        showEmptyTable("No donation records found.");
        updatePaginationUI();
        return;
    }

    // ⭐ Compute slice for current page
    const totalPages = Math.max(1, Math.ceil(currentFilteredData.length / ROWS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const endIdx   = startIdx + ROWS_PER_PAGE;
    const pageData = currentFilteredData.slice(startIdx, endIdx);

    pageData.forEach(item => {
        const formattedDate = new Date(item.date).toLocaleDateString("en-US", {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const isCash = item.type === "Cash";
        const iconClass = isCash ? "fa-money-bill-wave" : "fa-box-open";

        let detailsHtml = `<h3 class="font-medium text-gray-800">${item.organization || 'Animal Shelter'}</h3>`;
        if (isCash && item.reference_number) {
            detailsHtml += `<p class="text-xs text-gray-400 mt-0.5">Ref No: ${item.reference_number}</p>`;
        }

        const amountOrItems = isCash
            ? `₱ ${parseFloat(item.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}`
            : (item.item_name ? `${item.item_name} (${item.quantity || ''})` : (item.items || 'In-Kind Items'));

        let statusBadge = '';
        const statusStr = (item.status || 'Pending').toLowerCase();

        if (statusStr === 'approved' || statusStr === 'verified' || statusStr === 'received') {
            statusBadge = `
                <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full">
                    <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    Verified
                </div>`;
        } else if (statusStr === 'rejected') {
            statusBadge = `
                <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-3 py-1 rounded-full">
                    <span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                    Rejected
                </div>`;
        } else {
            statusBadge = `
                <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-full">
                    <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    Pending
                </div>`;
        }

        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-100 table-row-hover transition";
        tr.innerHTML = `
            <td class="p-4 text-xs font-medium text-gray-700">${formattedDate}</td>
            <td class="p-4">
                <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-sm">
                    <i class="fas ${iconClass}"></i>
                </div>
            </td>
            <td class="p-4">${detailsHtml}</td>
            <td class="p-4 text-xs font-bold text-gray-800">${amountOrItems}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 text-center">
                <button onclick="viewDetails('${item.type}', ${item.id})" class="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition" title="View Details">
                    <i class="fas fa-eye text-base"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI();
}
function updatePaginationUI() {
    const infoEl     = document.getElementById("paginationInfo");
    const controlsEl = document.getElementById("paginationControls");
    const footerEl   = document.getElementById("paginationFooter");

    if (!infoEl || !controlsEl || !footerEl) return;

    const total = currentFilteredData.length;

    // Kung walang laman, itago ang footer
    if (total === 0) {
        footerEl.classList.add("hidden");
        return;
    }
    footerEl.classList.remove("hidden");

    const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
    const startIdx   = (currentPage - 1) * ROWS_PER_PAGE + 1;
    const endIdx     = Math.min(currentPage * ROWS_PER_PAGE, total);

    infoEl.textContent = `Showing ${endIdx - startIdx + 1} of ${total} results`;

    // Build page buttons
    controlsEl.innerHTML = "";

    const makeBtn = (label, page, { disabled = false, active = false, isIcon = false } = {}) => {
        const btn = document.createElement("button");
        btn.type = "button";

        let cls = "min-w-[36px] h-9 px-3 rounded-lg text-sm font-semibold border transition flex items-center justify-center";

        if (active) {
            cls += " bg-blue-600 text-white border-blue-600 shadow-sm";
        } else if (disabled) {
            cls += " bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed";
        } else {
            cls += " bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-blue-700";
        }

        btn.className = cls;
        btn.innerHTML = label;
        btn.disabled = disabled;

        if (!disabled) {
            btn.addEventListener("click", () => goToPage(page));
        }
        return btn;
    };

    // Prev
    controlsEl.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-left text-xs"></i>',
        currentPage - 1,
        { disabled: currentPage === 1, isIcon: true }
    ));

    // Page numbers with ellipsis logic
    const pages = getPaginationRange(currentPage, totalPages);
    pages.forEach(p => {
        if (p === "...") {
            const span = document.createElement("span");
            span.className = "px-1 text-gray-400 text-sm font-semibold select-none";
            span.textContent = "...";
            controlsEl.appendChild(span);
        } else {
            controlsEl.appendChild(makeBtn(p, p, { active: p === currentPage }));
        }
    });

    // Next
    controlsEl.appendChild(makeBtn(
        '<i class="fa-solid fa-chevron-right text-xs"></i>',
        currentPage + 1,
        { disabled: currentPage === totalPages, isIcon: true }
    ));
}

function getPaginationRange(current, total) {
    const delta = 1; // ilang pages sa bawat tabi ng current
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

function goToPage(page) {
    const totalPages = Math.max(1, Math.ceil(currentFilteredData.length / ROWS_PER_PAGE));
    if (page < 1 || page > totalPages || page === currentPage) return;

    currentPage = page;
    renderDonations(currentFilteredData);
}
/**
 * Calculates and updates dashboard statistics.
 */
function calculateStats(data) {
    let totalCash = 0;
    let totalInKindCount = 0;

    data.forEach(item => {
        const statusStr = (item.status || '').toLowerCase();
        if (statusStr === 'approved' || statusStr === 'verified' || statusStr === 'received') {
            if (item.type === 'Cash') {
                totalCash += parseFloat(item.amount || 0);
            } else if (item.type === 'In-Kind') {
                totalInKindCount += 1;
            }
        }
    });

    document.getElementById("totalCash").textContent = `₱ ${totalCash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById("totalInKind").textContent = `${totalInKindCount} Donation${totalInKindCount === 1 ? '' : 's'}`;
}

/**
 * Filters donation records based on type.
 */
function filterDonations() {
    const filterValue = document.getElementById("typeFilter").value;
    if (filterValue === "All") {
        renderDonations(rawDonationsData);
    } else {
        const filtered = rawDonationsData.filter(d => d.type === filterValue);
        renderDonations(filtered);
    }
}

function showEmptyTable(message) {
    document.getElementById("donationTableBody").innerHTML = `
        <tr>
            <td colspan="6" class="text-center p-8 text-gray-400 text-sm">${message}</td>
        </tr>`;
}

function viewDetails(type, id) {
    const donation = rawDonationsData.find(d => d.id == id && d.type === type);
    if (!donation) return;

    document.getElementById("modalOrgName").textContent = donation.organization || 'Animal Shelter';
    
    const dateObj = new Date(donation.date);
    document.getElementById("modalDate").textContent = `${dateObj.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })} at ${dateObj.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}`;
    
    document.getElementById("modalType").textContent = donation.type;

    if (type === 'Cash') {
        document.getElementById("modalAmountContainer").classList.remove("hidden");
        document.getElementById("modalRefContainer").classList.remove("hidden");
        document.getElementById("modalAmount").textContent = `₱ ${parseFloat(donation.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById("modalRefNo").textContent = donation.reference_number || 'N/A';
    } else {
        document.getElementById("modalAmountContainer").classList.remove("hidden");
        document.getElementById("modalRefContainer").classList.add("hidden");
        
        // Dito pinalitan ang hardcoded string para makuha ang dynamic item name at quantity mula sa database
        const itemDisplay = donation.item_name ? `${donation.item_name} (${donation.quantity || ''})` : (donation.items || 'In-Kind Resource Item');
        document.getElementById("modalAmount").textContent = itemDisplay;
    }

    const proofSection = document.getElementById("modalProofSection");
    const receiptUrl = getReceiptImageUrl(donation.receipt_path);
    if (receiptUrl) {
        proofSection.classList.remove("hidden");

        currentActiveReceiptPath = receiptUrl;

        const preview = document.getElementById("modalReceiptPreview");
        preview.onerror = function () {
            this.onerror = null;
            this.src = "/assets/images/no-image.png";
        };
        preview.src = receiptUrl;
    } else {
        proofSection.classList.add("hidden");
        currentActiveReceiptPath = "";
    }

    const statusBanner = document.getElementById("modalStatusBanner");
    const statusStr = (donation.status || 'Pending').toLowerCase();

    if (statusStr === 'approved' || statusStr === 'verified' || statusStr === 'received') {
        statusBanner.className = "mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-semibold";
        statusBanner.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                <span>This donation has been verified and confirmed.</span>
            </div>
            <span class="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-full text-[11px]">Verified</span>
        `;
        statusBanner.classList.remove("hidden");
    } else if (statusStr === 'rejected') {
        statusBanner.className = "mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-1.5";
        statusBanner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-xmark text-rose-600 text-base"></i>
                    <span>This donation entry was rejected.</span>
                </div>
                <span class="px-2.5 py-0.5 bg-rose-200/60 text-rose-800 rounded-full text-[11px]">Rejected</span>
            </div>
            ${donation.rejection_reason ? `<p class="text-[11px] font-normal text-rose-700 pl-6 border-l-2 border-rose-300 ml-1">Reason: ${donation.rejection_reason}</p>` : ''}
        `;
        statusBanner.classList.remove("hidden");
    } else {
        statusBanner.className = "mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-800 text-xs font-semibold";
        statusBanner.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-clock text-amber-600 text-base"></i>
                <span>This donation is currently pending review by the organization.</span>
            </div>
            <span class="px-2.5 py-0.5 bg-amber-200/60 text-amber-800 rounded-full text-[11px]">Pending</span>
        `;
        statusBanner.classList.remove("hidden");
    }

    const modal = document.getElementById("detailsModal");
    modal.classList.remove("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.remove("scale-95");
}
    function closeDetailsModal() {
    const modal = document.getElementById("detailsModal");
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.add("scale-95");
}

function viewReceiptDirect(receiptPathRaw) {
    const fullPath = getReceiptImageUrl(receiptPathRaw)
        || "/assets/images/no-image.png";

    const modalImg = document.getElementById("modalReceiptImg");
    const downloadBtn = document.getElementById("downloadReceiptBtn");
    const openBtn = document.getElementById("openReceiptExternal");

    modalImg.onerror = function () {
        this.onerror = null;
        this.src = "/assets/images/no-image.png";
    };

    modalImg.src = fullPath;

    downloadBtn.href = fullPath;
    openBtn.href = fullPath;

    const modal = document.getElementById("receiptModal");
    modal.classList.remove("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.remove("scale-95");
}
function closeReceiptModal() {
    const modal = document.getElementById("receiptModal");
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.querySelector("div").classList.add("scale-95");
}

function triggerZoomReceipt() {
    if (currentActiveReceiptPath) {
        viewReceiptDirect(currentActiveReceiptPath);
    }
}

/**
 * Fetches user profile data to populate the header (name, avatar).
 */
async function fetchAndRenderUserProfile() {
    try {
        const response = await fetch('/api/user/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch user profile');

        const userData = await response.json();
        const user = userData.user || userData;

        const userNameEl = document.getElementById('userName') || document.querySelector('.user-name');
        const userAvatarEl = document.getElementById('userAvatar') || document.querySelector('.user-avatar');

        if (userNameEl) userNameEl.textContent = user.name || user.username;
        if (userAvatarEl && user.avatar) userAvatarEl.src = user.avatar;
    } catch (error) {
        console.error('Error loading profile in header:', error);
    }
}