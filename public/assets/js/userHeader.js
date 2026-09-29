async function loadTopbar(options = {}) {
    const headerContainer = document.getElementById("header");
    if (!headerContainer) return;

    // 1. I-load ang userHeader.html
    const response = await fetch("/header"); // o kung ano ang route ng userHeader.html
    const html = await response.text();
    headerContainer.innerHTML = html;

    // 2. I-set ang Title at Subtitle kung mayroon
    if (options.title) {
        const titleEl = document.getElementById("pageTitle");
        if (titleEl) titleEl.textContent = options.title;
    }
    if (options.subtitle) {
        const subEl = document.getElementById("pageSubtitle");
        if (subEl) subEl.textContent = options.subtitle;
    }

    // 3. I-LOAD ANG PROFILE PICTURE MULA SA API
    try {
        const userRes = await fetch("/api/current-user");
        const userData = await userRes.json();
        
        const avatarContainer = document.getElementById("topbarAvatarContainer");
        if (avatarContainer && userData.profile_picture) {
            avatarContainer.innerHTML = `
                <img src="${userData.profile_picture}" 
                     alt="Profile" 
                     class="w-full h-full object-cover rounded-full" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fas fa-user-circle text-2xl text-gray-500\\'></i>';" />
            `;
        }
    } catch (err) {
        console.error("Error setting topbar avatar:", err);
    }

     // 4. NOTIFICATIONS
     initUserNotifications();
}

function userNotifIcon(type) {
    const icons = {
        application_status: "📋",
        interview_scheduled: "📅",
        interview_rescheduled: "📅",
        donation_status: "💰",
        kamustahan_due: "🐾",
        account_warning: "⚠️"
    };
    return icons[type] || "🔔";
}

async function loadUserNotifications() {
    const list = document.getElementById("userNotifList");
    const dot = document.querySelector("#notificationBtn .bg-red-500");
    if (!list) return;

    try {
        const res = await fetch("/api/notifications");
        const data = await res.json();

        if (dot) {
            dot.style.display = data.unreadCount > 0 ? "" : "none";
        }

        if (!data.success || !data.notifications || data.notifications.length === 0) {
            list.innerHTML = '<li class="text-gray-400 text-xs text-center py-4">No notifications yet.</li>';
            return;
        }

        // Mga notification type na pang-impormasyon lang, hindi dapat i-click/i-navigate
        const NON_CLICKABLE_TYPES = ["feedback_resolved", "feedback_reopened"];

        list.innerHTML = data.notifications.map(n => {
            const isInfoOnly = NON_CLICKABLE_TYPES.includes(n.type);
            const clickableClass = isInfoOnly ? "" : "cursor-pointer";
            return `
            <li data-id="${n.notification_id}" data-link="${n.link || ''}" data-info-only="${isInfoOnly}" class="user-notif-item flex items-start justify-between gap-2 border-b pb-2 ${n.is_read ? 'opacity-50' : ''}">
                <div class="user-notif-content flex-1 min-w-0 ${clickableClass}">
                    ${userNotifIcon(n.type)} <span class="font-medium">${n.title}</span><br>
                    <span class="text-xs text-gray-500">${n.message}</span>
                </div>
                <button class="user-notif-delete-btn text-gray-300 hover:text-red-500 transition shrink-0 px-1" title="Delete">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </li>
        `}).join("");

        list.querySelectorAll(".user-notif-item").forEach(item => {
            if (item.dataset.infoOnly !== "true") {
                item.querySelector(".user-notif-content").addEventListener("click", async () => {
                    await fetch(`/api/notifications/${item.dataset.id}/read`, { method: "PUT" });
                    if (item.dataset.link) window.location.href = item.dataset.link;
                });
            }
        });

        list.querySelectorAll(".user-notif-delete-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const row = btn.closest(".user-notif-item");
                const id = row.dataset.id;
                try {
                    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                    row.remove();
                    if (!list.querySelector(".user-notif-item")) {
                        loadUserNotifications();
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

function initUserNotifications() {
    const btn = document.getElementById("notificationBtn");
    const popup = document.getElementById("notificationPopup");
    const markAllBtn = document.getElementById("userMarkAllReadBtn");

    if (btn && popup) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = popup.classList.contains("hidden");
            popup.classList.toggle("hidden");
            if (isHidden) loadUserNotifications();
        });

        document.addEventListener("click", (e) => {
            if (!btn.contains(e.target) && !popup.contains(e.target)) {
                popup.classList.add("hidden");
            }
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await fetch("/api/notifications/read-all", { method: "PUT" });
            await loadUserNotifications();
        });
    }

}

// ==========================================
// FACEBOOK-STYLE SESSION WATCHER + ACCOUNT SWITCH
// ==========================================
async function checkUserSessionStatus() {
    if (isRedirecting) return;

    try {
        const res = await fetch("/api/session-status", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (res.status === 401 || res.status === 403) {
            lockUserSidebarAndRedirect("session_expired");
            return;
        }

        const data = await res.json();

        // 1. Session invalidated (SAS or ban/suspend)
        if (!data.active) {
            lockUserSidebarAndRedirect(data.status || "session_expired");
            return;
        }

        // 2. ⭐ ACCOUNT SWITCH DETECTION (same browser, different tab)
        if (data.accountId) {
            const savedAccountId = sessionStorage.getItem("pawpon_tab_account_id");

            if (!savedAccountId) {
                // First poll — i-save ang account ID ng tab na ito
                sessionStorage.setItem("pawpon_tab_account_id", String(data.accountId));
            } else if (String(savedAccountId) !== String(data.accountId)) {
                // ❌ Ibang account na ang naka-login sa browser na ito
                console.log(`[Account Switch] Tab had ${savedAccountId}, now ${data.accountId}`);
                lockUserSidebarAndRedirect("account_switched");
            }
        }
    } catch (err) {
        console.warn("Session check failed:", err.message);
    }
}

let isRedirecting = false;

function lockUserSidebarAndRedirect(reason) {
    if (isRedirecting) return;
    isRedirecting = true;

    // 1. I-disable ang lahat ng clickable elements
    document.querySelectorAll("a, button, input, select, textarea").forEach(el => {
        el.style.pointerEvents = "none";
        el.style.opacity = "0.4";
    });

    // 2. I-blur at i-hide agad ang buong page content (privacy)
    const mainContent = document.querySelector("main") || document.body;
    mainContent.style.filter = "blur(8px)";
    mainContent.style.opacity = "0.15";
    mainContent.style.transition = "opacity 0.15s";

    // 3. Overlay (Facebook-style)
    const overlay = document.createElement("div");
    overlay.id = "sessionEndedOverlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 16px;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    // Iba ang title kapag account switch
    const isSwitch = reason === "account_switched";
    const titleText = isSwitch
        ? "Different account signed in"
        : "Signed in on another device";
    const subtitleText = isSwitch
        ? "A different account was signed in on this browser. Redirecting..."
        : "Your account was signed in elsewhere. Redirecting...";

    overlay.innerHTML = `
        <div style="
            width: 48px; height: 48px;
            border: 4px solid #e5e7eb;
            border-top-color: #1656ff;
            border-radius: 50%;
            animation: sasSpin 0.6s linear infinite;
        "></div>
        <div style="text-align: center;">
            <p style="
                color: #0f172a;
                font-size: 15px;
                font-weight: 700;
                margin: 0 0 4px;
            ">${titleText}</p>
            <p style="
                color: #64748b;
                font-size: 12px;
                margin: 0;
            ">${subtitleText}</p>
        </div>
        <style>
            @keyframes sasSpin { to { transform: rotate(360deg); } }
        </style>
    `;
    document.body.appendChild(overlay);

    // 4. I-force logout sa server — PERO hindi kapag account switch
    if (reason !== "account_switched") {
        fetch("/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            keepalive: true
        }).catch(() => {});
    }

    // 5. I-clear ang tab-specific storage
    try {
        sessionStorage.removeItem("pawpon_tab_account_id");
    } catch (e) { /* ignore */ }

    // 6. ⭐ Redirect — 250ms na lang (dating 1500ms)
    setTimeout(() => {
        const loginReason = reason || "session_expired";
        window.location.replace(`/auth/login?reason=${encodeURIComponent(loginReason)}`);
    }, 250);
}