async function loadTopbar({ title = "", subtitle = "" }) {

    console.log("Subtitle received:", subtitle);

    const container = document.getElementById("headerContainer");

    const response = await fetch("/organization/header.html");
    container.innerHTML = await response.text();

    const titleEl = document.getElementById("pageTitle");
    const subtitleEl = document.getElementById("pageSubtitle");

    console.log(titleEl);
    console.log(subtitleEl);

    if (titleEl) {
        titleEl.textContent = title;
    }

    if (subtitleEl) {
        subtitleEl.textContent = subtitle;
    }

    console.log("Subtitle after setting:", subtitleEl.textContent);

    // IDAGDAG ITO: Tawagin ang function para i-sync ang profile pic mula sa server session
    await updateTopbarProfilePic();
    
    initializeTopbar();
}

function initializeTopbar() {

    const notifBtn = document.getElementById("notificationBtn");
    const notifPopup = document.getElementById("notificationPopup");
    const markReadBtn = document.getElementById("markReadBtn");
    const notifList = document.getElementById("notifList");

    if (notifBtn && notifPopup) {
        notifBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            const isOpen =
                notifPopup.getAttribute("data-open") === "true";

            notifPopup.setAttribute("data-open", !isOpen);

            if (!isOpen) {
                loadNotifications();
            }
        });

        document.addEventListener("click", (e) => {
            if (
                !notifBtn.contains(e.target) &&
                !notifPopup.contains(e.target)
            ) {
                notifPopup.setAttribute("data-open", "false");
            }
        });
    }

    if (markReadBtn) {
        markReadBtn.addEventListener("click", async (e) => {
            e.stopPropagation();

            try {
                await fetch("/api/notifications/read-all", { method: "PUT" });
                await loadNotifications();
            } catch (err) {
                console.error("Failed to mark all as read:", err);
            }
        });
    }

    loadNotifications();
    setInterval(loadNotifications, 300000);
    setInterval(checkSessionStatus, 300000);
}

async function checkSessionStatus() {
    try {
        const res = await fetch("/api/session-status");
        const data = await res.json();

        if (!data.active) {
            lockSidebarAndRedirect(data.status);
        }
    } catch (err) {
        console.error("Failed to check session status:", err);
    }
}

let isRedirecting = false;

function lockSidebarAndRedirect(reason) {
    // Prevent this from running multiple times
    if (isRedirecting) return;
    isRedirecting = true;

    document.querySelectorAll(".nav-link").forEach(link => {
        if (link.id !== "logoutLink") {
            link.classList.add("opacity-40", "cursor-not-allowed");
            link.addEventListener("click", (e) => e.preventDefault());
        }
    });

    const banner = document.createElement("div");
    banner.className = "fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-3 z-[9999] text-sm font-semibold";
    banner.textContent = "Your account status has changed. Redirecting to login...";
    document.body.prepend(banner);

    setTimeout(() => {
         const loginReason = reason || "session_expired";

        window.location.href =
            `/auth/login?reason=${encodeURIComponent(loginReason)}`;
    }, 2500);
}

function renderNotifIcon(type) {
    const icons = {
        application_submitted: "🐾",
        donation_submitted: "💰",
        feedback_resolved: "💬",
        feedback_reopened: "💬",
        kamustahan_submitted: "🐶",
        application_status: "📋",
        interview_scheduled: "📅",
        donation_status: "💵",
        org_pending: "🏢",
        feedback_new: "💬",
        account_suspended: "🚫",
        account_banned: "⛔",
        account_disabled: "🔒",
    };
    return icons[type] || "🔔";
}

// Mga notification type na pang-impormasyon lang, hindi dapat i-click/i-navigate
const NON_CLICKABLE_NOTIF_TYPES = ["feedback_resolved", "feedback_reopened"];

async function loadNotifications() {
    const notifList = document.getElementById("notifList");
    const dot = document.querySelector(".notif-dot");
    if (!notifList) return;

    try {
        const res = await fetch("/api/notifications");
        const data = await res.json();

        if (dot) {
            dot.style.display = data.unreadCount > 0 ? "" : "none";
        }

        if (!data.success || !data.notifications || data.notifications.length === 0) {
            notifList.innerHTML = `
                <div class="text-center py-8 text-gray-400 text-sm">
                    <i class="fa-regular fa-bell-slash text-xl block mb-1.5"></i>
                    No new notifications
                </div>
            `;
            return;
        }

        notifList.innerHTML = data.notifications.map(n => {
            const isInfoOnly = NON_CLICKABLE_NOTIF_TYPES.includes(n.type);
            const interactiveClass = isInfoOnly ? "" : "hover:bg-gray-50/80 cursor-pointer";

            return `
                <div data-id="${n.notification_id}" data-info-only="${isInfoOnly}" data-link="${n.link || ''}" class="notif-item flex gap-3.5 p-4 border-b border-gray-50 transition-colors items-start ${n.is_read ? 'opacity-60' : ''}">
                    <div class="notif-content flex gap-3.5 flex-1 min-w-0 ${interactiveClass}">
                        <span class="text-xl flex-shrink-0">${renderNotifIcon(n.type)}</span>
                        <div class="min-w-0">
                            <p class="font-medium text-gray-900 text-sm">${n.title}</p>
                            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">${n.message}</p>
                        </div>
                    </div>
                    <button class="notif-delete-btn text-gray-300 hover:text-red-500 transition shrink-0 p-1" title="Delete">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join("");

        notifList.querySelectorAll(".notif-item").forEach(item => {
            if (item.dataset.infoOnly !== "true") {
                item.querySelector(".notif-content").addEventListener("click", async () => {
                    await fetch(`/api/notifications/${item.dataset.id}/read`, { method: "PUT" });
                    if (item.dataset.link) window.location.href = item.dataset.link;
                });
            }
        });

        notifList.querySelectorAll(".notif-delete-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const row = btn.closest(".notif-item");
                const id = row.dataset.id;
                try {
                    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                    row.remove();
                    if (!notifList.querySelector(".notif-item")) {
                        loadNotifications();
                    }
                } catch (err) {
                    console.error("Failed to delete notification:", err);
                }
            });
        });

    } catch (err) {
        console.error("Failed to load notifications:", err);
    }
}

async function updateTopbarProfilePic() {
    const imgTag = document.getElementById('headerProfilePic');
    const iconTag = document.getElementById('headerProfileIcon');

    if (!imgTag || !iconTag) return;

    try {
        const response = await fetch("/api/organization/profile");
        if (response.ok) {
            const data = await response.json();
            if (data && data.profile_pic) {
                imgTag.src = data.profile_pic;
                imgTag.classList.remove('hidden'); // Ipakita ang larawan
                iconTag.classList.add('hidden');    // Itago ang default icon
            } else {
                imgTag.classList.add('hidden');
                iconTag.classList.remove('hidden'); // Ipakita ang default icon kung walang photo
            }
        }
    } catch (err) {
       if (err.name === 'AbortError') {
            console.warn("Profile picture request was cancelled.");
        } else {
            console.error("Error loading topbar profile picture:", err);
        }
    }
}
// ==========================================
// SESSION WATCHER + ACCOUNT SWITCH DETECTION (ORG)
// ==========================================
let __orgTabAccountId = null;
let __orgRedirecting = false;

async function __checkOrgSession() {
    if (__orgRedirecting) return;

    // Skip kung nasa login page
    if (window.location.pathname.startsWith("/auth/")) return;

    try {
        const res = await fetch("/api/session-status", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (res.status === 401 || res.status === 403) {
            __lockOrgAndRedirect("session_expired");
            return;
        }

        const data = await res.json();

        // 1. Session invalidated (SAS, ban, suspend, disable)
        if (!data.active) {
            __lockOrgAndRedirect(data.status || "session_expired");
            return;
        }

        // 2. ACCOUNT SWITCH — ibang account na ang naka-login sa browser
        if (data.accountId) {
            const currentId = String(data.accountId);

            if (__orgTabAccountId === null) {
                __orgTabAccountId = currentId;
                console.log("[Org Tab] Initial account_id:", currentId);
                return;
            }

            if (__orgTabAccountId !== currentId) {
                console.warn(`[Org Switch] Was ${__orgTabAccountId}, now ${currentId}`);
                __lockOrgAndRedirect("account_switched");
            }
        }
    } catch (err) {
        console.warn("Org session check failed:", err.message);
    }
}

function __lockOrgAndRedirect(reason) {
    if (__orgRedirecting) return;
    __orgRedirecting = true;

    document.querySelectorAll("a, button, input, select, textarea").forEach(el => {
        el.style.pointerEvents = "none";
        el.style.opacity = "0.4";
    });

    const mainContent = document.querySelector("main") || document.body;
    mainContent.style.filter = "blur(8px)";
    mainContent.style.opacity = "0.15";
    mainContent.style.transition = "opacity 0.15s";

    const overlay = document.createElement("div");
    overlay.id = "sessionEndedOverlay";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(255,255,255,0.85);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 99998;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 16px;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const isSwitch = reason === "account_switched";
    const titleText = isSwitch ? "Different account signed in" : "Signed in on another device";
    const subtitleText = isSwitch
        ? "A different account was signed in on this browser. Redirecting..."
        : "Your organization was signed in elsewhere. Redirecting...";

    overlay.innerHTML = `
        <div style="
            width: 48px; height: 48px;
            border: 4px solid #e5e7eb;
            border-top-color: #1656ff;
            border-radius: 50%;
            animation: sasSpin 0.6s linear infinite;
        "></div>
        <div style="text-align: center;">
            <p style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 4px;">${titleText}</p>
            <p style="color:#64748b;font-size:12px;margin:0;">${subtitleText}</p>
        </div>
        <style>@keyframes sasSpin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);

    if (reason !== "account_switched") {
        fetch("/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            keepalive: true
        }).catch(() => {});
    }

    setTimeout(() => {
        const r = reason || "session_expired";
        window.location.replace(`/auth/login?reason=${encodeURIComponent(r)}`);
    }, 250);
}

// Start polling (1.5s)
if (typeof window.__orgWatcherStarted === "undefined") {
    window.__orgWatcherStarted = true;
    setInterval(__checkOrgSession, 1500);
    window.addEventListener("pageshow", () => __checkOrgSession());
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) __checkOrgSession();
    });
    __checkOrgSession();
}