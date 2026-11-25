// XonaERP v2 — core: state, helpers, navigation, router.
// Page renderers live in pages1.js / pages2.js / pages3.js and register into window.PAGES.
// RULE: every number shown anywhere is computed from Supabase tables at render time.
(function () {
  "use strict";

  // ---------- tiny helpers ----------
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function fmt(v) { return "$" + num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(t) {
    if (!t) return "-";
    var d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " &middot; " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function fmtDay(t) {
    if (!t) return "-";
    return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid(prefix) {
    var d = new Date();
    var ymd = "" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return prefix + "-" + ymd + "-" + String(Date.now()).slice(-5);
  }
  function initials(name) {
    return String(name || "?").split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  }

  // ---------- global state ----------
  var X = {
    org: { business_name: "XonaERP", currency: "USD", tax_rate: 8.5, email: "", phone: "", address: "" },
    receipt: { header: "Thank you for shopping with us!", footer: "Please visit again!", show_logo: true, show_tax: true, show_cashier: true },
    branches: [],
    branchId: localStorage.getItem("xona_branch") || "all",
    profile: JSON.parse(localStorage.getItem("xona_profile") || '{"name":"Admin","email":"","phone":""}'),
    schemaMissing: false
  };
  function branchQ(params) { // add branch filter param when a specific branch is active
    if (X.branchId && X.branchId !== "all") params["branch_id"] = "eq." + X.branchId;
    return params;
  }
  function activeBranch() {
    return X.branches.find(function (b) { return b.id === X.branchId; }) || null;
  }

  // ---------- toast ----------
  function toast(msg, isErr) {
    var t = document.createElement("div");
    t.className = "toast" + (isErr ? " err" : "");
    t.textContent = msg;
    q("#toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }
  function errToast(e) {
    if (e && e.code === "PGRST205") { showSchemaBanner(); toast("Database tables not found. Run the migration first (see Setup page).", true); return; }
    if (e && e.code === "NOT_CONFIGURED") { toast("Supabase is not configured yet. Open the Setup page.", true); return; }
    toast("Error: " + ((e && e.message) || e), true);
  }

  // ---------- modal ----------
  function openModal(opts) {
    // opts: {title, sub, body, submitLabel, wide, hideFoot, onSubmit(formRoot) -> bool|Promise}
    var root = q("#modalRoot");
    root.innerHTML =
      '<div class="modal-backdrop"><div class="modal' + (opts.wide ? " wide" : "") + '">' +
      "<h2>" + esc(opts.title) + "</h2>" + (opts.sub ? '<div class="sub">' + esc(opts.sub) + "</div>" : "") +
      '<form id="modalForm">' + opts.body +
      (opts.hideFoot ? "" : '<div class="modal-foot"><button type="button" class="btn" id="modalCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + esc(opts.submitLabel || "Save") + "</button></div>") +
      "</form></div></div>";
    var cancel = q("#modalCancel", root);
    if (cancel) cancel.onclick = closeModal;
    q(".modal-backdrop", root).addEventListener("mousedown", function (e) { if (e.target === e.currentTarget) closeModal(); });
    q("#modalForm", root).addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!opts.onSubmit) { closeModal(); return; }
      var btn = q('button[type="submit"]', root);
      if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
      try {
        var keep = await opts.onSubmit(q("#modalForm", root));
        if (keep !== false) closeModal();
      } catch (err) { errToast(err); }
      if (btn) { btn.disabled = false; btn.textContent = opts.submitLabel || "Save"; }
    });
    var first = q("#modalForm input, #modalForm select, #modalForm textarea", root);
    if (first) first.focus();
    return root;
  }
  function closeModal() { q("#modalRoot").innerHTML = ""; }
  function field(label, inner, full) {
    return '<div class="field' + (full ? " full" : "") + '"><label>' + esc(label) + "</label>" + inner + "</div>";
  }
  function inp(id, val, attrs) {
    return '<input id="' + id + '" value="' + esc(val === null || val === undefined ? "" : val) + '" ' + (attrs || "") + ">";
  }
  function sel(id, options, val) {
    var h = '<select id="' + id + '">';
    options.forEach(function (o) {
      h += '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? " selected" : "") + ">" + esc(o.label) + "</option>";
    });
    return h + "</select>";
  }
  function val(id, root) { var e = q("#" + id, root); return e ? e.value.trim() : ""; }
  function confirmDelete(label, onYes) {
    openModal({
      title: "Delete " + label + "?", sub: "This cannot be undone.", body: "",
      submitLabel: "Delete",
      onSubmit: async function () { await onYes(); }
    });
    var btn = q('#modalForm button[type="submit"]');
    if (btn) btn.className = "btn btn-danger";
  }

  // ---------- audit ----------
  async function audit(action, details) {
    try { await DB.insert("audit_logs", { user_name: X.profile.name || "Admin", action: action, details: details || "" }); }
    catch (e) { /* audit must never break the main flow */ }
  }

  // ---------- shared UI ----------
  function emptyState(title, text, ctaHash, ctaLabel) {
    return '<div class="card empty"><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p>" +
      (ctaHash ? '<a class="btn btn-primary" href="' + ctaHash + '">' + esc(ctaLabel) + "</a>" : "") + "</div>";
  }
  function skeleton() { return '<div class="card"><div class="skeleton" style="width:40%"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>'; }
  function pageHead(title, sub, actionsHtml) {
    return '<div class="page-head"><div><h1>' + esc(title) + "</h1><p>" + esc(sub || "") + '</p></div><div class="spacer"></div>' + (actionsHtml || "") + "</div>";
  }
  function pill(status) {
    var s = String(status || "");
    var cls = /paid|received|active|refunded|processed|completed/i.test(s) ? "green" :
      /overdue|rejected|cancelled|inactive/i.test(s) ? "red" :
      /pending|partial|due|transit|approved/i.test(s) ? "amber" : "grey";
    return '<span class="pill ' + cls + '">' + esc(s) + "</span>";
  }
  function kpi(label, value, hint, cls) {
    return '<div class="kpi ' + (cls || "") + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div><div class="hint">' + esc(hint || "") + "</div></div>";
  }
  function csvExport(filename, rows) {
    if (!rows.length) { toast("Nothing to export"); return; }
    var keys = Object.keys(rows[0]);
    var lines = [keys.join(",")].concat(rows.map(function (r) {
      return keys.map(function (k) {
        var v = r[k] === null || r[k] === undefined ? "" : String(r[k]);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(",");
    }));
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = filename; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function searchFilter(rows, text, fields) {
    if (!text) return rows;
    var t = text.toLowerCase();
    return rows.filter(function (r) {
      return fields.some(function (f) { return String(r[f] || "").toLowerCase().indexOf(t) >= 0; });
    });
  }

  // ---------- navigation ----------
  var NAV = [
    { group: "Operations", items: [
      { hash: "#/dashboard", label: "Dashboard" },
      { hash: "#/pos", label: "POS Billing" },
      { hash: "#/sales", label: "Sales Invoices" },
      { hash: "#/returns", label: "Sales Returns" } ] },
    { group: "Catalog & Inventory", items: [
      { hash: "#/products", label: "Products" },
      { hash: "#/categories", label: "Categories & Brands" },
      { hash: "#/inventory", label: "Stock & Inventory" },
      { hash: "#/transfers", label: "Stock Transfers" } ] },
    { group: "Procurement", items: [
      { hash: "#/purchases", label: "Purchases (PO)" },
      { hash: "#/purchase-returns", label: "Purchase Returns" },
      { hash: "#/suppliers", label: "Suppliers & Dues" } ] },
    { group: "CRM & Accounts", items: [
      { hash: "#/customers", label: "Customers & Credit" },
      { hash: "#/expenses", label: "Expenses" },
      { hash: "#/financials", label: "Financials & P&L" } ] },
    { group: "Insights & Admin", items: [
      { hash: "#/reports", label: "Reports & Analytics" },
      { hash: "#/employees", label: "Employees & Staff" },
      { hash: "#/roles", label: "Roles & Permissions" },
      { hash: "#/branches", label: "Branch Locations" },
      { hash: "#/audit", label: "Audit Logs" },
      { hash: "#/settings", label: "Settings & Branding" },
      { hash: "#/setup", label: "Supabase Setup" } ] }
  ];
  function dotIcon() {
    return '<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor"/></svg>';
  }
  function renderNav() {
    var closed = JSON.parse(localStorage.getItem("xona_nav_closed") || "[]");
    q("#nav").innerHTML = NAV.map(function (g, gi) {
      var items = g.items.map(function (it) {
        return '<a class="nav-item" data-hash="' + it.hash + '" href="' + it.hash + '">' + dotIcon() + esc(it.label) + "</a>";
      }).join("");
      return '<div class="nav-group' + (closed.indexOf(gi) >= 0 ? " closed" : "") + '" data-gi="' + gi + '">' +
        '<button class="nav-group-head" type="button">' + esc(g.group) + '<span class="chev">&#9662;</span></button>' +
        '<div class="nav-items">' + items + "</div></div>";
    }).join("");
    qa(".nav-group-head").forEach(function (btn) {
      btn.onclick = function () {
        var grp = btn.parentElement, gi = +grp.dataset.gi, list = JSON.parse(localStorage.getItem("xona_nav_closed") || "[]");
        grp.classList.toggle("closed");
        var isClosed = grp.classList.contains("closed");
        list = list.filter(function (i) { return i !== gi; });
        if (isClosed) list.push(gi);
        localStorage.setItem("xona_nav_closed", JSON.stringify(list));
      };
    });
    markActiveNav();
  }
  function markActiveNav() {
    var cur = "#/" + currentRoute().page;
    qa(".nav-item").forEach(function (a) { a.classList.toggle("active", a.dataset.hash === cur); });
  }

  // ---------- router ----------
  function currentRoute() {
    var h = (location.hash || "#/dashboard").replace(/^#\//, "");
    var parts = h.split("/");
    return { page: parts[0] || "dashboard", arg: parts[1] || null };
  }
  async function render() {
    var r = currentRoute();
    markActiveNav();
    closeSidebarMobile();
    var page = q("#page");
    if (!DB.configured() && r.page !== "setup") { location.hash = "#/setup"; return; }
    var fn = (window.PAGES || {})[r.page];
    if (!fn) { page.innerHTML = emptyState("Page not found", "This route does not exist.", "#/dashboard", "Go to Dashboard"); return; }
    page.innerHTML = skeleton();
    try { await fn(page, r.arg); }
    catch (e) { errToast(e); page.innerHTML = emptyState("Could not load this page", (e && e.message) || String(e), null, ""); }
    window.scrollTo(0, 0);
  }

  // ---------- topbar ----------
  function renderBranchSwitcher() {
    var s = q("#branchSwitcher");
    var opts = [{ value: "all", label: "All Branches" }].concat(X.branches.filter(function (b) { return b.is_active !== false; })
      .map(function (b) { return { value: b.id, label: b.name }; }));
    s.innerHTML = opts.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === X.branchId ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("");
  }
  async function loadCommon() {
    try {
      X.branches = await DB.get("branches", { select: "*", order: "name.asc", limit: 200 });
      var settings = await DB.get("app_settings", { select: "*" });
      settings.forEach(function (row) {
        if (row.key === "org") X.org = Object.assign(X.org, row.value || {});
        if (row.key === "receipt") X.receipt = Object.assign(X.receipt, row.value || {});
      });
      X.schemaMissing = false;
      hideSchemaBanner();
    } catch (e) {
      if (e.code === "PGRST205") { X.schemaMissing = true; showSchemaBanner(); }
    }
    renderBranchSwitcher();
  }
  function showSchemaBanner() {
    var b = q("#setupBanner");
    b.classList.remove("hidden");
    b.innerHTML = "Database tables are not created yet. Run the project migration <b>supabase/migrations/20261122140000_initial_schema.sql</b> " +
      "(via <b>supabase db push</b> or paste it once in the Supabase SQL Editor), then reload. Details on the <a href='#/setup'>Supabase Setup</a> page.";
  }
  function hideSchemaBanner() { q("#setupBanner").classList.add("hidden"); }

  function closeSidebarMobile() { q("#sidebar").classList.remove("open"); q("#scrim").classList.remove("show"); }

  function initSearch() {
    var input = q("#globalSearch"), box = q("#searchResults");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var text = input.value.trim();
      if (text.length < 2) { box.classList.add("hidden"); return; }
      timer = setTimeout(async function () {
        try {
          var like = "*" + text + "*";
          var results = [];
          var prods = await DB.get("products", { select: "id,name,sku,price", or: "(name.ilike." + like + ",sku.ilike." + like + ")", limit: 5 });
          prods.forEach(function (p) { results.push({ label: p.name, sub: "Product &middot; " + esc(p.sku) + " &middot; " + fmt(p.price), hash: "#/products" }); });
          var custs = await DB.get("customers", { select: "id,name,email", name: "ilike." + like, limit: 5 });
          custs.forEach(function (c) { results.push({ label: c.name, sub: "Customer &middot; " + esc(c.email || ""), hash: "#/customers" }); });
          var sales = await DB.get("sales", { select: "id,invoice_no,total", invoice_no: "ilike." + like, limit: 5 });
          sales.forEach(function (s) { results.push({ label: s.invoice_no, sub: "Invoice &middot; " + fmt(s.total), hash: "#/sale/" + s.id }); });
          box.innerHTML = results.length ? results.map(function (r) {
            return '<a href="' + r.hash + '"><b>' + esc(r.label) + "</b><small>" + r.sub + "</small></a>";
          }).join("") : '<a>No results found</a>';
          box.classList.remove("hidden");
        } catch (e) { box.classList.add("hidden"); }
      }, 250);
    });
    document.addEventListener("click", function (e) { if (!box.contains(e.target) && e.target !== input) box.classList.add("hidden"); });
    box.addEventListener("click", function () { box.classList.add("hidden"); input.value = ""; });
  }

  // ---------- init ----------
  function initTheme() {
    var theme = localStorage.getItem("xona_theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
  }
  document.addEventListener("DOMContentLoaded", async function () {
    initTheme();
    renderNav();
    q("#darkToggle").onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", cur);
      localStorage.setItem("xona_theme", cur);
    };
    q("#hamburger").onclick = function () { q("#sidebar").classList.add("open"); q("#scrim").classList.add("show"); };
    q("#sidebarClose").onclick = closeSidebarMobile;
    q("#scrim").onclick = closeSidebarMobile;
    q("#profileBtn").onclick = function () { location.hash = "#/profile"; };
    q("#profileBtn").textContent = initials(X.profile.name);
    q("#branchSwitcher").onchange = function (e) {
      X.branchId = e.target.value;
      localStorage.setItem("xona_branch", X.branchId);
      render();
    };
    initSearch();
    if (DB.configured()) await loadCommon();
    window.addEventListener("hashchange", render);
    render();
  });

  // expose helpers to page modules
  window.X = X;
  window.H = {
    esc: esc, num: num, fmt: fmt, fmtDate: fmtDate, fmtDay: fmtDay, q: q, qa: qa, uid: uid, initials: initials,
    toast: toast, errToast: errToast, openModal: openModal, closeModal: closeModal, field: field, inp: inp, sel: sel, val: val,
    confirmDelete: confirmDelete, audit: audit, emptyState: emptyState, skeleton: skeleton, pageHead: pageHead,
    pill: pill, kpi: kpi, csvExport: csvExport, searchFilter: searchFilter, branchQ: branchQ, activeBranch: activeBranch,
    reloadCommon: loadCommon, render: render
  };
})();
