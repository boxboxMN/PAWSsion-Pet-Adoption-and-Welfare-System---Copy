let allApplications = [];
let filteredApplications = [];
let currentPage = 1;
const itemsPerPage = 5; // Pwedeng baguhin kung ilang rows ang gusto mo bawat page

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load Shared Components
    if (typeof loadTopbar === "function") {
        await loadTopbar({
            title: "Adoption Application",
            subtitle: "Review and Manage Adoption application from potential adopters"
        });
    }
    if (typeof loadSidebar === "function") {
        await loadSidebar("dashboard");
    }

    await fetchAdoptionApplications();

    // 3. Search & Filter Event Listeners
    document.getElementById("searchInput")?.addEventListener("input", filterAndRenderTable);
    document.getElementById("statusFilter")?.addEventListener("change", filterAndRenderTable);

    const params = new URLSearchParams(window.location.search);
        const applicationId = params.get("application_id");

        if (applicationId) {
         viewApplicationDetails(applicationId);
    }
});


async function fetchAdoptionApplications() {
    const tableBody = document.getElementById("applicationsTableBody");

    try {
        const response = await fetch("/api/organization/applications", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        
        if (!response.ok) throw new Error("Failed to load applications");

        allApplications = await response.json();

        // Dynamic count update para sa cards
        updateStatCards(allApplications);

        // Render table rows
        filterAndRenderTable();

    } catch (error) {
        console.error("Error fetching adoption applications:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-red-500 font-medium">
                    <i class="fa-solid fa-triangle-exclamation text-xl mb-1 block"></i>
                    Failed to fetch data. Please try again.
                </td>
            </tr>
        `;
    }
}

// Helper: Update Stat Cards
function updateStatCards(data) {
    let active = 0;     // Under Review
    let approved = 0;   // Approved
    let declined = 0;   // Declined / Rejected
    let interview = 0;  // Interview Scheduled

    data.forEach(app => {
        // I-normalize ang status string para hindi magka-error sa casing o underscores
        const status = (app.status || '').toLowerCase().replace(/_/g, ' ').trim();

        if (status.includes('approved')) {
            approved++;
        } else if (status.includes('declined') || status.includes('rejected')) {
            declined++;
        } else if (status.includes('interview') || status.includes('scheduled')) {
            interview++;
        } else if (status.includes('review') || status.includes('pending') || status === '') {
        // Tanging 'Under Review' at 'Pending' lamang ang bibilangin dito (hindi kasama ang 'Cancelled')
            active++;
        }
    });

    // I-update ang mga numero sa UI
    document.getElementById("statActiveApps").textContent = active;
    document.getElementById("statSuccessfulApps").textContent = approved;
    document.getElementById("statDeclinedApps").textContent = declined;
    document.getElementById("statInterviewApps").textContent = interview;
}

// Helper: Filter Function
function filterAndRenderTable() {
    const searchVal = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    const statusVal = (document.getElementById("statusFilter")?.value || "ALL").toLowerCase();

    filteredApplications = allApplications.filter(app => {
        // 1. Search Filter (Applicant Name, Email, o Pet Name)
        const matchesSearch = 
            (app.applicant_name || '').toLowerCase().includes(searchVal) ||
            (app.applicant_email || '').toLowerCase().includes(searchVal) ||
            (app.pet_name || '').toLowerCase().includes(searchVal);

        
        let rawStatus = (app.status || '').toLowerCase().replace(/_/g, ' ').trim();
        
        // Pag-set ng fallback kung walang status o PENDING
        if (!rawStatus || rawStatus.includes('pending') || rawStatus.includes('review')) {
            rawStatus = 'under review';
        }

        // 3. Status Matching Check
        let matchesStatus = false;

        if (statusVal === "all") {
            matchesStatus = true;
        } else if (statusVal === "under_review" && rawStatus.includes("review")) {
            matchesStatus = true;
        } else if (statusVal === "interview_scheduled" && (rawStatus.includes("interview") || rawStatus.includes("scheduled"))) {
            matchesStatus = true;
        } else if (statusVal === "approved" && rawStatus.includes("approved")) {
            matchesStatus = true;
        } else if (statusVal === "declined" && (rawStatus.includes("declined") || rawStatus.includes("rejected"))) {
            matchesStatus = true;
        } else if (statusVal === "cancelled" && rawStatus.includes("cancelled")) {
            matchesStatus = true;
        }

        return matchesSearch && matchesStatus;
    });

    currentPage = 1; // Panatilihing nasa page 1 pagkatapos mag-filter
    renderTableRows();
}

// Helper: Render Dynamic HTML Rows with Pagination
function renderTableRows() {
    const tableBody = document.getElementById("applicationsTableBody");
    const paginationInfo = document.getElementById("paginationInfo");
    const paginationControls = document.getElementById("paginationControls");

    const totalItems = filteredApplications.length;

    if (totalItems === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-400">
                    No adoption applications found.
                </td>
            </tr>
        `;
        paginationInfo.textContent = "Showing 0 of 0 results";
        paginationControls.innerHTML = "";
        return;
    }

    // Calculate Pagination Slices
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentData = filteredApplications.slice(startIndex, endIndex);

    const fallbackImg = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=80&h=80";

    tableBody.innerHTML = currentData.map(app => {
        const statusBadge = getStatusBadgeHTML(app.status);
        
        let petImage = app.pet_image;
        if (!petImage) {
            petImage = fallbackImg;
        } else if (!petImage.startsWith("http") && !petImage.startsWith("/")) {
            petImage = `/uploads/pets/${petImage}`; 
        }

        return `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="py-4 px-6">
                    <span class="font-semibold text-gray-900 block">${escapeHtml(app.applicant_name || 'N/A')}</span>
                    <span class="text-xs text-gray-400 block mt-0.5">${escapeHtml(app.applicant_email || '')}</span>
                </td>
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <img src="${petImage}" 
                                alt="${escapeHtml(app.pet_name || 'Pet')}" 
                                onerror="this.onerror=null; this.src='${fallbackImg}';"
                                class="w-9 h-9 rounded-full object-cover border border-gray-100" />
                        <div>
                            <span class="font-semibold text-gray-900 block">${escapeHtml(app.pet_name || 'N/A')}</span>
                            <span class="text-xs text-gray-400 block mt-0.5">${escapeHtml(app.pet_type || "Pet")}${app.pet_gender ? ' · ' + escapeHtml(app.pet_gender) : ''}</span>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    ${statusBadge}
                </td>
                <td class="py-4 px-6">
                    <span class="font-medium text-gray-900 block">${app.applied_date || 'N/A'}</span>
                    <span class="text-xs text-gray-400 block mt-0.5">${app.applied_time || ""}</span>
                </td>
                <td class="py-4 px-6 text-center">
                    <button onclick="viewApplicationDetails('${app.id}')" class="text-gray-400 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-gray-100 cursor-pointer" title="View Application">
                        <i class="fa-regular fa-eye text-lg"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Update Info Text
    paginationInfo.textContent = `Showing ${endIndex} of ${totalItems} results`;

    // Render Pagination Buttons (Tulad ng nasa image)
    renderPaginationButtons(totalPages);
}

// Helper: Render Pagination UI Buttons (Matching UI design)
function renderPaginationButtons(totalPages) {
    const paginationControls = document.getElementById("paginationControls");
    let html = '';

    // Previous Button (<)
    const prevDisabled = currentPage === 1;
    html += `
        <button onclick="changePage(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''} 
            class="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    // Page Number Buttons
    for (let page = 1; page <= totalPages; page++) {
        if (page === currentPage) {
            html += `
                <button class="w-8 h-8 flex items-center justify-center border border-blue-600 bg-blue-50 text-blue-600 font-semibold rounded-lg text-xs">
                    ${page}
                </button>
            `;
        } else {
            html += `
                <button onclick="changePage(${page})" 
                    class="w-8 h-8 flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium transition">
                    ${page}
                </button>
            `;
        }
    }

    // Next Button (>)
    const nextDisabled = currentPage === totalPages;
    html += `
        <button onclick="changePage(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''} 
            class="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    paginationControls.innerHTML = html;
}

// Change Page Action
function changePage(newPage) {
    currentPage = newPage;
    renderTableRows();
}

// Status Badge Component Helper
function getStatusBadgeHTML(status) {
    if (!status) status = '';
    
    // Gawing lowercase at palitan ang underscores para ligtas ang comparison
    const cleanStatus = status.toLowerCase().replace('_', ' ').trim();

    if (cleanStatus === 'post-interview review') {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Post-Interview Review</span>`;
    }
    else if (cleanStatus.includes('approved')) {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600">Approved</span>`;
    } 
    else if (cleanStatus.includes('declined') || cleanStatus.includes('rejected')) {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-500">Declined</span>`;
    } 
    else if (cleanStatus.includes('interview') || cleanStatus.includes('scheduled')) {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">Interview Scheduled</span>`;
    } 
    else if (cleanStatus.includes('review') || cleanStatus.includes('pending') || cleanStatus === '') {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-600">Under Review</span>`;
    } 
    else if (cleanStatus.includes('cancelled')) {
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">Cancelled by Adopter</span>`;
    } 
    else {
        // Fallback lang para sa hindi kilalang status
        return `<span class="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">${status}</span>`;
    }
}

// Action Handler
function viewApplicationDetails(applicationId) {
    // 1. I-save ang ID sa browser memory (tago sa URL)
    sessionStorage.setItem("selectedApplicationId", applicationId);
    
    // 2. I-redirect sa page nang WALANG ?id= parameter
    window.location.href = "/org/adoption-details";
}

// Utility to prevent XSS
function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

// ==========================================================
// INTERVIEW CALENDAR
// ==========================================================
// Default weekly availability, since there's no stored org schedule yet.
// Change this if your org's actual hours differ (0 = Sunday ... 6 = Saturday).
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Fallback lang ito habang naglo-load pa o kung walang laman ang response
let ORG_AVAILABILITY_BY_DAY = DAY_NAMES.map((_, i) => ({
    day_of_week: i,
    is_open: i !== 0,
    start_time: "08:00:00",
    end_time: "18:00:00"
}));

async function fetchOrgAvailability() {
    try {
        const res = await fetch('/api/organization/availability', { credentials: 'include' });
        const data = await res.json();
        if (data.success && Array.isArray(data.availability) && data.availability.length === 7) {
            ORG_AVAILABILITY_BY_DAY = data.availability;
        }
    } catch (err) {
        console.error("Failed to load org availability:", err);
    }
    updateAvailabilityHint();
}

function getAvailabilityForDay(dow) {
    return ORG_AVAILABILITY_BY_DAY.find(d => d.day_of_week === dow) || ORG_AVAILABILITY_BY_DAY[dow];
}

function updateAvailabilityHint() {
    const hintEl = document.getElementById("calendarAvailabilityHint");
    if (!hintEl) return;

    const openDays = ORG_AVAILABILITY_BY_DAY.filter(d => d.is_open);
    if (openDays.length === 0) {
        hintEl.textContent = "No availability set. Click \"Edit Time\" to configure your schedule.";
        return;
    }

    const openDayNames = openDays.map(d => DAY_NAMES[d.day_of_week].slice(0, 3)).join(", ");
    hintEl.textContent = `Open: ${openDayNames}. Click "Edit Time" to change your hours.`;
}

let calendarViewDate = new Date();
calendarViewDate.setDate(1);
let calendarSelectedDateStr = null;

async function openCalendarModal() {
    document.getElementById("calendarModal").classList.remove("hidden");
    calendarViewDate = new Date();
    calendarViewDate.setDate(1);

    await fetchOrgAvailability();

    // Kunin ang kasalukuyang petsa ngayon (bugal/araw ngayon)
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());

    calendarSelectedDateStr = todayStr;
    renderCalendarGrid();
    // Awtomatikong i-load at ipakita ang schedule ng araw na ito sa kanang panel
    selectCalendarDate(todayStr);
}

// ================= EDIT AVAILABILITY MODAL =================
function openEditAvailabilityModal() {
    const body = document.getElementById("availabilityFormBody");
    body.innerHTML = DAY_NAMES.map((name, dow) => {
        const day = getAvailabilityForDay(dow);
        const startVal = (day.start_time || "08:00:00").slice(0, 5);
        const endVal = (day.end_time || "18:00:00").slice(0, 5);
        return `
            <div class="availability-day-row flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50" data-day="${dow}">
                <label class="flex items-center gap-2 w-28 shrink-0 cursor-pointer">
                    <input type="checkbox" class="day-open-toggle w-4 h-4 accent-blue-600 cursor-pointer" data-day="${dow}" ${day.is_open ? 'checked' : ''} onchange="toggleDayRow(${dow})">
                    <span class="text-sm font-semibold text-gray-700">${name.slice(0, 3)}</span>
                </label>
                <input type="time" class="day-start-input flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" data-day="${dow}" value="${startVal}" ${day.is_open ? '' : 'disabled'}>
                <span class="text-gray-400 text-sm">to</span>
                <input type="time" class="day-end-input flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" data-day="${dow}" value="${endVal}" ${day.is_open ? '' : 'disabled'}>
            </div>
        `;
    }).join('');

    document.getElementById("editAvailabilityModal").classList.remove("hidden");
}

function closeEditAvailabilityModal() {
    document.getElementById("editAvailabilityModal").classList.add("hidden");
}

function toggleDayRow(dow) {
    const row = document.querySelector(`#availabilityFormBody .availability-day-row[data-day="${dow}"]`);
    if (!row) return;
    const isOpen = row.querySelector('.day-open-toggle').checked;
    row.querySelector('.day-start-input').disabled = !isOpen;
    row.querySelector('.day-end-input').disabled = !isOpen;
}

async function saveAvailability() {
    const rows = document.querySelectorAll('#availabilityFormBody .availability-day-row');
    const days = [];

    for (const row of rows) {
        const dow = parseInt(row.dataset.day, 10);
        const isOpen = row.querySelector('.day-open-toggle').checked;
        const startTime = row.querySelector('.day-start-input').value;
        const endTime = row.querySelector('.day-end-input').value;

        if (isOpen && (!startTime || !endTime || startTime >= endTime)) {
            alert(`${DAY_NAMES[dow]}: Start time must be earlier than end time.`);
            return;
        }

        days.push({
            day_of_week: dow,
            is_open: isOpen,
            start_time: startTime ? `${startTime}:00` : "08:00:00",
            end_time: endTime ? `${endTime}:00` : "18:00:00"
        });
    }

    const saveBtn = document.getElementById("saveAvailabilityBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const res = await fetch('/api/organization/availability', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ days })
        });
        const data = await res.json();

        if (data.success) {
            ORG_AVAILABILITY_BY_DAY = days;
            closeEditAvailabilityModal();
            updateAvailabilityHint();
            renderCalendarGrid();
            if (calendarSelectedDateStr) selectCalendarDate(calendarSelectedDateStr);
        } else {
            alert(data.message || "Failed to save availability.");
        }
    } catch (err) {
        console.error(err);
        alert("Something went wrong while saving.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
    }
}

function closeCalendarModal() {
    document.getElementById("calendarModal").classList.add("hidden");
}

function changeCalendarMonth(delta) {
    if (delta < 0) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const targetDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + delta, 1);

        // Huwag payagang lumipat kung ang target na buwan ay mas maaga kaysa sa kasalukuyang buwan ngayon
        if (targetDate.getFullYear() < currentYear || (targetDate.getFullYear() === currentYear && targetDate.getMonth() < currentMonth)) {
            return;
        }
    }
    calendarViewDate.setMonth(calendarViewDate.getMonth() + delta);
    renderCalendarGrid();
}

function getScheduledInterviews() {
    // Only count applications that are STILL actively "Interview Scheduled" right now.
    // If the org changes status to Under Review, Declined, Cancelled, or Approved,
    // that slot should stop being treated as booked on the calendar.
    return allApplications.filter(app => {
        if (!app.interview_date || !app.interview_time) return false;
        const cleanStatus = (app.status || '').toLowerCase().replace('_', ' ').trim();
        return cleanStatus.includes('interview') || cleanStatus.includes('scheduled');
    });
}

function getInterviewsByDate() {
    const map = {};
    getScheduledInterviews().forEach(app => {
        const dateStr = String(app.interview_date).split("T")[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(app);
    });
    return map;
}

function formatDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getSlotsForDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const dayConfig = getAvailabilityForDay(dow);

    if (!dayConfig || !dayConfig.is_open) return [];

    const [startH, startM] = (dayConfig.start_time || "08:00:00").split(':').map(Number);
    const [endH, endM] = (dayConfig.end_time || "21:00:00").split(':').map(Number);

    const startTotalMin = startH * 60 + startM;
    const endTotalMin = endH * 60 + endM;

    const slots = [];
    for (let totalMin = startTotalMin; totalMin <= endTotalMin; totalMin += 1) {
        const hStr = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mStr = String(totalMin % 60).padStart(2, '0');
        slots.push(`${hStr}:${mStr}`);
    }
    return slots;
}

function renderCalendarGrid() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    document.getElementById("calendarMonthLabel").textContent =
        calendarViewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Awtomatikong hanapin ang "Previous Month" button (ang unang button sa loob ng month navigation bar)
        const monthNavContainer = document.getElementById("calendarMonthLabel")?.parentElement;
        if (monthNavContainer) {
            const prevBtn = monthNavContainer.querySelector("button"); // Ang unang button ay ang < (left arrow)
            if (prevBtn) {
                if (year === currentYear && month <= currentMonth) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add("opacity-40", "cursor-not-allowed", "bg-gray-50");
                    prevBtn.classList.remove("hover:bg-gray-50", "cursor-pointer");
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove("opacity-40", "cursor-not-allowed", "bg-gray-50");
                    prevBtn.classList.add("hover:bg-gray-50", "cursor-pointer");
                }
            }
        }

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const interviewsByDate = getInterviewsByDate();

    const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());

    let cells = '';
    for (let i = 0; i < firstDayOfWeek; i++) {
        cells += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(year, month, day);
        const bookedCount = (interviewsByDate[dateStr] || []).length;
        const totalSlots = getSlotsForDate(dateStr).length;
        const isPast = dateStr < todayStr;
        const isClosed = totalSlots === 0;

        // Mas malinaw na kulay: Indigo/Blue para sa may interview, Bright Teal para sa fully open
        let dotColor = 'bg-slate-300';
        if (!isPast) {
            if (bookedCount > 0) {
                dotColor = 'bg-indigo-600'; // Kulay Indigo (Malayo sa green)
            } else if (!isClosed) {
                dotColor = 'bg-teal-500';  // Kulay Teal / Turkesa
            }
        }

        const isSelected = dateStr === calendarSelectedDateStr;

        // Kung past date na, huwag nang payagang ma-click (alisin ang onclick o i-disable)
        if (isPast) {
            cells += `
                <div class="aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-1 text-gray-300 bg-gray-50 cursor-not-allowed">
                    <span>${day}</span>
                </div>
            `;
        } else {
        cells += `
            <button onclick="selectCalendarDate('${dateStr}')"
                class="aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer
                    ${isSelected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-700'}
                    ${isPast && !isSelected ? 'text-gray-300' : ''}">
                <span>${day}</span>
                ${!isSelected ? `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>` : ''}
            </button>
        `;
        }
    }

    document.getElementById("calendarGrid").innerHTML = cells;
}

function selectCalendarDate(dateStr) {
    calendarSelectedDateStr = dateStr;
    renderCalendarGrid();

    const [y, m, d] = dateStr.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById("calendarSelectedDateLabel").textContent = label;

    const interviewsByDate = getInterviewsByDate();
    const dayInterviews = (interviewsByDate[dateStr] || []).slice().sort((a, b) =>
        String(a.interview_time).localeCompare(String(b.interview_time))
    );

    const allSlots = getSlotsForDate(dateStr);
    const bookedTimes = new Set(dayInterviews.map(app => String(app.interview_time).slice(0, 5)));
    // If viewing today, also exclude times that have already passed —
    // an unbooked 9:00 AM slot shouldn't read as "available" at 2:00 PM.
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const openSlots = allSlots.filter(slot => {
        if (bookedTimes.has(slot)) return false;
        if (dateStr === todayStr) {
            const [h, m] = slot.split(':').map(Number);
            if (h * 60 + m <= nowMinutes) return false;
        }
        return true;
    });

    const detailEl = document.getElementById("calendarDayDetail");

    if (allSlots.length === 0) {
        detailEl.innerHTML = `<p class="text-sm text-gray-400">Closed on this day.</p>`;
        return;
    }

    let html = '';

    html += `<div>
        <h5 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Scheduled (${dayInterviews.length})</h5>`;
    if (dayInterviews.length === 0) {
        html += `<p class="text-sm text-gray-400">No interviews scheduled yet.</p>`;
    } else {
        html += `<div class="space-y-2">` + dayInterviews.map(app => `
            <div onclick="viewApplicationDetails('${app.id}')" class="flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition rounded-lg px-3 py-2 cursor-pointer group" title="View Application Details">
                <div>
                    <span class="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition block">${escapeHtml(app.applicant_name || 'N/A')}</span>
                    <span class="text-xs text-gray-500">${escapeHtml(app.pet_name || '')}${app.interview_method ? ' · ' + escapeHtml(app.interview_method) : ''}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-blue-600">${formatTimeLabel(app.interview_time)}</span>
                    <i class="fa-solid fa-chevron-right text-xs text-blue-400 group-hover:translate-x-0.5 transition"></i>
                </div>
            </div>
        `).join('') + `</div>`;
    }
    html += `</div>`;

    html += `<div class="mt-4">
        <h5 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Still Available (${openSlots.length})</h5>`;
    if (openSlots.length === 0) {
        html += `<p class="text-sm text-gray-400">Fully booked.</p>`;
    } else {
        html += `<div class="flex flex-wrap gap-2">` + openSlots.map(slot => `
            <span class="text-xs font-medium bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg">${formatTimeLabel(slot)}</span>
        `).join('') + `</div>`;
    }
    html += `</div>`;

    detailEl.innerHTML = html;
}

function formatTimeLabel(timeStr) {
    const [hStr, mStr] = String(timeStr).split(':');
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${period}`;
}

const exportBtn = document.getElementById("exportBtn");
const exportDropdown = document.getElementById("exportDropdown");

exportBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (!exportBtn?.contains(e.target) && !exportDropdown?.contains(e.target)) {
        exportDropdown?.classList.add("hidden");
    }
});

// Modal para sa pagpili ng format (CSV or PDF)
function handleExportChoice(type) {
    exportDropdown?.classList.add("hidden"); // Isara agad ang dropdown

    const exportData = filteredApplications.length > 0 ? filteredApplications : allApplications;

    if (!exportData || exportData.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'No Data to Export',
            text: 'There are no adoption applications available to export.',
            confirmButtonColor: '#2563EB'
        });
        return;
    }

    if (type === 'csv') {
        exportAdoptionSummaryCSV(exportData);
    } else if (type === 'pdf') {
        exportAdoptionSummaryPDF(exportData);
    }
}

// Variable para i-cache ang organization profile data
let cachedOrgProfile = null;

// Helper Function: Kunin ang Org Profile mula sa API kung wala pa
async function getOrgProfileData() {
    if (cachedOrgProfile) return cachedOrgProfile;
    try {
        const response = await fetch('/api/organization/profile', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (response.ok) {
            cachedOrgProfile = await response.json();
            return cachedOrgProfile;
        }
    } catch (err) {
        console.error("Failed to fetch org profile:", err);
    }
    return { organization_name: "Pawpon Organization Shelter" }; // Fallback
}

// Function 1: Export as CSV
async function exportAdoptionSummaryCSV(data) {
    const orgData = await getOrgProfileData();
    const orgName = orgData.organization_name || "Pawpon Organization Shelter";
    const today = new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    const currentYear = new Date().getFullYear();

    let csvHeaderMeta = [
        `"Organization Name: ${orgName.replace(/"/g, '""')}"`,
        `"Report Period: ${currentYear}"`,
        `"Generated Date: ${today}"`,
        `""`
    ].join("\n");

    const headers = ["No.", "Applicant Name", "Applicant Email", "Target Pet", "Pet Species", "Gender", "Status", "Applied Date", "Applied Time"];

    // GAMIT ANG (app, index) -> index + 1
    const rows = data.map((app, index) => [
        `"${index + 1}"`, // <--- Kusa na itong magsisimula sa 1
        `"${(app.applicant_name || '').replace(/"/g, '""')}"`,
        `"${(app.applicant_email || '').replace(/"/g, '""')}"`,
        `"${(app.pet_name || '').replace(/"/g, '""')}"`,
        `"${(app.pet_type || '').replace(/"/g, '""')}"`,
        `"${(app.pet_gender || '').replace(/"/g, '""')}"`,
        `"${(app.status || 'Under Review').replace(/"/g, '""')}"`,
        `"${app.applied_date || ''}"`,
        `"${app.applied_time || ''}"`
    ]);

    const csvContent = "\uFEFF" + csvHeaderMeta + "\n" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const fileDate = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `Adoption_Summary_${fileDate}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Function 2: Export as PDF
async function exportAdoptionSummaryPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait" });

    // Kunin ang Organization Name mula sa API
    const orgData = await getOrgProfileData();
    const orgName = orgData.organization_name || "Pawpon Organization Shelter";
    
    const today = new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    const currentYear = new Date().getFullYear();

    // ================= 1. MAIN TITLE =================
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("Adoption Applications Summary Report", 14, 18);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 22, 196, 22);

    // ================= 2. ORGANIZATION DETAILS =================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Organization Name: ${orgName}`, 14, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Report Period: ${currentYear}`, 14, 36);
    doc.text(`Generated Date: ${today}`, 14, 42);

    // ================= 3. APPLICATIONS TABLE =================
    // Binago ang "ID" header patungong "#" para mas angkop sa row sequence
    const tableHeaders = [["#", "Applicant Name", "Email", "Target Pet", "Species", "Status", "Applied Date"]];

    // GAMIT ANG (app, index) -> index + 1 para maging 1, 2, 3...
    const tableRows = data.map((app, index) => [
        index + 1, // <--- Kusa na itong magsisimula sa 1 hanggang sa huling record
        app.applicant_name || 'N/A',
        app.applicant_email || 'N/A',
        app.pet_name || 'N/A',
        app.pet_type || 'N/A',
        app.status || 'Under Review',
        `${app.applied_date || ''}`
    ]);

    doc.autoTable({
        head: tableHeaders,
        body: tableRows,
        startY: 48,
        theme: 'grid',
        headStyles: { 
            fillColor: [20, 184, 137], // Teal/Emerald Color (#14b889)
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { fontSize: 8.5, cellPadding: 3, halign: 'center' },
        columnStyles: {
            0: { cellWidth: 10 } // Mas makitid na column width para sa number (#)
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    const fileDate = new Date().toISOString().split("T")[0];
    doc.save(`Adoption_Summary_${fileDate}.pdf`);
}
