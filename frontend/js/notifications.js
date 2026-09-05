/**
 * Mandisathi - Notifications Page Handler
 */

let cachedNotifs = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  const markAllBtn = document.getElementById("markAllReadBtn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const res = await apiFetch("/api/notifications/read-all", { method: "PUT" });
      if (res.success) {
        showToast(t("allNotifsMarkedRead"), "success");
        await loadNotifications();
      }
    });
  }

  await loadNotifications();

  window.addEventListener("languageChanged", () => {
    if (cachedNotifs) {
      renderNotifications(cachedNotifs);
    }
  });
});

async function loadNotifications() {
  const loading = document.getElementById("notifLoading");

  try {
    const res = await apiFetch("/api/notifications");
    if (loading) loading.style.display = "none";

    if (res.success && res.data) {
      cachedNotifs = res.data;
      renderNotifications(cachedNotifs);
    }
  } catch (error) {
    console.error("Notifs load error:", error);
    if (loading) loading.textContent = t("unableLoadNotifs");
  }
}

function renderNotifications(data) {
  const container = document.getElementById("notificationsList");
  if (!container) return;

  if (data && data.length > 0) {
    container.innerHTML = data.map(n => `
      <div class="notification-card ${n.isRead ? '' : 'unread'}" id="notif-card-${n._id}">
        <div class="notif-icon">${getIconForType(n.type)}</div>
        <div class="notif-content">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <span class="badge ${getTypeBadge(n.type)}">${escapeHtml(n.type || "General")}</span>
          </div>
          <div class="notif-msg">${escapeHtml(n.message)}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
            <div class="notif-time">${new Date(n.createdAt).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            ${!n.isRead ? `<button class="btn btn-sm btn-secondary" onclick="markRead('${n._id}')">${t("markAsReadBtn")}</button>` : `<span style="font-size: 0.75rem; color: var(--text-muted);">${t("readStatus")}</span>`}
          </div>
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔔</div>
        <h3>${t("caughtUpTitle")}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">${t("noNotifsAccount")}</p>
      </div>
    `;
  }
}

async function markRead(id) {
  const res = await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
  if (res.success) {
    showToast(t("markedAsReadToast"), "success");
    await loadNotifications();
    
    // Update header badge
    const badge = document.getElementById("headerNotifBadge");
    if (badge) {
      const cur = parseInt(badge.textContent || "1", 10);
      if (cur > 1) badge.textContent = cur - 1;
      else badge.style.display = "none";
    }
  }
}

function getIconForType(type) {
  switch (type) {
    case "Schedule": return "📅";
    case "Token": return "🎫";
    case "Procurement": return "🌾";
    case "Payment": return "💰";
    default: return "🔔";
  }
}

function getTypeBadge(type) {
  switch (type) {
    case "Payment": return "badge-green";
    case "Schedule": return "badge-blue";
    case "Token": return "badge-amber";
    case "Procurement": return "badge-green";
    default: return "badge-gray";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
