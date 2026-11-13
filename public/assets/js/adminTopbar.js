async function loadTopbar(options = {}) {
    const container = document.getElementById("topbar");
    if (!container) return;

    // Load the HTML
    const response = await fetch("./topbar.html");
    container.innerHTML = await response.text();

    // Set page title & subtitle
    document.getElementById("topbarTitle").textContent =
        options.title || "Dashboard";

    document.getElementById("topbarSubtitle").textContent =
        options.subtitle || "";

    // Notification dropdown
    const bell = document.getElementById("notificationBellBtn");
    const dropdown = document.getElementById("notificationDropdown");

    if (!bell || !dropdown) return;

    // Open / Close
    bell.addEventListener("click", function (e) {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains("hidden");
        dropdown.classList.toggle("hidden");
        if (isHidden) loadAdminNotifications();
    });

    // Close when clicking outside
    document.addEventListener("click", function (e) {
        if (
            !dropdown.contains(e.target) &&
            !bell.contains(e.target)
        ) {
            dropdown.classList.add("hidden");
        }
    });
    const markAllBtn = document.getElementById("adminMarkAllReadBtn");
    if (markAllBtn) {
        markAllBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await fetch("/api/notifications/read-all", { method: "PUT" });
            await loadAdminNotifications();
        });
    }

    loadAdminNotifications();
    if (!window.__adminNotifPolling) {
        window.__adminNotifPolling = true;
        setInterval(loadAdminNotifications, 30000);
    }
}

function adminNotifIcon(type) {
    const icons = {
        org_pending: "fa-building",
        feedback_new: "fa-comment-dots",
        contact_message_new: "fa-envelope"
    };
    return icons[type] || "fa-bell";
}

async function loadAdminNotifications() {
    const list = document.getElementById("adminNotifList");
    const pulseWrapper = document.querySelector("#notificationBellBtn .absolute");
    if (!list) return;

    try {
        const res = await fetch("/api/notifications");
        const data = await res.json();

        if (pulseWrapper) {
            pulseWrapper.style.display = data.unreadCount > 0 ? "" : "none";
        }

        if (!data.success || !data.notifications || data.notifications.length === 0) {
            list.innerHTML = '<p class="px-5 py-6 text-center text-xs text-slate-400">No notifications yet.</p>';
            return;
        }

        list.innerHTML = data.notifications.map(n => {
            const timeAgo = new Date(n.created_at).toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            });
            return `
                 <div data-id="${n.notification_id}" class="admin-notif-item px-5 py-3.5 hover:bg-slate-50/80 transition-colors duration-150 group ${n.is_read ? 'opacity-50' : ''} flex items-start gap-2">
                    <div class="admin-notif-content flex items-start gap-3 flex-1 min-w-0 cursor-pointer" data-link="${n.link || ''}">
                        <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 shadow-xs">
                            <i class="fa-solid ${adminNotifIcon(n.type)} text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-slate-800 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">${n.title}</p>
                            <p class="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">${n.message}</p>
                            <p class="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
                                <i class="fa-regular fa-clock text-[10px]"></i> ${timeAgo}
                            </p>
                        </div>
                    </div>
                    <button class="admin-notif-delete-btn text-slate-300 hover:text-red-500 transition shrink-0 p-1" title="Delete">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join("");

        list.querySelectorAll(".admin-notif-content").forEach(content => {
            content.addEventListener("click", async () => {
                const id = content.closest(".admin-notif-item").dataset.id;
                await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
                if (content.dataset.link) window.location.href = content.dataset.link;
            });
        });

        list.querySelectorAll(".admin-notif-delete-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const row = btn.closest(".admin-notif-item");
                const id = row.dataset.id;
                try {
                    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                    row.remove();
                    if (!list.querySelector(".admin-notif-item")) {
                        loadAdminNotifications();
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
// ==========================================
// SESSION WATCHER + ACCOUNT SWITCH DETECTION (ADMIN)
// ==========================================
let __adminTabAccountId = null;
let __adminRedirecting = false;

async function __checkAdminSession() {
    if (__adminRedirecting) return;

    if (window.location.pathname.startsWith("/auth/")) return;

    try {
        const res = await fetch("/api/session-status", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (res.status === 401 || res.status === 403) {
            __lockAdminAndRedirect("session_expired");
            return;
        }

        const data = await res.json();

        if (!data.active) {
            __lockAdminAndRedirect(data.status || "session_expired");
            return;
        }

        if (data.accountId) {
            const currentId = String(data.accountId);

            if (__adminTabAccountId === null) {
                __adminTabAccountId = currentId;
                return;
            }

            if (__adminTabAccountId !== currentId) {
                console.warn(`[Admin Switch] Was ${__adminTabAccountId}, now ${currentId}`);
                __lockAdminAndRedirect("account_switched");
            }
        }
    } catch (err) {
        console.warn("Admin session check failed:", err.message);
    }
}

function __lockAdminAndRedirect(reason) {
    if (__adminRedirecting) return;
    __adminRedirecting = true;

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
        : "Your admin session was signed in elsewhere. Redirecting...";

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
if (typeof window.__adminWatcherStarted === "undefined") {
    window.__adminWatcherStarted = true;
    setInterval(__checkAdminSession, 1500);
    window.addEventListener("pageshow", () => __checkAdminSession());
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) __checkAdminSession();
    });
    __checkAdminSession();
}
