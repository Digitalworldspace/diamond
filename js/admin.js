/* =========================================================
   Admin panel logic
   ========================================================= */

let allStones = [];
let allRequests = [];
let allUsers = [];

const pageMeta = {
  dashboard: ["Dashboard", "Overview of your stock and activity"],
  inventory: ["Inventory", "Add, edit and track every stone in stock"],
  requests: ["Requests", "Review hold and confirmation requests from customers"],
  users: ["Users", "Create and manage admin and customer logins"],
  settings: ["Settings", "Company information shown on documents and to customers"],
};

(async function init() {
  const user = requireRole("admin");
  if (!user) return;

  document.getElementById("adminName").textContent = user.full_name || user.username || "Admin";
  document.getElementById("adminEmail").textContent = user.email || "";

  wireMenuToggle();
  wireNav();
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("stoneForm").addEventListener("submit", saveStone);
  document.getElementById("userForm").addEventListener("submit", saveUser);
  document.getElementById("invSearch").addEventListener("input", renderInventory);
  document.getElementById("invStatusFilter").addEventListener("change", renderInventory);
  document.getElementById("reqStatusFilter").addEventListener("change", renderRequests);

  await Promise.all([loadStones(), loadRequests(), loadSettings(), loadUsers()]);
  renderDashboard();
})();

function wireNav() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      const view = link.dataset.view;
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      document.getElementById("view-" + view).classList.add("active");
      document.getElementById("pageTitle").textContent = pageMeta[view][0];
      document.getElementById("pageSubtitle").textContent = pageMeta[view][1];
      document.querySelector(".sidebar").classList.remove("open");
    });
  });
}

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  document.getElementById("statTotal").textContent = allStones.length;
  document.getElementById("statAvailable").textContent = allStones.filter((s) => s.status === "available").length;
  document.getElementById("statHold").textContent = allStones.filter((s) => s.status === "hold").length;
  document.getElementById("statConfirmed").textContent = allStones.filter((s) => s.status === "confirmed").length;
  const pendingCount = allRequests.filter((r) => r.status === "pending").length;
  document.getElementById("statPending").textContent = pendingCount;

  const badge = document.getElementById("reqNavBadge");
  badge.textContent = pendingCount > 0 ? pendingCount : "";

  const tbody = document.getElementById("dashRecentRequests");
  const recent = [...allRequests].slice(0, 6);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No requests yet</td></tr>`;
    return;
  }
  tbody.innerHTML = recent
    .map((r) => `
      <tr>
        <td>${escapeHtml(r.stones?.stone_id || "—")}</td>
        <td>${escapeHtml(r.customer_name || r.customer_email || "—")}</td>
        <td style="text-transform:capitalize;">${escapeHtml((r.action_type || "").replace(/_/g, " "))}</td>
        <td>${badgeForStatus(r.status)}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`)
    .join("");
}

/* ---------------- Inventory ---------------- */
async function loadStones() {
  const { data, error } = await sb.from("stones").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Could not load stones: " + error.message, "error"); return; }
  allStones = data || [];
  renderInventory();
}

function renderInventory() {
  const search = document.getElementById("invSearch").value.trim().toLowerCase();
  const status = document.getElementById("invStatusFilter").value;

  let rows = allStones.filter((s) => {
    const matchesSearch = !search || (s.stone_id || "").toLowerCase().includes(search) || (s.shape || "").toLowerCase().includes(search);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById("inventoryTbody");
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg class="diamond-mark" viewBox="0 0 24 24"><path d="M4 9 L12 3 L20 9 L12 21 Z M4 9 L20 9 M9 9 L12 3 L15 9 M9 9 L12 21 M15 9 L12 21"/></svg>
      <h3>No stones found</h3><p>Try a different search or add a new stone.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((s) => `
    <tr>
      <td>
        <div class="stone-cell">
          <img class="stone-thumb" src="${escapeHtml(s.image_url) || PLACEHOLDER_IMG}" onerror="this.src='${PLACEHOLDER_IMG}'" onclick="openLightbox('${escapeHtml(s.image_url) || ""}')" alt="${escapeHtml(s.stone_id)}" />
          <div><div class="stone-id">${escapeHtml(s.stone_id)}</div><div class="stone-sub">${escapeHtml(s.lab || "")} ${escapeHtml(s.certificate_no || "")}</div></div>
        </div>
      </td>
      <td>${escapeHtml(s.shape || "—")}</td>
      <td>${s.carat ?? "—"}</td>
      <td>${escapeHtml(s.color || "—")}</td>
      <td>${escapeHtml(s.clarity || "—")}</td>
      <td>${fmtPrice(s.price)}</td>
      <td>${badgeForStatus(s.status)}</td>
      <td><div class="row-actions">
        <button class="btn btn-sm" onclick='openStoneModal(${JSON.stringify(s).replace(/'/g, "&apos;")})'>Edit</button>
      </div></td>
    </tr>
  `).join("");
}

function openStoneModal(stone) {
  const form = document.getElementById("stoneForm");
  form.reset();
  document.getElementById("deleteStoneBtn").style.display = stone ? "inline-flex" : "none";
  document.getElementById("stoneModalTitle").textContent = stone ? "Edit stone" : "Add stone";
  document.getElementById("f_id").value = stone?.id || "";
  document.getElementById("f_stone_id").value = stone?.stone_id || "";
  document.getElementById("f_image_url").value = stone?.image_url || "";
  document.getElementById("f_shape").value = stone?.shape || "Round";
  document.getElementById("f_carat").value = stone?.carat ?? "";
  document.getElementById("f_color").value = stone?.color || "";
  document.getElementById("f_clarity").value = stone?.clarity || "VS1";
  document.getElementById("f_cut").value = stone?.cut || "Excellent";
  document.getElementById("f_fluorescence").value = stone?.fluorescence || "None";
  document.getElementById("f_measurements").value = stone?.measurements || "";
  document.getElementById("f_lab").value = stone?.lab || "GIA";
  document.getElementById("f_certificate_no").value = stone?.certificate_no || "";
  document.getElementById("f_price").value = stone?.price ?? "";
  document.getElementById("f_status").value = stone?.status || "available";
  document.getElementById("stoneModalOverlay").classList.add("show");
}

function closeStoneModal() {
  document.getElementById("stoneModalOverlay").classList.remove("show");
}

async function saveStone(e) {
  e.preventDefault();
  const id = document.getElementById("f_id").value;
  const payload = {
    stone_id: document.getElementById("f_stone_id").value.trim(),
    image_url: document.getElementById("f_image_url").value.trim() || null,
    shape: document.getElementById("f_shape").value,
    carat: parseFloat(document.getElementById("f_carat").value) || null,
    color: document.getElementById("f_color").value.trim() || null,
    clarity: document.getElementById("f_clarity").value,
    cut: document.getElementById("f_cut").value,
    fluorescence: document.getElementById("f_fluorescence").value,
    measurements: document.getElementById("f_measurements").value.trim() || null,
    lab: document.getElementById("f_lab").value,
    certificate_no: document.getElementById("f_certificate_no").value.trim() || null,
    price: parseFloat(document.getElementById("f_price").value) || null,
    status: document.getElementById("f_status").value,
  };

  const btn = document.getElementById("stoneSaveBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner dark"></span> Saving…';

  let error;
  if (id) {
    ({ error } = await sb.from("stones").update(payload).eq("id", id));
  } else {
    ({ error } = await sb.from("stones").insert(payload));
  }

  btn.disabled = false;
  btn.textContent = "Save stone";

  if (error) { showToast("Could not save stone: " + error.message, "error"); return; }
  showToast(id ? "Stone updated" : "Stone added", "success");
  closeStoneModal();
  await loadStones();
  renderDashboard();
}

async function deleteStone() {
  const id = document.getElementById("f_id").value;
  if (!id) return;
  if (!confirm("Delete this stone permanently? This cannot be undone.")) return;
  const { error } = await sb.from("stones").delete().eq("id", id);
  if (error) { showToast("Could not delete: " + error.message, "error"); return; }
  showToast("Stone deleted", "success");
  closeStoneModal();
  await loadStones();
  renderDashboard();
}

function openLightbox(url) {
  if (!url) return;
  document.getElementById("lightboxImg").src = url;
  document.getElementById("lightbox").classList.add("show");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("show");
}

/* ---------------- Requests ---------------- */
async function loadRequests() {
  const { data, error } = await sb
    .from("stone_requests")
    .select("*, stones(stone_id, image_url, status)")
    .order("created_at", { ascending: false });
  if (error) { showToast("Could not load requests: " + error.message, "error"); return; }
  allRequests = data || [];
  renderRequests();
}

function renderRequests() {
  const status = document.getElementById("reqStatusFilter").value;
  const rows = allRequests.filter((r) => !status || r.status === status);
  const tbody = document.getElementById("requestsTbody");

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg class="diamond-mark" viewBox="0 0 24 24"><path d="M4 9 L12 3 L20 9 L12 21 Z M4 9 L20 9 M9 9 L12 3 L15 9 M9 9 L12 21 M15 9 L12 21"/></svg>
      <h3>Nothing here</h3><p>No requests match this filter.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>
        <div class="stone-cell">
          <img class="stone-thumb" style="width:44px;height:44px;" src="${escapeHtml(r.stones?.image_url) || PLACEHOLDER_IMG}" onerror="this.src='${PLACEHOLDER_IMG}'" />
          <div class="stone-id">${escapeHtml(r.stones?.stone_id || "—")}</div>
        </div>
      </td>
      <td>${escapeHtml(r.customer_name || "—")}<div class="stone-sub">${escapeHtml(r.customer_email || "")}</div></td>
      <td style="text-transform:capitalize;">${escapeHtml((r.action_type || "").replace(/_/g, " "))}</td>
      <td>${escapeHtml(r.note || "—")}</td>
      <td>${badgeForStatus(r.status)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td>
        ${r.status === "pending" ? `
          <div class="row-actions">
            <button class="btn btn-sm btn-success" onclick="decideRequest('${r.id}', 'approved')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="decideRequest('${r.id}', 'rejected')">Reject</button>
          </div>` : `<span class="text-muted">Reviewed</span>`}
      </td>
    </tr>
  `).join("");
}

async function decideRequest(requestId, decision) {
  const req = allRequests.find((r) => r.id === requestId);
  if (!req) return;

  const { error: reqError } = await sb.from("stone_requests").update({ status: decision }).eq("id", requestId);
  if (reqError) { showToast("Could not update request: " + reqError.message, "error"); return; }

  if (decision === "approved") {
    const statusMap = {
      hold: "hold",
      confirm: "confirmed",
      request_video: null,
      request_memo: null,
      request_certificate: null,
    };
    const newStoneStatus = statusMap[req.action_type];
    if (newStoneStatus) {
      const { error: stoneError } = await sb.from("stones").update({ status: newStoneStatus }).eq("id", req.stone_id);
      if (stoneError) showToast("Request approved, but stone status update failed: " + stoneError.message, "error");
    }
  }

  showToast("Request " + decision, "success");
  await Promise.all([loadRequests(), loadStones()]);
  renderDashboard();
}

/* ---------------- Settings ---------------- */
async function loadSettings() {
  const { data, error } = await sb.from("company_settings").select("*").eq("id", COMPANY_SETTINGS_ID).maybeSingle();
  if (error) { showToast("Could not load settings: " + error.message, "error"); return; }
  if (!data) return;

  const fields = [
    "company_name", "website", "email", "phone", "logo_url",
    "address", "city", "state", "country", "postal_code",
    "gst_number", "pan_number", "bank_name", "bank_account_number", "bank_ifsc",
    "terms_conditions",
  ];
  fields.forEach((f) => {
    const el = document.getElementById("s_" + f);
    if (el) el.value = data[f] || "";
  });
}

async function saveSettings(e) {
  e.preventDefault();
  const fields = [
    "company_name", "website", "email", "phone", "logo_url",
    "address", "city", "state", "country", "postal_code",
    "gst_number", "pan_number", "bank_name", "bank_account_number", "bank_ifsc",
    "terms_conditions",
  ];
  const payload = { id: COMPANY_SETTINGS_ID };
  fields.forEach((f) => { payload[f] = document.getElementById("s_" + f).value.trim() || null; });
  payload.updated_at = new Date().toISOString();

  const btn = document.getElementById("settingsSaveBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner dark"></span> Saving…';

  const { error } = await sb.from("company_settings").upsert(payload);

  btn.disabled = false;
  btn.textContent = "Save changes";

  if (error) { showToast("Could not save settings: " + error.message, "error"); return; }
  showToast("Company information saved", "success");
}

/* ---------------- Users ---------------- */
async function loadUsers() {
  const { data, error } = await sb.from("users").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Could not load users: " + error.message, "error"); return; }
  allUsers = data || [];
  renderUsers();
}

function renderUsers() {
  const tbody = document.getElementById("usersTbody");
  if (allUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No users yet. Add one to get started.</td></tr>`;
    return;
  }
  tbody.innerHTML = allUsers.map((u) => `
    <tr>
      <td><strong>${escapeHtml(u.username)}</strong></td>
      <td>${escapeHtml(u.full_name || "—")}</td>
      <td>${escapeHtml(u.email || "—")}</td>
      <td style="text-transform:capitalize;">${escapeHtml(u.role)}</td>
      <td><button class="btn btn-sm" onclick='openUserModal(${JSON.stringify(u).replace(/'/g, "&apos;")})'>Edit</button></td>
    </tr>
  `).join("");
}

function openUserModal(user) {
  const form = document.getElementById("userForm");
  form.reset();
  document.getElementById("deleteUserBtn").style.display = user ? "inline-flex" : "none";
  document.getElementById("userModalTitle").textContent = user ? "Edit user" : "Add user";
  document.getElementById("u_id").value = user?.id || "";
  document.getElementById("u_username").value = user?.username || "";
  document.getElementById("u_password").value = user?.password || "";
  document.getElementById("u_full_name").value = user?.full_name || "";
  document.getElementById("u_email").value = user?.email || "";
  document.getElementById("u_role").value = user?.role || "customer";
  document.getElementById("userModalOverlay").classList.add("show");
}

function closeUserModal() {
  document.getElementById("userModalOverlay").classList.remove("show");
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById("u_id").value;
  const payload = {
    username: document.getElementById("u_username").value.trim(),
    password: document.getElementById("u_password").value,
    full_name: document.getElementById("u_full_name").value.trim() || null,
    email: document.getElementById("u_email").value.trim() || null,
    role: document.getElementById("u_role").value,
  };

  const btn = document.getElementById("userSaveBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner dark"></span> Saving…';

  let error;
  if (id) {
    ({ error } = await sb.from("users").update(payload).eq("id", id));
  } else {
    ({ error } = await sb.from("users").insert(payload));
  }

  btn.disabled = false;
  btn.textContent = "Save user";

  if (error) { showToast("Could not save user: " + error.message, "error"); return; }
  showToast(id ? "User updated" : "User added", "success");
  closeUserModal();
  await loadUsers();
}

async function deleteUser() {
  const id = document.getElementById("u_id").value;
  if (!id) return;
  if (!confirm("Delete this user's login? This cannot be undone.")) return;
  const { error } = await sb.from("users").delete().eq("id", id);
  if (error) { showToast("Could not delete: " + error.message, "error"); return; }
  showToast("User deleted", "success");
  closeUserModal();
  await loadUsers();
}
