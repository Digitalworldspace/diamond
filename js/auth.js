/* =========================================================
   Shared auth + small UI helpers used on every page
   ========================================================= */

async function getProfile(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

// Called at the top of admin.html / customer.html.
// Redirects to index.html if not logged in or wrong role.
async function requireRole(role) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  const profile = await getProfile(session.user.id);
  if (!profile || profile.role !== role) {
    window.location.href = "index.html";
    return null;
  }
  return profile;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}

// ---------- Toast ----------
function showToast(message, type = "") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

// ---------- Small formatting helpers ----------
function fmtPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badgeForStatus(status) {
  const map = {
    available: "badge-available",
    hold: "badge-hold",
    confirmed: "badge-confirmed",
    sold: "badge-sold",
    pending: "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
  };
  const cls = map[status] || "badge-sold";
  return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f6'/><path d='M50 20 L75 40 L50 82 L25 40 Z M25 40 H75 M50 20 L38 40 M50 20 L62 40' stroke='%2398a2b3' stroke-width='2' fill='none'/></svg>`
  );

// Mobile sidebar toggle (wired on each page)
function wireMenuToggle() {
  const btn = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (btn && sidebar) {
    btn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
}
