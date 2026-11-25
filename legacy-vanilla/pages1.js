// XonaERP — pages part 1: Dashboard, POS, Sales, Invoice detail, Sales Returns.
// Every figure below is computed from Supabase rows fetched at render time.
window.PAGES = window.PAGES || {};
(function () {
  var H = window.H, X = window.X;

  function inRange(iso, from, to) { var t = new Date(iso).getTime(); return t >= from && t <= to; }
  function rangeFor(key) {
    var now = new Date(); var end = now.getTime(); var start;
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (key === "today") start = dayStart;
    else if (key === "yesterday") { start = dayStart - 864e5; end = dayStart - 1; }
    else if (key === "7d") start = dayStart - 6 * 864e5;
    else if (key === "30d") start = dayStart - 29 * 864e5;
    else if (key === "month") start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    else start = 0; // all
    return { from: start, to: end };
  }

  // ---------------- Dashboard ----------------
  var dashRange = "today";
  window.PAGES.dashboard = async function (root) {
    var salesP = H.branchQ({ select: "*", order: "created_at.desc", limit: 1000 });
    var expP = H.branchQ({ select: "*", order: "expense_date.desc", limit: 1000 });
    var purP = H.branchQ({ select: "*", order: "created_at.desc", limit: 1000 });
    var data = await Promise.all([
      DB.get("sales", salesP), DB.get("sale_items", { select: "*", limit: 5000 }),
      DB.get("expenses", expP), DB.get("purchases", purP),
      DB.get("products", { select: "*", limit: 1000 }), DB.get("customers", { select: "id,name", limit: 1000 }),
      DB.get("categories", { select: "*" })
    ]);
    var sales = data[0], items = data[1], expenses = data[2], purchases = data[3],
      products = data[4], customers = data[5], categories = data[6];
    var r = rangeFor(dashRange);
    var salesR = sales.filter(function (s) { return inRange(s.created_at, r.from, r.to); });
    var expR = expenses.filter(function (e) { return inRange(e.expense_date || e.created_at, r.from, r.to); });
    var saleIds = {}; salesR.forEach(function (s) { saleIds[s.id] = s; });
    var itemsR = items.filter(function (i) { return saleIds[i.sale_id]; });

    var totalSales = salesR.reduce(function (a, s) { return a + H.num(s.total); }, 0);
    var cogs = itemsR.reduce(function (a, i) { return a + H.num(i.cost) * H.num(i.qty); }, 0);
    var gross = totalSales - salesR.reduce(function (a, s) { return a + H.num(s.tax_amount); }, 0) - cogs;
    // Note: gross profit here = (sales total - tax collected) - COGS, all from real rows.
    var totalExp = expR.reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    var net = gross - totalExp;
    var dues = sales.reduce(function (a, s) { return a + Math.max(0, H.num(s.total) - H.num(s.amount_paid)); }, 0);
    var payables = purchases.reduce(function (a, p) { return a + Math.max(0, H.num(p.total) - H.num(p.amount_paid)); }, 0);
    var lowStock = products.filter(function (p) { return H.num(p.stock) <= H.num(p.low_stock_at); });
    var invValue = products.reduce(function (a, p) { return a + H.num(p.stock) * H.num(p.cost); }, 0);
    var invRetail = products.reduce(function (a, p) { return a + H.num(p.stock) * H.num(p.price); }, 0);

    // Trend buckets
    var buckets = [];
    if (dashRange === "today" || dashRange === "yesterday") {
      var base = new Date(r.from);
      for (var h = 0; h < 24; h += 3) buckets.push({ label: String(h).padStart(2, "0") + ":00", from: base.getTime() + h * 36e5, to: base.getTime() + (h + 3) * 36e5, value: 0 });
    } else {
      var days = dashRange === "7d" ? 7 : dashRange === "30d" ? 30 : 14;
      for (var d = days - 1; d >= 0; d--) {
        var ds = new Date(); ds.setHours(0, 0, 0, 0); ds.setDate(ds.getDate() - d);
        buckets.push({ label: ds.toLocaleDateString("en-US", { month: "short", day: "numeric" }), from: ds.getTime(), to: ds.getTime() + 864e5, value: 0 });
      }
    }
    salesR.forEach(function (s) {
      var t = new Date(s.created_at).getTime();
      buckets.forEach(function (b) { if (t >= b.from && t < b.to) b.value += H.num(s.total); });
    });
    var maxB = Math.max.apply(null, buckets.map(function (b) { return b.value; }).concat([1]));
    var barsHtml = buckets.map(function (b) {
      return '<div class="bar-col"><b>' + (b.value ? H.fmt(b.value) : "") + '</b><div class="bar" style="height:' + Math.max(2, (b.value / maxB) * 120) + 'px"></div><small>' + b.label + "</small></div>";
    }).join("");

    // Category share from real sale_items -> product -> category
    var prodById = {}; products.forEach(function (p) { prodById[p.id] = p; });
    var catById = {}; categories.forEach(function (c) { catById[c.id] = c.name; });
    var shareMap = {};
    itemsR.forEach(function (i) {
      var p = prodById[i.product_id];
      var cat = p && p.category_id ? (catById[p.category_id] || "Uncategorized") : "Uncategorized";
      shareMap[cat] = (shareMap[cat] || 0) + H.num(i.line_total);
    });
    var shareTotal = Object.keys(shareMap).reduce(function (a, k) { return a + shareMap[k]; }, 0);
    var shareHtml = shareTotal ? Object.keys(shareMap).sort(function (a, b) { return shareMap[b] - shareMap[a]; }).map(function (k) {
      var pct = Math.round((shareMap[k] / shareTotal) * 100);
      return '<div class="share-row"><div class="lbl"><span>' + H.esc(k) + '</span><b>' + pct + '%</b></div><div class="share-track"><div class="share-fill" style="width:' + pct + '%"></div></div></div>';
    }).join("") : '<p style="color:var(--muted)">No sales in this period yet.</p>';

    var custNameById = {}; customers.forEach(function (c) { custNameById[c.id] = c.name; });
    sales.forEach(function (s) { s._cust = s.customer_id ? (custNameById[s.customer_id] || "Customer") : "Walk-in Customer"; });
    var branchName = H.activeBranch() ? H.activeBranch().name : "All Branches";
    var recent = sales.slice(0, 8);
    root.innerHTML =
      H.pageHead("Executive Business Dashboard", "Real-time overview for " + branchName,
        '<select id="dashRange" style="width:auto">' +
        [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["month", "This Month"], ["all", "All Time"]]
          .map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === dashRange ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        '</select> <a class="btn btn-primary" href="#/pos">Open POS Terminal</a>') +
      '<div class="grid kpis">' +
      H.kpi("Total Sales", H.fmt(totalSales), salesR.length + (salesR.length === 1 ? " invoice" : " invoices")) +
      H.kpi("Gross Profit", H.fmt(gross), "Revenue (ex tax) - COGS", gross < 0 ? "bad" : "good") +
      H.kpi("Net Profit", H.fmt(net), "After expenses", net < 0 ? "bad" : "good") +
      H.kpi("Total Expenses", H.fmt(totalExp), "In selected period") +
      H.kpi("Customer Dues", H.fmt(dues), "Accounts receivable", dues > 0 ? "warn" : "") +
      H.kpi("Supplier Payables", H.fmt(payables), "Accounts payable", payables > 0 ? "warn" : "") +
      H.kpi("Total Products", products.length, "In active catalog") +
      H.kpi("Low Stock Alert", lowStock.length, lowStock.length ? lowStock.map(function (p) { return p.name; }).join(", ") : "All stocked", lowStock.length ? "warn" : "") +
      H.kpi("Inventory Value (Cost)", H.fmt(invValue), "Retail: " + H.fmt(invRetail)) +
      H.kpi("Customer Base", customers.length, "Registered customers") +
      "</div>" +
      '<div class="grid cols-2" style="margin-top:14px">' +
      '<div class="card"><h3>Sales Activity Trend</h3><div class="sub">Computed from sales in the selected period</div><div class="bars">' + barsHtml + "</div></div>" +
      '<div class="card"><h3>Category Revenue Share</h3><div class="sub">From sold items and their real product categories</div>' + shareHtml + "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:14px"><h3>Recent Sales &amp; Checkout Invoices</h3><div class="sub">Latest sales across terminals &middot; <a href="#/sales">View All Sales</a></div>' +
      (recent.length ? '<div class="table-wrap"><table><thead><tr><th>Invoice No</th><th>Date &amp; Time</th><th>Customer</th><th class="num">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>' +
        recent.map(function (s) {
          return "<tr><td><b>" + H.esc(s.invoice_no) + "</b></td><td>" + H.fmtDate(s.created_at) + "</td><td>" + H.esc(s._cust) + '</td><td class="num">' + H.fmt(s.total) + "</td><td>" + H.esc(s.payment_method) + "</td><td>" + H.pill(s.status) + '</td><td><a class="btn btn-sm" href="#/sale/' + s.id + '">Receipt</a></td></tr>';
        }).join("") + "</tbody></table></div>"
        : '<div class="empty"><h3>No sales yet</h3><p>Sales you make in POS will appear here.</p><a class="btn btn-primary" href="#/pos">Open POS</a></div>') +
      "</div>";
    H.q("#dashRange", root).onchange = function (e) { dashRange = e.target.value; window.PAGES.dashboard(root); };
  };

  // ---------------- POS ----------------
  var cart = [];
  var posCat = "all", posSearch = "", posCustomer = "";
  function holds() { try { return JSON.parse(localStorage.getItem("xona_holds") || "[]"); } catch (e) { return []; } }
  function saveHolds(h) { localStorage.setItem("xona_holds", JSON.stringify(h)); }

  window.PAGES.pos = async function (root) {
    var data = await Promise.all([
      DB.get("products", { select: "*", order: "name.asc", limit: 1000, is_active: "eq.true" }),
      DB.get("categories", { select: "*", order: "name.asc" }),
      DB.get("customers", { select: "*", order: "name.asc", limit: 500 })
    ]);
    var products = data[0], categories = data[1], customers = data[2];
    var catName = {}; categories.forEach(function (c) { catName[c.id] = c.name; });
    var taxRate = H.num(X.org.tax_rate);

    function totals() {
      var sub = cart.reduce(function (a, l) { return a + l.price * l.qty; }, 0);
      var discPct = H.num((H.q("#posDiscount", root) || {}).value);
      var disc = sub * discPct / 100;
      var tax = (sub - disc) * taxRate / 100;
      var raw = sub - disc + tax;
      var rounded = Math.round(raw * 100) / 100;
      return { sub: sub, discPct: discPct, disc: disc, tax: tax, rounding: rounded - raw, total: rounded };
    }
    function renderCart() {
      var box = H.q("#cartLines", root);
      if (!cart.length) {
        box.innerHTML = '<div class="empty" style="padding:26px"><h3>Your cart is empty</h3><p>Search and add products to begin a sale.</p></div>';
      } else {
        box.innerHTML = cart.map(function (l, i) {
          return '<div class="cart-line"><div class="grow"><b>' + H.esc(l.name) + "</b><small>" + H.fmt(l.price) + ' each</small></div>' +
            '<span class="stepper"><button data-dec="' + i + '">-</button><span>' + l.qty + '</span><button data-inc="' + i + '">+</button></span>' +
            "<b>" + H.fmt(l.price * l.qty) + '</b><button class="btn btn-ghost btn-sm" data-del="' + i + '" title="Remove">&times;</button></div>';
        }).join("");
      }
      var t = totals();
      H.q("#ctSub", root).textContent = H.fmt(t.sub);
      H.q("#ctDisc", root).textContent = "-" + H.fmt(t.disc);
      H.q("#ctTax", root).textContent = H.fmt(t.tax);
      H.q("#ctRound", root).textContent = H.fmt(t.rounding);
      H.q("#ctTotal", root).textContent = H.fmt(t.total);
      H.q("#payBtn", root).disabled = !cart.length;
      H.qa("[data-inc]", box).forEach(function (b) { b.onclick = function () { cart[+b.dataset.inc].qty++; renderCart(); }; });
      H.qa("[data-dec]", box).forEach(function (b) { b.onclick = function () { var i = +b.dataset.dec; cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); renderCart(); }; });
      H.qa("[data-del]", box).forEach(function (b) { b.onclick = function () { cart.splice(+b.dataset.del, 1); renderCart(); }; });
    }
    function renderGrid() {
      var list = products.filter(function (p) {
        if (posCat !== "all" && p.category_id !== posCat) return false;
        if (posSearch && (p.name + " " + p.sku).toLowerCase().indexOf(posSearch.toLowerCase()) < 0) return false;
        return true;
      });
      H.q("#prodGrid", root).innerHTML = list.length ? list.map(function (p) {
        return '<div class="prod-card">' +
          (p.image_url ? '<img src="' + H.esc(p.image_url) + '" alt="">' : '<div class="pimg">' + H.esc(H.initials(p.name)) + "</div>") +
          "<h4>" + H.esc(p.name) + '</h4><div class="meta">' + H.esc(catName[p.category_id] || "Uncategorized") + " &middot; Stock: " + H.num(p.stock) + '</div>' +
          '<div class="price">' + H.fmt(p.price) + '</div>' +
          '<button class="btn btn-primary btn-sm" data-add="' + p.id + '"' + (H.num(p.stock) <= 0 ? " disabled" : "") + ">Add to Cart</button></div>";
      }).join("") : '<div class="empty"><h3>No products found</h3><p>Add products first, or change the search.</p><a class="btn btn-primary" href="#/products">Go to Products</a></div>';
      H.qa("[data-add]", root).forEach(function (b) {
        b.onclick = function () {
          var p = products.find(function (x) { return x.id === b.dataset.add; });
          var line = cart.find(function (x) { return x.id === p.id; });
          if (line) line.qty++; else cart.push({ id: p.id, name: p.name, price: H.num(p.price), cost: H.num(p.cost), qty: 1 });
          renderCart();
        };
      });
    }

    root.innerHTML =
      H.pageHead("Point of Sale", "Fast checkout & receipt generation",
        '<span class="btn-row"><button class="btn" id="holdBtn">Hold (' + holds().length + ')</button><button class="btn" id="resumeBtn">Resume</button><a class="btn" href="#/sales">View Sales</a></span>') +
      '<div class="pos-layout"><div class="card">' +
      '<div class="toolbar"><input type="search" id="posSearch" placeholder="Search products...">' +
      '<select id="posCustomer"><option value="">Walk-in Customer</option>' +
      customers.map(function (c) { return '<option value="' + c.id + '">' + H.esc(c.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="chips"><button class="chip' + (posCat === "all" ? " active" : "") + '" data-cat="all">All (' + products.length + ")</button>" +
      categories.map(function (c) {
        var n = products.filter(function (p) { return p.category_id === c.id; }).length;
        return '<button class="chip' + (posCat === c.id ? " active" : "") + '" data-cat="' + c.id + '">' + H.esc(c.name) + " (" + n + ")</button>";
      }).join("") + "</div>" +
      '<div class="prod-grid" id="prodGrid"></div></div>' +
      '<div class="card"><h3>Current Sale</h3><div id="cartLines"></div>' +
      '<div class="totals">' +
      '<div class="row"><span>Subtotal</span><b id="ctSub">$0.00</b></div>' +
      '<div class="row"><span>Discount %</span><input id="posDiscount" type="number" min="0" max="100" value="0" style="width:80px"></div>' +
      '<div class="row"><span>Discount</span><b id="ctDisc">$0.00</b></div>' +
      '<div class="row"><span>Tax (' + taxRate + '%)</span><b id="ctTax">$0.00</b></div>' +
      '<div class="row"><span>Rounding</span><b id="ctRound">$0.00</b></div>' +
      '<div class="row grand"><span>Total</span><span id="ctTotal">$0.00</span></div></div>' +
      '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="payBtn" style="flex:1">Checkout — Pay Now</button>' +
      '<button class="btn" id="clearBtn">Clear Cart</button></div></div></div>';

    H.q("#posSearch", root).oninput = function (e) { posSearch = e.target.value; renderGrid(); };
    H.q("#posDiscount", root).oninput = renderCart;
    H.qa("[data-cat]", root).forEach(function (b) { b.onclick = function () { posCat = b.dataset.cat; window.PAGES.pos(root); }; });
    H.q("#clearBtn", root).onclick = function () { cart = []; renderCart(); };
    H.q("#holdBtn", root).onclick = function () {
      if (!cart.length) { H.toast("Cart is empty — nothing to hold"); return; }
      var h = holds(); h.push({ at: Date.now(), customer: H.q("#posCustomer", root).value, lines: cart });
      saveHolds(h); cart = []; H.toast("Sale held"); window.PAGES.pos(root);
    };
    H.q("#resumeBtn", root).onclick = function () {
      var h = holds();
      if (!h.length) { H.toast("No held sales"); return; }
      var body = h.map(function (x, i) {
        var tot = x.lines.reduce(function (a, l) { return a + l.price * l.qty; }, 0);
        return '<div class="switch-row"><span>' + new Date(x.at).toLocaleString() + " &middot; " + x.lines.length + " item(s) &middot; " + H.fmt(tot) + '</span><button type="button" class="btn btn-sm btn-primary" data-resume="' + i + '">Resume</button></div>';
      }).join("");
      var m = H.openModal({ title: "Held Sales", body: body, hideFoot: true });
      H.qa("[data-resume]", m).forEach(function (b) {
        b.onclick = function () {
          var hh = holds(); var item = hh.splice(+b.dataset.resume, 1)[0]; saveHolds(hh);
          cart = item.lines || []; H.closeModal(); window.PAGES.pos(root);
        };
      });
    };
    H.q("#payBtn", root).onclick = function () {
      var t = totals();
      var method = "Cash";
      var body =
        '<div class="totals"><div class="row grand"><span>Total Amount Due</span><span>' + H.fmt(t.total) + "</span></div></div>" +
        '<label style="margin-top:12px">Payment Method</label><div class="pay-methods">' +
        ["Cash", "Card", "Digital Wallet"].map(function (m2) { return '<button type="button" data-m="' + m2 + '"' + (m2 === "Cash" ? ' class="active"' : "") + ">" + m2 + "</button>"; }).join("") + "</div>" +
        H.field("Cash Received", H.inp("f_received", "", 'type="number" min="0" step="0.01" placeholder="0.00"')) +
        '<div class="quick-amts">' + [10, 20, 50, 100].map(function (a) { return '<button type="button" data-q="' + a + '">$' + a + "</button>"; }).join("") +
        '<button type="button" data-q="' + t.total + '">Exact ' + H.fmt(t.total) + "</button></div>" +
        '<div class="row" style="display:flex;justify-content:space-between"><span>Change Due</span><span class="change-due" id="changeDue">$0.00</span></div>';
      var m = H.openModal({
        title: "Complete Payment", body: body, submitLabel: "Complete Sale — " + H.fmt(t.total),
        onSubmit: async function () {
          var received = H.num(H.val("f_received", m)) || t.total;
          var custSel = H.q("#posCustomer", root);
          var custId = custSel.value || null;
          var custName = custSel.options[custSel.selectedIndex].text;
          var invoiceNo = H.uid("INV");
          var saleRows = await DB.insert("sales", {
            invoice_no: invoiceNo, customer_id: custId,
            branch_id: X.branchId !== "all" ? X.branchId : (X.branches.find(function (b) { return b.is_main; }) || {}).id || null,
            cashier_name: X.profile.name || "Admin", payment_method: method,
            status: received >= t.total ? "Paid" : "Partial",
            subtotal: +t.sub.toFixed(2), discount: +t.disc.toFixed(2), tax_rate: taxRate,
            tax_amount: +t.tax.toFixed(2), total: t.total, amount_paid: Math.min(received, t.total)
          });
          var sale = saleRows[0];
          for (var i = 0; i < cart.length; i++) {
            var l = cart[i];
            await DB.insert("sale_items", { sale_id: sale.id, product_id: l.id, product_name: l.name, price: l.price, cost: l.cost, qty: l.qty, line_total: +(l.price * l.qty).toFixed(2) });
            var fresh = await DB.get("products", { select: "stock", id: "eq." + l.id });
            if (fresh.length) await DB.update("products", l.id, { stock: H.num(fresh[0].stock) - l.qty });
            await DB.insert("stock_movements", { product_id: l.id, branch_id: sale.branch_id, type: "Sale", qty: -l.qty, ref: invoiceNo, note: "POS sale to " + custName });
          }
          await H.audit("Create", "Sale " + invoiceNo + " total " + H.fmt(t.total) + " via " + method);
          cart = [];
          H.toast("Sale completed: " + invoiceNo);
          location.hash = "#/sale/" + sale.id;
        }
      });
      H.qa("[data-m]", m).forEach(function (b) {
        b.onclick = function () { method = b.dataset.m; H.qa("[data-m]", m).forEach(function (x) { x.classList.toggle("active", x === b); }); };
      });
      var upd = function () {
        var received = H.num(H.val("f_received", m));
        H.q("#changeDue", m).textContent = H.fmt(Math.max(0, received - t.total));
      };
      H.q("#f_received", m).addEventListener("input", upd);
      H.qa("[data-q]", m).forEach(function (b) { b.onclick = function () { H.q("#f_received", m).value = b.dataset.q; upd(); }; });
    };
    renderGrid(); renderCart();
  };

  // ---------------- Sales list ----------------
  window.PAGES.sales = async function (root) {
    var data = await Promise.all([
      DB.get("sales", H.branchQ({ select: "*", order: "created_at.desc", limit: 1000 })),
      DB.get("customers", { select: "id,name" })
    ]);
    var sales = data[0];
    var custName = {}; data[1].forEach(function (c) { custName[c.id] = c.name; });
    sales.forEach(function (s) { s._cust = s.customer_id ? (custName[s.customer_id] || "Customer") : "Walk-in Customer"; });
    var revenue = sales.reduce(function (a, s) { return a + H.num(s.total); }, 0);
    var paid = sales.filter(function (s) { return s.status === "Paid"; }).length;
    var discounts = sales.reduce(function (a, s) { return a + H.num(s.discount); }, 0);

    function draw(list) {
      H.q("#salesTable", root).innerHTML = list.length ?
        '<div class="table-wrap"><table><thead><tr><th>Invoice ID</th><th>Date</th><th>Customer</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (s) {
          return "<tr><td><b>" + H.esc(s.invoice_no) + "</b></td><td>" + H.fmtDate(s.created_at) + "</td><td>" + H.esc(s._cust) + '</td><td class="num">' + H.fmt(s.total) + "</td><td>" + H.pill(s.status) + '</td><td><a class="btn btn-sm" href="#/sale/' + s.id + '">View</a></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No invoices found", "Sales made in POS will appear here.", "#/pos", "New Sale");
    }
    root.innerHTML =
      H.pageHead("Sales Invoices", "View, print and manage customer invoices",
        '<span class="btn-row"><button class="btn" id="csvBtn">Export CSV</button><a class="btn btn-primary" href="#/pos">New Sale</a></span>') +
      '<div class="grid kpis">' +
      H.kpi("Total Revenue", H.fmt(revenue), sales.length + " invoices") +
      H.kpi("Total Invoices", sales.length, "Processed sales") +
      H.kpi("Paid Invoices", paid, "Fully settled") +
      H.kpi("Total Discount", H.fmt(discounts), "Discounts given") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="toolbar">' +
      '<input type="search" id="sSearch" placeholder="Search by invoice #, customer...">' +
      '<select id="sStatus"><option value="">All Status</option><option>Paid</option><option>Partial</option><option>Pending</option><option>Refunded</option></select>' +
      '<select id="sSort"><option value="new">Newest First</option><option value="old">Oldest First</option><option value="high">Highest Amount</option><option value="low">Lowest Amount</option></select></div>' +
      '<div id="salesTable"></div></div>';
    function apply() {
      var list = H.searchFilter(sales, H.q("#sSearch", root).value, ["invoice_no", "_cust"]);
      var st = H.q("#sStatus", root).value;
      if (st) list = list.filter(function (s) { return s.status === st; });
      var sort = H.q("#sSort", root).value;
      list = list.slice().sort(function (a, b) {
        if (sort === "old") return new Date(a.created_at) - new Date(b.created_at);
        if (sort === "high") return H.num(b.total) - H.num(a.total);
        if (sort === "low") return H.num(a.total) - H.num(b.total);
        return new Date(b.created_at) - new Date(a.created_at);
      });
      draw(list);
    }
    ["sSearch", "sStatus", "sSort"].forEach(function (id) { H.q("#" + id, root).addEventListener("input", apply); });
    H.q("#csvBtn", root).onclick = function () {
      H.csvExport("sales.csv", sales.map(function (s) { return { invoice_no: s.invoice_no, date: s.created_at, customer: s._cust, total: s.total, status: s.status, payment: s.payment_method }; }));
    };
    draw(sales);
  };

  // ---------------- Invoice detail / receipt ----------------
  window.PAGES.sale = async function (root, id) {
    var saleRows = await DB.get("sales", { select: "*", id: "eq." + id });
    if (!saleRows.length) { root.innerHTML = H.emptyState("Invoice not found", "This invoice does not exist.", "#/sales", "Back to Sales"); return; }
    var s = saleRows[0];
    var data = await Promise.all([
      DB.get("sale_items", { select: "*", sale_id: "eq." + id }),
      s.customer_id ? DB.get("customers", { select: "*", id: "eq." + s.customer_id }) : Promise.resolve([]),
      s.branch_id ? DB.get("branches", { select: "*", id: "eq." + s.branch_id }) : Promise.resolve([])
    ]);
    var items = data[0];
    var cust = data[1][0];
    var branch = data[2][0];
    var rc = X.receipt;
    root.innerHTML =
      '<div class="page-head no-print"><div><h1>Invoice ' + H.esc(s.invoice_no) + "</h1><p>" + H.fmtDate(s.created_at) + '</p></div><div class="spacer"></div>' +
      '<span class="btn-row"><a class="btn" href="#/sales">Back to Sales</a><button class="btn btn-primary" id="printBtn">Print Receipt</button></span></div>' +
      '<div class="card receipt">' +
      (rc.show_logo ? '<h3>' + H.esc(X.org.business_name) + "</h3>" : "") +
      '<p style="text-align:center;color:var(--muted)">' + H.esc(rc.header) + "</p>" +
      '<div class="totals">' +
      "<div class='row'><span>Invoice</span><b>" + H.esc(s.invoice_no) + "</b></div>" +
      "<div class='row'><span>Date</span><b>" + H.fmtDate(s.created_at) + "</b></div>" +
      "<div class='row'><span>Customer</span><b>" + H.esc(cust ? cust.name : "Walk-in Customer") + "</b></div>" +
      "<div class='row'><span>Branch</span><b>" + H.esc(branch ? branch.name : "-") + "</b></div>" +
      "<div class='row'><span>Payment</span><b>" + H.esc(s.payment_method) + " &middot; " + H.esc(s.status) + "</b></div>" +
      (rc.show_cashier ? "<div class='row'><span>Cashier</span><b>" + H.esc(s.cashier_name || "-") + "</b></div>" : "") +
      "</div>" +
      '<table style="margin-top:10px"><thead><tr><th>Item</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead><tbody>' +
      items.map(function (i) {
        // Line total is ALWAYS price * qty here; tax lives only in the summary below.
        return "<tr><td>" + H.esc(i.product_name) + '</td><td class="num">' + H.fmt(i.price) + '</td><td class="num">' + H.num(i.qty) + '</td><td class="num">' + H.fmt(H.num(i.price) * H.num(i.qty)) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="totals">' +
      "<div class='row'><span>Subtotal</span><b>" + H.fmt(s.subtotal) + "</b></div>" +
      (H.num(s.discount) ? "<div class='row'><span>Discount</span><b>-" + H.fmt(s.discount) + "</b></div>" : "") +
      (rc.show_tax ? "<div class='row'><span>Tax (" + H.num(s.tax_rate) + "%)</span><b>" + H.fmt(s.tax_amount) + "</b></div>" : "") +
      "<div class='row grand'><span>Total</span><span>" + H.fmt(s.total) + "</span></div>" +
      "<div class='row'><span>Amount Paid</span><b>" + H.fmt(s.amount_paid) + "</b></div></div>" +
      '<p style="text-align:center;color:var(--muted);margin-top:14px">' + H.esc(rc.footer) + "</p></div>";
    H.q("#printBtn", root).onclick = function () { window.print(); };
  };

  // ---------------- Sales Returns ----------------
  window.PAGES.returns = async function (root) {
    var data = await Promise.all([
      DB.get("sales_returns", { select: "*", order: "created_at.desc", limit: 500 }),
      DB.get("sales", { select: "id,invoice_no,customer_id,total,created_at", order: "created_at.desc", limit: 500 }),
      DB.get("customers", { select: "id,name" })
    ]);
    var returns = data[0], sales = data[1];
    var saleById = {}; sales.forEach(function (s) { saleById[s.id] = s; });
    var custName = {}; data[2].forEach(function (c) { custName[c.id] = c.name; });
    var totalRefunds = returns.reduce(function (a, r) { return a + H.num(r.amount); }, 0);

    root.innerHTML =
      H.pageHead("Sales Returns", "Process product returns and issue refunds",
        '<button class="btn btn-primary" id="newReturn">New Sales Return</button>') +
      '<div class="grid kpis">' +
      H.kpi("Total Refunds", H.fmt(totalRefunds), returns.length + " returns") +
      H.kpi("Total Returns", returns.length, "Processed returns") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (returns.length ? '<div class="table-wrap"><table><thead><tr><th>Return ID</th><th>Original Invoice</th><th>Date</th><th>Customer</th><th class="num">Amount</th><th>Status</th><th>Reason</th></tr></thead><tbody>' +
        returns.map(function (r) {
          var sale = saleById[r.sale_id];
          return "<tr><td><b>" + H.esc(r.return_no) + "</b></td><td>" + (sale ? H.esc(sale.invoice_no) : "(deleted sale)") + "</td><td>" + H.fmtDate(r.created_at) + "</td><td>" +
            H.esc(r.customer_id ? (custName[r.customer_id] || "") : (sale && sale.customer_id ? (custName[sale.customer_id] || "") : "Walk-in Customer")) +
            '</td><td class="num">' + H.fmt(r.amount) + "</td><td>" + H.pill(r.status) + "</td><td>" + H.esc(r.reason || "-") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No sales returns yet", "Returns must reference an existing invoice — pick one when creating a return.", null, "")) +
      "</div>";
    H.q("#newReturn", root).onclick = function () {
      if (!sales.length) { H.toast("No sales exist yet — a return needs an existing invoice."); return; }
      var body = '<div class="form-grid">' +
        H.field("Original Invoice (existing sales only)", H.sel("f_sale", sales.map(function (s) { return { value: s.id, label: s.invoice_no + " — " + H.fmt(s.total) }; }), sales[0].id), true) +
        H.field("Refund Amount", H.inp("f_amount", H.num(sales[0].total), 'type="number" min="0" step="0.01"')) +
        H.field("Status", H.sel("f_status", ["Refunded", "Processed", "Rejected"].map(function (v) { return { value: v, label: v }; }), "Refunded")) +
        H.field("Reason", H.inp("f_reason", "", 'placeholder="e.g. Damaged product"'), true) + "</div>" +
        '<p style="color:var(--muted);font-size:12.5px">Submitting restores the sold items back into stock and writes a stock movement + audit log.</p>';
      var m = H.openModal({
        title: "Create New Sales Return", sub: "The invoice is picked from real sales — a return can never reference a missing invoice.",
        body: body, submitLabel: "Submit Return",
        onSubmit: async function () {
          var sale = saleById[H.val("f_sale", m)];
          var rows = await DB.insert("sales_returns", {
            return_no: H.uid("RET"), sale_id: sale.id, customer_id: sale.customer_id,
            amount: H.num(H.val("f_amount", m)), status: H.val("f_status", m), reason: H.val("f_reason", m)
          });
          if (H.val("f_status", m) !== "Rejected") {
            var items = await DB.get("sale_items", { select: "*", sale_id: "eq." + sale.id });
            for (var i = 0; i < items.length; i++) {
              var it = items[i];
              if (!it.product_id) continue;
              var fresh = await DB.get("products", { select: "stock", id: "eq." + it.product_id });
              if (fresh.length) await DB.update("products", it.product_id, { stock: H.num(fresh[0].stock) + H.num(it.qty) });
              await DB.insert("stock_movements", { product_id: it.product_id, type: "Sales Return", qty: H.num(it.qty), ref: rows[0].return_no, note: "Return against " + sale.invoice_no });
            }
          }
          await H.audit("Create", "Sales return " + rows[0].return_no + " for " + sale.invoice_no);
          H.toast("Return saved");
          window.PAGES.returns(root);
        }
      });
      H.q("#f_sale", m).onchange = function () {
        var s2 = saleById[H.q("#f_sale", m).value];
        if (s2) H.q("#f_amount", m).value = H.num(s2.total);
      };
    };
  };
})();
