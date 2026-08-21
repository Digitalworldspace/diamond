/* =========================================================
   Admin panel logic
   ========================================================= */

let allStones = [];
let allRequests = [];
let allUsers = [];
let invSelectedIds = new Set();
let currentUser = null;

const pageMeta = {
  dashboard: ["Dashboard", "Overview of your stock and activity"],
  inventory: ["Inventory", "Add, edit and track every stone in stock"],
  requests: ["Requests", "Review hold and confirmation requests from customers"],
  users: ["Users", "Create and manage admin and customer logins"],
  settings: ["Settings", "Company information shown on documents and to customers"],
};

const STONE_FIELDS_MAP = [
  ["stone_id", "Stone ID"], ["location", "Location"], ["shape", "Shape"], ["cts", "Cts"],
  ["size", "Size"], ["colour", "Colour"], ["clarity", "Clarity"], ["cut", "Cut"],
  ["polish", "Polish"], ["symmetry", "Symmetry"], ["fluorescence", "Fluorescence"],
  ["price_per_ct", "Price/Ct $"], ["total_price", "Total price $"], ["measurement", "Measurement"],
  ["table_percent", "Table %"], ["depth_percent", "Depth %"], ["video_url", "Video"],
  ["report_no", "Report no"], ["lab", "Lab"], ["company_comment", "Company comment"],
  ["image_url", "Image"], ["stock_status", "Stock status"], ["certificate_link", "Certificate link"],
];
const NUMERIC_STONE_FIELDS = ["cts", "price_per_ct", "total_price", "table_percent", "depth_percent"];

(async function init() {
  const user = requireRole("admin");
  if (!user) return;
  currentUser = user;

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
  document.getElementById("invSelectAllChk").addEventListener("change", toggleInvSelectAll);
  document.getElementById("logoUploadBtn").addEventListener("click", () => document.getElementById("logoFileInput").click());
  document.getElementById("logoFileInput").addEventListener("change", handleLogoUpload);
  document.getElementById("importFileInput").addEventListener("change", handleImportFile);

  await Promise.all([loadStones(), loadRequests(), loadSettings(), loadUsers()]);
  renderDashboard();
  setupRealtime();
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
      document.getElementById("invBulkBar").classList.toggle("show", view === "inventory" && invSelectedIds.size > 0);
    });
  });
}

/* ---------------- Realtime — live sync both directions ---------------- */
function setupRealtime() {
  sb.channel("admin-stones")
    .on("postgres_changes", { event: "*", schema: "public", table: "stones" }, async () => {
      await loadStones();
      renderDashboard();
    })
    .subscribe();

  sb.channel("admin-requests")
    .on("postgres_changes", { event: "*", schema: "public", table: "stone_requests" }, async () => {
      await loadRequests();
      renderDashboard();
    })
    .subscribe();

  sb.channel("admin-settings")
    .on("postgres_changes", { event: "*", schema: "public", table: "company_settings" }, () => loadSettings())
    .subscribe();

  sb.channel("admin-users")
    .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => loadUsers())
    .subscribe();

  // If someone edits or removes the currently signed-in admin's own login
  // (from another tab, another admin, or Table Editor), reflect it live.
  sb.channel("admin-own-session")
    .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if (!row || row.id !== currentUser.id) return;

      if (payload.eventType === "DELETE" || row.role !== "admin") {
        showToast("Your access has changed. Please sign in again.", "error");
        clearSession();
        setTimeout(() => { window.location.href = "index.html"; }, 1200);
        return;
      }

      // Password, name, or email changed on this account — keep the local session in sync.
      currentUser = row;
      setSession(row);
      document.getElementById("adminName").textContent = row.full_name || row.username || "Admin";
      document.getElementById("adminEmail").textContent = row.email || "";
    })
    .subscribe();
}

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  document.getElementById("statTotal").textContent = allStones.length;
  document.getElementById("statAvailable").textContent = allStones.filter((s) => s.stock_status === "available").length;
  document.getElementById("statHold").textContent = allStones.filter((s) => s.stock_status === "hold").length;
  document.getElementById("statConfirmed").textContent = allStones.filter((s) => s.stock_status === "confirmed").length;
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
    const matchesStatus = !status || s.stock_status === status;
    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById("inventoryTbody");
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <svg class="diamond-mark" viewBox="0 0 24 24"><path d="M4 9 L12 3 L20 9 L12 21 Z M4 9 L20 9 M9 9 L12 3 L15 9 M9 9 L12 21 M15 9 L12 21"/></svg>
      <h3>No stones found</h3><p>Try a different search, or add / import stones.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((s) => {
    const checked = invSelectedIds.has(s.id) ? "checked" : "";
    return `
    <tr class="${invSelectedIds.has(s.id) ? "row-selected" : ""}" data-id="${s.id}">
      <td><input type="checkbox" class="chk inv-row-chk" data-id="${s.id}" ${checked} onchange="toggleInvRow('${s.id}', this.checked)" /></td>
      <td>
        <div class="stone-cell">
          <img class="stone-thumb" src="${escapeHtml(s.image_url) || PLACEHOLDER_IMG}" onerror="this.src='${PLACEHOLDER_IMG}'" onclick="openLightbox('${escapeHtml(s.image_url) || ""}')" alt="${escapeHtml(s.stone_id)}" />
          <div><div class="stone-id">${escapeHtml(s.stone_id)}</div><div class="stone-sub">${escapeHtml(s.lab || "")} ${escapeHtml(s.report_no || "")}</div></div>
        </div>
      </td>
      <td>${escapeHtml(s.shape || "—")}</td>
      <td>${s.cts ?? "—"}</td>
      <td>${escapeHtml(s.colour || "—")}</td>
      <td>${escapeHtml(s.clarity || "—")}</td>
      <td>${fmtPrice(s.total_price)}</td>
      <td>${badgeForStatus(s.stock_status)}</td>
      <td><div class="row-actions">
        <button class="btn btn-sm" onclick='openStoneModal(${JSON.stringify(s).replace(/'/g, "&apos;")})'>Edit</button>
      </div></td>
    </tr>
  `;
  }).join("");

  updateInvBulkBar();
}

function openStoneModal(stone) {
  const form = document.getElementById("stoneForm");
  form.reset();
  document.getElementById("deleteStoneBtn").style.display = stone ? "inline-flex" : "none";
  document.getElementById("stoneModalTitle").textContent = stone ? "Edit stone" : "Add stone";

  document.getElementById("f_id").value = stone?.id || "";
  document.getElementById("f_stone_id").value = stone?.stone_id || "";
  document.getElementById("f_location").value = stone?.location || "";
  document.getElementById("f_image_url").value = stone?.image_url || "";
  document.getElementById("f_video_url").value = stone?.video_url || "";
  document.getElementById("f_shape").value = stone?.shape || "Round";
  document.getElementById("f_cts").value = stone?.cts ?? "";
  document.getElementById("f_size").value = stone?.size || "";
  document.getElementById("f_colour").value = stone?.colour || "";
  document.getElementById("f_clarity").value = stone?.clarity || "VS1";
  document.getElementById("f_cut").value = stone?.cut || "Excellent";
  document.getElementById("f_polish").value = stone?.polish || "Excellent";
  document.getElementById("f_symmetry").value = stone?.symmetry || "Excellent";
  document.getElementById("f_fluorescence").value = stone?.fluorescence || "None";
  document.getElementById("f_measurement").value = stone?.measurement || "";
  document.getElementById("f_table_percent").value = stone?.table_percent ?? "";
  document.getElementById("f_depth_percent").value = stone?.depth_percent ?? "";
  document.getElementById("f_price_per_ct").value = stone?.price_per_ct ?? "";
  document.getElementById("f_total_price").value = stone?.total_price ?? "";
  document.getElementById("f_lab").value = stone?.lab || "GIA";
  document.getElementById("f_report_no").value = stone?.report_no || "";
  document.getElementById("f_certificate_link").value = stone?.certificate_link || "";
  document.getElementById("f_stock_status").value = stone?.stock_status || "available";
  document.getElementById("f_company_comment").value = stone?.company_comment || "";

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
    location: document.getElementById("f_location").value.trim() || null,
    image_url: document.getElementById("f_image_url").value.trim() || null,
    video_url: document.getElementById("f_video_url").value.trim() || null,
    shape: document.getElementById("f_shape").value,
    cts: parseFloat(document.getElementById("f_cts").value) || null,
    size: document.getElementById("f_size").value.trim() || null,
    colour: document.getElementById("f_colour").value.trim() || null,
    clarity: document.getElementById("f_clarity").value,
    cut: document.getElementById("f_cut").value,
    polish: document.getElementById("f_polish").value,
    symmetry: document.getElementById("f_symmetry").value,
    fluorescence: document.getElementById("f_fluorescence").value,
    measurement: document.getElementById("f_measurement").value.trim() || null,
    table_percent: parseFloat(document.getElementById("f_table_percent").value) || null,
    depth_percent: parseFloat(document.getElementById("f_depth_percent").value) || null,
    price_per_ct: parseFloat(document.getElementById("f_price_per_ct").value) || null,
    total_price: parseFloat(document.getElementById("f_total_price").value) || null,
    lab: document.getElementById("f_lab").value,
    report_no: document.getElementById("f_report_no").value.trim() || null,
    certificate_link: document.getElementById("f_certificate_link").value.trim() || null,
    stock_status: document.getElementById("f_stock_status").value,
    company_comment: document.getElementById("f_company_comment").value.trim() || null,
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

/* ---------------- Inventory bulk selection & actions ---------------- */
function toggleInvRow(id, checked) {
  if (checked) invSelectedIds.add(id); else invSelectedIds.delete(id);
  const row = document.querySelector(`#inventoryTbody tr[data-id="${id}"]`);
  if (row) row.classList.toggle("row-selected", checked);
  updateInvBulkBar();
}

function toggleInvSelectAll(e) {
  const checked = e.target.checked;
  document.querySelectorAll(".inv-row-chk").forEach((chk) => {
    chk.checked = checked;
    toggleInvRow(chk.dataset.id, checked);
  });
}

function clearInvSelection() {
  invSelectedIds.clear();
  document.getElementById("invSelectAllChk").checked = false;
  renderInventory();
}

function updateInvBulkBar() {
  const count = invSelectedIds.size;
  document.getElementById("invBulkCount").textContent = count;
  document.getElementById("invBulkBar").classList.toggle("show", count > 0);
}

async function bulkSetStatus(status) {
  if (invSelectedIds.size === 0) return;
  const { error } = await sb.from("stones").update({ stock_status: status }).in("id", Array.from(invSelectedIds));
  if (error) { showToast("Could not update stones: " + error.message, "error"); return; }
  showToast(`${invSelectedIds.size} stone(s) marked ${status}`, "success");
  clearInvSelection();
  await loadStones();
  renderDashboard();
}

async function bulkDeleteStones() {
  if (invSelectedIds.size === 0) return;
  if (!confirm(`Delete ${invSelectedIds.size} stone(s) permanently? This cannot be undone.`)) return;
  const { error } = await sb.from("stones").delete().in("id", Array.from(invSelectedIds));
  if (error) { showToast("Could not delete stones: " + error.message, "error"); return; }
  showToast(`${invSelectedIds.size} stone(s) deleted`, "success");
  clearInvSelection();
  await loadStones();
  renderDashboard();
}

/* ---------------- Excel / CSV import with smart column matching ---------------- */
const FIELD_ALIASES = {
  stone_id: ["stone id", "stoneid", "packet id", "packet no", "packetno", "lot no", "lot number", "id", "stock id", "stockno", "stock no"],
  location: ["location", "loc"],
  shape: ["shape"],
  cts: ["cts", "carat", "carats", "ct", "wt", "weight"],
  size: ["size", "sieve", "sieve size"],
  colour: ["colour", "color"],
  clarity: ["clarity"],
  cut: ["cut"],
  polish: ["po", "polish", "pol"],
  symmetry: ["sym", "symmetry", "symm"],
  fluorescence: ["fls", "fl", "fluorescence", "fluro"],
  price_per_ct: ["ct/pr $", "ct/pr", "ctpr", "price per ct", "price/ct", "rate", "rap", "rap %", "rate/ct"],
  total_price: ["total price $", "total price", "amount", "total", "total amount", "totalprice"],
  measurement: ["measurment", "measurement", "measurements", "dimensions", "dimension", "meas"],
  table_percent: ["table %", "table%", "table"],
  depth_percent: ["depth %", "depth%", "depth"],
  video_url: ["video", "video link", "video url", "videolink"],
  report_no: ["report no", "report number", "certificate no", "cert no", "certno", "reportno"],
  lab: ["lab"],
  company_comment: ["company comment", "comment", "comments", "remark", "remarks"],
  image_url: ["image", "img", "image url", "photo", "picture"],
  stock_status: ["stock status", "status", "stockstatus"],
  certificate_link: ["certificate link", "cert link", "certificate url", "certlink"],
};

function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessFieldForHeader(header) {
  const norm = normalizeHeader(header);
  if (!norm) return "";
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === norm)) return field;
  }
  return "";
}

let importHeaders = [];
let importRows = [];
let importMapping = {};

function openImportModal() {
  importHeaders = [];
  importRows = [];
  importMapping = {};
  document.getElementById("importStep1").style.display = "block";
  document.getElementById("importStep2").style.display = "none";
  document.getElementById("importSubmitBtn").style.display = "none";
  document.getElementById("importFileInput").value = "";
  document.getElementById("importModalOverlay").classList.add("show");
}

function closeImportModal() {
  document.getElementById("importModalOverlay").classList.remove("show");
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      if (rows.length < 2) { showToast("This file doesn't have any data rows", "error"); return; }
      importHeaders = rows[0].map((h) => String(h).trim());
      importRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));
      renderImportMapping();
    } catch (err) {
      showToast("Could not read this file: " + err.message, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportMapping() {
  document.getElementById("importStep1").style.display = "none";
  document.getElementById("importStep2").style.display = "block";
  document.getElementById("importSubmitBtn").style.display = "inline-flex";
  document.getElementById("importRowCount").textContent = importRows.length;

  const optionList = [["", "— Skip this column —"], ...STONE_FIELDS_MAP];

  const tbody = document.getElementById("importMappingTbody");
  tbody.innerHTML = importHeaders.map((h, i) => {
    const guess = guessFieldForHeader(h);
    importMapping[i] = guess;
    const options = optionList.map(([val, label]) => `<option value="${val}" ${val === guess ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    return `<tr><td>${escapeHtml(h) || "(blank)"}</td><td><select class="select-filter" onchange="importMapping[${i}] = this.value">${options}</select></td></tr>`;
  }).join("");

  const head = document.getElementById("importPreviewHead");
  head.innerHTML = "<tr>" + importHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join("") + "</tr>";
  const body = document.getElementById("importPreviewBody");
  body.innerHTML = importRows.slice(0, 5).map((r) =>
    "<tr>" + importHeaders.map((_, i) => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("") + "</tr>"
  ).join("");
}

async function runImport() {
  const btn = document.getElementById("importSubmitBtn");
  const mappedFields = Object.values(importMapping).filter(Boolean);
  if (!mappedFields.includes("stone_id")) {
    showToast("Map a column to Stone ID before importing", "error");
    return;
  }

  const records = importRows.map((row) => {
    const rec = {};
    importHeaders.forEach((_, i) => {
      const field = importMapping[i];
      if (!field) return;
      let value = row[i];
      if (value === undefined || String(value).trim() === "") { value = null; }
      if (NUMERIC_STONE_FIELDS.includes(field) && value !== null) {
        value = parseFloat(String(value).replace(/,/g, "")) || null;
      }
      if (field === "stock_status" && value) {
        const v = String(value).trim().toLowerCase();
        value = ["available", "hold", "confirmed", "sold"].includes(v) ? v : "available";
      }
      if (typeof value === "string") value = value.trim();
      rec[field] = value;
    });
    if (!rec.stock_status) rec.stock_status = "available";
    return rec;
  }).filter((r) => r.stone_id);

  if (records.length === 0) {
    showToast("No valid rows with a Stone ID found", "error");
    return;
  }

  btn.disabled = true;
  const total = records.length;
  const chunkSize = 300;
  let imported = 0;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    btn.innerHTML = `<span class="spinner dark"></span> Importing ${imported}/${total}…`;
    const { error } = await sb.from("stones").upsert(chunk, { onConflict: "stone_id" });
    if (error) {
      showToast("Import stopped: " + error.message, "error");
      btn.disabled = false;
      btn.textContent = "Import stones";
      return;
    }
    imported += chunk.length;
  }

  btn.disabled = false;
  btn.textContent = "Import stones";
  showToast(`Imported ${imported} stone(s)`, "success");
  closeImportModal();
  await loadStones();
  renderDashboard();
}

/* ---------------- Requests ---------------- */
async function loadRequests() {
  const { data, error } = await sb
    .from("stone_requests")
    .select("*, stones(stone_id, image_url, stock_status)")
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
    const statusMap = { hold: "hold", confirm: "confirmed" };
    const newStoneStatus = statusMap[req.action_type];
    if (newStoneStatus) {
      const { error: stoneError } = await sb.from("stones").update({ stock_status: newStoneStatus }).eq("id", req.stone_id);
      if (stoneError) showToast("Request approved, but stone status update failed: " + stoneError.message, "error");
    }
  }

  showToast("Request " + decision, "success");
  await Promise.all([loadRequests(), loadStones()]);
  renderDashboard();
}

/* ---------------- Settings (incl. logo upload) ---------------- */
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

  const preview = document.getElementById("logoPreview");
  if (data.logo_url) {
    preview.src = data.logo_url;
    preview.style.display = "block";
  }

  updateSidebarBrand(data.company_name, data.logo_url);
}

function updateSidebarBrand(companyName, logoUrl) {
  const nameLabel = document.querySelector("#sidebarBrand span");
  if (nameLabel && companyName) nameLabel.textContent = companyName;
  const brand = document.getElementById("sidebarBrand");
  if (brand && logoUrl && !brand.querySelector("img")) {
    const svg = brand.querySelector("svg");
    const img = document.createElement("img");
    img.src = logoUrl;
    img.alt = "Logo";
    img.style.cssText = "width:26px;height:26px;object-fit:contain;border-radius:4px;";
    if (svg) svg.replaceWith(img);
  } else if (brand && logoUrl) {
    brand.querySelector("img").src = logoUrl;
  }
}

async function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    showToast("Please choose a JPEG or PNG file", "error");
    return;
  }
  const statusEl = document.getElementById("logoUploadStatus");
  statusEl.textContent = "Uploading…";

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `logo-${Date.now()}.${ext}`;

  const { error } = await sb.storage.from("portal-assets").upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    statusEl.textContent = "";
    showToast("Logo upload failed: " + error.message, "error");
    return;
  }

  const { data } = sb.storage.from("portal-assets").getPublicUrl(path);
  document.getElementById("s_logo_url").value = data.publicUrl;
  const preview = document.getElementById("logoPreview");
  preview.src = data.publicUrl;
  preview.style.display = "block";
  statusEl.textContent = "Uploaded — click Save changes to apply.";
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
  document.getElementById("logoUploadStatus").textContent = "";
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
