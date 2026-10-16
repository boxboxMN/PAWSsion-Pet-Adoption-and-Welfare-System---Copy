let allUpdatesData = [];
let currentTab = 'active'; 
let currentSortOrder = 'desc'; 
let currentView = 'table';
let currentDate = new Date();

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

/**
 * Returns today's LOCAL date as YYYY-MM-DD.
 */
function getTodayLocalKey() {
    return toLocalDateKey(new Date());
}

/**
 * Formats a date to "Month DD, YYYY" using local timezone.
 */
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
// HTML ESCAPE — proteksyon sa XSS
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

    // Apply theme based on type
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
// TOAST NOTIFICATION (same style as donation.html)
// ==========================================
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) {
        console.warn("Toast container not found.");
        return;
    }

    const themes = {
        success: {
            classes: "bg-emerald-50 border-emerald-200 text-emerald-800",
            icon: "fa-circle-check text-emerald-600"
        },
        error: {
            classes: "bg-rose-50 border-rose-200 text-rose-800",
            icon: "fa-circle-xmark text-rose-600"
        },
        warning: {
            classes: "bg-amber-50 border-amber-200 text-amber-800",
            icon: "fa-triangle-exclamation text-amber-600"
        }
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
// ==========================================
// EXPORT DROPDOWN MENU HANDLERS
// ==========================================
function toggleExportMenu() {
    const menu = document.getElementById('exportDropdownMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof loadTopbar === "function") {
        await loadTopbar({ title: "Kamustahan", subtitle: "" });
    }
    if (typeof loadSidebar === "function") {
        await loadSidebar("dashboard");
    }

    await fetchKamustahanData();

    // Close Export Dropdown when clicking outside
    window.addEventListener('click', function(e) {
        const menu = document.getElementById('exportDropdownMenu');
        const button = e.target.closest('button');
        if (menu && !e.target.closest('#exportDropdownMenu') && (!button || !button.getAttribute('onclick')?.includes('toggleExportMenu'))) {
            menu.classList.add('hidden');
        }
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            filterAndRenderTable();
        });
    }

    const tabs = document.querySelectorAll(".flex.items-center.gap-8.border-b button");
    if(tabs.length >= 2) {
        tabs[0].addEventListener("click", () => {
            currentTab = 'active';
            tabs[0].className = "text-sm font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 px-1 transition-colors";
            tabs[1].className = "text-sm font-medium text-gray-500 hover:text-gray-800 pb-3 px-1 transition-colors";
            filterAndRenderTable();
        });
        tabs[1].addEventListener("click", () => {
            currentTab = 'archive';
            tabs[1].className = "text-sm font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 px-1 transition-colors";
            tabs[0].className = "text-sm font-medium text-gray-500 hover:text-gray-800 pb-3 px-1 transition-colors";
            filterAndRenderTable();
        });
    }

    const sortButton = document.querySelector("button:has(.fa-arrows-up-down)");
    if(sortButton) {
        sortButton.addEventListener("click", () => {
            currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
            sortButton.innerHTML = `<i class="fa-solid fa-arrows-up-down text-gray-400 text-xs"></i> Sort (${currentSortOrder.toUpperCase()})`;
            filterAndRenderTable();
        });
    }
});
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

        const scheduledItems = (typeof allUpdatesData !== 'undefined' ? allUpdatesData : []).filter(item => {
            const rawDate = toLocalDateKey(item.scheduled_date);
            return rawDate === dateString && item.is_archived != 1;
        });

        let eventsHtml = '';
        scheduledItems.forEach(item => {
            eventsHtml += `
                <div data-action="view" data-update-id="${Number(item.update_id)}"
                    class="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium p-1 rounded-md mb-1 cursor-pointer truncate hover:bg-amber-100 transition-colors"
                    title="Pet: ${escapeHtml(item.pet_name)} | Adopter: ${escapeHtml(item.adopter_name)}">
                    <i class="fa-regular fa-clock mr-1"></i> ${escapeHtml(item.pet_name)} (${escapeHtml(item.adopter_name)})
                </div>
            `;
        });

        dayCell.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}">${day}</span>
                ${scheduledItems.length > 0 ? `<span class="w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">${scheduledItems.length}</span>` : ''}
            </div>
            <div class="mt-1 flex-1 overflow-y-auto">
                ${eventsHtml}
            </div>
        `;

        calendarGrid.appendChild(dayCell);
    }
}

function exportData(type) {
    const monthFilter = document.getElementById("exportMonthFilter") ? document.getElementById("exportMonthFilter").value : "";
    
    let dataToExport = (typeof allUpdatesData !== 'undefined' ? allUpdatesData : []).filter(item => {
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
        let csvContent = "data:text/csv;charset=utf-8,Pet Name,Adopter,Date\n";
        
        dataToExport.forEach(item => {
            let pet = (item.pet_name || "").replace(/,/g, "");
            let adopter = (item.adopter_name || "").replace(/,/g, "");
            const rawDate = item.formatted_date || item.scheduled_date || "";
            let date = rawDate 
                ? formatReadableDate(rawDate).replace(/,/g, "")
                : "N/A";
            csvContent += `${pet},${adopter},${date}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `kamustahan_${currentTab}_reports.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } else if (type === 'pdf') {
        if (typeof html2pdf === 'undefined') {
            showToast("The PDF library has not been included yet.", "error");
            return;
        }
        renderPrintableReport(dataToExport);
        downloadKamustahanPDF();
    }
    
    const dropdownMenu = document.getElementById('exportDropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.classList.add('hidden');
    }
}

function renderPrintableReport(data) {
    let printContainer = document.getElementById('printableReport');
    if (!printContainer) return;

    function cleanDate(dateString) {
        if (!dateString) return 'N/A';

        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        const parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime())) {
            return dateString; 
        }
        return parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    let html = `
        <div class="hidden print:block mb-6 text-center">
            <h1 style="font-size: 18px; font-weight: bold; color: #111827; margin: 0;">PAWSSION BENEVOLENCE CIRCLE</h1>
            <p style="font-size: 13px; color: #4b5563; margin: 4px 0 15px 0;">Adopted Pets Kamustahan Report</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin-bottom: 15px;">
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 10px; color: #334155; text-transform: uppercase; font-size: 11px;">Pets</th>
                    <th style="padding: 10px; color: #334155; text-transform: uppercase; font-size: 11px;">Adopter</th>
                    <th style="padding: 10px; color: #334155; text-transform: uppercase; font-size: 11px;">Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        const petName = item.pet_name || 'N/A';
        const adopterName = item.adopter_name || 'N/A';
        
        const rawDate = item.formatted_date || item.formatted_scheduled_date || item.scheduled_date || '';
        const dateVal = cleanDate(rawDate);
        
        let displayPhoto = "";
        if (item.update_photos) {
            try {
                let parsed = JSON.parse(item.update_photos);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    displayPhoto = parsed[0];
                }
            } catch (e) { 
                displayPhoto = item.update_photos; 
            }
            if (displayPhoto && !displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) {
                displayPhoto = `/uploads/${displayPhoto}`;
            }
        } else if (item.pet_image) {
            displayPhoto = item.pet_image;
            if (displayPhoto && !displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) {
                displayPhoto = `/uploads/pets/${displayPhoto}`;
            }
        } else if (item.photo) {
            displayPhoto = item.photo;
        }

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${displayPhoto ? `<img src="${displayPhoto}" crossorigin="anonymous" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0;" />` : `<div style="width: 45px; height: 45px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b;">No Img</div>`}
                        <span style="font-weight: 600; color: #1e293b;">${escapeHtml(petName)}</span>
                    </div>
                </td>
                <td style="padding: 10px; vertical-align: middle; color: #475569;">${escapeHtml(adopterName)}</td>
                <td style="padding: 10px; vertical-align: middle; color: #475569;">${dateVal}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    printContainer.innerHTML = html;
}

function downloadKamustahanPDF() {
    const element = document.getElementById('printableReport'); 

    if (!element) {
        showToast("No report container found for download.", "error");
        return;
    }

    const options = {
        margin:       10,
        filename:     'Kamustahan-Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(options).save()
        .then(() => {
            console.log("PDF downloaded successfully!");
            if (typeof filterAndRenderTable === 'function') {
                filterAndRenderTable();
            }
        })
        .catch(err => {
            console.error("Error downloading PDF:", err);
            showToast("There was a problem downloading the PDF.", "error");
        });
}


function exportSingleKamustahan() {
    const petNameElement = document.getElementById('modalPetName');
    const photoElement = document.getElementById('modalPhoto');
    const adopterElement = document.getElementById('modalAdopter');
    const dateElement = document.getElementById('modalDate');

    if (!petNameElement || !photoElement) {
        showToast("Some required elements are missing from the modal.", "error");
        return;
    }
    const petName = petNameElement.innerText;
    const photoSrc = photoElement.src;
    const adopterRaw = adopterElement ? adopterElement.innerText : '';
    const dateRaw = dateElement ? dateElement.innerText : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("Your browser blocked the pop-up window. Please allow pop-ups for this site.", "warning");
        return;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Kamustahan Report - ${petName}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 30px;
                        text-align: center;
                    }
                    .report-container {
                        max-width: 700px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .image-wrapper {
                        width: 100%;
                        height: 400px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: #f9fafb;
                        margin-bottom: 20px;
                    }
                    .image-wrapper img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <h2>Kamustahan Report: ${petName}</h2>
                    <div class="image-wrapper">
                        <img id="printImage" src="${photoSrc}" crossorigin="anonymous" alt="Pet Photo">
                    </div>
                    <p><strong>${adopterRaw}</strong></p>
                    <p><strong>${dateRaw}</strong></p>
                </div>
                <script>
                    const img = document.getElementById('printImage');
                    img.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 300);
                    };
                    img.onerror = function() {
                        setTimeout(() => {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}
async function fetchKamustahanData() {
    try {
        const response = await fetch("/org/kamustahan-updates");
        const result = await response.json();

        if (result.success && result.updates) {
            allUpdatesData = result.updates;
            filterAndRenderTable();
            updateStatistics(allUpdatesData);
        } else {
            document.getElementById("updatesTableBody").innerHTML = `
                <tr><td colspan="5" class="text-center py-8 text-gray-400 italic">No updates found in database.</td></tr>
            `;
        }
    } catch (error) {
        console.error("Error fetching updates:", error);
        document.getElementById("updatesTableBody").innerHTML = `
            <tr><td colspan="5" class="text-center py-8 text-red-400 italic">Failed to connect to database server.</td></tr>
        `;
    }
}

function filterAndRenderTable() {
    const searchInputEl = document.getElementById("searchInput");
    const searchQuery = searchInputEl ? (searchInputEl.value || "").toLowerCase() : "";

    let filtered = allUpdatesData.filter(item => {
        const isArchived = item.is_archived == 1;
        const matchesTab = currentTab === 'archive' ? isArchived : !isArchived;

        const petName = (item.pet_name || "").toLowerCase();
        const adopterName = (item.adopter_name || "").toLowerCase();
        const matchesSearch = petName.includes(searchQuery) || adopterName.includes(searchQuery);

        return matchesTab && matchesSearch;
    });

    filtered.sort((a, b) => {
        let nameA = (a.pet_name || "").toLowerCase();
        let nameB = (b.pet_name || "").toLowerCase();
        if (currentSortOrder === 'asc') {
            return nameA.localeCompare(nameB);
        } else {
            return nameB.localeCompare(nameA);
        }
    });

    renderTable(filtered);
}

function renderTable(data) {
    const tbody = document.getElementById("updatesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400 italic">No matching records found.</td></tr>`;
        const paginationInfo = document.getElementById("tablePaginationInfo");
        if (paginationInfo) paginationInfo.textContent = "Showing 0 results";
        return;
    }

    const todayKey = getTodayLocalKey();

    data.forEach((item) => {
        let displayPhoto = "https://images.unsplash.com/photo-1543466835-00a7907e9de1";
        
        if (item.update_photos) {
            try {
                let parsed = JSON.parse(item.update_photos);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    displayPhoto = parsed[0];
                }
            } catch (e) { 
                displayPhoto = item.update_photos; 
            }
            if (!displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) {
                displayPhoto = `/uploads/${displayPhoto}`;
            }
        } else if (item.pet_image) {
            displayPhoto = item.pet_image;
            if (!displayPhoto.startsWith('http') && !displayPhoto.startsWith('/')) {
                displayPhoto = `/uploads/pets/${displayPhoto}`;
            }
        }

        // Status badge logic
        let statusBadge;

        if (item.is_archived == 1 || item.update_status === 'Archived') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                <i class="fa-solid fa-box-archive text-[10px]"></i> Archived
            </span>`;
        } else if (item.formatted_date && item.update_status !== 'For Update') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                <i class="fa-solid fa-check text-[10px]"></i> Updated
            </span>`;
        } else if (item.scheduled_date) {
            const deadlineKey = toLocalDateKey(item.scheduled_date);
            const isPast = todayKey > deadlineKey;

            if (isPast) {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                    <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> Overdue
                </span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                    <i class="fa-regular fa-calendar-check text-[10px]"></i> Scheduled
                </span>`;
            }
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                <i class="fa-regular fa-clock text-[10px]"></i> For Update
            </span>`;
        }

        // Action buttons — data attributes para sa event delegation
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

        const dateDisplay = 
            item.formatted_date 
            || item.formatted_scheduled_date 
            || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : 'N/A');

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
            <td class="py-4 px-3 align-middle">${statusBadge}</td>
            <td class="py-4 px-3 align-middle text-right pr-4 whitespace-nowrap">
                <div class="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden align-middle">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    const paginationInfo = document.getElementById("tablePaginationInfo");
    if (paginationInfo) paginationInfo.textContent = `Showing 1 to ${data.length} of ${data.length} results`;
}



function openUpdateModal(item) {
    currentOpenUpdateId = item.update_id;

    const modal = document.getElementById("updateModal");
    const modalPetName = document.getElementById("modalPetName");
    const modalPhoto = document.getElementById("modalPhoto");
    const modalText = document.getElementById("modalText");
    const modalAdopter = document.getElementById("modalAdopter");
    const modalDate = document.getElementById("modalDate");
    const modalActionContainer = document.getElementById("modalActionContainer");

    if (modalPetName) modalPetName.textContent = `Kamustahan: ${item.pet_name || 'Pet'}`;

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
    if (modalPhoto) modalPhoto.src = photoUrl;

    if (modalText) modalText.textContent = item.update_text || "No message provided.";

    // ⭐ HEALTH GRID
    const grid = document.getElementById("modalHealthGrid");
    if (grid) {
        const healthColors = {
            'Excellent': 'bg-emerald-50 border-emerald-200 text-emerald-700',
            'Good': 'bg-blue-50 border-blue-200 text-blue-700',
            'Needs Attention': 'bg-amber-50 border-amber-200 text-amber-700',
            'Poor': 'bg-rose-50 border-rose-200 text-rose-700'
        };
        const hc = healthColors[item.health_condition] || 'bg-slate-50 border-slate-200 text-slate-600';
        grid.innerHTML = `
            <div class="p-3 rounded-xl border ${hc}">
                <p class="text-[10px] font-bold uppercase tracking-wider opacity-70">Health</p>
                <p class="text-sm font-bold mt-1">${item.health_condition || '—'}</p>
            </div>
            <div class="p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-700">
                <p class="text-[10px] font-bold uppercase tracking-wider opacity-70">Weight</p>
                <p class="text-sm font-bold mt-1">${item.pet_weight ? item.pet_weight + ' kg' : '—'}</p>
            </div>
            <div class="p-3 rounded-xl border bg-orange-50 border-orange-200 text-orange-700">
                <p class="text-[10px] font-bold uppercase tracking-wider opacity-70">Appetite</p>
                <p class="text-sm font-bold mt-1">${item.appetite || '—'}</p>
            </div>
            <div class="p-3 rounded-xl border bg-purple-50 border-purple-200 text-purple-700">
                <p class="text-[10px] font-bold uppercase tracking-wider opacity-70">Type</p>
                <p class="text-sm font-bold mt-1">${item.consultation_type || 'Routine'}</p>
            </div>
        `;
    }

    // Behavior notes
    const behaviorWrap = document.getElementById("modalBehaviorWrap");
    const behaviorEl = document.getElementById("modalBehavior");
    if (item.behavior_notes && behaviorEl && behaviorWrap) {
        behaviorEl.textContent = item.behavior_notes;
        behaviorWrap.classList.remove("hidden");
    } else if (behaviorWrap) {
        behaviorWrap.classList.add("hidden");
    }

    // Vet
    const vetWrap = document.getElementById("modalVetWrap");
    const vetEl = document.getElementById("modalVet");
    if ((item.vet_name || item.vet_visit_date) && vetEl && vetWrap) {
        const parts = [];
        if (item.vet_name) parts.push(item.vet_name);
        if (item.vet_visit_date) parts.push(`(${item.vet_visit_date})`);
        vetEl.textContent = parts.join(' ');
        vetWrap.classList.remove("hidden");
    } else if (vetWrap) {
        vetWrap.classList.add("hidden");
    }

    // Existing reply
    const existingBanner = document.getElementById("existingReplyBanner");
    const existingText = document.getElementById("existingReplyText");
    const existingMeta = document.getElementById("existingReplyMeta");
    const replyInput = document.getElementById("orgReplyInput");
    const nextSchedInput = document.getElementById("nextScheduleInput");

    if (item.org_reply && existingBanner && existingText) {
        existingText.textContent = item.org_reply;
        existingMeta.textContent = item.org_reply_date
            ? `Sent: ${new Date(item.org_reply_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
            : '';
        existingBanner.classList.remove("hidden");

        if (replyInput) replyInput.value = item.org_reply;
    } else if (existingBanner) {
        existingBanner.classList.add("hidden");
        if (replyInput) replyInput.value = '';
    }

    if (nextSchedInput) nextSchedInput.value = item.next_schedule_date || '';

    // Date + Adopter
    if (modalAdopter) modalAdopter.textContent = `Adopter: ${item.adopter_name || 'N/A'}`;
    if (modalDate) {
        const displayDate = item.formatted_date || item.formatted_scheduled_date || (item.scheduled_date ? formatReadableDate(item.scheduled_date) : null) || 'N/A';
        modalDate.textContent = `Date: ${displayDate}`;
    }

    // Action buttons (archive) — keep existing logic
    if (modalActionContainer) {
        if (item.is_archived == 1) {
            modalActionContainer.innerHTML = `
                <span class="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-2 rounded-xl border border-gray-200">
                    <i class="fa-solid fa-box-archive mr-1"></i> Archived Item
                </span>
            `;
        } else if (item.update_status === 'For Update' || !item.formatted_date) {
            modalActionContainer.innerHTML = `
                <span class="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                    <i class="fa-regular fa-clock mr-1"></i> Available to archive once updated
                </span>
            `;
        } else {
            modalActionContainer.innerHTML = `
                <button onclick='archiveUpdate(${Number(item.update_id)})' class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2">
                    <i class="fa-solid fa-box-archive"></i> Archive
                </button>
            `;
        }
    }

    if (modal) modal.classList.remove("hidden");
}

function closeUpdateModal() {
    const modal = document.getElementById("updateModal");
    if (modal) modal.classList.add("hidden");
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
async function submitOrgReply() {
    if (!currentOpenUpdateId) {
        showToast("No update selected.", "error");
        return;
    }

    const replyInput = document.getElementById("orgReplyInput");
    const nextSchedInput = document.getElementById("nextScheduleInput");
    const sendBtn = document.getElementById("sendReplyBtn");

    const org_reply = (replyInput?.value || '').trim();
    const next_schedule_date = nextSchedInput?.value || '';

    if (org_reply.length < 5) {
        showToast("Reply must be at least 5 characters.", "warning");
        return;
    }

    const originalText = sendBtn ? sendBtn.innerHTML : '';
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sending...';
    }

    try {
        const res = await fetch('/org/kamustahan-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                update_id: currentOpenUpdateId,
                org_reply: org_reply,
                next_schedule_date: next_schedule_date || null
            })
        });

        const data = await res.json();

        if (data.success) {
            showToast(data.message || "Reply sent successfully!", "success");
            closeUpdateModal();
            fetchKamustahanData();
        } else {
            showToast(data.message || "Failed to send reply.", "error");
        }
    } catch (err) {
        console.error("Reply error:", err);
        showToast("Network error while sending reply.", "error");
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText || '<i class="fa-solid fa-paper-plane mr-1"></i> Send Reply';
        }
    }
}

function closeUpdateModal() {
    const modal = document.getElementById("updateModal");
    if (modal) modal.classList.add("hidden");
    currentOpenUpdateId = null;
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

    const update_id      = document.getElementById("schedUpdateId").value;
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
            showToast(
                data.message || `Deadline set to ${scheduled_date}. The adopter may submit anytime on or before this date.`,
                "success"
            );
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