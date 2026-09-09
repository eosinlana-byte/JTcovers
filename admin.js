const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const loginView = $("#loginView");
const appView = $("#appView");
const viewContent = $("#viewContent");
const viewTitle = $("#viewTitle");
const modal = $("#modal");
const toastEl = $("#toast");

let currentView = "dashboard";

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    credentials: "same-origin",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function checkAuth() {
  try {
    const d = await api("/api/admin/check");
    return d.authenticated;
  } catch {
    return false;
  }
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  loadView(currentView);
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  $("#loginNote").textContent = "Signing in…";
  $("#loginNote").style.color = "#6e655b";
  if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        user: $("#loginUser").value.trim(),
        password: $("#loginPass").value,
      }),
    });
    showApp();
  } catch (err) {
    $("#loginNote").style.color = "#c45c4a";
    $("#loginNote").textContent = err.message || "Could not sign in.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  showLogin();
});

$$(".sidebar__nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".sidebar__nav button").forEach((b) => b.classList.toggle("active", b === btn));
    loadView(btn.dataset.view);
  });
});

modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) modal.classList.remove("open");
});

async function uploadFile(input) {
  const file = input.files && input.files[0];
  if (!file) return "";
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  modal.classList.add("open");
}

async function loadView(name) {
  currentView = name;
  viewTitle.textContent = { dashboard: "Dashboard", covers: "Covers", testimonials: "Testimonials", enquiries: "Enquiries" }[name];
  viewContent.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    if (name === "dashboard") return renderDashboard();
    if (name === "covers") return renderCovers();
    if (name === "testimonials") return renderTestimonials();
    if (name === "enquiries") return renderEnquiries();
  } catch (err) {
    viewContent.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function renderDashboard() {
  const [covers, testimonials, enquiries] = await Promise.all([
    api("/api/admin/covers"),
    api("/api/admin/testimonials"),
    api("/api/admin/enquiries"),
  ]);
  const unread = enquiries.filter((e) => e.status === "new").length;
  $("#enqBadge").hidden = unread === 0;
  $("#enqBadge").textContent = unread;
  viewContent.innerHTML = `
    <div class="cards">
      <div class="card"><span class="muted">Covers</span><b>${covers.length}</b></div>
      <div class="card"><span class="muted">Testimonials</span><b>${testimonials.length}</b></div>
      <div class="card"><span class="muted">New enquiries</span><b>${unread}</b></div>
    </div>
    <p class="muted">Use Covers to upload book covers. Use Testimonials for screenshots. Enquiries is your inbox.</p>
  `;
}

function coverForm(item = {}) {
  return `
    <form id="editForm">
      <div class="field"><label>Cover image *</label><input type="file" id="file" accept="image/*" /></div>
      ${item.image ? `<img class="preview" src="${item.image}" alt="" />` : ""}
      <input type="hidden" id="image" value="${item.image || ""}" />
      <div class="field"><label>Title *</label><input id="title" value="${item.title || ""}" required /></div>
      <div class="field"><label>Author</label><input id="author" value="${item.author || ""}" /></div>
      <div class="field"><label>Genre</label>
        <select id="genre">
          ${["christian","romance","fantasy","horror","crime","thriller","mystery","self-help","memoir"].map((g) => {
            const label = g === "self-help" ? "Self-Help" : g[0].toUpperCase() + g.slice(1);
            return `<option value="${g}" ${item.genre === g ? "selected" : ""}>${label}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="row-actions">
        <button class="btn btn--primary" type="submit">Save</button>
        <button class="btn btn--ghost" type="button" data-close>Cancel</button>
      </div>
    </form>
  `;
}

async function renderCovers() {
  const rows = await api("/api/admin/covers");
  viewContent.innerHTML = `
    <div class="toolbar">
      <p class="muted">${rows.length} cover${rows.length === 1 ? "" : "s"}</p>
      <button class="btn btn--primary" id="addBtn" style="width:auto">Add cover</button>
    </div>
    <table>
      <thead><tr><th></th><th>Title</th><th>Author</th><th>Genre</th><th></th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.image ? `<img class="thumb" src="${r.image}" alt="">` : ""}</td>
            <td>${r.title}</td>
            <td>${r.author || "-"}</td>
            <td>${r.genre || "-"}</td>
            <td class="row-actions">
              <button class="btn btn--ghost" data-edit="${r.id}">Edit</button>
              <button class="btn btn--danger" data-del="${r.id}">Delete</button>
            </td>
          </tr>
        `).join("") || `<tr><td colspan="5" class="muted">No covers yet. Click Add cover.</td></tr>`}
      </tbody>
    </table>
  `;

  $("#addBtn").onclick = () => openCoverModal();
  $$("[data-edit]").forEach((b) => b.onclick = () => openCoverModal(rows.find((r) => String(r.id) === b.dataset.edit)));
  $$("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirm("Delete this cover?")) return;
    await api("/api/admin/covers/" + b.dataset.del, { method: "DELETE" });
    toast("Deleted");
    renderCovers();
  });
}

function openCoverModal(item) {
  openModal(item ? "Edit cover" : "Add cover", coverForm(item || {}));
  $("#editForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      let image = $("#image").value;
      if ($("#file").files[0]) image = await uploadFile($("#file"));
      if (!image) return toast("Please upload a cover image.");
      const body = {
        title: $("#title").value.trim(),
        author: $("#author").value.trim(),
        genre: $("#genre").value,
        image,
      };
      if (item) await api("/api/admin/covers/" + item.id, { method: "PUT", body: JSON.stringify(body) });
      else await api("/api/admin/covers", { method: "POST", body: JSON.stringify(body) });
      modal.classList.remove("open");
      toast("Saved");
      renderCovers();
    } catch (err) {
      toast(err.message);
    }
  };
}

function testimonialForm(item = {}) {
  return `
    <form id="editForm">
      <div class="field"><label>Screenshot *</label><input type="file" id="file" accept="image/*" /></div>
      ${item.image ? `<img class="preview" src="${item.image}" alt="" />` : ""}
      <input type="hidden" id="image" value="${item.image || ""}" />
      <div class="field"><label>Name (optional)</label><input id="name" value="${item.name || ""}" /></div>
      <div class="field"><label>Role (optional)</label><input id="role" value="${item.role || ""}" /></div>
      <div class="row-actions">
        <button class="btn btn--primary" type="submit">Save</button>
        <button class="btn btn--ghost" type="button" data-close>Cancel</button>
      </div>
    </form>
  `;
}

async function renderTestimonials() {
  const rows = await api("/api/admin/testimonials");
  viewContent.innerHTML = `
    <div class="toolbar">
      <p class="muted">${rows.length} testimonial${rows.length === 1 ? "" : "s"}</p>
      <button class="btn btn--primary" id="addBtn" style="width:auto">Add screenshot</button>
    </div>
    <table>
      <thead><tr><th></th><th>Name</th><th></th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.image ? `<img class="thumb thumb--wide" src="${r.image}" alt="">` : ""}</td>
            <td>${r.name || "Screenshot"}</td>
            <td class="row-actions">
              <button class="btn btn--ghost" data-edit="${r.id}">Edit</button>
              <button class="btn btn--danger" data-del="${r.id}">Delete</button>
            </td>
          </tr>
        `).join("") || `<tr><td colspan="3" class="muted">No testimonials yet.</td></tr>`}
      </tbody>
    </table>
  `;
  $("#addBtn").onclick = () => openTModal();
  $$("[data-edit]").forEach((b) => b.onclick = () => openTModal(rows.find((r) => String(r.id) === b.dataset.edit)));
  $$("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirm("Delete this testimonial?")) return;
    await api("/api/admin/testimonials/" + b.dataset.del, { method: "DELETE" });
    toast("Deleted");
    renderTestimonials();
  });
}

function openTModal(item) {
  openModal(item ? "Edit testimonial" : "Add testimonial", testimonialForm(item || {}));
  $("#editForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      let image = $("#image").value;
      if ($("#file").files[0]) image = await uploadFile($("#file"));
      if (!image) return toast("Please upload a screenshot.");
      const body = { image, quote: "", name: $("#name").value.trim(), role: $("#role").value.trim() };
      if (item) await api("/api/admin/testimonials/" + item.id, { method: "PUT", body: JSON.stringify(body) });
      else await api("/api/admin/testimonials", { method: "POST", body: JSON.stringify(body) });
      modal.classList.remove("open");
      toast("Saved");
      renderTestimonials();
    } catch (err) {
      toast(err.message);
    }
  };
}

async function renderEnquiries() {
  const rows = await api("/api/admin/enquiries");
  const unread = rows.filter((e) => e.status === "new").length;
  $("#enqBadge").hidden = unread === 0;
  $("#enqBadge").textContent = unread;
  viewContent.innerHTML = `
    <table>
      <thead><tr><th>From</th><th>Service</th><th>Subject</th><th></th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td><b>${r.name}</b><br><a href="mailto:${r.email}">${r.email}</a><br><span class="muted">${new Date(r.created_at).toLocaleString()}</span></td>
            <td>${r.service || "-"}</td>
            <td>${r.subject}<br><span class="muted">${(r.message || "").slice(0, 80)}</span></td>
            <td class="row-actions">
              <button class="btn btn--ghost" data-open="${r.id}">Open</button>
              <button class="btn btn--danger" data-del="${r.id}">Delete</button>
            </td>
          </tr>
        `).join("") || `<tr><td colspan="4" class="muted">No enquiries yet.</td></tr>`}
      </tbody>
    </table>
  `;
  $$("[data-open]").forEach((b) => b.onclick = () => {
    const r = rows.find((x) => String(x.id) === b.dataset.open);
    openModal("Enquiry", `
      <p><b>${r.name}</b> · <a href="mailto:${r.email}">${r.email}</a></p>
      <p class="muted">${r.service} · ${r.subject}</p>
      <p style="white-space:pre-wrap;margin:16px 0">${r.message}</p>
      <div class="row-actions">
        <button class="btn btn--primary" id="markRead" style="width:auto">Mark read</button>
        <button class="btn btn--ghost" data-close>Close</button>
      </div>
    `);
    $("#markRead").onclick = async () => {
      await api("/api/admin/enquiries/" + r.id, { method: "PATCH", body: JSON.stringify({ status: "read" }) });
      modal.classList.remove("open");
      renderEnquiries();
    };
  });
  $$("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirm("Delete this enquiry?")) return;
    await api("/api/admin/enquiries/" + b.dataset.del, { method: "DELETE" });
    renderEnquiries();
  });
}

checkAuth().then((ok) => ok ? showApp() : showLogin());
