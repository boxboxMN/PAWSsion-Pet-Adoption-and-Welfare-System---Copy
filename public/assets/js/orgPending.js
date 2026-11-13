// Global variable declaration sa pinakataas
let statusChecker;

document.addEventListener("DOMContentLoaded", async () => {

   // Load sidebar and header using the real loader functions
    if (typeof loadSidebar === "function") {
        await loadSidebar("dashboard");
    }
    if (typeof loadTopbar === "function") {
        await loadTopbar({
            title: "Verification Pending",
            subtitle: "Your account is currently under review."
        });
    }

    // Dashboard active
    const dashboardLink = document.querySelector('a[href="/org/dashboard"]');

    if (dashboardLink) {

        dashboardLink.classList.remove(
            "text-gray-600",
            "hover:bg-blue-50/50",
            "hover:text-blue-900"
        );

        dashboardLink.classList.add(
            "bg-blue-900",
            "text-white",
            "shadow-md"
        );

        const icon = dashboardLink.querySelector("i");

        if (icon) {
            icon.classList.remove(
                "text-gray-400",
                "group-hover:text-blue-900"
            );

            icon.classList.add("text-white");
        }

    }

    // Disable all other menu items
    document.querySelectorAll(".nav-link").forEach(link => {

        if (link.getAttribute("href") !== "/org/dashboard") {

            link.classList.add(
                "opacity-40",
                "cursor-not-allowed"
            );

            link.addEventListener("click", function(e){
                e.preventDefault();
            });

        }

    });

    // Load organization status
    await loadStatus();

    // Check every 5 seconds
    statusChecker = setInterval(loadStatus, 5000);

});

async function loadStatus() {
try {
    const response = await fetch("/api/organization/pending");

    if (!response.ok) {
        window.location.href = "/auth/login";
        return;
    }

    const data = await response.json();

    const orgNameEl = document.getElementById("organizationName");
    const statusEl = document.getElementById("status");
    const submittedEl = document.getElementById("submitted");

    if (orgNameEl) orgNameEl.textContent = data.organization_name || "Organization";
    if (statusEl) statusEl.textContent = data.verification_status || "Pending";

    if (submittedEl && data.created_at) {
        submittedEl.textContent = new Date(data.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    // Check if account is active or approved
    const isAccountActive = data.account_status?.toLowerCase() === "active";
    const isVerifApproved = data.verification_status?.toLowerCase() === "approved";
    
   if (isAccountActive || isVerifApproved) {
            clearInterval(statusChecker);

            const contentContainer = document.getElementById("verificationContent");
            if (contentContainer) {
                contentContainer.innerHTML = `
                    <div class="text-6xl mb-6">
                        <i class="fa-solid fa-circle-check text-green-500"></i>
                    </div>

                    <h1 class="text-4xl font-bold text-green-600 mb-3">
                        Verification Approved
                    </h1>
                    
                    <p class="text-xl text-gray-700 mb-4">
                        Congratulations, <strong>${data.organization_name}</strong>!
                    </p>

                    <p class="text-gray-600 leading-relaxed">
                        Your organization has been successfully verified by the <strong>Pawpon Administrator.</strong>
                    </p>

                    <div class="bg-green-50 border border-green-200 rounded-2xl p-6 mt-8 text-left">
                        <p class="text-green-700 font-semibold mb-2">
                            <i class="fa-solid fa-circle-check mr-2"></i>
                            Your account is now active.
                        </p>
                        <p class="text-gray-700">
                            To protect your account and refresh your permissions, please log in again using your organization credentials.
                        </p>
                    </div>

                    <div class="mt-8">
                        <button id="pendingLogoutBtn"
                            class="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition cursor-pointer">
                            <i class="fa-solid fa-right-to-bracket"></i>
                            Login Again
                        </button>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error("Error fetching status:", err);
    }
}

// Idagdag ito sa pinakababa ng orgPending.js:
document.addEventListener("click", async (e) => {
    const logoutBtn = e.target.closest("#pendingLogoutBtn");
    
    if (logoutBtn) {
        e.preventDefault();
        try {
            const response = await fetch("/auth/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                window.location.href = "/auth/login";
            } else {
                // Redirect pa rin sa login kahit may minor issue sa response
                window.location.href = "/auth/login";
            }
        } catch (err) {
            console.error("Logout error:", err);
            window.location.href = "/auth/login";
        }
    }
});
