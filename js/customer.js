/* =========================================================
   Customer panel logic
   ========================================================= */

let myProfile = null;
let allStones = [];
let myRequests = [];
let selectedIds = new Set();
let pendingActionType = null; // set when opening the action modal

const ACTION_LABELS = {
  hold: { label: "Hold", desc: "This will ask the admin to place a hold on the selected stone(s) so they're reserved for you." },
  confirm: { label: "Confirm", desc: "This will ask the admin to confirm your purchase of the selected stone(s)." },
  request_video: { label: "Request video", desc: "Ask the admin to send a video of the selected stone(s)." },
  request_memo: { label: "Request memo", desc: "Ask the admin to send these stone(s) on memo." },
  request_certificate: { label: "Request certificate", desc: "Ask the admin to share the certificate for the selected stone(s)." },
};

(async function init() {
  myProfile = requireRole("customer");
  if (!myProfile) return;

  document.getElementById("custName").textContent = myProfile.full_name || "Customer";
  document.getElementById("custEmail").textContent = myProfile.email || "";

  wireMenuToggle();
  wireNav();
  loadCompanySettings();

  document.getElementById("stoneSearch").addEventListener("input", renderStones);
  document.getElementById("stoneStatusFilter").addEventListener("change", renderStones);
  document.getElementById("selectAllChk").addEventListener("change", toggleSelectAll);

  await loadStones();
  await loadMyRequests();
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
      const meta = view === "stones"
        ? ["Stones", "Browse available stones. Select any to send a request."]
        : ["My requests", "Track the status of everything you've requested."];
      document.getElementById("pageTitle").textContent = meta[0];
      document.getElementById("pageSubtitle").textContent = meta[1];
      document.querySelector(".sidebar").classList.remove("open");
      if (view === "myrequests") loadMyRequests();
    });
  });
}

/* ---------------- Realtime — live sync both directions ---------------- */
function setupRealtime() {
  sb.channel("customer-stones")
    .on("postgres_changes", { event: "*", schema: "public", table: "stones" }, () => loadStones())
    .subscribe();

  sb.channel("customer-requests")
    .on("postgres_changes", { event: "*", schema: "public", table: "stone_requests" }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if (row && row.customer_id === myProfile.id) loadMyRequests();
    })
    .subscribe();

  sb.channel("customer-settings")
    .on("postgres_changes", { event: "*", schema: "public", table: "company_settings" }, () => loadCompanySettings())
    .subscribe();

  // If the admin edits or removes this customer's own login (from the Users
  // tab, another tab, or Table Editor), reflect it live in this open session.
  sb.channel("customer-own-session")
    .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if (!row || row.id !== myProfile.id) return;

      if (payload.eventType === "DELETE" || row.role !== "customer") {
        showToast("Your access has changed. Please sign in again.", "error");
        clearSession();
        setTimeout(() => { window.location.href = "index.html"; }, 1200);
        return;
      }

      // Password, name, or email changed on this account — keep the local session in sync.
      myProfile = row;
      setSession(row);
      document.getElementById("custName").textContent = myProfile.full_name || "Customer";
      document.getElementById("custEmail").textContent = myProfile.email || "";
    })
    .subscribe();
}

async function loadCompanySettings() {
  const { data } = await sb.from("company_settings").select("company_name, logo_url").eq("id", COMPANY_SETTINGS_ID).maybeSingle();
  if (!data) return;
  if (data.company_name) document.getElementById("companyNameTag").textContent = data.company_name;

  const brand = document.getElementById("sidebarBrand");
  if (brand && data.logo_url) {
    const existingImg = brand.querySelector("img");
    if (existingImg) {
      existingImg.src = data.logo_url;
    } else {
      const svg = brand.querySelector("svg");
      const img = document.createElement("img");
      img.src = data.logo_url;
      img.alt = "Logo";
      img.style.cssText = "width:26px;height:26px;object-fit:contain;border-radius:4px;";
      if (svg) svg.replaceWith(img);
    }
  }
}

/* ---------------- Stones list ---------------- */
async function loadStones() {
  const { data, error } = await sb.from("stones").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Could not load stones: " + error.message, "error"); return; }
  allStones = data || [];
  renderStones();
}

function renderStones() {
  const search = document.getElementById("stoneSearch").value.trim().toLowerCase();
  const status = document.getElementById("stoneStatusFilter").value;

  const rows = allStones.filter((s) => {
    const matchesSearch = !search || (s.stone_id || "").toLowerCase().includes(search) || (s.shape || "").toLowerCase().includes(search);
    const matchesStatus = !status || s.stock_status === status;
    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById("stonesTbody");
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <svg class="diamond-mark" viewBox="0 0 24 24"><path d="M4 9 L12 3 L20 9 L12 21 Z M4 9 L20 9 M9 9 L12 3 L15 9 M9 9 L12 21 M15 9 L12 21"/></svg>
      <h3>No stones found</h3><p>Try a different search or filter.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((s) => {
    const locked = s.stock_status === "sold";
    const checked = selectedIds.has(s.id) ? "checked" : "";
    return `
    <tr class="${selectedIds.has(s.id) ? "row-selected" : ""}" data-id="${s.id}">
      <td><input type="checkbox" class="chk row-chk" data-id="${s.id}" ${checked} ${locked ? "disabled" : ""} onchange="toggleRow('${s.id}', this.checked)" /></td>
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
      <td>
        <div class="row-actions">
          <button class="btn btn-sm" ${locked ? "disabled" : ""} onclick="quickAction('${s.id}', 'hold')">Hold</button>
          <button class="btn btn-sm btn-gold" ${locked ? "disabled" : ""} onclick="quickAction('${s.id}', 'confirm')">Confirm</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  updateBulkBar();
}

/* ---------------- Selection ---------------- */
function toggleRow(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.classList.toggle("row-selected", checked);
  updateBulkBar();
}

function toggleSelectAll(e) {
  const checked = e.target.checked;
  document.querySelectorAll(".row-chk:not(:disabled)").forEach((chk) => {
    chk.checked = checked;
    toggleRow(chk.dataset.id, checked);
  });
}

function clearSelection() {
  selectedIds.clear();
  document.getElementById("selectAllChk").checked = false;
  renderStones();
}

function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  const count = selectedIds.size;
  document.getElementById("bulkCount").textContent = count;
  bar.classList.toggle("show", count > 0);
}

/* ---------------- Action modal (bulk + quick single) ---------------- */
function openBulkModal(actionType) {
  if (selectedIds.size === 0) { showToast("Select at least one stone first", "error"); return; }
  pendingActionType = actionType;
  openActionModal(actionType, Array.from(selectedIds));
}

function quickAction(stoneId, actionType) {
  pendingActionType = actionType;
  openActionModal(actionType, [stoneId]);
}

let actionStoneIds = [];
function openActionModal(actionType, stoneIds) {
  actionStoneIds = stoneIds;
  const meta = ACTION_LABELS[actionType];
  document.getElementById("actionModalTitle").textContent = meta.label + " — " + stoneIds.length + " stone(s)";
  document.getElementById("actionModalDesc").textContent = meta.desc;
  document.getElementById("actionNote").value = "";
  document.getElementById("actionModalOverlay").classList.add("show");
}

function closeActionModal() {
  document.getElementById("actionModalOverlay").classList.remove("show");
}

async function submitAction() {
  const actionType = pendingActionType;
  const note = document.getElementById("actionNote").value.trim() || null;
  const btn = document.getElementById("actionSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner dark"></span> Sending…';

  const rows = actionStoneIds.map((stoneId) => ({
    stone_id: stoneId,
    customer_id: myProfile.id,
    customer_name: myProfile.full_name || null,
    customer_email: myProfile.email || null,
    action_type: actionType,
    status: "pending",
    note,
  }));

  const { error } = await sb.from("stone_requests").insert(rows);

  btn.disabled = false;
  btn.textContent = "Send request";

  if (error) { showToast("Could not send request: " + error.message, "error"); return; }

  showToast(`Request sent for ${rows.length} stone(s)`, "success");
  closeActionModal();
  clearSelection();
  loadMyRequests();
}

/* ---------------- My requests ---------------- */
async function loadMyRequests() {
  const { data, error } = await sb
    .from("stone_requests")
    .select("*, stones(stone_id, image_url)")
    .eq("customer_id", myProfile.id)
    .order("created_at", { ascending: false });
  if (error) { showToast("Could not load your requests: " + error.message, "error"); return; }
  myRequests = data || [];

  const tbody = document.getElementById("myRequestsTbody");
  if (myRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <svg class="diamond-mark" viewBox="0 0 24 24"><path d="M4 9 L12 3 L20 9 L12 21 Z M4 9 L20 9 M9 9 L12 3 L15 9 M9 9 L12 21 M15 9 L12 21"/></svg>
      <h3>No requests yet</h3><p>Select stones from the list and send a request to see it here.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = myRequests.map((r) => `
    <tr>
      <td>
        <div class="stone-cell">
          <img class="stone-thumb" style="width:44px;height:44px;" src="${escapeHtml(r.stones?.image_url) || PLACEHOLDER_IMG}" onerror="this.src='${PLACEHOLDER_IMG}'" />
          <div class="stone-id">${escapeHtml(r.stones?.stone_id || "—")}</div>
        </div>
      </td>
      <td style="text-transform:capitalize;">${escapeHtml((r.action_type || "").replace(/_/g, " "))}</td>
      <td>${escapeHtml(r.note || "—")}</td>
      <td>${badgeForStatus(r.status)}</td>
      <td>${fmtDate(r.created_at)}</td>
    </tr>
  `).join("");
}

/* ---------------- Lightbox ---------------- */
function openLightbox(url) {
  if (!url) return;
  document.getElementById("lightboxImg").src = url;
  document.getElementById("lightbox").classList.add("show");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("show");
}
