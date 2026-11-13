document.addEventListener("DOMContentLoaded", async () => {

    await loadSidebar("dashboard");

    await loadTopbar({
        title: "Dashboard",
        subtitle: "Manage your rescue pets, track adoption requests, and stay updated with your organization's progress."
    });

    // organization name
    // try {
    //     const response = await fetch("/api/organization/profile");

    //     if (response.ok) {
    //         const organization = await response.json();

    //         document.getElementById("organizationName").textContent =
    //             organization.organization_name;
    //     }
    // } catch (error) {
    //     console.error(error);
    // }

     // Organization dashboard greeting
    try {
        const response = await fetch(
            "/api/organization/dashboard-greeting",
            { cache: "no-store" }
        );

        if (response.ok) {
            const organization = await response.json();

            document.getElementById("organizationName").textContent =
                organization.organization_name;

            const greeting = document.getElementById("dashboardGreeting");

            if (greeting) {
                greeting.textContent = organization.isFirstDashboardAccess
                    ? "Welcome,"
                    : "Welcome back,";
            }
        }
    } catch (error) {
        console.error("Error loading dashboard greeting:", error);
    }

    await loadDashboardStats();
    await loadRecentApplications();
    await loadNewestPets();
});



async function loadDashboardStats() {

    try {

        const response =
            await fetch("/org/dashboard/stats");

        const data =
            await response.json();

        if (!data.success) return;

        document.getElementById("totalPets").textContent =
            data.stats.totalPets;

        document.getElementById("pendingAdoptions").textContent =
            data.stats.pendingAdoptions;

        document.getElementById("adoptedPets").textContent =
            data.stats.adoptedPets;

        document.getElementById("totalDonations").textContent =
            "₱" +
            Number(data.stats.cashDonations).toLocaleString();

    } catch (err) {

        console.error("Error loading stats:", err);

    }

}
function getPetImageUrl(imagePath) {
    if (!imagePath) {
        return "/assets/images/no-image.png";
    }

    if (imagePath.startsWith("http")) {
        return imagePath;
    }

    return `/uploads/pets/${imagePath}`;
}
//NEWLY ADDED PETS
async function loadNewestPets() {
    try {
        const response = await fetch("/org/pets/newest");
        const pets = await response.json();
        const container = document.getElementById("newPetsContainer");
        container.innerHTML = "";
        if (!pets.length) {
            container.innerHTML = `
                <div class="col-span-2 text-center py-8 text-gray-400 text-sm">
                    No pets added yet.
                </div>
            `;
            return;
        }
        pets.forEach(pet => {
            const emoji =
                pet.species === "Dog"
                    ? "🐕"
                    : "🐈";
            const bg =
                pet.species === "Dog"
                    ? "bg-blue-50 border-blue-100"
                    : "bg-orange-50 border-orange-100";

            const age = formatAge(pet.age);

            container.innerHTML += `
                <a href="/org/pets"
                   class="flex flex-col items-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition group text-center">

                    <img
                        src="${getPetImageUrl(pet.image_path)}"
                        alt="${pet.name}"
                        class="w-14 h-14 rounded-full object-cover border shadow-sm mb-2.5 group-hover:scale-105 transition"
                        onerror="this.onerror=null; this.src='/assets/images/no-image.png';"
                    >
                    <span class="text-sm font-bold text-gray-800 group-hover:text-blue-900"> ${pet.name}</span>
                    <span class="text-[11px] font-medium text-gray-400 mt-1 bg-gray-100 px-2 py-0.5 rounded-full"> ${pet.species} • ${age}</span>
                </a>
            `;
        });
    } catch (err) {
        console.error("Error loading newest pets:",err);
    }
}
function formatAge(age) {

    switch (age) {

        case "Puppy/Kitten (0-1 yr old)":
            return "0-1 yr";

        case "Adolescence (2-3 yrs old)":
            return "2-3 yrs";

        case "Adult (4-7 yrs old)":
            return "4-7 yrs";

        case "Senior (8-10 yrs old)":
            return "8-10 yrs";

        default:
            return age;
    }

}

// RECENT APPLICATIONS
async function loadRecentApplications() {
    const container = document.getElementById("recentApplicationsContainer");
    const actionCount = document.getElementById("actionRequiredCount");

    try {
        const response = await fetch("/org/dashboard/recent-applications");

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to load applications.");
        }

        // Update action required count
        actionCount.textContent = `${data.actionRequired} Action Required`;

        // No applications
        if (!data.applications || data.applications.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                    <i class="fa-regular fa-folder-open text-3xl mb-3"></i>
                    <p class="text-sm">No adoption applications yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.applications.map(app => createApplicationRow(app)).join("");

    } catch (err) {
        console.error("Failed to load applications:", err);

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-red-400">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <p class="text-sm">Failed to load applications.</p>
            </div>
        `;
    }
}

// =====================================================
// GET INITIALS
// =====================================================
function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join("");
}

// =====================================================
// APPLICATION STATUS STYLE
// =====================================================
function getApplicationStatusStyle(status) {
    switch (status) {
        case "Under Review":
            return "bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200/60";
        case "Interview Scheduled":
            return "bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100";
        case "Approved":
            return "bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/60";
        case "Declined":
            return "bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200/60";
        default:
            return "bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200";
    }
}

// =====================================================
// ESCAPE HTML
// =====================================================
function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function createApplicationRow(app) {
    const initials = getInitials(app.full_name);
    const statusStyle = getApplicationStatusStyle(app.status);

    return `
        <div class="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/60 transition group">
            <!-- Applicant -->
            <div class="flex items-center gap-3.5 min-w-0">
                <div class="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center font-bold text-blue-950 text-sm shadow-sm shadow-indigo-100">
                    ${initials}
                </div>

                <div class="min-w-0">
                    <div class="text-sm font-bold text-gray-900 group-hover:text-blue-900 transition truncate">
                        ${escapeHtml(app.full_name)}
                    </div>

                    <div class="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                        <i class="fa-regular fa-envelope text-[11px]"></i>
                        ${escapeHtml(app.email)}
                    </div>

                    <div class="text-[11px] text-gray-400 mt-0.5">
                        Applying for:
                        <span class="font-semibold text-gray-500">${escapeHtml(app.pet_name || "Unknown pet")}</span>
                    </div>
                </div>
            </div>

            <!-- Status -->
            <div class="flex items-center gap-3 shrink-0">
                <span class="text-xs font-semibold ${statusStyle}">
                    ${escapeHtml(app.status)}
                </span>

                <button type="button" onclick="viewApplication(${app.application_id})" class="text-gray-400 hover:text-blue-900 p-1.5 rounded-lg hover:bg-gray-100 transition">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </button>
            </div>
        </div>
    `;
}

function viewApplication(applicationId) {

    if (!applicationId) {
        console.error("Missing application ID.");
        return;
    }

    window.location.href =
        `/org/adoption?application_id=${applicationId}`;
}
