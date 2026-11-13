const actionLabels = {
    organization_approved: "Approved organization",
    pet_created: "Added a pet",
    pet_updated: "Updated a pet",
    pet_deleted: "Deleted a pet",
    pet_archived: "Archived a pet",
    donation_status_updated: "Updated donation status",
    adoption_application_submitted: "Submitted adoption application",
    adoption_application_cancelled: "Cancelled adoption application (by adopter)",
    application_cancelled: "Cancelled adoption application (by organization)",
    donation_submitted: "Submitted a donation",
    kamustahan_submitted: "Submitted a Kamustahan update",
    application_approved: "Approved adoption application",
    application_declined: "Declined adoption application",
    application_status_updated: "Updated application status",
    account_registered: "Registered new account",
    login_success: "Logged in",
    login_failed: "Failed login attempt",
    logout: "Logged out",
    suspicious_login_input: "Suspicious login input detected",
    login_blocked: "Blocked login attempt",
    login_locked: "Login temporarily locked (too many attempts)",
    login_pending_org: "Org logged in (pending verification)",
    admin_profile_verification_failed: "Failed profile verification attempt",
    admin_profile_verify_locked: "Profile verification locked (too many attempts)",
    admin_profile_updated: "Updated own profile",
    org_profile_verification_failed: "Failed profile verification attempt",
    org_profile_verify_locked: "Profile verification locked (too many attempts)",
    org_profile_updated: "Updated organization profile",
    user_profile_updated: "Updated profile",
    interview_scheduled: "Scheduled an interview",
    interview_rescheduled: "Rescheduled an interview",
    reschedule_request_approved: "Approved reschedule request",
    reschedule_request_rejected: "Rejected reschedule request",
    organization_rejected: "Rejected organization",
    user_suspended: "Suspended user account",
    user_banned: "Banned user account",
    feedback_resolved: "Resolved feedback",
    feedback_unresolved: "Unresolved feedback",
    feedback_archived: "Archived feedback",
    feedback_unarchived: "Unarchived feedback",
    guide_section_created: "Created guide section",
    guide_section_updated: "Updated guide section",
    guide_section_deleted: "Deleted guide section",
    guide_section_restored: "Restored guide section",
    guide_section_purged: "Permanently deleted guide section",
    guide_sections_reordered: "Reordered guide sections",
    contact_info_updated: "Updated site contact info",
    user_status_changed: "Changed user status"
};

const PAGE_SIZE = 10;
let allLogs = [];
let currentPage = 1;

// ✅ Helper Function para harangin ang HTML injection / XSS
function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderLogRow(log) {
    const rawLabel = actionLabels[log.action] || log.action;
    const label = escapeHtml(rawLabel);
    const actorEmail = escapeHtml(log.actor_email || "Unknown");
    const actorRole = escapeHtml(log.actor_role || "unknown");
    const details = log.details ? " · " + escapeHtml(log.details) : "";

    const date = new Date(log.created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    return `
        <div class="p-4 flex items-start justify-between gap-4">
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800">${label}</p>
                <p class="text-xs text-slate-500">${actorEmail} <span class="text-slate-300">(${actorRole})</span>${details}</p>
            </div>
            <span class="text-xs text-slate-400 shrink-0">${date}</span>
        </div>
    `;
}

function renderPage(page) {
    const container = document.getElementById("logsList");
    if (!container) return;
    const paginationBox = document.getElementById("logsPagination");
    const paginationText = document.getElementById("logsPaginationText");
    const paginationButtons = document.getElementById("logsPaginationButtons");
    
    const totalPages = Math.max(1, Math.ceil(allLogs.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allLogs.slice(start, start + PAGE_SIZE);

    container.innerHTML = pageItems.map(renderLogRow).join("");

    if (!paginationBox) return;

    if (allLogs.length === 0) {
        paginationBox.classList.add("hidden");
        return;
    }

    paginationBox.classList.remove("hidden");
    if (paginationText) {
        paginationText.textContent = `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, allLogs.length)} of ${allLogs.length} results`;
    }

    const btnBase = "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition";
    const disabledBtn = `${btnBase} text-slate-300 cursor-not-allowed`;
    const enabledBtn = `${btnBase} text-slate-500 hover:bg-slate-100`;
    const activeBtn = `${btnBase} bg-blue-600 text-white`;

    let buttonsHtml = `<button type="button" data-page="${currentPage - 1}" class="page-btn ${currentPage === 1 ? disabledBtn : enabledBtn}" ${currentPage === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left text-[10px]"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        buttonsHtml += `<button type="button" data-page="${i}" class="page-btn ${i === currentPage ? activeBtn : enabledBtn}">${i}</button>`;
    }

    buttonsHtml += `<button type="button" data-page="${currentPage + 1}" class="page-btn ${currentPage === totalPages ? disabledBtn : enabledBtn}" ${currentPage === totalPages ? "disabled" : ""}><i class="fa-solid fa-chevron-right text-[10px]"></i></button>`;

    if (paginationButtons) {
        paginationButtons.innerHTML = buttonsHtml;
        paginationButtons.querySelectorAll(".page-btn:not(:disabled)").forEach(btn => {
            btn.addEventListener("click", () => renderPage(Number(btn.dataset.page)));
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof loadSidebar === "function") loadSidebar("logs");
    if (typeof loadTopbar === "function") {
        loadTopbar({ title: "Activity Logs", subtitle: "Review recent admin actions." });
    }

    const container = document.getElementById("logsList");

    try {
        const res = await fetch("/admin/api/logs");
        const data = await res.json();

        if (!data.success || !data.logs || data.logs.length === 0) {
            container.innerHTML = '<p class="p-6 text-xs text-slate-400">No activity recorded yet.</p>';
            return;
        }

        allLogs = data.logs;
        renderPage(1);

    } catch (err) {
        console.error("Failed to load logs", err);
        container.innerHTML = '<p class="p-6 text-xs text-rose-500">Unable to load activity logs.</p>';
    }
});
