document.addEventListener("DOMContentLoaded", async () => {

    // Wait until sidebar + header are loaded
    await loadSidebar();

    // Wait one tick so the header HTML exists
    requestAnimationFrame(() => {

        // Set page title
        loadTopbar({
            title: "My Application",
            subtitle: "Track your adoption applications, monitor their progress, and stay updated on each stage of the adoption process."
        });

        document.body.style.visibility = "visible";
    });

});

let applications = [];
let currentTab = "Under Review";
let selectedApp = null;

// =====================================================
// DOM REFERENCES
// =====================================================

const listView = document.getElementById("list-view");
const detailsView = document.getElementById("details-view");
const tableBody = document.getElementById("table-body");
const tabBtns = document.querySelectorAll(".tab-btn");
const backBtn = document.getElementById("back-btn");
const detailsActions = document.getElementById("details-actions");
const detailStatusBadge = document.getElementById("detail-status-badge");
const detailRef = document.getElementById("detail-ref");
const detailUploadDate = document.getElementById("detail-upload-date");
const detailApplicant = document.getElementById("detail-applicant");
const detailIntent = document.getElementById("detail-intent");
const detailEmergency = document.getElementById("detail-emergency");
const stepperContainer = document.getElementById("stepper-container");

// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(date) {
    if (!date) return "—";
    try {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    } catch (error) {
        return date;
    }
}

// =====================================================
// FORMAT TIME (12-Hour AM/PM Format)
// =====================================================

function formatTime(timeStr) {
    if (!timeStr) return "—";
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
        let hours = parseInt(timeParts[0], 10);
        const minutes = timeParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Kapag 0 (12 AM), gawing 12
        const formattedHours = hours < 10 ? `0${hours}` : hours;
        return `${formattedHours}:${minutes} ${ampm}`;
    }
    return timeStr;
}

// =====================================================
// GET STATUS CSS CLASS
// =====================================================

function getStatusClass(status) {
    switch (status) {
        case "Under Review":
            return "active";
        case "Interview Scheduled":
            return "scheduled";
        case "Post-Interview Review":
            return "scheduled";
        case "Approved":
            return "success";
        case "Declined":
            return "declined";
        case "Cancelled":
            return "cancelled";
        default:
            return "active";
    }
}

function getPetImageUrl(imagePath) {
    const fallback = "/assets/images/no-image.png";

    if (!imagePath || typeof imagePath !== "string") {
        return fallback;
    }

    const image = imagePath.trim();

    if (!image || image === "null" || image === "undefined") {
        return fallback;
    }

    // Cloudinary or another complete image URL
    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    // Existing absolute path
    if (image.startsWith("/")) {
        return image;
    }

    // Legacy filename stored in the database
    return `/uploads/pets/${encodeURIComponent(image)}`;
}

// =====================================================
// LOAD APPLICATIONS FROM DATABASE
// =====================================================
async function loadApplications() {
    try {
        // ---------------------------------------------
        // SHOW LOADING
        // ---------------------------------------------
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    Loading your applications...
                </td>
            </tr>
        `;

        // ---------------------------------------------
        // REQUEST CURRENT USER'S APPLICATIONS
        // ---------------------------------------------
        const response = await fetch("/api/user/applications");

        // ---------------------------------------------
        // CHECK RESPONSE
        // ---------------------------------------------
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        // ---------------------------------------------
        // PARSE JSON
        // ---------------------------------------------
        const data = await response.json();

        console.log("User applications:", data);

        // ---------------------------------------------
        // CHECK SUCCESS
        // ---------------------------------------------
        if (!data.success) {
            throw new Error(data.message || "Failed to load applications.");
        }

        // ---------------------------------------------
        // CONVERT DATABASE DATA
        // ---------------------------------------------
        applications = data.applications.map(app => {
            // 1. I-parse ang JSON string mula sa applicant_snapshot
        let snap = {};
        if (app.applicant_snapshot) {
            try {
                snap = typeof app.applicant_snapshot === 'string' 
                    ? JSON.parse(app.applicant_snapshot) 
                    : app.applicant_snapshot;
            } catch (e) {
                console.error("Error parsing snapshot:", e);
            }
        }

        return {
            id: app.application_id,
            petId: app.animal_id,
            petName: app.pet_name || "Unknown Pet",
            species: app.species || "N/A",
            gender: app.gender || "N/A",
            petAge: app.pet_age || "N/A",
            petAdoptionStatus: app.pet_adoption_status || "Available",
            image: getPetImageUrl(app.image_path),
            organization: app.organization_name || "Unknown Organization",
            organizationId: app.organization_id || app.org_id || null, 
            status: app.status === "Pending" ? "Under Review" : (app.status || "Under Review"),
            date: formatDate(app.created_at),
            rawDate: app.created_at,

            
            // Applicant Info mula sa Form
            applicant: {
                fullName: snap.full_name || snap.fullName || app.full_name || '—',
                phone: snap.contact_number || snap.phone || snap.contactNumber || app.contact_number || '—',
                email: snap.email || app.email || '—',
                address: snap.full_address || snap.address || snap.fullAddress || app.full_address || '—',
                civilStatus: snap.civil_status || snap.civilStatus || app.civil_status || '—',
                age: snap.age || app.age || '—',
                occupation: snap.occupation || app.occupation || '—'
            },
            intent: app.adoption_intent,
            emergency: {
                name: app.emergency_name,
                phone: app.emergency_phone,
                relation: app.emergency_relation
            },
            documentPath: app.document_path,
            declineReason: app.decline_reason,
            meetupLocation: app.meetup_location,
            interview: {
                date: app.interview_date,
                time: app.interview_time,
                method: app.interview_method,
                locationLink: app.interview_location_link,
                requestedDate: app.requested_interview_date,
                requestedTime: app.requested_interview_time,
                reschedReason: app.reschedule_reason,
                reschedStatus: app.resched_status
            }
        };
    });
        // ---------------------------------------------
        // RENDER
        // ---------------------------------------------
        renderTable();

    } catch (error) {
        console.error("Failed to load applications:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-red-500">
                    <i class="fas fa-circle-exclamation mr-2"></i>
                    Failed to load your applications.
                </td>
            </tr>
        `;
    }
}
// =====================================================
// RENDER APPLICATION TABLE
// =====================================================

function renderTable() {
    // ---------------------------------------------
    // FILTER BY STATUS
    // ---------------------------------------------
    const filtered = applications.filter(app => app.status === currentTab);

    // ---------------------------------------------
    // NO RESULTS
    // ---------------------------------------------
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-gray-500">
                    No applications with status "${currentTab}"
                </td>
            </tr>
        `;
        return;
    }

    // ---------------------------------------------
    // BUILD TABLE
    // ---------------------------------------------
    let html = "";

    filtered.forEach(app => {
        const statusClass = getStatusClass(app.status);

        const petImageSrc = app.image && app.image.trim() !== "" ? app.image : "/assets/images/no-image.png";

        html += `
            <tr class="border-t border-gray-200 hover:bg-gray-50 transition">
                <!-- PET -->
               <td class="p-4">
                    <div class="flex items-center gap-3">
                        <img src="${petImageSrc}" alt="${app.petName}" class="w-14 h-14 rounded-lg object-cover border" onerror="this.onerror=null; this.src='/assets/images/no-image.png';" />
                        <div>
                            <span class="font-semibold text-gray-800">${app.petName}</span>
                            <p class="text-xs text-gray-500">${app.species}</p>
                        </div>
                    </div>
                </td>

                <!-- STATUS -->
                <td class="p-4">
                    <span class="badge-status ${statusClass}">
                        <span class="dot"></span>
                        ${app.status}
                    </span>
                </td>

                <!-- ORGANIZATION -->
                <td class="p-4 text-sm text-gray-700">
                    ${app.organization}
                </td>

                <!-- DATE -->
                <td class="p-4 text-sm text-gray-700">
                    ${app.date}
                </td>

                <!-- ACTION -->
                <td class="p-4 text-center">
                    <button class="view-details-btn inline-flex items-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-full text-sm font-medium transition" data-id="${app.id}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // ---------------------------------------------
    // VIEW DETAILS EVENTS
    // ---------------------------------------------
    document.querySelectorAll(".view-details-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            const id = Number(this.dataset.id);
            const app = applications.find(a => a.id === id);

            if (app) {
                showDetails(app);
            }
        });
    });
}

// =====================================================
// CREATE FORMAL FIELD
// =====================================================

function createFormalField(label, value) {
    return `
        <div class="formal-field">
            <label>${label}</label>
            <div class="field-value">
                ${value !== null && value !== undefined && value !== "" ? value : "—"}
            </div>
        </div>
    `;
}

// =====================================================
// UPDATE STEPPER
// =====================================================

function updateStepper(status) {
    const steps = stepperContainer.querySelectorAll(".step-item");
    let currentStep = 1;

    // 1. Submitted / Under Review
    if (status === "Under Review") {
        currentStep = 1;
    } 
    // 2. Interview Scheduled
    else if (status === "Interview Scheduled") {
        currentStep = 2;
    } 
    // 3. Approved
    else if (status === "Approved") {
        currentStep = 3;
    } 
    // Kapag Declined: Ipapakita hanggang step 1 o 2 batay sa status kung kailan na-decline
    else if (status === "Declined") {
        currentStep = 1; 
    }

    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove("active", "completed");

        if (stepNumber < currentStep) {
            step.classList.add("completed");
        } else if (stepNumber === currentStep) {
            step.classList.add("active");
        }
    });
}

// =====================================================
// SHOW APPLICATION DETAILS
// =====================================================

function showDetails(app) {
    selectedApp = app;

    listView.classList.add("hidden-view");
    detailsView.style.display = "block";

    detailRef.textContent = `APP-${new Date(app.rawDate).getFullYear() || 2026}-${String(app.id).padStart(3, "0")}`;
    detailUploadDate.textContent = app.date;

    const statusKey = getStatusClass(app.status);
    detailStatusBadge.className = `badge-status ${statusKey}`;
    detailStatusBadge.innerHTML = `<span class="dot"></span> ${app.status}`;

    // 1. TINGNAN KUNG TAPOS NA ANG INTERVIEW DATE/TIME
    const now = new Date();
    let isPastInterview = false;

    if (app.interview && app.interview.date) {
        const interviewDateTime = new Date(app.interview.date);
        if (app.interview.time) {
            const [hours, minutes] = app.interview.time.split(':');
            interviewDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        } else {
            interviewDateTime.setHours(23, 59, 59, 999);
        }
        
        if (now > interviewDateTime && app.status === "Interview Scheduled") {
            isPastInterview = true;
        }
    }

    // 2. KUNG LUMAGPAS NA ANG PETSA, I-UPDATE ANG HEADER & STATUS BANNER
    if (isPastInterview) {
        detailStatusBadge.className = "badge-status scheduled";
        detailStatusBadge.innerHTML = `<span class="dot"></span> Post-Interview Review`;
    }

    // Maglagay ng Cancel Application Button sa Header kapag "Under Review" ang status
    if (detailsActions) {
        if (app.status === "Under Review") {
            detailsActions.innerHTML = `
                <button onclick="handleCancelApplication(${app.id})" class="px-4 py-2 text-xs font-semibold border border-red-500 text-red-600 hover:bg-red-50 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer">
                    <i class="fas fa-ban"></i> Cancel Application
                </button>
            `;
        } else if (app.status === "Declined") {
            // Suriin kung ang dahilan ay dahil na-adopt na ng iba ang pet
            const reasonLower = (app.decline_reason || "").toLowerCase();
            const isPetAdopted = (app.petAdoptionStatus || "").toLowerCase() === "adopted";
            const isReasonAdopted = reasonLower.includes("already been adopted") || 
                                     reasonLower.includes("adopted") || 
                                     reasonLower.includes("another applicant");

            if (isPetAdopted || isReasonAdopted) {
                // DISABLED BUTTON KAPAG NA-ADOPT NA NG IBA ANG PET
                detailsActions.innerHTML = `
                    <button disabled class="px-4 py-2 text-xs font-semibold bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed inline-flex items-center gap-1.5 shadow-none" title="This pet has already been adopted by another applicant">
                        <i class="fas fa-ban"></i> Pet Already Adopted (Cannot Re-apply)
                    </button>
                `;
            } else {
                // NORMAL RE-APPLY BUTTON KUNG IBANG DAHILAN ANG PAGKADECLINED (Hal. hindi angkop ang tirahan)
                detailsActions.innerHTML = `
                    <button onclick="handleReapply(${app.petId})" class="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer">
                        <i class="fas fa-rotate-right"></i> Re-apply for Adoption
                    </button>
                `;
            }
        } else {
            detailsActions.innerHTML = "";
        }
    }

    updateStepper(app.status);

    // 1. PET CARD SUMMARY (Ipakita ang in-applyan na Pet)
    let petHeaderCard = document.getElementById("detail-pet-card");
    if (!petHeaderCard) {
        petHeaderCard = document.createElement("div");
        petHeaderCard.id = "detail-pet-card";
        petHeaderCard.className = "card mb-6 bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-center gap-4";
        detailsView.insertBefore(petHeaderCard, stepperContainer.parentElement);
    }
    petHeaderCard.innerHTML = `
        <img src="${app.image}" alt="${app.petName}" class="w-20 h-20 rounded-xl object-cover border border-blue-200" onerror="this.onerror=null; this.src='/assets/images/no-image.png';" />
        <div class="flex-1">
            <h2 class="text-lg font-bold text-gray-800">${app.petName}</h2>
            <p class="text-xs text-gray-500">${app.species} • ${app.gender} • ${app.petAge}</p>
            <div class="flex items-center justify-between flex-wrap gap-2 mt-2">
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    <i class="fas fa-building mr-1"></i> ${app.organization}
                </span>
                <button id="viewOrgProfileBtn" type="button"
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                    <i class="fa-solid fa-building-user"></i>
                    View Organization Profile
                </button>
            </div>
        </div>
    `;
    
    document.getElementById("viewOrgProfileBtn")?.addEventListener("click", () => {
        openOrgProfileModal(selectedApp?.organizationId);
    });

    // 2. APPLICANT INFO
    const a = app.applicant;
    detailApplicant.innerHTML = `
        ${createFormalField("Full Name", a.fullName)}
        ${createFormalField("Contact Number", a.phone)}
        ${createFormalField("Email Address", a.email)}
        <div class="md:col-span-3">
            ${createFormalField("Full Address", a.address)}
        </div>
        ${createFormalField("Civil Status", a.civilStatus)}
        ${createFormalField("Age", a.age)}
        ${createFormalField("Occupation / Source of Income", a.occupation)}
    `;

    // 3. ADOPTION INTENT
    detailIntent.value = app.intent || "No reason specified.";

    // 4. EMERGENCY CONTACT
    const e = app.emergency;
    detailEmergency.innerHTML = `
        ${createFormalField("Contact Person Name", e.name)}
        ${createFormalField("Emergency Phone Number", e.phone)}
        ${createFormalField("Relationship", e.relation)}
    `;

    // 5. INTERVIEW SCHEDULE CARD (Gaya ng ibang Card)
    const interviewCard = document.getElementById("detail-interview-card");
    const interviewContent = document.getElementById("detail-interview-content");
    
    if (app.status === "Interview Scheduled") {
        interviewCard.classList.remove("hidden");

        // I-update ang Card Header para sa Reschedule Button / Pending Badge
        const cardHeader = interviewCard.querySelector(".section-title");
        if (cardHeader) {
            cardHeader.className = "section-title flex flex-wrap items-center justify-between gap-2 mb-4";
            if (isPastInterview) {
                // TANGGALIN ANG REQUEST RESCHEDULE BUTTON AT PALITAN NG NOTIFICATION BANNER
                cardHeader.innerHTML = `
                    <span class="flex items-center gap-2">
                        <i class="fas fa-calendar-check text-purple-600"></i> Post-Interview Stage
                    </span>
                    <span class="text-xs font-semibold px-3 py-1 bg-purple-100 text-purple-700 rounded-full inline-flex items-center gap-1.5 border border-purple-200">
                        <i class="fas fa-clock"></i> Interview Done • Awaiting Org Decision
                    </span>
                `;
            } else {
                cardHeader.innerHTML = `
                    <span class="flex items-center gap-2">
                    <i class="fas fa-calendar-alt text-blue-600"></i> Interview Schedule
                    </span>
                    <span class="text-xs text-gray-500 font-medium">
                        <i class="fas fa-info-circle mr-1"></i> Contact organization for schedule changes
                    </span>
                `;
            }
        }

        let locationOrLink = app.interview.locationLink || "N/A";
        let linkDisplay = locationOrLink.startsWith("http")
            ? `<a href="${locationOrLink}" target="_blank" class="text-blue-600 underline font-semibold break-all">${locationOrLink}</a>`
            : locationOrLink;

        // Base Schedule Details
        let scheduleHTML = `
            ${createFormalField("Interview Date", app.interview.date ? formatDate(app.interview.date) : "—")}
            ${createFormalField("Interview Time", formatTime(app.interview.time))}
            ${createFormalField("Method", app.interview.method ? app.interview.method.toUpperCase() : "—")}
            <div class="md:col-span-3">
                ${createFormalField("Venue / Meeting Link", linkDisplay)}
            </div>
        `;

        interviewContent.innerHTML = scheduleHTML;

    } else {
        interviewCard.classList.add("hidden");
    }

    // 6. DECLINE REASON CARD (Gaya ng ibang Card)
    const declineCard = document.getElementById("detail-decline-card");
    const declineContent = document.getElementById("detail-decline-content");
    if (app.status === "Declined") {
        declineCard.classList.remove("hidden");

        const declineHeader = declineCard.querySelector(".section-title");
        if (declineHeader) {
            declineHeader.className = "section-title flex items-center gap-2 mb-4";
            declineHeader.innerHTML = `
                <i class="fas fa-circle-xmark text-red-600"></i> Reason for Decline
            `;
        }

        declineContent.innerHTML = `
            <p class="italic text-gray-800 leading-relaxed break-words whitespace-pre-line">
                ${app.declineReason ? app.declineReason : 'No specific reason provided by the organization.'}
            </p>
        `;
    } else {
        declineCard.classList.add("hidden");
    }

    // 6b. MEET-UP LOCATION CARD (Gaya ng ibang Card, lalabas lang kapag Approved)
    const meetupCard = document.getElementById("detail-meetup-card");
    const meetupContent = document.getElementById("detail-meetup-content");
    if (app.status === "Approved") {
        meetupCard.classList.remove("hidden");

        meetupContent.innerHTML = `
            <p class="font-semibold leading-relaxed break-words whitespace-pre-line">
                <i class="fas fa-location-dot mr-1.5"></i>${app.meetupLocation ? app.meetupLocation : 'No meet-up location was specified by the organization. Please contact them directly.'}
            </p>
        `;
    } else {
        meetupCard.classList.add("hidden");
    }


    // 7. UPLOADED DOCUMENT (Ipakita ang totoong PDF/Image link na in-upload)
    const docContainer = document.querySelector('#details-view .border-dashed');
    if (docContainer) {
        if (app.documentPath) {
            let docUrl = app.documentPath.startsWith('/') ? app.documentPath : `/uploads/documents/${app.documentPath}`;
            docContainer.innerHTML = `
                <i class="fas fa-file-alt text-3xl text-blue-500 mb-2 block"></i>
                <span class="font-semibold text-gray-800 text-sm block break-all">${app.documentPath}</span>
                <p class="text-xs text-gray-400 mt-1 mb-3">Submitted Requirement Proof (Uploaded on ${app.date})</p>
                <a href="${docUrl}" target="_blank" class="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition">
                    <i class="fas fa-external-link-alt"></i> View Uploaded File
                </a>
            `;
        } else {
            docContainer.innerHTML = `
                <i class="fas fa-exclamation-triangle text-2xl text-amber-500 mb-2 block"></i>
                <span class="font-medium text-gray-500 text-sm">No requirement document attached.</span>
            `;
        }
    }

    document.getElementById("app").scrollTo({ top: 0, behavior: "smooth" });
}

// =====================================================
// RE-APPLY BUTTON HANDLER
// =====================================================
function handleReapply(petId) {
    if (!petId) {
        alert("Pet ID not found.");
        return;
    }

    // 1. I-save ang Pet ID sa sessionStorage para mabasa ng Adoption Hub page
    sessionStorage.setItem("autoOpenPetId", petId);

    if (selectedApp) {
        sessionStorage.setItem("isReapply", "true");
        sessionStorage.setItem("reapplyData", JSON.stringify(selectedApp));
    }
    
    // 2. Pumunta sa Adoption Hub page
    window.location.href = "/adoption-hub";
}

// =====================================================
// CANCEL APPLICATION HANDLER
// =====================================================
let pendingCancelAppId = null;

function handleCancelApplication(appId) {
    if (!appId) return;
    pendingCancelAppId = appId;

    // Subukang gamitin ang SweetAlert2 popup modal kapag available
    if (typeof Swal !== "undefined") {
        Swal.fire({
            title: 'Cancel Application?',
            text: "Are you sure you want to cancel this adoption application? The organization will be notified, and this action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'Yes, Cancel Application',
            cancelButtonText: 'Keep Application',
            customClass: {
                popup: 'rounded-2xl',
                confirmButton: 'rounded-xl font-semibold px-4 py-2',
                cancelButton: 'rounded-xl font-semibold px-4 py-2'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                await submitCancelApplication(appId);
            }
        });
    } else {
        // Fallback sa custom HTML modal kung walang SweetAlert2
        const modal = document.getElementById("cancelAppModal");
        if (modal) modal.classList.remove("hidden");
    }
}

function closeCancelModal() {
    const modal = document.getElementById("cancelAppModal");
    if (modal) modal.classList.add("hidden");
    pendingCancelAppId = null;
}

async function submitCancelApplication(appId = null) {
    const targetId = appId || pendingCancelAppId;
    if (!targetId) return;

    const confirmBtn = document.getElementById("confirmCancelBtn");
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Cancelling...`;
    }

    try {
        const response = await fetch(`/api/user/applications/${targetId}/cancel`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeCancelModal();

            if (typeof Swal !== "undefined") {
                await Swal.fire({
                    icon: 'success',
                    title: 'Application Cancelled',
                    text: 'Your application has been cancelled and updated.',
                    confirmButtonColor: '#2563EB',
                    customClass: { popup: 'rounded-2xl' }
                });
            } else {
                alert("Application cancelled successfully.");
            }

            goBack();
            await loadApplications();
        } else {
            throw new Error(data.message || "Failed to cancel application.");
        }
    } catch (err) {
        console.error("❌ Error cancelling application:", err);
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: 'error',
                title: 'Cancellation Failed',
                text: err.message || 'Unable to cancel application. Please try again.',
                confirmButtonColor: '#EF4444',
                customClass: { popup: 'rounded-2xl' }
            });
        } else {
            alert(err.message || "Error cancelling application.");
        }
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<span>Confirm Cancel</span>`;
        }
    }
}

async function openOrgProfileModal(id) {
    if (!id) {
        alert("Organization profile isn't available for this application.");
        return;
    }

    const modal = document.getElementById("orgProfileModal");
    const orgName = document.getElementById("modalOrgName");
    const orgAddress = document.getElementById("modalOrgAddress");
    const orgPhone = document.getElementById("modalOrgPhone");
    const orgEmail = document.getElementById("modalOrgEmail");
    const orgMission = document.getElementById("modalOrgMission");
    const logoEl = document.getElementById("modalOrgLogo");

    try {
        const response = await fetch(`/api/organizations/${id}`);
        if (!response.ok) throw new Error("Failed to load organization.");
        const org = await response.json();

        if (orgName) orgName.textContent = org.organization_name || "Unknown Organization";
        if (orgAddress) orgAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${org.city || ''}, ${org.province || ''}`;
        if (orgPhone) orgPhone.textContent = org.contact_number || org.phone || "N/A";
        if (orgEmail) orgEmail.textContent = org.email || org.org_email || "N/A";
        if (orgMission) orgMission.textContent = org.description || org.mission || "No description available.";

        const logoPath = org.logo || org.avatar || org.image || org.profile_pic;
        if (logoEl && logoPath) {
            logoEl.outerHTML = `<img id="modalOrgLogo" src="${logoPath}" alt="Org Logo" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.src='https://via.placeholder.com/64';">`;
        }
    } catch (err) {
        console.error("Error fetching organization profile:", err);
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
}

function closeOrgProfileModal() {
    const modal = document.getElementById("orgProfileModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
}

// =====================================================
// GO BACK TO APPLICATION LIST
// =====================================================

function goBack() {
    detailsView.style.display = "none";
    listView.classList.remove("hidden-view");
    listView.style.display = "block";
    selectedApp = null;
    renderTable();
}

// =====================================================
// TAB SWITCHING
// =====================================================

function setActiveTab(tab) {
    currentTab = tab;

    tabBtns.forEach(btn => {
        const tabName = btn.dataset.tab;
        if (tabName === tab) {
            btn.className = "tab-btn pb-2 font-semibold transition text-blue-700 border-b-2 border-blue-700";
        } else {
            btn.className = "tab-btn pb-2 font-semibold transition text-gray-600 hover:text-blue-600";
        }
    });

    renderTable();
}

// =====================================================
// INITIALIZE PAGE
// =====================================================

async function init() {
    // 1. Tignan kung may nakatagong tab mula sa Adoption Hub
    const savedTab = sessionStorage.getItem("targetAppTab");
    const savedPetId = sessionStorage.getItem("targetPetId");
    
    const defaultTab = savedTab ? savedTab : "Under Review";

    // 2. I-clear agad ang sessionStorage
    sessionStorage.removeItem("targetAppTab");
    sessionStorage.removeItem("targetPetId");

    // 3. I-set ang active tab
    setActiveTab(defaultTab);

    // 4. Tab click events
    tabBtns.forEach(btn => {
        btn.addEventListener("click", function () {
            setActiveTab(this.dataset.tab);
        });
    });

    // 5. Back button event
    backBtn.addEventListener("click", goBack);

    // 6. Initial view display
    listView.style.display = "block";
    detailsView.style.display = "none";

    // 7. I-load ang applications mula sa Database
    await loadApplications();

    // 8. KUNG NGALING SA ADOPTION HUB: Awtomatikong buksan ang mismong View Details page
    if (savedPetId) {
        const targetApp = applications.find(app => Number(app.petId) === Number(savedPetId));
        if (targetApp) {
            showDetails(targetApp);
        }
    }
}

init();
