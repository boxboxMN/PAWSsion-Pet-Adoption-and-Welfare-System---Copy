let currentAppId = null;
let currentAppDetails = null;
let allApplications = [];
let currentDeclineReason = "";
let pendingRescheduleOverrideReason = "";
let selectedMethod = 'virtual';

async function fetchAllOrgApplications() {
    try {
        const response = await fetch("/api/organization/applications", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        if (response.ok) {
            allApplications = await response.json();
        }
    } catch (err) {
        console.error("Error fetching all applications:", err);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof loadTopbar === "function") {
        await loadTopbar({
            title: "Adoption Application Details",
            subtitle: "Review complete details for this adopter"
        });
    }
    if (typeof loadSidebar === "function") {
        await loadSidebar("adoption"); 
    }

    // TAMA: Gamitin ang umiiral na global 'currentAppId' (huwag lagyan ng 'const' o 'let')
    currentAppId = sessionStorage.getItem("selectedApplicationId");

    // IDAGDAG ITO PARA MA-LOAD ANG LAHAT NG SCHEDULES:
    await fetchAllOrgApplications();

    if (currentAppId) {
        await fetchApplicationDetail(currentAppId);
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'No Application Selected',
            text: 'Please select an application from the list.',
            confirmButtonColor: '#2563EB'
        }).then(() => {
            window.location.href = "/org/adoption";
        });
    }

    // FORCE CLOSE TIME DROPDOWN: Kapag pinili na ang oras, automatic itong mag-blur para magsara
    const timeInput = document.getElementById("interviewTime");
    if (timeInput) {
        timeInput.addEventListener("change", function() {
            this.blur();
        });
    }

    const dateInput = document.getElementById("interviewDate");
    if (dateInput) {
        dateInput.addEventListener("change", function() {
            // Kapag nagbago ang petsa, i-generate ulit ang time options para ma-filter ang booked slots
            generateTimeOptions();
            
            // Linisin din ang nakaraang napiling oras sakaling sakupin nito ang booked slot
            document.getElementById("interviewTime").value = "";
            document.getElementById("interviewTimeDisplay").value = "";
        });
    }

    // I-load ang org availability nang isang beses sa simula
    await fetchOrgAvailability();
});

async function fetchApplicationDetail(id) {
    try {
        const response = await fetch(`/org/applications/${id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const app = await response.json();
        console.log("Exact DB Data:", app);

        if (app) {
            populateDetailsUI(app);
        }

    } catch (err) {
        console.error("❌ Error loading application detail:", err);
    }
}

function populateDetailsUI(app) {
    //for rescheduling interview
    currentAppDetails = app;

    const val = (v, fallback = "N/A") => (v !== undefined && v !== null && v !== "") ? v : fallback;

    // 1. Matalinong Status Check
    let status = app.status;

    if ((!status || status.trim() === "") && (app.interview_date || app.interview_time)) {
        status = "Interview Scheduled";
    } else if (!status || status.trim() === "") {
        status = "Under Review";
    }

    const lowerStatus = status.toLowerCase();

    // FIX: Kung Under Review ang status, huwag hayaang maging "Post-Interview Review" 
    // kahit may naiwan pang lumang interview date sa database.
    const isUnderReview = lowerStatus.includes("under review") || lowerStatus.includes("pending");

    // CHECK KUNG TAPOS NA ANG INTERVIEW DATE/TIME
    const now = new Date();
    let hasInterviewSchedule = false;
    let isPastInterview = false;

    if (app.interview_date) {
        hasInterviewSchedule = true;

        // Parse local date nang maayos (YYYY-MM-DD)
        let interviewDateTime;
        if (typeof app.interview_date === 'string' && app.interview_date.includes('T')) {
            const raw = new Date(app.interview_date);
            const yr = raw.getFullYear();
            const mo = String(raw.getMonth() + 1).padStart(2, '0');
            const dy = String(raw.getDate()).padStart(2, '0');
            interviewDateTime = new Date(`${yr}-${mo}-${dy}T00:00:00`);
        } else {
            interviewDateTime = new Date(app.interview_date);
        }

        if (app.interview_time) {
            const timeParts = app.interview_time.split(':');
            interviewDateTime.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
        } else {
            interviewDateTime.setHours(23, 59, 59, 999);
        }

        if (now > interviewDateTime) {
            isPastInterview = true;
        }
    }

    const isInterviewScheduled = lowerStatus.includes("interview") || lowerStatus.includes("scheduled");
    const statusBadge = document.getElementById("appStatusBadge");

    if (statusBadge) {
         if (lowerStatus === "post-interview review") {
            statusBadge.textContent = "Post-Interview Review";
            statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-200";
        } else {
            statusBadge.textContent = status;
            if (lowerStatus === "approved") {
                statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-600";
            } else if (lowerStatus === "declined" || lowerStatus === "rejected") {
                statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-600";
            } else if (isInterviewScheduled) {
                statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-600";
            } else if (lowerStatus.includes("cancelled")) {
                // Kulay ng badge kapag kinansela ng adopter
                statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-gray-200 text-gray-700";
            } else {
                statusBadge.className = "inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-600";
            }
        }
    }

    currentDeclineReason = app.decline_reason || app.rejection_reason || "No decline reason specified.";

    // 2. DISABLE BUTTONS KAPAG FINALIZED NA O CANCELLED BY ADOPTER
    const scheduleBtn = document.getElementById("scheduleBtn");
    const reviewDecisionBtn = document.getElementById("reviewDecisionBtn");

    const isDeclined = ["declined", "rejected"].includes(lowerStatus);
    const isApproved = lowerStatus === "approved";
    const isCancelled = lowerStatus.includes("cancelled"); // Check kung kinansela ng adopter
    const isFinalized = isApproved || isDeclined || isCancelled;

    // Awtomatikong magiging true (disabled) kung:
    // - Naka-Under Review o Pending pa ang status, O
    // - Walang interview schedule, O
    // - May interview date/time pa sa hinaharap (upcoming o kakareschedule lang ng org)
    const isUnderReviewOrPending = lowerStatus.includes("under review") || lowerStatus.includes("pending") || !isInterviewScheduled;
    const hasUpcomingOrOngoingInterview = Boolean(app.interview_date) && !isPastInterview;

    const shouldDisable = isFinalized || isUnderReviewOrPending || hasUpcomingOrOngoingInterview;

    if (scheduleBtn) {
        if (isInterviewScheduled) {
            scheduleBtn.disabled = isFinalized; 
            scheduleBtn.textContent = "Reschedule Interview"; 
            scheduleBtn.className = "px-5 py-2.5 rounded-xl border border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
        } else {
            scheduleBtn.disabled = isFinalized; 
            scheduleBtn.textContent = "Schedule Interview";
            scheduleBtn.className = "px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent";
        }
    }

    // DYNAMIC INTERVIEW BUTTON BASED ON APPLICATION STATUS
    if (reviewDecisionBtn) {
        if (isDeclined) {
            reviewDecisionBtn.disabled = false;
            reviewDecisionBtn.textContent = "View Decline Reason";
            reviewDecisionBtn.className = "px-5 py-2.5 rounded-xl border border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-semibold transition cursor-pointer";
            reviewDecisionBtn.onclick = handleViewDeclineReason;
        } else if (isApproved) {
            reviewDecisionBtn.disabled = true;
            reviewDecisionBtn.textContent = "Approved";
            reviewDecisionBtn.className = "px-5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-semibold cursor-not-allowed opacity-80";
            reviewDecisionBtn.onclick = null;
        } else if (lowerStatus === "interview scheduled") {
            reviewDecisionBtn.disabled = shouldDisable;
            reviewDecisionBtn.textContent = "Done Interview";
            reviewDecisionBtn.className = "px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition shadow-md shadow-blue-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600";
            reviewDecisionBtn.onclick = handleDoneInterview;
        } else if (lowerStatus === "post-interview review") {
            reviewDecisionBtn.disabled = false;
            reviewDecisionBtn.textContent = "Review Decision";
            reviewDecisionBtn.className = "px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition shadow-md cursor-pointer";
            reviewDecisionBtn.onclick = handleReviewDecision;
        } else {
            reviewDecisionBtn.disabled = true;
            reviewDecisionBtn.textContent = "Review Decision";
            reviewDecisionBtn.className = "px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold cursor-not-allowed opacity-50";
            reviewDecisionBtn.onclick = null;
        }
    }


    document.getElementById("appSubmittedDate").textContent = app.applied_date ? `Submitted on ${app.applied_date}` : 'Submitted on N/A';

    document.getElementById("applicantName").textContent = val(app.full_name);
    
    const locEl = document.getElementById("applicantLocation");
    if (locEl) {
        locEl.innerHTML = `<i class="fa-solid fa-location-dot text-blue-500 mt-0.5 shrink-0"></i> <span>${val(app.full_address)}</span>`;
    }

    document.getElementById("applicantPhone").textContent = val(app.contact_number);
    document.getElementById("applicantAge").textContent = val(app.age);
    document.getElementById("applicantStatus").textContent = val(app.civil_status);
    document.getElementById("applicantJob").textContent = val(app.occupation);
    document.getElementById("applicantEmail").textContent = val(app.email);

    // 5. Preferred Pet & Adoption Intent
    document.getElementById("targetPetName").textContent = `Name: ${val(app.pet_name)}`;
    document.getElementById("adoptionReason").textContent = val(app.adoption_intent, "No reason provided.");

    // 6. Emergency Contact Direct DB Mapping
    document.getElementById("emergencyName").textContent = val(app.emergency_name);
    document.getElementById("emergencyPhone").textContent = val(app.emergency_phone);
    document.getElementById("emergencyRelation").textContent = val(app.emergency_relation);
    
    // 7. ID PROOF DOCUMENT
    const idImg = document.getElementById("idProofImg");
    const placeholder = document.getElementById("idProofPlaceholder");
    const fileNameEl = document.getElementById("idProofFileName");

    if (idImg && placeholder) {
        const savedPath = String(app.document_path || "").trim();

        if (savedPath) {
            let imageUrl = savedPath.replace(/\\/g, "/");

            // Cloudinary: use the saved URL directly.
            // Legacy local uploads: convert to the existing uploads path.
            if (!/^https?:\/\//i.test(imageUrl)) {
                imageUrl = imageUrl.replace(/^\/+/, "");

                if (imageUrl.startsWith("documents/")) {
                    imageUrl = `/uploads/${imageUrl}`;
                } else if (imageUrl.startsWith("uploads/")) {
                    imageUrl = `/${imageUrl}`;
                } else {
                    imageUrl = `/uploads/documents/${imageUrl}`;
                }
            }

            idImg.onerror = () => {
                idImg.classList.add("hidden");
                placeholder.classList.remove("hidden");
                if (fileNameEl) {
                    fileNameEl.textContent = "Unable to load ID proof";
                }
            };

            idImg.onload = () => {
                idImg.classList.remove("hidden");
                placeholder.classList.add("hidden");
            };

            idImg.src = imageUrl;

            if (fileNameEl) {
                fileNameEl.textContent =
                    imageUrl.split("/").pop().split("?")[0] || "ID Proof";
            }
        } else {
            idImg.removeAttribute("src");
            idImg.classList.add("hidden");
            placeholder.classList.remove("hidden");

            if (fileNameEl) {
                fileNameEl.textContent = "No ID proof uploaded";
            }
        }
    }


    // 8. Render Status Action Box
    renderApplicationStatusDetails(app, isPastInterview);
}

// ================= CHECK IF INTERVIEW IS INCOMPLETE =================
function isInterviewIncomplete() {
if (!currentAppDetails || !currentAppDetails.interview_date) return true;

const now = new Date();
let schedDate;
if (typeof currentAppDetails.interview_date === 'string' && currentAppDetails.interview_date.includes('T')) {
    const raw = new Date(currentAppDetails.interview_date);
    const yr = raw.getFullYear();
    const mo = String(raw.getMonth() + 1).padStart(2, '0');
    const dy = String(raw.getDate()).padStart(2, '0');
    schedDate = new Date(`${yr}-${mo}-${dy}T00:00:00`);
} else {
    schedDate = new Date(currentAppDetails.interview_date);
}

if (currentAppDetails.interview_time) {
    const [h, m] = currentAppDetails.interview_time.split(':');
    schedDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
} else {
    schedDate.setHours(23, 59, 59, 999);
}

return now < schedDate;
}

// checks if the interview is scheduled and if the current time is before the scheduled interview time
async function handleDoneInterview() {
    if (!currentAppId || !currentAppDetails) {
        return Swal.fire({
            icon: "warning",
            title: "Attention",
            text: "No application selected.",
            confirmButtonColor: "#2563EB"
        });
    }

    const currentStatus = (
        currentAppDetails.status || ""
    ).toLowerCase();

    // Only scheduled interviews can be marked as completed
    if (currentStatus !== "interview scheduled") {
        return Swal.fire({
            icon: "warning",
            title: "Invalid Status",
            text: "Only applications with a scheduled interview can be marked as completed.",
            confirmButtonColor: "#2563EB"
        });
    }

    // Prevent marking the interview as done before its scheduled time
    if (isInterviewIncomplete()) {
        return Swal.fire({
            icon: "warning",
            title: "Interview Not Yet Finished",
            text: "You can mark the interview as done after its scheduled date and time.",
            confirmButtonColor: "#2563EB"
        });
    }

    const result = await Swal.fire({
        icon: "question",
        title: "Finish Interview?",
        text: "Mark this interview as completed and move the application to Post-Interview Review?",
        showCancelButton: true,
        confirmButtonText: "Yes, Done Interview",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#2563EB"
    });

    if (!result.isConfirmed) return;

    const btn = document.getElementById("reviewDecisionBtn");

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Updating...";
    }

    try {
        await updateStatus(
            currentAppId,
            "Post-Interview Review"
        );
    } finally {
        // Restore the button if the request fails
        // or the status has not changed yet.
        if (btn) {
            btn.disabled = false;
        }
    }
}

// ================= REVIEW DECISION (post-interview hub) =================
function handleReviewDecision() {
        if (!currentAppId) {
            return Swal.fire({ icon: 'warning', title: 'Attention', text: 'No application selected.', confirmButtonColor: '#2563EB' });
        }
        const modal = document.getElementById("reviewDecisionModal");
        if (modal) modal.classList.remove("hidden");
    }

    function closeReviewDecisionModal() {
        const modal = document.getElementById("reviewDecisionModal");
        if (modal) modal.classList.add("hidden");
    }

    function proceedToApprove() {
        closeReviewDecisionModal();
        handleApprove();
    }

    function proceedToDecline() {
        closeReviewDecisionModal();
        handleDecline();
    }


function handleDecline() {
    if (!currentAppId) {
        return Swal.fire({ icon: 'warning', title: 'Attention', text: 'No application selected.', confirmButtonColor: '#2563EB' });
    }

    // Only allow declining after the interview is marked complete
    if (!currentAppDetails || (currentAppDetails.status || "").toLowerCase() !== "post-interview review") {
         return Swal.fire({
             icon: "warning",
            title: "Action Restricted",
            text: "You can only decline an application after marking the interview as done.",
            confirmButtonColor: "#2563EB"
        });
    }

    const modal = document.getElementById("declineModal");
    if (modal) modal.classList.remove("hidden");

}

function closeDeclineModal() {
    const modal = document.getElementById("declineModal");
    if (modal) modal.classList.add("hidden");
    document.getElementById("declineReason").value = "";
}

async function submitDecline() {
    if (!currentAppId) return;

    const confirmBtn = document.getElementById("confirmDeclineBtn");
    const reason = document.getElementById("declineReason").value.trim();

    // FRONTEND VALIDATION: Pigilan kung walang nilagay na dahilan
    if (!reason) {
        return Swal.fire({
            icon: 'warning',
            title: 'Reason Required',
            text: 'Please provide a reason or feedback for declining this application.',
            confirmButtonColor: '#2563EB'
        });
    }
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Processing...`;

    try {
        await updateStatus(currentAppId, "Declined", reason);
        closeDeclineModal();
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>Confirm Decline</span>`;
    }
}

function handleViewDeclineReason() {
    const modal = document.getElementById("viewDeclineReasonModal");
    const reasonText = document.getElementById("viewDeclineReasonText");
    
    if (reasonText) {
        reasonText.textContent = currentDeclineReason || "No reason specified.";
    }
    
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function closeViewDeclineModal() {
    const modal = document.getElementById("viewDeclineReasonModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

async function handleApprove() {
    if (!currentAppId) {
        return Swal.fire({ icon: 'warning', title: 'Attention', text: 'No application selected.', confirmButtonColor: '#2563EB' });
    }

    // Only allow approval after the interview is marked complete
    if (!currentAppDetails || (currentAppDetails.status || "").toLowerCase() !== "post-interview review") {
        return Swal.fire({
             icon: "warning",
            title: "Action Restricted",
            text: "You can only approve an application after marking the interview as done.",
            confirmButtonColor: "#2563EB"
        });
    }

    // Auto-fill ang Meet-up Location gamit ang naka-save na address ng organization,
    // pero kung on-site na ang naka-schedule na interview, gamitin muna 'yon bilang default.
    const meetupInput = document.getElementById("meetupLocation");
    if (meetupInput) {
        if (currentAppDetails && currentAppDetails.interview_method === 'onsite' && currentAppDetails.interview_location_link) {
            meetupInput.value = currentAppDetails.interview_location_link;
        } else {
            meetupInput.value = "Loading address...";
            const orgData = await getOrgProfileData();
            meetupInput.value = buildOrgFullAddress(orgData) || "";
        }
    }

    const modal = document.getElementById("approveModal");
    if (modal) modal.classList.remove("hidden");
}

function closeApproveModal() {
    const modal = document.getElementById("approveModal");
    if (modal) modal.classList.add("hidden");
    document.getElementById("meetupLocation").value = "";
}

async function submitApprove() {
    if (!currentAppId) return;

    const meetupLocation = document.getElementById("meetupLocation").value.trim();

    if (!meetupLocation) {
        return Swal.fire({
            icon: 'warning',
            title: 'Meet-up Location Required',
            text: 'Please provide where the adopter should meet up to claim the pet.',
            confirmButtonColor: '#2563EB'
        });
    }

    const confirmBtn = document.getElementById("confirmApproveBtn");
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Finalizing...`;

    try {
        await updateStatus(currentAppId, "Approved", null, meetupLocation);
        closeApproveModal();
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>Confirm Approval</span>`;
    }
}

// ================= STATUS UPDATE API HANDLER =================
async function updateStatus(appId, status, reason = null, meetupLocation = null) {
    try {
        const response = await fetch(`/org/applications/${appId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: status, decline_reason: reason, meetup_location: meetupLocation })
        });

        const data = await response.json();

        if (response.ok && (data.success || data.status === "success")) {
            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: data.message || `Application status updated to ${status}.`,
                confirmButtonColor: '#2563EB'
            });
            await fetchApplicationDetail(appId);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: data.message || 'Unable to update application status.',
                confirmButtonColor: '#EF4444'
            });
        }
    } catch (err) {
        console.error("❌ Error updating status:", err);
        Swal.fire({
            icon: 'error',
            title: 'Server Error',
            text: 'Unable to connect to the server. Please try again later.',
            confirmButtonColor: '#EF4444'
        });
    }
}


function handleScheduleInterview() {
    if (!currentAppId) {
        return Swal.fire({ 
            icon: 'warning', 
            title: 'Attention', 
            text: 'No application selected.', 
            confirmButtonColor: '#2563EB' 
        });
    }

    // BAGONG CHECK: Kung naubos na ang 3 reschedule attempts, ipakita muna ang limit modal
    const rescheduleCount = (currentAppDetails && currentAppDetails.org_reschedule_count) || 0;
    if (currentAppDetails && currentAppDetails.interview_date && rescheduleCount >= 3) {
        openRescheduleLimitModal(rescheduleCount);
        return;
    }
    
    selectInterviewMethod('virtual');

    // Disable past dates
    const dateInput = document.getElementById("interviewDate");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.min = today; // Disable past dates
    }

    // Load existing interview details into modal inputs
    if (currentAppDetails && (currentAppDetails.interview_date || currentAppDetails.interview_time)) {
        if (currentAppDetails.interview_date) {
            let rawDate = currentAppDetails.interview_date;
            const d = new Date(rawDate);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            dateInput.value = `${year}-${month}-${day}`;
        }

        if (currentAppDetails.interview_time) {
            const rawTime = currentAppDetails.interview_time; 
            const timeOnly = rawTime.substring(0, 5); 
            
            document.getElementById("interviewTime").value = timeOnly;

            const [h, m] = timeOnly.split(':');
            let hrNum = parseInt(h, 10);
            const ampm = hrNum >= 12 ? 'PM' : 'AM';
            hrNum = hrNum % 12 || 12;
            document.getElementById("interviewTimeDisplay").value = `${String(hrNum).padStart(2, '0')}:${m} ${ampm}`;
        }
        
        const method = (currentAppDetails.interview_method || 'virtual').toLowerCase();
        selectInterviewMethod(method);
        
        document.getElementById("interviewLocationLink").value = currentAppDetails.interview_location_link || '';
    } else {
        selectInterviewMethod('virtual');
        document.getElementById("interviewTime").value = "";
        document.getElementById("interviewTimeDisplay").value = "";
        document.getElementById("interviewDate").value = "";
        document.getElementById("interviewLocationLink").value = "";
    }

    // IDAGDAG ITO PARA MA-GENERATE AT MA-FILTER AGAD ANG TIME SLOTS PAGBUKAS NG MODAL:
    generateTimeOptions();
    
    const modal = document.getElementById("scheduleModal");
    if (modal) modal.classList.remove("hidden");
}

function closeScheduleModal() {
    const modal = document.getElementById("scheduleModal");
    if (modal) modal.classList.add("hidden");
    document.getElementById("scheduleForm").reset();

    // Siguruhing nabubura rin ang custom display fields pag sinara
    document.getElementById("interviewTime").value = "";
    document.getElementById("interviewTimeDisplay").value = "";
}

function openRescheduleLimitModal(count) {
    document.getElementById("rescheduleLimitMessage").textContent =
        `This application has already been rescheduled ${count} times. Please tell us why you need to reschedule again.`;
    document.getElementById("rescheduleLimitReason").value = "";
    const modal = document.getElementById("rescheduleLimitModal");
    if (modal) modal.classList.remove("hidden");
}

function closeRescheduleLimitModal() {
    const modal = document.getElementById("rescheduleLimitModal");
    if (modal) modal.classList.add("hidden");
}

async function confirmNotAttending() {
    const reason = document.getElementById("rescheduleLimitReason").value.trim();
    if (!reason) {
        return Swal.fire({
            icon: 'warning',
            title: 'Reason Required',
            text: 'Please state that the applicant is not attending before declining.',
            confirmButtonColor: '#2563EB'
        });
    }

    const btn = document.getElementById("confirmNotAttendingBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Declining...`;

    try {
        await updateStatus(
            currentAppId,
            "Declined",
            `Application automatically declined: exceeded maximum reschedule attempts (3). Reason given: ${reason}`
        );
        closeRescheduleLimitModal();
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-user-slash"></i> Applicant Not Attending — Decline Application`;
    }
}

function confirmContinueReschedule() {
    const reason = document.getElementById("rescheduleLimitReason").value.trim();
    if (!reason) {
        return Swal.fire({
            icon: 'warning',
            title: 'Reason Required',
            text: 'Please provide a reason for rescheduling again.',
            confirmButtonColor: '#2563EB'
        });
    }

    pendingRescheduleOverrideReason = reason;
    closeRescheduleLimitModal();

    // Buksan ang normal na schedule modal para pumili ng bagong date/time
    selectInterviewMethod((currentAppDetails.interview_method || 'virtual').toLowerCase());
    document.getElementById("interviewDate").min = new Date().toISOString().split("T")[0];
    document.getElementById("scheduleModal").classList.remove("hidden");
}

async function selectInterviewMethod(method, isUserClick = false) {
    selectedMethod = method;
    
    const btnOnsite = document.getElementById("btnMethodOnsite");
    const btnVirtual = document.getElementById("btnMethodVirtual");
    const iconOnsite = document.getElementById("iconOnsite");
    const iconVirtual = document.getElementById("iconVirtual");
    const textOnsite = document.getElementById("textOnsite");
    const textVirtual = document.getElementById("textVirtual");
    
    const label = document.getElementById("methodDetailLabel");
    const input = document.getElementById("interviewLocationLink");

    if (method === 'onsite') {
        btnOnsite.className = "flex flex-col items-center justify-center py-4 px-3 border-2 border-blue-500 bg-blue-50/50 rounded-2xl gap-2 transition cursor-pointer";
        iconOnsite.className = "fa-solid fa-building text-2xl text-blue-500";
        textOnsite.className = "text-sm font-bold text-blue-600";

        btnVirtual.className = "flex flex-col items-center justify-center py-4 px-3 border border-gray-200 rounded-2xl gap-2 transition cursor-pointer hover:border-blue-400";
        iconVirtual.className = "fa-solid fa-video text-2xl text-gray-400";
        textVirtual.className = "text-sm font-bold text-gray-600";

        label.textContent = "Venue / Office Address:";
        input.placeholder = "e.g. Pawpon Shelter HQ, Main Hall";
    } else {
        btnVirtual.className = "flex flex-col items-center justify-center py-4 px-3 border-2 border-blue-500 bg-blue-50/50 rounded-2xl gap-2 transition cursor-pointer";
        iconVirtual.className = "fa-solid fa-video text-2xl text-blue-500";
        textVirtual.className = "text-sm font-bold text-blue-600";

        btnOnsite.className = "flex flex-col items-center justify-center py-4 px-3 border border-gray-200 rounded-2xl gap-2 transition cursor-pointer hover:border-blue-400";
        iconOnsite.className = "fa-solid fa-building text-2xl text-gray-400";
        textOnsite.className = "text-sm font-bold text-gray-600";

        label.textContent = "GMeet Link:";
        input.placeholder = "Please enter a valid Google Meet link";
    }

    
    if (isUserClick) {
        if (method === 'onsite') {
            
            input.value = "Loading address...";
            const orgData = await getOrgProfileData();
            const fullAddress = buildOrgFullAddress(orgData);
            input.value = fullAddress || "";
        } else {
            input.value = "";
        }
    }
}

async function submitInterviewSchedule(event) {
    // Ligtas na iprevent ang default form submit kung may event
    if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
    }
    
    if (!currentAppId) return;

    const dateVal = document.getElementById("interviewDate").value || null;
    const timeVal = document.getElementById("interviewTime").value || null;
    const detailVal = document.getElementById("interviewLocationLink").value.trim();
    const confirmBtn = document.getElementById("confirmScheduleBtn");

    if (!dateVal || !timeVal) {
        return Swal.fire({
            icon: 'warning',
            title: 'Incomplete Details',
            text: 'Please select both Date and Time for the interview.',
            confirmButtonColor: '#2563EB'
        });
    }

    // ================= WORKING DAY VALIDATION (dynamic, batay sa org's saved availability) =================
    const [selY, selM, selD] = dateVal.split('-').map(Number);
    const selectedDow = new Date(selY, selM - 1, selD).getDay();
    const selectedDayConfig = getAvailabilityForDay(selectedDow);

    if (!selectedDayConfig || !selectedDayConfig.is_open) {
        return Swal.fire({
            icon: 'warning',
            title: 'Invalid Day',
            text: `The organization is closed on ${DAY_NAMES[selectedDow]}s. Please select a different working day.`,
            confirmButtonColor: '#2563EB'
        });
    }

    // ================= PAST DATE & TIME VALIDATION =================
    const selectedDateTime = new Date(`${dateVal}T${timeVal}:00`);
    const now = new Date();

    if (selectedDateTime <= now) {
        return Swal.fire({
            icon: 'error',
            title: 'Invalid Schedule',
            text: 'You cannot schedule an interview in the past. Please select a future date and time.',
            confirmButtonColor: '#EF4444'
        });
    }

    // ================= GMEET LINK VALIDATION =================
    const urlCheckRegex = /https?:\/\/|www\./i;

    if (selectedMethod === 'virtual') {
        
        const gmeetRegex = /^https?:\/\/(www\.)?meet\.google\.com\/[a-z0-9]{3,4}-[a-z0-9]{3,4}-[a-z0-9]{3,4}(\?.*)?$/i;

        if (!detailVal || !gmeetRegex.test(detailVal)) {
            return Swal.fire({
                icon: 'error',
                title: 'Invalid Google Meet Link',
                text: 'Please enter a valid Google Meet link.',
                confirmButtonColor: '#EF4444'
            });
        }
    } else if (selectedMethod === 'onsite') {
        // Validation para sa On-site Venue / Address
        if (!detailVal) {
            return Swal.fire({
                icon: 'warning',
                title: 'Missing Venue Address',
                text: 'Please provide an office address or location for the on-site interview.',
                confirmButtonColor: '#2563EB'
            });
        }

    // Pigilan ang paglagay ng link o URL kapag On-site
    if (urlCheckRegex.test(detailVal)) {
            return Swal.fire({
                icon: 'error',
                title: 'Invalid On-site Address',
                text: 'On-site venue addresses cannot accept links or URLs. Please enter a physical location.',
                confirmButtonColor: '#EF4444'
            });
    }
}

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Saving...`;

    const payload = {
        status: "Interview Scheduled",
        interview_date: dateVal,
        interview_time: timeVal,
        interview_method: selectedMethod,
        interview_location_link: detailVal,
        override_reason: pendingRescheduleOverrideReason || undefined
    };

    try {
        const response = await fetch(`/org/applications/${currentAppId}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && (data.success || data.status === "success")) {
            pendingRescheduleOverrideReason = "";
            closeScheduleModal();
            await Swal.fire({
                icon: 'success',
                title: 'Scheduled!',
                text: 'Interview schedule has been set successfully.',
                confirmButtonColor: '#2563EB'
            });
            // Re-fetch para ma-update agad ang UI mula sa DB
            fetchApplicationDetail(currentAppId);
        } else if (response.status === 409 && data.code === 'RESCHEDULE_LIMIT_EXCEEDED') {
            // Fallback kung na-stale ang currentAppDetails sa client
            closeScheduleModal();
            openRescheduleLimitModal(data.reschedule_count || 3);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Schedule Failed',
                text: data.message || 'Could not save schedule. Please try again.',
                confirmButtonColor: '#EF4444'
            });
        }
    } catch (err) {
        console.error("❌ Error scheduling interview:", err);
        Swal.fire({
            icon: 'error',
            title: 'Server Error',
            text: 'Unable to connect to the server. Please try again later.',
            confirmButtonColor: '#EF4444'
        });
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `Confirm`;
    }
}

function renderApplicationStatusDetails(app, isPastInterview = false) {
    const container = document.getElementById("interviewDetailsCard");
    if (!container) return;

    // Suriin kung may nakatakdang schedule
    const hasSchedule = app.interview_date || app.interview_time || app.interview_location_link;

    if (!hasSchedule) {
        container.classList.add("hidden");
        return;
    }

    // FIX: hasSchedule alone isn't enough. If a re-applied application comes back
   
    // (declined) cycle, this card would show that stale schedule even though the
    // current status is a fresh "Under Review" with no interview of its own yet.
    // Only show the card when the status actually reflects an active interview
    // stage - "Interview Scheduled"/"Rescheduled", or the legitimate
    // "Post-Interview Review" state (interview date has passed and the org hasn't
    // finalized yet). A plain Under Review / Pending status with no interview
    // keyword means this cycle hasn't reached the interview stage, so any
    // interview_date present belongs to an earlier cycle and shouldn't be shown.
    // NOTE: this only hides the stale data in the UI - the real fix is to make sure
   
    // interview_location_link (and any resched_* fields) when an application is
    // re-opened/re-applied for, so the record itself doesn't carry old data forward.
    let statusForCardCheck = app.status;
    if ((!statusForCardCheck || statusForCardCheck.trim() === "") && (app.interview_date || app.interview_time)) {
        statusForCardCheck = "Interview Scheduled";
    } else if (!statusForCardCheck || statusForCardCheck.trim() === "") {
        statusForCardCheck = "Under Review";
    }
    const lowerStatusForCardCheck = statusForCardCheck.toLowerCase();

    if (lowerStatusForCardCheck.includes("under review") || lowerStatusForCardCheck.includes("pending")) {
        container.classList.add("hidden");
        return;
    }

    const isInterviewScheduledForCardCheck = lowerStatusForCardCheck.includes("interview") || lowerStatusForCardCheck.includes("scheduled");
    const isFinalizedForCardCheck = ["approved", "declined", "rejected"].includes(lowerStatusForCardCheck) || lowerStatusForCardCheck.includes("cancelled");
    const isPostInterviewReviewForCardCheck = isPastInterview && !isFinalizedForCardCheck;
    const isApprovedForCardCheck = lowerStatusForCardCheck === "approved";

    if (!isInterviewScheduledForCardCheck && !isPostInterviewReviewForCardCheck && !isApprovedForCardCheck) {
        container.classList.add("hidden");
        return;
    }

    // Kung hindi naipasa ang isPastInterview, i-compute ito dito
    if (typeof isPastInterview === "undefined" && app.interview_date) {
        const now = new Date();
        const interviewDateTime = new Date(app.interview_date);
        if (app.interview_time) {
            const [hours, minutes] = app.interview_time.split(':');
            interviewDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        } else {
            interviewDateTime.setHours(23, 59, 59, 999);
        }
        isPastInterview = now > interviewDateTime;
    }

    // 1. FORMAT DATE (Kaparehong-kapareho ng User Side formatDate function)
    let formattedDate = "—";
    if (app.interview_date) {
        try {
            formattedDate = new Date(app.interview_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        } catch (error) {
            formattedDate = app.interview_date;
        }
    }

    // 2. FORMAT TIME (Mula SQL TIME na "14:30:00" patungong "02:30 PM")
    let formattedTime = "No Time Set";
    if (app.interview_time) {
        const timeParts = app.interview_time.split(':');
        if (timeParts.length >= 2) {
            let hours = parseInt(timeParts[0], 10);
            const minutes = timeParts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            formattedTime = `${hours}:${minutes} ${ampm}`;
        } else {
            formattedTime = app.interview_time;
        }
    }

    const interviewMethod = app.interview_method ? app.interview_method.toUpperCase() : "N/A";
    const locationLink = app.interview_location_link || "N/A";

    // 2. CHECK FOR PENDING RESCHEDULE REQUEST
    const isReschedPending = app.resched_status === 'Pending' || (app.requested_interview_date && app.resched_status !== 'Approved');

    let reqFormattedDate = "—";
    if (app.requested_interview_date) {
        try {
            reqFormattedDate = new Date(app.requested_interview_date).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric"
            });
        } catch (e) { reqFormattedDate = app.requested_interview_date; }
    }

    let reqFormattedTime = "—";
    if (app.requested_interview_time) {
        const tParts = app.requested_interview_time.split(':');
        if (tParts.length >= 2) {
            let h = parseInt(tParts[0], 10);
            const m = tParts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            reqFormattedTime = `${h}:${m} ${ampm}`;
        }
    }

    // 3. RENDER SA UI CARD
    let reschedBannerHTML = "";
    if (isReschedPending) {
        reschedBannerHTML = `
            <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                        <i class="fa-solid fa-clock text-amber-600"></i> User Requested Reschedule
                    </span>
                    <span class="px-2.5 py-0.5 bg-amber-200/70 text-amber-800 text-[11px] font-bold rounded-md">ACTION REQUIRED</span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                        <span class="text-xs text-gray-400 block">Requested Date:</span>
                        <span class="font-bold text-gray-800">${reqFormattedDate}</span>
                    </div>
                    <div>
                        <span class="text-xs text-gray-400 block">Requested Time:</span>
                        <span class="font-bold text-gray-800">${reqFormattedTime}</span>
                    </div>
                    ${app.reschedule_reason ? `
                        <div class="sm:col-span-2 pt-1">
                            <span class="text-xs text-gray-400 block">Reason:</span>
                            <span class="text-xs text-gray-700 italic">${app.reschedule_reason}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                    <button onclick="approveReschedule('${app.application_id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">
                        <i class="fa-solid fa-check mr-1"></i> Accept Reschedule
                    </button>
                    <button onclick="rejectReschedule('${app.application_id}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition">
                        <i class="fa-solid fa-xmark mr-1"></i> Reject Request
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
            <h3 class="text-blue-600 font-semibold text-base mb-3 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-blue-500"></i> Interview Schedule Details
            </h3>
            <div class="p-4 bg-blue-50/50 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                <div class="min-w-0">
                    <span class="text-xs text-gray-400 block mb-0.5">Method</span>
                    <span class="font-bold text-gray-800 break-words">${interviewMethod}</span>
                </div>
                <div class="min-w-0">
                    <span class="text-xs text-gray-400 block mb-0.5">Current Date</span>
                    <span class="font-bold text-gray-800 break-words">${formattedDate}</span>
                </div>
                <div class="min-w-0">
                    <span class="text-xs text-gray-400 block mb-0.5">Current Time</span>
                    <span class="font-bold text-gray-800 break-all block">${formattedTime}</span>
                </div>
                <div class="sm:col-span-2 pt-2 border-t border-blue-100/60 min-w-0">
                    <span class="text-xs text-gray-400 block mb-0.5">Location / Link</span>
                    <span class="font-semibold text-gray-800 break-all block">
                        ${locationLink.startsWith('http') 
                            ? `<a href="${locationLink}" target="_blank" class="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"><i class="fa-solid fa-arrow-up-right-from-square text-xs shrink-0"></i> <span>${locationLink}</span></a>` 
                            : locationLink}
                    </span>
                </div>
            </div>

                ${app.status === 'Approved' ? `
            <div class="mt-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span class="text-xs text-emerald-600 block mb-0.5"><i class="fa-solid fa-map-marker-alt mr-1"></i>Meet-up Location for Pet Pickup</span>
                <span class="font-semibold text-emerald-900 break-words block mt-1">${app.meetup_location || 'Not specified.'}</span>
            </div>
            ` : ''}

            ${reschedBannerHTML}
        </div>
    `;
    
    container.classList.remove("hidden");
}

// Handler functions for Approve / Reject Reschedule
async function approveReschedule(appId) {
    const result = await Swal.fire({
        title: 'Accept Reschedule Request?',
        text: 'This will update the interview date and time to the applicant\'s requested schedule.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10B981', // Emerald green
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Yes, Accept',
        cancelButtonText: 'Cancel',
        customClass: { popup: 'rounded-2xl' }
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/org/applications/${appId}/approve-reschedule`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok && data.success) {
                await Swal.fire({ 
                    icon: 'success', 
                    title: 'Rescheduled!', 
                    text: data.message, 
                    confirmButtonColor: '#2563EB',
                    customClass: { popup: 'rounded-2xl' }
                });
                fetchApplicationDetail(appId);
            }
        } catch (err) {
            Swal.fire({ 
                icon: 'error', 
                title: 'Error', 
                text: 'Server error.', 
                confirmButtonColor: '#EF4444',
                customClass: { popup: 'rounded-2xl' }
            });
        }
    }
}

async function rejectReschedule(appId) {
    const result = await Swal.fire({
        title: 'Decline Reschedule Request?',
        text: 'The original interview schedule will be kept and the applicant will be notified.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444', // Red
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Yes, Decline',
        cancelButtonText: 'Cancel',
        customClass: { popup: 'rounded-2xl' }
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/org/applications/${appId}/reject-reschedule`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok && data.success) {
                await Swal.fire({ 
                    icon: 'info', 
                    title: 'Request Declined', 
                    text: data.message, 
                    confirmButtonColor: '#2563EB',
                    customClass: { popup: 'rounded-2xl' }
                });
                fetchApplicationDetail(appId);
            }
        } catch (err) {
            Swal.fire({ 
                icon: 'error', 
                title: 'Error', 
                text: 'Server error.', 
                confirmButtonColor: '#EF4444',
                customClass: { popup: 'rounded-2xl' }
            });
        }
    }
}

function previewIdProof() {
    const idImg = document.getElementById("idProofImg");
    if (idImg && idImg.src && !idImg.classList.contains("hidden")) {
        Swal.fire({
            imageUrl: idImg.src,
            imageAlt: 'ID Proof Document',
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: 'Open in New Tab',
            confirmButtonColor: '#2563EB',
            customClass: {
                image: 'max-h-[80vh] object-contain rounded-lg'
            }
        }).then((res) => {
            if (res.isConfirmed) {
                window.open(idImg.src, '_blank');
            }
        });
    }
}

function goBackAndRefresh() {
    if (document.referrer) {
        window.location.href = document.referrer;
    } else {
        window.history.back();
    }
}

// Variable para sa pag-cache ng profile
let cachedOrgProfile = null;

// Helper: Kunin ang Organization Profile
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
    return { organization_name: "Pawpon Organization Shelter" };
}

// Helper: Buuin ang Full Address ng Organization mula sa Profile data
function buildOrgFullAddress(orgData) {
    if (!orgData) return "";
    const parts = [
        orgData.address,
        orgData.barangay ? `Brgy. ${orgData.barangay}` : "",
        orgData.city,
        orgData.province,
        orgData.zip_code
    ].filter(part => part && String(part).trim() !== "");
    return parts.join(", ");
}

// Function para sa pag-export ng Single Application Details bilang PDF
async function exportSingleApplicationPDF() {
    if (!currentAppDetails) {
        return Swal.fire({
            icon: 'warning',
            title: 'Attention',
            text: 'Application details are not loaded yet.',
            confirmButtonColor: '#2563EB'
        });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait" });

    const orgData = await getOrgProfileData();
    const orgName = orgData.organization_name || "Pawpon Organization Shelter";
    const today = new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });

    // ================= 1. HEADER & LOGO/TITLE =================
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // Darker Indigo/Blue (#1E3A8A)
    doc.text("ADOPTION APPLICATION REPORT", 14, 20);

    doc.setDrawColor(37, 99, 235); // Primary Blue
    doc.setLineWidth(1);
    doc.line(14, 24, 196, 24);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); 
    doc.text(`Organization: ${orgName}`, 14, 32);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); 
    doc.text(`Generated Date: ${today}`, 14, 38);

    // Status Badge Block (Top Right)
    const appStatus = (currentAppDetails.status || 'Under Review').toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(239, 246, 255); 
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(135, 28, 61, 10, 2, 2, "FD");
    doc.setTextColor(29, 78, 216);
    doc.text(`STATUS: ${appStatus}`, 140, 34.5);

    // Helper Function para sa Section Banners
    function createSectionHeader(title, yPos) {
        doc.setFillColor(241, 245, 249); 
        doc.roundedRect(14, yPos, 182, 7, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 58, 138); 
        doc.text(title, 18, yPos + 4.8);
    }

    // Helper Function para sa Responsive/Auto-wrapped 2-Column Fields
    function drawResponsiveField(label, value, x, y, maxWidth = 85) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); 
        doc.text(label, x, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); 

        // I-auto wrap ang value sakaling mahaba (tulad ng kumpletong address)
        const wrappedText = doc.splitTextToSize(String(value || 'N/A'), maxWidth);
        doc.text(wrappedText, x, y + 5);

        // Ibabalik ang total height na nakonsumo para magamit sa dynamic Y spacing ng kasunod na rows
        return wrappedText.length * 4.5;
    }

    let currentY = 46;
    createSectionHeader("1. APPLICANT INFORMATION", currentY);

    currentY += 13;
    // Row 1 (Full Name vs Email)
    const h1 = Math.max(
        drawResponsiveField("FULL NAME", currentAppDetails.full_name, 18, currentY, 80),
        drawResponsiveField("EMAIL ADDRESS", currentAppDetails.email, 105, currentY, 85)
    );

    currentY += h1 + 8;
    // Row 2 (Contact vs Age/Civil Status)
    const h2 = Math.max(
        drawResponsiveField("CONTACT NUMBER", currentAppDetails.contact_number, 18, currentY, 80),
        drawResponsiveField("AGE / CIVIL STATUS", `${currentAppDetails.age || 'N/A'} yrs old • ${currentAppDetails.civil_status || 'N/A'}`, 105, currentY, 85)
    );

    currentY += h2 + 8;
    // Row 3 (Occupation vs Complete Address - ito madalas ang mahaba)
    const h3 = Math.max(
        drawResponsiveField("OCCUPATION", currentAppDetails.occupation, 18, currentY, 80),
        drawResponsiveField("COMPLETE ADDRESS", currentAppDetails.full_address, 105, currentY, 85)
    );

    currentY += h3 + 12;

    // ================= 2. SECTION 2: PREFERRED PET & ADOPTION INTENT =================
    createSectionHeader("2. PREFERRED PET & ADOPTION INTENT", currentY);

    currentY += 13;
    const hPet = drawResponsiveField("TARGET PET NAME", currentAppDetails.pet_name, 18, currentY, 170);

    currentY += hPet + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("REASON FOR ADOPTION", 18, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    
    const splitReason = doc.splitTextToSize(currentAppDetails.adoption_intent || "No reason provided.", 174);
    doc.text(splitReason, 18, currentY + 5);

    currentY += 12 + (splitReason.length * 4.5);

    // ================= 3. SECTION 3: EMERGENCY CONTACT =================
    createSectionHeader("3. EMERGENCY CONTACT DETAILS", currentY);

    currentY += 13;
    const hEmg1 = Math.max(
        drawResponsiveField("CONTACT PERSON", currentAppDetails.emergency_name, 18, currentY, 80),
        drawResponsiveField("RELATIONSHIP", currentAppDetails.emergency_relation, 105, currentY, 85)
    );

    currentY += hEmg1 + 8;
    drawResponsiveField("CONTACT NUMBER", currentAppDetails.emergency_phone, 18, currentY, 80);

    currentY += 18;

    // ================= 4. SECTION 4: INTERVIEW SCHEDULE (IF SET) =================
    if (currentAppDetails.interview_date || currentAppDetails.interview_time) {
        createSectionHeader("4. INTERVIEW SCHEDULE DETAILS", currentY);

        currentY += 13;
        const hInt1 = Math.max(
            drawResponsiveField("INTERVIEW METHOD", (currentAppDetails.interview_method || 'N/A').toUpperCase(), 18, currentY, 80),
            drawResponsiveField("SCHEDULED DATE & TIME", `${currentAppDetails.interview_date || 'N/A'} @ ${currentAppDetails.interview_time || 'N/A'}`, 105, currentY, 85)
        );

        currentY += hInt1 + 8;
        drawResponsiveField("LOCATION / MEETING LINK", currentAppDetails.interview_location_link, 18, currentY, 170);
    }

    // ================= FOOTER =================
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Confidential Document — For Organization Internal Adoption Review Only", 14, 285);
    doc.text("Page 1 of 1", 182, 285);

    const cleanFileName = (currentAppDetails.full_name || "Applicant").replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`Adoption_Form_${cleanFileName}.pdf`);
}

// Fallback lang ito habang naglo-load pa o kung walang laman ang response
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
}

function getAvailabilityForDay(dow) {
    return ORG_AVAILABILITY_BY_DAY.find(d => d.day_of_week === dow) || ORG_AVAILABILITY_BY_DAY[dow];
}

// Populate time slots batay sa naka-configure na org availability (per day of week)
function generateTimeOptions() {
    const dropdown = document.getElementById("timeDropdownList");
    if (!dropdown) return;

    // Kunin ang napiling petsa sa date picker
    const selectedDateVal = document.getElementById("interviewDate")?.value;

    if (!selectedDateVal) {
        dropdown.innerHTML = `<div class="p-3 text-sm text-gray-400 italic text-center">Please select a date first.</div>`;
        return;
    }

    const [selY, selM, selD] = selectedDateVal.split('-').map(Number);
    const selectedDow = new Date(selY, selM - 1, selD).getDay();
    const dayConfig = getAvailabilityForDay(selectedDow);

    if (!dayConfig || !dayConfig.is_open) {
        dropdown.innerHTML = `<div class="p-3 text-sm text-gray-400 italic text-center">Closed on ${DAY_NAMES[selectedDow]}s. Please select a different date.</div>`;
        return;
    }

    const [startHour, startMin] = (dayConfig.start_time || "08:00:00").split(':').map(Number);
    const [endHour, endMin] = (dayConfig.end_time || "18:00:00").split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    // Kunin ang mga naka-schedule nang interviews para sa petsang ito mula sa global 'allApplications'
    const bookedTimesForDate = new Set();
    if (selectedDateVal && typeof allApplications !== 'undefined') {
        allApplications.forEach(app => {
            // HUWAG ISAMA ang kasalukuyang application na nire-reschedule para hindi ma-block ang sarili nitong oras
            if (String(app.id) === String(currentAppId)) return;

            // Suriin kung ang application ay may interview date at time, at kung pareho ng petsa
            if (app.interview_date && app.interview_time) {
                const appDateStr = String(app.interview_date).split("T")[0];
                if (appDateStr === selectedDateVal) {
                    // Kunin ang oras sa HH:MM format (e.g., "08:00")
                    bookedTimesForDate.add(String(app.interview_time).substring(0, 5));
                }
            }
        });
    }

    let html = "";
    let availableCount = 0;

    // Kung ang napiling petsa ay NGAYON (today), kailangang alamin kung anong
    // oras na ngayon para maalis ang mga oras na lumipas na sa listahan.
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const isToday = selectedDateVal === todayStr;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (let totalMin = startTotalMin; totalMin <= endTotalMin; totalMin += 1) {
        {
            const hour = Math.floor(totalMin / 60);
            const minute = totalMin % 60;
            const h24 = String(hour).padStart(2, '0') + ":" + String(minute).padStart(2, '0');
            
            // Huwag ipakita ang oras na lumipas na kung ang petsa ay ngayong araw
            if (isToday && (hour * 60 + minute) <= nowMinutes) continue;

            // Format for display (e.g., 02:30 PM)
            let displayHour = hour % 12 || 12;
            displayHour = String(displayHour).padStart(2, '0');
            const displayMinute = String(minute).padStart(2, '0');
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const timeLabel = `${displayHour}:${displayMinute} ${ampm}`;

            // Tignan kung ang oras na ito ay nakabook na
            const isBooked = bookedTimesForDate.has(h24);

            if (isBooked) {
                // Kung naka-book na, maaari nating i-display na may markang naka-schedule o huwag na itong isali
                html += `<div class="p-3 text-sm font-medium text-gray-300 bg-gray-50 cursor-not-allowed flex items-center justify-between">
                    <span>${timeLabel}</span>
                    <span class="text-[10px] font-bold uppercase bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Already Scheduled</span>
                </div>`;
            } else {
                availableCount++;
                html += `<div class="p-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition" onclick="selectTime('${h24}', '${timeLabel}')">${timeLabel}</div>`;
            }
        }
    }

    if (availableCount === 0) {
        const message = isToday
            ? "No available time slots left for today. Please choose another date."
            : "Already fully booked for this date. Please select a different date.";
        html = `<div class="p-3 text-sm text-gray-400 italic text-center">${message}</div>`;
    }

    dropdown.innerHTML = html;
}

function toggleTimeDropdown() {
    const dropdown = document.getElementById("timeDropdownList");
    if (dropdown) {
        dropdown.classList.toggle("hidden");
    }
}

function selectTime(value24, label) {
    document.getElementById("interviewTime").value = value24;
    document.getElementById("interviewTimeDisplay").value = label;
    
    // Immediately close the dropdown list
    const dropdown = document.getElementById("timeDropdownList");
    if (dropdown) {
        dropdown.classList.add("hidden");
    }
}

// Close dropdown when clicking outside of it
document.addEventListener("click", function(event) {
    const container = document.getElementById("interviewTimeDisplay");
    const dropdown = document.getElementById("timeDropdownList");
    if (container && dropdown && !container.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add("hidden");
    }
});

// Call generator on page load
document.addEventListener("DOMContentLoaded", () => {
    generateTimeOptions();
});

const qualificationChecklistSections = [
    {
        title: "1. Financial Readiness",
        items: [
            { id: "food_expenses", label: "Can provide regular food and clean drinking water." },
            { id: "vet_expenses", label: "Has considered routine veterinary care and emergency expenses." },
            { id: "basic_supplies", label: "Can provide essential supplies for the pet." }
        ]
    },
    {
        title: "2. Living Environment and Safety",
        items: [
            { id: "living_permission", label: "Has permission to keep a pet where they live, when applicable." },
            { id: "safe_space", label: "Can provide a safe and suitable living space." },
            { id: "hazards", label: "Has considered potential household hazards and escape risks." }
        ]
    },
    {
        title: "3. Pet-Care Knowledge",
        items: [
            { id: "basic_care", label: "Understands the pet's basic feeding, hygiene, and care needs." },
            { id: "healthcare", label: "Understands the importance of vaccinations and veterinary checkups." },
            { id: "behavior", label: "Understands that pets may need training, patience, and adjustment time." }
        ]
    },
    {
        title: "4. Existing or Previous Pet Experience",
        items: [
            { id: "experience", label: "Has discussed any relevant previous or current pet-care experience." },
            { id: "first_time_support", label: "If a first-time adopter, has considered available guidance and support." }
        ]
    },
    {
        title: "5. Time and Long-Term Commitment",
        items: [
            { id: "daily_time", label: "Can provide sufficient time, attention, and daily care." },
            { id: "long_term", label: "Understands the long-term responsibility of pet ownership." },
            { id: "backup_care", label: "Has considered who can care for the pet during absences or emergencies." }
        ]
    },
    {
        title: "6. Animal Welfare and Handling",
        items: [
            { id: "humane_handling", label: "Demonstrates understanding of humane and responsible handling." },
            { id: "welfare", label: "Understands the importance of the pet's safety and welfare." },
            { id: "adjustment", label: "Is prepared to allow the pet time to adjust to a new home." }
        ]
    },
    {
        title: "7. Pet-Specific Readiness",
        items: [
            { id: "specific_needs", label: "Has considered this pet's known needs, age, and behavior." },
            { id: "household_fit", label: "Has considered compatibility with household members and other pets, if applicable." }
        ]
    },
    {
        title: "8. Adopter Behavior and Personality",
        items: [
            {
                id: "patience_understanding",
                label: "Shows willingness to be patient while the pet adjusts to its new home."
            },
            {
                id: "animal_behavior_approach",
                label: "Has considered humane ways to respond to unwanted behavior, fear, or adjustment difficulties."
            },
            {
                id: "realistic_expectations",
                label: "Has realistic expectations about pet ownership, training, and the pet's adjustment period."
            },
            {
                id: "lifestyle_compatibility",
                label: "Has a lifestyle and activity level compatible with this pet's needs."
            }
        ]
    }
];

const qualificationChecklistStatuses = [
    { value: "satisfactory", label: "Satisfactory" },
    { value: "needs_follow_up", label: "Needs Follow-up" },
    { value: "unsatisfactory", label: "Unsatisfactory" },
    { value: "not_assessed", label: "Not Assessed" }
];

function renderQualificationChecklist(savedData = {}) {
    const container = document.getElementById("qualificationChecklistItems");
    if (!container) return;

    container.innerHTML = "";

    qualificationChecklistSections.forEach((section) => {
        const sectionElement = document.createElement("section");
        sectionElement.className = "space-y-4";

        const heading = document.createElement("h4");
        heading.className = "text-base font-bold text-gray-800 border-b border-gray-200 pb-2";
        heading.textContent = section.title;
        sectionElement.appendChild(heading);

        section.items.forEach((item) => {
            const savedItem = savedData[item.id] || {};
            const itemWrapper = document.createElement("div");
            itemWrapper.className = "rounded-xl border border-gray-200 p-4 space-y-3";

            const label = document.createElement("p");
            label.className = "text-sm font-medium text-gray-800";
            label.textContent = item.label;
            itemWrapper.appendChild(label);

            const statusGroup = document.createElement("div");
            statusGroup.className = "flex flex-wrap gap-x-4 gap-y-2";

            qualificationChecklistStatuses.forEach((status) => {
                const optionLabel = document.createElement("label");
                optionLabel.className = "inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer";

                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = `qualification_${item.id}`;
                radio.value = status.value;
                radio.className = "text-teal-600 focus:ring-teal-500";
                radio.checked = savedItem.status === status.value;

                optionLabel.appendChild(radio);

                const optionText = document.createElement("span");
                optionText.textContent = status.label;
                optionLabel.appendChild(optionText);

                statusGroup.appendChild(optionLabel);
            });

            itemWrapper.appendChild(statusGroup);

            const noteLabel = document.createElement("label");
            noteLabel.className = "block text-xs font-semibold text-gray-600";
            noteLabel.textContent = "Item Notes";

            const noteInput = document.createElement("textarea");
            noteInput.name = `qualification_note_${item.id}`;
            noteInput.rows = 2;
            noteInput.maxLength = 1000;
            noteInput.placeholder = "Optional observations or follow-up questions...";
            noteInput.className = "mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";
            noteInput.value = savedItem.notes || "";

            noteLabel.appendChild(noteInput);
            itemWrapper.appendChild(noteLabel);

            sectionElement.appendChild(itemWrapper);
        });

        container.appendChild(sectionElement);
    });
}


async function openQualificationChecklist() {
    if (!currentAppId) {
        Swal.fire({
            icon: "warning",
            title: "No Application Selected",
            text: "Please select an adoption application first."
        });
        return;
    }

    const modal = document.getElementById("qualificationChecklistModal");
    if (!modal) {
        console.error("Qualification checklist modal was not found.");
        return;
    }

    modal.classList.remove("hidden");

    // Show applicant and pet details using the currently loaded application.
    const applicantName = document.getElementById("checklistApplicantName");
    const petName = document.getElementById("checklistPetName");

    if (applicantName) {
        applicantName.textContent =
            currentAppDetails?.full_name ||
            currentAppDetails?.applicant_name ||
            "Applicant";
    }

    if (petName) {
        petName.textContent =
            currentAppDetails?.pet_name ||
            currentAppDetails?.animal_name ||
            "Pet";
    }

    renderQualificationChecklist();

    const lastUpdated = document.getElementById("qualificationChecklistLastUpdated");
    if (lastUpdated) {
        lastUpdated.textContent = "Loading saved checklist...";
    }

    try {
        const response = await fetch(
            `/org/applications/${encodeURIComponent(currentAppId)}/qualification-checklist`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load the checklist.");
        }

        const checklist = result.checklist;

        if (checklist) {
            renderQualificationChecklist(checklist.data || {});

            const notesField = document.getElementById("qualificationChecklistNotes");
            if (notesField) {
                notesField.value = checklist.notes || "";
            }

            if (lastUpdated) {
                const updatedDate = checklist.updated_at
                    ? new Date(checklist.updated_at)
                    : null;

                lastUpdated.textContent =
                    updatedDate && !Number.isNaN(updatedDate.getTime())
                        ? `Last updated: ${updatedDate.toLocaleString()}`
                        : "Saved checklist loaded.";
            }
        } else {
            // No saved checklist yet: start with a blank checklist.
            renderQualificationChecklist();

            const notesField = document.getElementById("qualificationChecklistNotes");
            if (notesField) {
                notesField.value = "";
            }

            if (lastUpdated) {
                lastUpdated.textContent = "No checklist has been saved yet.";
            }
        }
    } catch (error) {
        console.error("Load qualification checklist error:", error);

        if (lastUpdated) {
            lastUpdated.textContent = "Unable to load the saved checklist.";
        }

        Swal.fire({
            icon: "error",
            title: "Unable to Load Checklist",
            text: error.message || "Please try again."
        });
    }
}

function closeQualificationChecklist() {
    const modal = document.getElementById("qualificationChecklistModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}


async function saveQualificationChecklist() {
    if (!currentAppId) {
        Swal.fire({
            icon: "warning",
            title: "No Application Selected",
            text: "Please select an adoption application first."
        });
        return;
    }

    const saveButton = document.getElementById("saveQualificationChecklistBtn");
    const notesField = document.getElementById("qualificationChecklistNotes");

    const checklistData = {};

    // Collect each item's status and notes.
    qualificationChecklistSections.forEach((section) => {
        section.items.forEach((item) => {
            const selectedStatus = document.querySelector(
                `input[name="qualification_${item.id}"]:checked`
            );

            const itemNotes = document.querySelector(
                `textarea[name="qualification_note_${item.id}"]`
            );

            checklistData[item.id] = {
                status: selectedStatus ? selectedStatus.value : null,
                notes: itemNotes?.value.trim() || ""
            };
        });
    });

    const originalButtonHTML = saveButton?.innerHTML;

    try {
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        const response = await fetch(
            `/org/applications/${encodeURIComponent(currentAppId)}/qualification-checklist`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    checklist_data: checklistData,
                    notes: notesField?.value.trim() || ""
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to save the checklist.");
        }

        const lastUpdated = document.getElementById(
            "qualificationChecklistLastUpdated"
        );

        if (lastUpdated) {
            lastUpdated.textContent =
                `Last saved: ${new Date().toLocaleString()}`;
        }

        await Swal.fire({
            icon: "success",
            title: "Checklist Saved",
            text: result.message || "Qualification checklist saved successfully.",
            confirmButtonColor: "#0d9488"
        });

        closeQualificationChecklist();
        
    } catch (error) {
        console.error("Save qualification checklist error:", error);

        Swal.fire({
            icon: "error",
            title: "Save Failed",
            text: error.message || "Unable to save the checklist. Please try again."
        });

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonHTML ||
                '<i class="fa-solid fa-floppy-disk"></i> Save Checklist';
        }
    }
}
