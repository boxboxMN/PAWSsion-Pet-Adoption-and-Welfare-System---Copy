
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadRecentActivities() {
    const container = document.getElementById("recentActivitiesContainer");
    if (!container) return;

    try {
        const response = await fetch("/api/user/recent-activities");
        const data = await response.json();

        if (!data.success || !data.activities.length) {
            container.innerHTML = `<p class="text-sm text-gray-400">No recent activities found.</p>`;
            return;
        }

        container.innerHTML = data.activities.map(item => {
            let icon = 'fa-bell';
            let dotColor = 'bg-blue-500 ring-blue-100';
            let title = '';
            let description = '';

            switch (item.activity_type) {
                case 'application':
                    icon = 'fa-clipboard-check';

                    const now = new Date();
                    let isPastInterview = false;
                    let interviewDateTime = null;

                    if (item.interview_date) {
                        interviewDateTime = new Date(item.interview_date);
                        
                       
                        if (item.interview_time) {
                            const [hours, minutes] = item.interview_time.split(':');
                            interviewDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                        } else {
                            interviewDateTime.setHours(23, 59, 59, 999); 
                        }
                
                        
                        if (now > interviewDateTime && (item.status === 'Interview Scheduled' || item.status === 'Under Review')) {
                            isPastInterview = true;
                        }
                    }

                    if (isPastInterview) {
                        dotColor = 'bg-purple-500 ring-purple-100';
                        title = `Application: Post-Interview Review`;
                        description = `Your interview for <span class="font-medium text-gray-700">"${item.pet_name}"</span> was scheduled for <span class="font-medium text-gray-700">${new Date(item.interview_date).toLocaleDateString()}</span>. The organization is currently reviewing your application.`;
                    } else {
                        dotColor = 'bg-blue-500 ring-blue-100';
                        title = `Application: ${item.status}`;
                        description = `Adoption application for <span class="font-medium text-gray-700">"${item.pet_name}"</span> (${item.species}) is currently <strong>${item.status}</strong>.`;
                    }
                    break;

                case 'donation_cash':
                    icon = 'fa-donate';
                    dotColor = 'bg-green-500 ring-green-100';
                    title = `Cash Donation (${item.status})`;
                    description = `You sent a cash donation of <span class="font-medium text-gray-700">₱${Number(item.amount).toLocaleString()}</span> to <span class="font-medium text-gray-700">${item.organization_name || 'Organization'}</span>.`;
                    break;

                case 'donation_inkind':
                    icon = 'fa-box-open';
                    dotColor = 'bg-yellow-500 ring-yellow-100';
                    title = `In-Kind Donation (${item.status})`;
                    description = `You submitted an in-kind donation for <span class="font-medium text-gray-700">${item.quantity}x ${item.item_name}</span>.`;
                    break;

                case 'kamustahan':
                    icon = 'fa-heart';
                    dotColor = 'bg-orange-500 ring-orange-100';
                    title = `Kamustahan Care Update`;
                    description = `Submitted a health and care update for <span class="font-medium text-gray-700">"${item.pet_name}"</span>. Status: <strong>${item.status}</strong>.`;
                    break;
            }

            return `
                <div class="relative activity-item">
                    <div class="activity-dot absolute -left-8 top-1 w-4 h-4 rounded-full ${dotColor} flex items-center justify-center ring-4">
                        <i class="fas ${icon} text-white text-[8px]"></i>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${title}</h4>
                        <p class="text-sm text-gray-500">${description}</p>
                        <span class="text-xs text-gray-400 mt-1 inline-block">${timeAgo(item.activity_date)}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading activities:", err);
        container.innerHTML = `<p class="text-sm text-red-400">Failed to load recent activities.</p>`;
    }
}


function formatScheduleDate(dateStr) {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatScheduleTime(timeStr) {
    if (!timeStr) return "TBD";
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours < 10 ? '0' + hours : hours}:${minutes} ${ampm}`;
    }
    return timeStr;
}

async function loadUpcomingSchedules() {
    const container = document.getElementById("upcomingScheduleContainer");
    if (!container) return;

    try {
        const response = await fetch("/api/user/upcoming-schedules");
        const data = await response.json();

        if (!data.success || !data.schedules || !data.schedules.length) {
            renderEmptySchedule(container);
            return;
        }

        const now = new Date();

       
        const activeSchedules = data.schedules.filter(item => {
            if (!item.interview_date) return false;

            const interviewDateTime = new Date(item.interview_date);
            
            if (item.interview_time) {
                const parts = item.interview_time.split(':');
                interviewDateTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
            } else {
                interviewDateTime.setHours(23, 59, 59, 999);
            }

            return now <= interviewDateTime; 
        });

        if (activeSchedules.length === 0) {
            renderEmptySchedule(container);
            return;
        }

        container.innerHTML = activeSchedules.map(item => {
            const hasLink = item.interview_location_link && item.interview_location_link.startsWith("http");
            const methodDisplay = item.interview_method ? item.interview_method.toUpperCase() : "Online Interview";
            
            return `
                <div class="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
                    <div class="flex items-start justify-between">
                        <div>
                            <h3 class="font-semibold text-gray-800 flex items-center gap-2">
                                <i class="fas fa-video text-blue-600 text-sm"></i>
                                Interview for ${item.pet_name}
                            </h3>
                            <p class="text-sm text-gray-600 mt-1">
                                <span class="font-medium">Date:</span> ${formatScheduleDate(item.interview_date)}
                            </p>
                            <p class="text-sm text-gray-600">
                                <span class="font-medium">Time:</span> ${formatScheduleTime(item.interview_time)}
                            </p>
                            <p class="text-sm text-gray-600">
                                <span class="font-medium">Platform / Venue:</span> ${methodDisplay}
                            </p>
                        </div>
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-200 text-blue-800 whitespace-nowrap mt-1">
                            ${item.resched_status === 'Pending' ? 'Reschedule Pending' : 'Upcoming'}
                        </span>
                    </div>

                    ${hasLink ? `
                        <a href="${item.interview_location_link}" target="_blank" class="mt-3 block text-center bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl transition text-sm font-medium">
                            <i class="fas fa-video mr-2"></i> Join Meeting
                        </a>
                    ` : `
                        <p class="mt-2 text-xs text-gray-500 italic break-all">
                            Location: ${item.interview_location_link || 'Location details will be shared by the organization.'}
                        </p>
                    `}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading upcoming schedules:", err);
        container.innerHTML = `<p class="text-sm text-red-400">Failed to load schedule.</p>`;
    }
}


function renderEmptySchedule(container) {
    container.innerHTML = `
        <div class="text-center py-8 text-gray-400">
            <i class="far fa-calendar-check text-4xl mb-2 text-gray-300"></i>
            <p class="text-sm font-medium">No upcoming interviews scheduled.</p>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", async () => {

     // ==========================================
    // LOGOUT ELEMENTS
    // ==========================================
    const logoutModal = document.getElementById("logoutModal");
    const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
    const logoutModalContent = document.getElementById("logoutModalContent");

    document.addEventListener("click", (e) => {

        const logoutLink = e.target.closest("#logoutLink");

        if (!logoutLink) {
            return;
        }

        e.preventDefault();

        console.log("Logout link clicked");

        logoutModal?.classList.remove(
            "opacity-0",
            "pointer-events-none"
        );

        logoutModal?.classList.add("opacity-100");

        logoutModalContent?.classList.remove("scale-95");
        logoutModalContent?.classList.add("scale-100");
    });

    function closeLogoutModal() {

        logoutModal?.classList.remove("opacity-100");

        logoutModal?.classList.add(
            "opacity-0",
            "pointer-events-none"
        );

        logoutModalContent?.classList.remove("scale-100");
        logoutModalContent?.classList.add("scale-95");
    }


    cancelLogoutBtn?.addEventListener("click", () => {

        console.log("Logout cancelled");

        closeLogoutModal();

    });


    logoutModal?.addEventListener("click", (e) => {

        if (e.target === logoutModal) {
            closeLogoutModal();
        }

    });

    confirmLogoutBtn?.addEventListener("click", async () => {

        console.log("Confirm logout clicked");

        confirmLogoutBtn.disabled = true;
        confirmLogoutBtn.textContent = "Logging out...";

        try {

            const response = await fetch("/auth/logout", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            console.log("Logout response status:", response.status);

            const data = await response.json();

            console.log("Logout response:", data);

            if (response.ok && data.success) {

                console.log("Logout successful");

                window.location.replace("/auth/login");

            } else {

                console.error("Logout failed:", data);

                confirmLogoutBtn.disabled = false;
                confirmLogoutBtn.textContent = "Yes, Logout";

                alert(data.message || "Logout failed.");

            }

        } catch (error) {

            console.error("LOGOUT ERROR:", error);

            confirmLogoutBtn.disabled = false;
            confirmLogoutBtn.textContent = "Yes, Logout";

            alert("Unable to logout. Please try again.");

        }

    });

    await loadSidebar("dashboard");

    
    requestAnimationFrame(async () => {

       
        loadTopbar({
            title: "Dashboard",
            subtitle: "View your adoption progress, upcoming schedules, recent activities, and quick access to important features."
        });

        await loadUserName();
        await loadRecentActivities();
        await loadUpcomingSchedules();

        document.body.style.visibility = "visible";
    });

});

async function loadUserName() {
    try {

        const response = await fetch("/api/current-user");
        const data = await response.json();

        document.getElementById("welcomeUserName").textContent =
            data.name || "User";

    } catch (err) {

        console.error(err);

        document.getElementById("welcomeUserName").textContent = "User";
    }
}