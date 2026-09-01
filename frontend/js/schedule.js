/**
 * Kisan Procurement Mitra - Schedule Page Handler
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["farmer"])) return;

  await loadSchedules();
});

let schedulesData = [];

async function loadSchedules() {
  const tbody = document.getElementById("scheduleTableBody");
  const loading = document.getElementById("scheduleLoading");

  try {
    const res = await apiFetch("/api/procurement/schedule");
    if (loading) loading.style.display = "none";

    if (res.success && res.data && res.data.length > 0) {
      schedulesData = res.data;
      renderScheduleTable(schedulesData);
    } else {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No procurement schedule available.</td></tr>`;
      }
    }
  } catch (error) {
    console.error("Schedule error:", error);
    if (loading) loading.textContent = "Unable to load schedule. Please try again.";
  }
}

function renderScheduleTable(items) {
  const tbody = document.getElementById("scheduleTableBody");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.scheduleDate || "12 Sep 2026")}</strong></td>
      <td>${escapeHtml(item.startTime || "10:00 AM")} – ${escapeHtml(item.endTime || "11:00 AM")}</td>
      <td>${escapeHtml(item.centreId || "Sanwer Mandi")}</td>
      <td><strong>${escapeHtml(item.crop || "Wheat")}</strong></td>
      <td>${escapeHtml(item.quantity || "18 Quintal")}</td>
      <td>
        <span class="badge ${getStatusBadge(item.procurementStatus)}">
          ${escapeHtml(item.procurementStatus || "Scheduled")}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <a href="procurement.html" class="btn btn-sm btn-secondary">View Details</a>
          <button class="btn btn-sm btn-outline-primary" onclick="simulateInstantReminder('${escapeHtml(item.scheduleDate || "12 September 2026")}', '${escapeHtml(item.startTime || "10:00 AM")}')" style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <span>📲</span> Reminder
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function getStatusBadge(status) {
  switch (status) {
    case "Completed":
    case "Procurement Completed":
      return "badge-green";
    case "Scheduled":
      return "badge-blue";
    case "Arrived":
    case "Pending":
      return "badge-amber";
    case "Cancelled":
      return "badge-red";
    default:
      return "badge-gray";
  }
}

function filterSchedule(status) {
  if (status === "all") {
    renderScheduleTable(schedulesData);
  } else {
    const filtered = schedulesData.filter(s => s.procurementStatus === status);
    renderScheduleTable(filtered);
  }
}

async function simulateInstantReminder(date, time) {
  const user = getUser();
  showToast("Dispatching mock SMS & WhatsApp reminder...", "info");
  try {
    const res = await apiFetch("/api/notifications/simulate-reminder", {
      method: "POST",
      body: JSON.stringify({
        channel: "both",
        mobile: user ? user.mobile : "9876543210"
      })
    });
    if (res.success) {
      showToast(`📲 Reminder for ${date} (${time}) simulated on +91 ${user ? user.mobile : "9876543210"}!`, "success");
    } else {
      showToast(res.message || "Unable to send reminder simulation", "error");
    }
  } catch (err) {
    showToast("Simulation error", "error");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
