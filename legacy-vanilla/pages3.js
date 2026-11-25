// XonaERP — pages part 3: Expenses, Financials & P&L, Reports, Employees,
// Roles & Permissions, Branches, Audit Logs, Settings, My Profile, Supabase Setup.
window.PAGES = window.PAGES || {};
(function () {
  var H = window.H, X = window.X;
  var EXP_CATS = ["Rent & Utilities", "Inventory", "Salaries", "Marketing", "Maintenance", "Other"];
  var PAY_METHODS = ["Cash", "Bank Transfer", "Card", "Digital Wallet"];

  // ---------------- Expenses ----------------
  window.PAGES.expenses = async function (root) {
    var expenses = await DB.get("expenses", H.branchQ({ select: "*", order: "expense_date.desc", limit: 1000 }));
    var total = expenses.reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var thisMonth = expenses.filter(function (e) { return new Date(e.expense_date || e.created_at) >= monthStart; })
      .reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    var cats = {}; expenses.forEach(function (e) { cats[e.category] = 1; });
    function openForm(e) {
      e = e || {};
      H.openModal({
        title: e.id ? "Edit Expense" : "Record Expense", sub: "Add a business expense.",
        body: '<div class="form-grid">' +
          H.field("Description *", H.inp("f_desc", e.description, 'placeholder="e.g. Office Rent"')) +
          H.field("Category", H.sel("f_cat", EXP_CATS.map(function (c) { return { value: c, label: c }; }), e.category || EXP_CATS[0])) +
          H.field("Amount *", H.inp("f_amount", e.amount, 'type="number" min="0" step="0.01"')) +
          H.field("Date", H.inp("f_date", (e.expense_date || new Date().toISOString().slice(0, 10)), 'type="date"')) +
          H.field("Payment Method", H.sel("f_pay", PAY_METHODS.map(function (m) { return { value: m, label: m }; }), e.payment_method || "Cash")) +
          H.field("Notes (Optional)", H.inp("f_notes", e.notes, 'placeholder="Additional details..."')) + "</div>",
        submitLabel: "Save Expense",
        onSubmit: async function (form) {
          var row = {
            description: H.val("f_desc", form), category: H.val("f_cat", form), amount: H.num(H.val("f_amount", form)),
            expense_date: H.val("f_date", form) || null, payment_method: H.val("f_pay", form), notes: H.val("f_notes", form),
            branch_id: e.branch_id || (X.branchId !== "all" ? X.branchId : null)
          };
          if (!row.description) { H.toast("Description is required", true); return false; }
          if (e.id) { await DB.update("expenses", e.id, row); await H.audit("Update", "Expense " + row.description); }
          else { await DB.insert("expenses", row); await H.audit("Create", "Expense " + row.description + " " + H.fmt(row.amount)); }
          H.toast("Expense saved"); window.PAGES.expenses(root);
        }
      });
    }
    function draw(list) {
      H.q("#expTable", root).innerHTML = list.length ?
        '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th>Payment Method</th><th></th></tr></thead><tbody>' +
        list.map(function (e) {
          return "<tr><td>" + H.fmtDay(e.expense_date || e.created_at) + "</td><td><b>" + H.esc(e.description) + "</b></td><td>" + H.esc(e.category) +
            '</td><td class="num">' + H.fmt(e.amount) + "</td><td>" + H.esc(e.payment_method || "-") +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-eexp="' + e.id + '">Edit</button><button class="btn btn-sm" data-dexp="' + e.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No expenses yet", "Record your first operating expense.", null, "");
      H.qa("[data-eexp]", root).forEach(function (b) { b.onclick = function () { openForm(expenses.find(function (e) { return e.id === b.dataset.eexp; })); }; });
      H.qa("[data-dexp]", root).forEach(function (b) { b.onclick = function () { var e = expenses.find(function (x) { return x.id === b.dataset.dexp; }); H.confirmDelete("expense " + e.description, async function () { await DB.remove("expenses", e.id); await H.audit("Delete", "Expense " + e.description); window.PAGES.expenses(root); }); }; });
    }
    root.innerHTML =
      H.pageHead("Expenses", "Track business expenses and operating costs", '<button class="btn btn-primary" id="addExp">Record Expense</button>') +
      '<div class="grid kpis">' + H.kpi("Total Expenses", H.fmt(total), "All time (current branch filter)") +
      H.kpi("This Month", H.fmt(thisMonth), "") +
      H.kpi("Categories", Object.keys(cats).length, "In use") +
      H.kpi("Avg. Expense", expenses.length ? H.fmt(total / expenses.length) : H.fmt(0), "Per record") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="toolbar"><input type="search" id="eSearch" placeholder="Search by description or category...">' +
      '<select id="eCat"><option value="">All Categories</option>' + EXP_CATS.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select></div><div id="expTable"></div></div>';
    H.q("#addExp", root).onclick = function () { openForm(null); };
    function apply() {
      var list = H.searchFilter(expenses, H.q("#eSearch", root).value, ["description", "category"]);
      var cat = H.q("#eCat", root).value;
      if (cat) list = list.filter(function (e) { return e.category === cat; });
      draw(list);
    }
    H.q("#eSearch", root).addEventListener("input", apply);
    H.q("#eCat", root).addEventListener("change", apply);
    draw(expenses);
  };

  // ---------------- Financials (computed P&L + drawer) ----------------
  async function computeFinancials() {
    var data = await Promise.all([
      DB.get("sales", H.branchQ({ select: "*", limit: 2000 })),
      DB.get("sale_items", { select: "*", limit: 5000 }),
      DB.get("expenses", H.branchQ({ select: "*", limit: 2000 }))
    ]);
    var sales = data[0], items = data[1], expenses = data[2];
    var saleIds = {}; sales.forEach(function (s) { saleIds[s.id] = 1; });
    var revenue = sales.reduce(function (a, s) { return a + H.num(s.total); }, 0);
    var taxCollected = sales.reduce(function (a, s) { return a + H.num(s.tax_amount); }, 0);
    var cogs = items.filter(function (i) { return saleIds[i.sale_id]; }).reduce(function (a, i) { return a + H.num(i.cost) * H.num(i.qty); }, 0);
    var gross = revenue - taxCollected - cogs;
    var totalExp = expenses.reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    var byMethod = {};
    sales.forEach(function (s) { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + H.num(s.amount_paid); });
    var totalReceived = Object.keys(byMethod).reduce(function (a, k) { return a + byMethod[k]; }, 0);
    var cashSales = byMethod["Cash"] || 0;
    var cashExpenses = expenses.filter(function (e) { return (e.payment_method || "Cash") === "Cash"; }).reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    return { sales: sales, items: items, expenses: expenses, revenue: revenue, taxCollected: taxCollected, cogs: cogs, gross: gross, totalExp: totalExp, net: gross - totalExp, byMethod: byMethod, totalReceived: totalReceived, cashSales: cashSales, cashExpenses: cashExpenses };
  }
  window.PAGES.financials = async function (root) {
    var f = await computeFinancials();
    var opening = 0; // no stored drawer session in schema; expected = cash in - cash out from real rows
    root.innerHTML =
      H.pageHead("Financial Overview", "Profit & loss and cash — everything computed from sales, items and expenses",
        '<button class="btn" id="finCsv">Export CSV</button>') +
      '<div class="grid kpis">' + H.kpi("Total Revenue", H.fmt(f.revenue), f.sales.length + " sales") +
      H.kpi("Total Expenses", H.fmt(f.totalExp), f.expenses.length + " records") +
      H.kpi("Gross Profit", H.fmt(f.gross), "Revenue ex tax - COGS", f.gross < 0 ? "bad" : "good") +
      H.kpi("Net Profit", H.fmt(f.net), "After expenses", f.net < 0 ? "bad" : "good") + "</div>" +
      '<div class="grid cols-2" style="margin-top:14px">' +
      '<div class="card"><h3>Profit &amp; Loss Statement</h3><div class="totals">' +
      "<div class='row'><span>Total Sales (incl. tax)</span><b>" + H.fmt(f.revenue) + "</b></div>" +
      "<div class='row'><span>Less: Tax Collected</span><b>-" + H.fmt(f.taxCollected) + "</b></div>" +
      "<div class='row'><span>COGS (from sale items)</span><b>-" + H.fmt(f.cogs) + "</b></div>" +
      "<div class='row'><span><b>Gross Profit</b></span><b>" + H.fmt(f.gross) + "</b></div>" +
      "<div class='row'><span>Operating Expenses</span><b>-" + H.fmt(f.totalExp) + "</b></div>" +
      "<div class='row grand'><span>Net Profit</span><span>" + H.fmt(f.net) + "</span></div></div></div>" +
      '<div class="card"><h3>Payment Method Breakdown</h3><div class="sub">From amount_paid on real sales — always reconciles with revenue received</div><div class="totals">' +
      Object.keys(f.byMethod).map(function (k) { return "<div class='row'><span>" + H.esc(k) + " Sales</span><b>" + H.fmt(f.byMethod[k]) + "</b></div>"; }).join("") +
      "<div class='row grand'><span>Total Received</span><span>" + H.fmt(f.totalReceived) + "</span></div></div>" +
      '<h3 style="margin-top:18px">Cash Drawer (computed)</h3><div class="totals">' +
      "<div class='row'><span>Cash Sales (received)</span><b>" + H.fmt(f.cashSales) + "</b></div>" +
      "<div class='row'><span>Cash Expenses</span><b>-" + H.fmt(f.cashExpenses) + "</b></div>" +
      "<div class='row grand'><span>Expected Cash in Drawer</span><span>" + H.fmt(opening + f.cashSales - f.cashExpenses) + "</span></div></div></div></div>";
    H.q("#finCsv", root).onclick = function () {
      H.csvExport("financials.csv", [
        { metric: "Total Revenue", amount: f.revenue }, { metric: "Tax Collected", amount: f.taxCollected },
        { metric: "COGS", amount: f.cogs }, { metric: "Gross Profit", amount: f.gross },
        { metric: "Operating Expenses", amount: f.totalExp }, { metric: "Net Profit", amount: f.net }
      ]);
    };
  };

  // ---------------- Reports ----------------
  var repTab = "overview", repRange = "30d";
  window.PAGES.reports = async function (root) {
    var data = await Promise.all([
      DB.get("sales", { select: "*", order: "created_at.desc", limit: 2000 }),
      DB.get("sale_items", { select: "*", limit: 5000 }),
      DB.get("expenses", { select: "*", limit: 2000 }),
      DB.get("purchases", { select: "*", limit: 2000 }),
      DB.get("products", { select: "*", limit: 1000 }),
      DB.get("customers", { select: "*" }), DB.get("suppliers", { select: "*" }),
      DB.get("categories", { select: "*" })
    ]);
    var sales = data[0], items = data[1], expenses = data[2], purchases = data[3], products = data[4];
    var customers = data[5], suppliers = data[6], categories = data[7];
    var rangeMap = { "7d": 7, "30d": 30, "month": 31, "all": 36500 };
    var cutoff = Date.now() - (rangeMap[repRange] || 30) * 864e5;
    if (repRange === "month") { var ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0); cutoff = ms.getTime(); }
    var salesR = sales.filter(function (s) { return new Date(s.created_at).getTime() >= cutoff; });
    var expR = expenses.filter(function (e) { return new Date(e.expense_date || e.created_at).getTime() >= cutoff; });
    var saleIds = {}; salesR.forEach(function (s) { saleIds[s.id] = s; });
    var itemsR = items.filter(function (i) { return saleIds[i.sale_id]; });
    var revenue = salesR.reduce(function (a, s) { return a + H.num(s.total); }, 0);
    var taxC = salesR.reduce(function (a, s) { return a + H.num(s.tax_amount); }, 0);
    var cogs = itemsR.reduce(function (a, i) { return a + H.num(i.cost) * H.num(i.qty); }, 0);
    var gross = revenue - taxC - cogs;
    var totalExp = expR.reduce(function (a, e) { return a + H.num(e.amount); }, 0);
    var net = gross - totalExp;
    var exportRows = [], body = "";

    if (repTab === "overview") {
      var byDay = {};
      salesR.forEach(function (s) { var k = H.fmtDay(s.created_at); byDay[k] = (byDay[k] || 0) + H.num(s.total); });
      var days = Object.keys(byDay).sort(function (a, b) { return new Date(a) - new Date(b); });
      var maxV = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
      var prodById = {}; products.forEach(function (p) { prodById[p.id] = p; });
      var catById = {}; categories.forEach(function (c) { catById[c.id] = c.name; });
      var share = {};
      itemsR.forEach(function (i) { var p = prodById[i.product_id]; var c = p && p.category_id ? (catById[p.category_id] || "Uncategorized") : "Uncategorized"; share[c] = (share[c] || 0) + H.num(i.line_total); });
      var shareTot = Object.keys(share).reduce(function (a, k) { return a + share[k]; }, 0);
      var pm = {}; salesR.forEach(function (s) { pm[s.payment_method] = (pm[s.payment_method] || 0) + H.num(s.amount_paid); });
      var pmTot = Object.keys(pm).reduce(function (a, k) { return a + pm[k]; }, 0);
      exportRows = days.map(function (d) { return { date: d, sales: byDay[d] }; });
      body = '<div class="grid kpis">' + H.kpi("Total Sales", H.fmt(revenue), salesR.length + " invoices") +
        H.kpi("Total Invoices", salesR.length, "") + H.kpi("Gross Profit", H.fmt(gross), "") +
        H.kpi("Net Profit", H.fmt(net), "", net < 0 ? "bad" : "good") + "</div>" +
        '<div class="grid cols-2" style="margin-top:14px"><div class="card"><h3>Sales Trend Over Time</h3>' +
        (days.length ? '<div class="bars">' + days.map(function (d) { return '<div class="bar-col"><b>' + H.fmt(byDay[d]) + '</b><div class="bar" style="height:' + Math.max(2, byDay[d] / maxV * 120) + 'px"></div><small>' + d + "</small></div>"; }).join("") + "</div>" : '<div class="empty"><h3>No sales in range</h3><p>Change the range or make a sale in POS.</p></div>') +
        '</div><div class="card"><h3>Sales by Category</h3>' +
        (shareTot ? Object.keys(share).map(function (k) { var pct = Math.round(share[k] / shareTot * 100); return '<div class="share-row"><div class="lbl"><span>' + H.esc(k) + "</span><b>" + pct + '%</b></div><div class="share-track"><div class="share-fill" style="width:' + pct + '%"></div></div></div>'; }).join("") : "<p>No item sales in range.</p>") +
        '<h3 style="margin-top:16px">Sales by Payment Method</h3>' +
        (pmTot ? Object.keys(pm).map(function (k) { var pct = Math.round(pm[k] / pmTot * 100); return '<div class="share-row"><div class="lbl"><span>' + H.esc(k) + "</span><b>" + pct + '%</b></div><div class="share-track"><div class="share-fill" style="width:' + pct + '%"></div></div></div>'; }).join("") : "<p>No payments in range.</p>") +
        "</div></div>";
    } else if (repTab === "volume") {
      var vol = {};
      itemsR.forEach(function (i) {
        var k = i.product_id || i.product_name;
        vol[k] = vol[k] || { name: i.product_name, sku: (products.find(function (p) { return p.id === i.product_id; }) || {}).sku || "-", units: 0, revenue: 0 };
        vol[k].units += H.num(i.qty); vol[k].revenue += H.num(i.price) * H.num(i.qty); // revenue ex-tax: price x qty
      });
      var rows = Object.keys(vol).map(function (k) { return vol[k]; });
      exportRows = rows.map(function (r) { return { product: r.name, sku: r.sku, units_sold: r.units, revenue: +r.revenue.toFixed(2), avg_price: r.units ? +(r.revenue / r.units).toFixed(2) : 0 }; });
      body = rows.length ? '<div class="card"><div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th class="num">Units Sold</th><th class="num">Revenue (ex tax)</th><th class="num">Avg Price</th></tr></thead><tbody>' +
        rows.map(function (r) { return "<tr><td><b>" + H.esc(r.name) + "</b></td><td>" + H.esc(r.sku) + '</td><td class="num">' + r.units + '</td><td class="num">' + H.fmt(r.revenue) + '</td><td class="num">' + H.fmt(r.units ? r.revenue / r.units : 0) + "</td></tr>"; }).join("") + "</tbody></table></div></div>"
        : H.emptyState("No product sales in range", "Sell something in POS first.", "#/pos", "Open POS");
    } else if (repTab === "pl") {
      exportRows = [
        { category: "Total Revenue", amount: revenue }, { category: "Tax Collected", amount: -taxC },
        { category: "COGS", amount: -cogs }, { category: "Gross Profit", amount: gross },
        { category: "Operating Expenses", amount: -totalExp }, { category: "Net Profit", amount: net },
        { category: "Profit Margin %", amount: revenue ? +(net / revenue * 100).toFixed(1) : 0 }
      ];
      body = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Amount</th></tr></thead><tbody>' +
        exportRows.map(function (r) { return "<tr><td>" + H.esc(r.category) + '</td><td class="num">' + H.fmt(r.amount) + "</td></tr>"; }).join("") +
        '<tr><td>Profit Margin</td><td class="num">' + (revenue ? (net / revenue * 100).toFixed(1) : "0.0") + "%</td></tr></tbody></table></div></div>";
    } else if (repTab === "receivables") {
      var rows2 = customers.map(function (c) {
        var list = sales.filter(function (s) { return s.customer_id === c.id; });
        var total = list.reduce(function (a, s) { return a + H.num(s.total); }, 0);
        var paid = list.reduce(function (a, s) { return a + H.num(s.amount_paid); }, 0);
        return { name: c.name, total: total, paid: paid, due: Math.max(0, total - paid) };
      });
      exportRows = rows2.map(function (r) { return { customer: r.name, total_purchases: r.total, total_paid: r.paid, outstanding: r.due }; });
      body = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th class="num">Total Purchases</th><th class="num">Total Paid</th><th class="num">Outstanding</th></tr></thead><tbody>' +
        rows2.map(function (r) { return "<tr><td><b>" + H.esc(r.name) + '</b></td><td class="num">' + H.fmt(r.total) + '</td><td class="num">' + H.fmt(r.paid) + '</td><td class="num">' + H.fmt(r.due) + "</td></tr>"; }).join("") +
        '<tr><td><b>Total</b></td><td class="num"><b>' + H.fmt(rows2.reduce(function (a, r) { return a + r.total; }, 0)) + '</b></td><td class="num"><b>' + H.fmt(rows2.reduce(function (a, r) { return a + r.paid; }, 0)) + '</b></td><td class="num"><b>' + H.fmt(rows2.reduce(function (a, r) { return a + r.due; }, 0)) + "</b></td></tr></tbody></table></div></div>";
    } else if (repTab === "payables") {
      var rows3 = suppliers.map(function (s) {
        var list = purchases.filter(function (p) { return p.supplier_id === s.id; });
        var total = list.reduce(function (a, p) { return a + H.num(p.total); }, 0);
        var paid = list.reduce(function (a, p) { return a + H.num(p.amount_paid); }, 0);
        return { name: s.name, total: total, paid: paid, due: Math.max(0, total - paid) };
      });
      exportRows = rows3.map(function (r) { return { supplier: r.name, total_purchases: r.total, total_paid: r.paid, outstanding: r.due }; });
      body = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Supplier</th><th class="num">Total Purchases</th><th class="num">Total Paid</th><th class="num">Outstanding</th></tr></thead><tbody>' +
        rows3.map(function (r) { return "<tr><td><b>" + H.esc(r.name) + '</b></td><td class="num">' + H.fmt(r.total) + '</td><td class="num">' + H.fmt(r.paid) + '</td><td class="num">' + H.fmt(r.due) + "</td></tr>"; }).join("") +
        '<tr><td><b>Total</b></td><td class="num"><b>' + H.fmt(rows3.reduce(function (a, r) { return a + r.total; }, 0)) + '</b></td><td class="num"><b>' + H.fmt(rows3.reduce(function (a, r) { return a + r.paid; }, 0)) + '</b></td><td class="num"><b>' + H.fmt(rows3.reduce(function (a, r) { return a + r.due; }, 0)) + "</b></td></tr></tbody></table></div></div>";
    } else if (repTab === "valuation") {
      exportRows = products.map(function (p) { return { product: p.name, sku: p.sku, stock: H.num(p.stock), unit_cost: H.num(p.cost), total_cost: +(H.num(p.stock) * H.num(p.cost)).toFixed(2), retail_price: H.num(p.price), total_retail: +(H.num(p.stock) * H.num(p.price)).toFixed(2) }; });
      body = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th class="num">Stock</th><th class="num">Unit Cost</th><th class="num">Total Cost (stock x cost)</th><th class="num">Retail Price</th><th class="num">Total Retail</th></tr></thead><tbody>' +
        exportRows.map(function (r) { return "<tr><td><b>" + H.esc(r.product) + "</b></td><td>" + H.esc(r.sku) + '</td><td class="num">' + r.stock + '</td><td class="num">' + H.fmt(r.unit_cost) + '</td><td class="num">' + H.fmt(r.total_cost) + '</td><td class="num">' + H.fmt(r.retail_price) + '</td><td class="num">' + H.fmt(r.total_retail) + "</td></tr>"; }).join("") +
        '<tr><td colspan="4"><b>Total Inventory Value</b></td><td class="num"><b>' + H.fmt(exportRows.reduce(function (a, r) { return a + r.total_cost; }, 0)) + '</b></td><td></td><td class="num"><b>' + H.fmt(exportRows.reduce(function (a, r) { return a + r.total_retail; }, 0)) + "</b></td></tr></tbody></table></div></div>";
    } else { // opex
      var byCat = {};
      expR.forEach(function (e) { byCat[e.category] = byCat[e.category] || { amount: 0, count: 0 }; byCat[e.category].amount += H.num(e.amount); byCat[e.category].count++; });
      exportRows = Object.keys(byCat).map(function (k) { return { category: k, amount: byCat[k].amount, count: byCat[k].count }; });
      body = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Count</th></tr></thead><tbody>' +
        exportRows.map(function (r) { return "<tr><td>" + H.esc(r.category) + '</td><td class="num">' + H.fmt(r.amount) + '</td><td class="num">' + r.count + "</td></tr>"; }).join("") +
        '<tr><td><b>Total</b></td><td class="num"><b>' + H.fmt(totalExp) + '</b></td><td class="num"><b>' + expR.length + "</b></td></tr></tbody></table></div></div>";
    }

    var TABS = [["overview", "Sales Overview"], ["volume", "Product Sales Volume"], ["pl", "Profit & Loss"], ["receivables", "Customer Receivables"], ["payables", "Supplier Payables"], ["valuation", "Stock Valuation"], ["opex", "Operating Expenses"]];
    root.innerHTML =
      H.pageHead("Reports & Analytics", "Detailed business intelligence — every figure computed from the tables",
        '<span class="btn-row"><select id="repRange" style="width:auto">' +
        [["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["month", "This Month"], ["all", "All Time"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === repRange ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        '</select><button class="btn btn-primary" id="repCsv">Export CSV</button></span>') +
      '<div class="tabs">' + TABS.map(function (t) { return '<button class="tab' + (repTab === t[0] ? " active" : "") + '" data-rtab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" + body;
    H.qa("[data-rtab]", root).forEach(function (b) { b.onclick = function () { repTab = b.dataset.rtab; window.PAGES.reports(root); }; });
    H.q("#repRange", root).onchange = function (e) { repRange = e.target.value; window.PAGES.reports(root); };
    H.q("#repCsv", root).onclick = function () { H.csvExport("report-" + repTab + ".csv", exportRows); };
  };

  // ---------------- Employees ----------------
  window.PAGES.employees = async function (root) {
    var data = await Promise.all([
      DB.get("employees", { select: "*", order: "name.asc" }),
      DB.get("branches", { select: "*", order: "name.asc" })
    ]);
    var employees = data[0], branches = data[1];
    var brName = {}; branches.forEach(function (b) { brName[b.id] = b.name; });
    var payroll = employees.reduce(function (a, e) { return a + H.num(e.salary); }, 0);
    var ROLES = ["Super Admin", "Organization Admin", "Manager", "Cashier", "Inventory Manager", "Accountant"];
    function openForm(e) {
      e = e || {};
      H.openModal({
        title: e.id ? "Edit Employee" : "Add New Employee",
        body: '<div class="form-grid">' +
          H.field("Full Name *", H.inp("f_name", e.name)) +
          H.field("Email", H.inp("f_email", e.email, 'type="email"')) +
          H.field("Role", H.sel("f_role", ROLES.map(function (r) { return { value: r, label: r }; }), e.role_name || "Cashier")) +
          H.field("Branch", H.sel("f_branch", [{ value: "", label: "Unassigned" }].concat(branches.map(function (b) { return { value: b.id, label: b.name }; })), e.branch_id || "")) +
          H.field("Monthly Salary", H.inp("f_salary", e.salary, 'type="number" min="0" step="0.01"')) +
          H.field("Status", H.sel("f_active", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }], String(e.is_active !== false))) + "</div>",
        onSubmit: async function (form) {
          var row = { name: H.val("f_name", form), email: H.val("f_email", form), role_name: H.val("f_role", form), branch_id: H.val("f_branch", form) || null, salary: H.num(H.val("f_salary", form)), is_active: H.val("f_active", form) === "true" };
          if (!row.name) { H.toast("Name is required", true); return false; }
          if (e.id) { await DB.update("employees", e.id, row); await H.audit("Update", "Employee " + row.name); }
          else { await DB.insert("employees", row); await H.audit("Create", "Employee " + row.name); }
          H.toast("Employee saved"); window.PAGES.employees(root);
        }
      });
    }
    root.innerHTML =
      H.pageHead("Employees & Staff", "Manage staff, roles and payroll", '<button class="btn btn-primary" id="addEmp">Add New Employee</button>') +
      '<div class="grid kpis">' + H.kpi("Total Employees", employees.length, "") +
      H.kpi("Monthly Payroll", H.fmt(payroll), "Computed from salaries") +
      H.kpi("Active Employees", employees.filter(function (e) { return e.is_active !== false; }).length, "") +
      H.kpi("Avg. Salary", employees.length ? H.fmt(payroll / employees.length) : H.fmt(0), "") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (employees.length ? '<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Branch</th><th class="num">Salary</th><th>Status</th><th></th></tr></thead><tbody>' +
        employees.map(function (e) {
          return "<tr><td><b>" + H.esc(e.name) + "</b>" + (e.email ? "<br><small style='color:var(--muted)'>" + H.esc(e.email) + "</small>" : "") + "</td><td>" + H.esc(e.role_name) + "</td><td>" + H.esc(brName[e.branch_id] || "-") +
            '</td><td class="num">' + H.fmt(e.salary) + "/mo</td><td>" + (e.is_active === false ? H.pill("Inactive") : H.pill("Active")) +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-eemp="' + e.id + '">Edit</button><button class="btn btn-sm" data-demp="' + e.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No employees yet", "Add your first staff member.", null, "")) + "</div>";
    H.q("#addEmp", root).onclick = function () { openForm(null); };
    H.qa("[data-eemp]", root).forEach(function (b) { b.onclick = function () { openForm(employees.find(function (e) { return e.id === b.dataset.eemp; })); }; });
    H.qa("[data-demp]", root).forEach(function (b) { b.onclick = function () { var e = employees.find(function (x) { return x.id === b.dataset.demp; }); H.confirmDelete("employee " + e.name, async function () { await DB.remove("employees", e.id); await H.audit("Delete", "Employee " + e.name); window.PAGES.employees(root); }); }; });
  };

  // ---------------- Roles & Permissions (stored in app_settings 'roles') ----------------
  var ROLE_NAMES = ["Super Admin", "Organization Admin", "Manager", "Cashier", "Inventory Manager", "Accountant"];
  var PERMS = ["Access POS Terminal", "Apply Discounts", "Process Refunds", "Manage Products", "Manage Inventory", "Manage Purchases", "Manage Cash Register", "View P&L Reports", "Manage Staff"];
  function defaultMatrix() {
    var m = {};
    ROLE_NAMES.forEach(function (r) { m[r] = PERMS.map(function () { return false; }); });
    m["Super Admin"] = PERMS.map(function () { return true; });
    m["Organization Admin"] = PERMS.map(function () { return true; });
    m["Manager"] = [true, true, true, true, true, true, true, false, false];
    m["Cashier"] = [true, true, true, false, false, false, true, false, false];
    m["Inventory Manager"] = [false, false, false, true, true, true, false, false, false];
    m["Accountant"] = [false, false, false, false, false, true, true, true, false];
    return m;
  }
  window.PAGES.roles = async function (root) {
    var rows = await DB.get("app_settings", { select: "*", key: "eq.roles" });
    var matrix = rows.length && rows[0].value && rows[0].value.matrix ? rows[0].value.matrix : defaultMatrix();
    root.innerHTML =
      H.pageHead("Roles & Permissions", "Control access to features by role — saved to Supabase settings",
        '<button class="btn btn-primary" id="saveRoles">Save Permissions</button>') +
      '<div class="grid cols-3">' + ROLE_NAMES.map(function (r) {
        var granted = (matrix[r] || []).filter(Boolean).length;
        return '<div class="card"><h3>' + H.esc(r) + '</h3><div class="sub">' + granted + " of " + PERMS.length + " permissions granted</div></div>";
      }).join("") + "</div>" +
      '<div class="card" style="margin-top:14px"><h3>Permissions Matrix</h3><div class="sub">Super Admin is locked to full access. Tick boxes and press Save Permissions.</div>' +
      '<div class="table-wrap"><table class="matrix"><thead><tr><th>Capability</th>' + ROLE_NAMES.map(function (r) { return "<th>" + H.esc(r) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      PERMS.map(function (p, pi) {
        return "<tr><td>" + H.esc(p) + "</td>" + ROLE_NAMES.map(function (r) {
          var checked = matrix[r] && matrix[r][pi] ? " checked" : "";
          var locked = r === "Super Admin" ? " disabled" : "";
          return '<td><input type="checkbox" data-role="' + H.esc(r) + '" data-perm="' + pi + '"' + checked + locked + ' style="width:auto"></td>';
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p style="color:var(--muted);font-size:12.5px;margin-top:10px">Permissions are stored in app_settings (key: roles). Navigation-level enforcement by role can be layered on top of this matrix.</p></div>';
    H.q("#saveRoles", root).onclick = async function () {
      var m2 = {};
      ROLE_NAMES.forEach(function (r) { m2[r] = PERMS.map(function () { return false; }); });
      m2["Super Admin"] = PERMS.map(function () { return true; });
      H.qa("input[data-role]", root).forEach(function (cb) { if (cb.dataset.role !== "Super Admin") m2[cb.dataset.role][+cb.dataset.perm] = cb.checked; });
      try {
        await DB.upsert("app_settings", { key: "roles", value: { matrix: m2 } });
        await H.audit("Update", "Roles & permissions matrix saved");
        H.toast("Permissions saved"); window.PAGES.roles(root);
      } catch (e) { H.errToast(e); }
    };
  };

  // ---------------- Branches ----------------
  window.PAGES.branches = async function (root) {
    var data = await Promise.all([
      DB.get("branches", { select: "*", order: "name.asc" }),
      DB.get("employees", { select: "id,branch_id" }),
      DB.get("products", { select: "stock,cost", limit: 1000 })
    ]);
    var branches = data[0], employees = data[1];
    var invValue = data[2].reduce(function (a, p) { return a + H.num(p.stock) * H.num(p.cost); }, 0);
    function staffCount(id) { return employees.filter(function (e) { return e.branch_id === id; }).length; }
    function openForm(b) {
      b = b || {};
      H.openModal({
        title: b.id ? "Edit Branch" : "Add New Branch",
        body: '<div class="form-grid">' +
          H.field("Branch Code *", H.inp("f_code", b.code, 'placeholder="e.g. BR-MAIN"')) +
          H.field("Branch Name *", H.inp("f_name", b.name)) +
          H.field("Phone", H.inp("f_phone", b.phone)) +
          H.field("Manager Name", H.inp("f_manager", b.manager_name)) +
          H.field("Address", '<textarea id="f_addr" rows="2">' + H.esc(b.address || "") + "</textarea>", true) +
          H.field("Main Branch", H.sel("f_main", [{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(!!b.is_main))) +
          H.field("Status", H.sel("f_active", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }], String(b.is_active !== false))) + "</div>",
        onSubmit: async function (form) {
          var row = { code: H.val("f_code", form), name: H.val("f_name", form), phone: H.val("f_phone", form), manager_name: H.val("f_manager", form), address: H.val("f_addr", form), is_main: H.val("f_main", form) === "true", is_active: H.val("f_active", form) === "true" };
          if (!row.code || !row.name) { H.toast("Code and name are required", true); return false; }
          if (b.id) { await DB.update("branches", b.id, row); await H.audit("Update", "Branch " + row.name); }
          else { await DB.insert("branches", row); await H.audit("Create", "Branch " + row.name); }
          await H.reloadCommon();
          H.toast("Branch saved"); window.PAGES.branches(root);
        }
      });
    }
    root.innerHTML =
      H.pageHead("Branch Locations", "The topbar branch switcher filters Dashboard, POS sales, Sales and Expenses by branch", '<button class="btn btn-primary" id="addBr">Add New Branch</button>') +
      '<div class="grid kpis">' + H.kpi("Total Branches", branches.length, "") +
      H.kpi("Active Branches", branches.filter(function (b) { return b.is_active !== false; }).length, "") +
      H.kpi("Total Staff", employees.length, "Across branches") +
      H.kpi("Total Inventory Value", H.fmt(invValue), "Computed: stock x cost") + "</div>" +
      '<div class="grid cols-2" style="margin-top:14px">' +
      (branches.length ? branches.map(function (b) {
        return '<div class="card"><h3>' + H.esc(b.name) + " " + (b.is_main ? H.pill("Main Branch") : H.pill("Sub Branch")) + " " + (b.is_active === false ? H.pill("Inactive") : H.pill("Active")) + '</h3>' +
          '<div class="sub">' + H.esc(b.code) + "</div>" +
          "<p>" + H.esc(b.address || "-") + "<br>Phone: " + H.esc(b.phone || "-") + "<br>Manager: " + H.esc(b.manager_name || "-") + "<br>Staff: " + staffCount(b.id) + "</p>" +
          '<span class="btn-row"><button class="btn btn-sm" data-ebr="' + b.id + '">Edit Branch</button><button class="btn btn-sm" data-dbr="' + b.id + '">Delete</button></span></div>';
      }).join("") : H.emptyState("No branches yet", "Add your first branch location.", null, "")) + "</div>";
    H.q("#addBr", root).onclick = function () { openForm(null); };
    H.qa("[data-ebr]", root).forEach(function (b) { b.onclick = function () { openForm(branches.find(function (x) { return x.id === b.dataset.ebr; })); }; });
    H.qa("[data-dbr]", root).forEach(function (b) { b.onclick = function () { var br = branches.find(function (x) { return x.id === b.dataset.dbr; }); H.confirmDelete("branch " + br.name, async function () { await DB.remove("branches", br.id); await H.audit("Delete", "Branch " + br.name); await H.reloadCommon(); window.PAGES.branches(root); }); }; });
  };

  // ---------------- Audit Logs ----------------
  window.PAGES.audit = async function (root) {
    var logs = await DB.get("audit_logs", { select: "*", order: "created_at.desc", limit: 500 });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var todayCount = logs.filter(function (l) { return new Date(l.created_at) >= today; }).length;
    function draw(list) {
      H.q("#logTable", root).innerHTML = list.length ?
        '<div class="table-wrap"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
        list.map(function (l) { return "<tr><td>" + H.fmtDate(l.created_at) + "</td><td>" + H.esc(l.user_name || "-") + "</td><td>" + H.pill(l.action) + "</td><td>" + H.esc(l.details || "-") + "</td></tr>"; }).join("") +
        "</tbody></table></div>"
        : H.emptyState("No audit logs yet", "Creates, updates, deletes and sales are logged here automatically.", null, "");
    }
    root.innerHTML =
      H.pageHead("Audit Logs", "Track all system activities and user actions", '<button class="btn" id="logCsv">Export CSV</button>') +
      '<div class="grid kpis">' + H.kpi("Total Logs", logs.length, "") +
      H.kpi("Today's Activity", todayCount, "Logs dated today") +
      H.kpi("User Actions", logs.filter(function (l) { return l.action !== "Login"; }).length, "Non-login events") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="toolbar"><input type="search" id="aSearch" placeholder="Search by user, action or details...">' +
      '<select id="aAction"><option value="">All Actions</option><option>Create</option><option>Update</option><option>Delete</option><option>Login</option><option>Export</option></select></div><div id="logTable"></div></div>';
    function apply() {
      var list = H.searchFilter(logs, H.q("#aSearch", root).value, ["user_name", "action", "details"]);
      var a = H.q("#aAction", root).value;
      if (a) list = list.filter(function (l) { return l.action === a; });
      draw(list);
    }
    H.q("#aSearch", root).addEventListener("input", apply);
    H.q("#aAction", root).addEventListener("change", apply);
    H.q("#logCsv", root).onclick = function () { H.csvExport("audit-logs.csv", logs.map(function (l) { return { timestamp: l.created_at, user: l.user_name, action: l.action, details: l.details }; })); };
    draw(logs);
  };

  // ---------------- Settings ----------------
  window.PAGES.settings = async function (root) {
    var org = Object.assign({}, X.org), rc = Object.assign({}, X.receipt);
    root.innerHTML =
      H.pageHead("Settings & Branding", "Configure your organization, store and system preferences — saved to Supabase") +
      '<form id="setForm"><div class="grid cols-2">' +
      '<div class="card"><h3>Organization Profile</h3><div class="sub">Tax rate here is what POS charges</div><div class="form-grid">' +
      H.field("Business Name", H.inp("s_name", org.business_name)) +
      H.field("Currency", H.sel("s_currency", ["USD", "EUR", "GBP", "PKR", "INR"].map(function (c) { return { value: c, label: c }; }), org.currency || "USD")) +
      H.field("Tax Rate (%)", H.inp("s_tax", org.tax_rate, 'type="number" step="0.01" min="0"')) +
      H.field("Timezone", H.inp("s_tz", org.timezone)) +
      H.field("Contact Email", H.inp("s_email", org.email, 'type="email"')) +
      H.field("Contact Phone", H.inp("s_phone", org.phone)) +
      H.field("Address", '<textarea id="s_addr" rows="2">' + H.esc(org.address || "") + "</textarea>", true) + "</div></div>" +
      '<div class="card"><h3>Receipt Settings</h3><div class="sub">Shown on printed invoices</div>' +
      H.field("Header Text", H.inp("r_header", rc.header)) +
      H.field("Footer Text", H.inp("r_footer", rc.footer)) +
      '<div class="switch-row"><span>Show Business Logo / Name</span><input type="checkbox" class="switch" id="r_logo"' + (rc.show_logo ? " checked" : "") + "></div>" +
      '<div class="switch-row"><span>Show Tax Breakdown</span><input type="checkbox" class="switch" id="r_tax"' + (rc.show_tax ? " checked" : "") + "></div>" +
      '<div class="switch-row"><span>Show Cashier Name</span><input type="checkbox" class="switch" id="r_cashier"' + (rc.show_cashier ? " checked" : "") + "></div>" +
      "</div></div>" +
      '<div class="btn-row" style="margin-top:16px"><button class="btn btn-primary" type="submit">Save Settings</button></div></form>';
    H.q("#setForm", root).addEventListener("submit", async function (e) {
      e.preventDefault();
      var newOrg = { business_name: H.val("s_name", root), currency: H.val("s_currency", root), tax_rate: H.num(H.val("s_tax", root)), timezone: H.val("s_tz", root), email: H.val("s_email", root), phone: H.val("s_phone", root), address: H.val("s_addr", root) };
      var newRc = { header: H.val("r_header", root), footer: H.val("r_footer", root), show_logo: H.q("#r_logo", root).checked, show_tax: H.q("#r_tax", root).checked, show_cashier: H.q("#r_cashier", root).checked };
      try {
        await DB.upsert("app_settings", { key: "org", value: newOrg });
        await DB.upsert("app_settings", { key: "receipt", value: newRc });
        X.org = newOrg; X.receipt = newRc;
        await H.audit("Update", "Settings saved");
        H.toast("Settings saved to Supabase");
      } catch (err) { H.errToast(err); }
    });
  };

  // ---------------- My Profile (local) ----------------
  window.PAGES.profile = async function (root) {
    var p = X.profile;
    root.innerHTML =
      H.pageHead("My Profile", "Manage your personal information (stored locally in this browser)") +
      '<div class="grid cols-2"><div class="card"><h3>Profile Information</h3><div class="sub">' +
      H.esc(p.name || "Admin") + " &middot; " + H.esc(H.activeBranch() ? H.activeBranch().name : "All Branches") + '</div><div class="form-grid">' +
      H.field("Full Name", H.inp("p_name", p.name)) +
      H.field("Email Address", H.inp("p_email", p.email, 'type="email"')) +
      H.field("Phone Number", H.inp("p_phone", p.phone)) + "</div>" +
      '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="saveProfile">Save Changes</button></div></div>' +
      '<div class="card"><h3>Session</h3><div class="sub">This revamp uses the Supabase anon key (no per-user login gate yet). Your display name above is used as the cashier name on sales and as the user on audit logs.</div>' +
      '<div class="btn-row"><a class="btn" href="#/setup">Supabase Connection</a><a class="btn" href="#/audit">My Audit Trail</a></div></div></div>';
    H.q("#saveProfile", root).onclick = function () {
      X.profile = { name: H.val("p_name", root), email: H.val("p_email", root), phone: H.val("p_phone", root) };
      localStorage.setItem("xona_profile", JSON.stringify(X.profile));
      H.q("#profileBtn").textContent = H.initials(X.profile.name);
      H.toast("Profile saved");
    };
  };

  // ---------------- Supabase Setup ----------------
  window.PAGES.setup = async function (root) {
    var cfg = DB.getCfg();
    var status = await DB.test();
    var tablesNote = "";
    if (!status.ok && status.code === "PGRST205") tablesNote = "Key is valid, but the database tables do not exist yet. Run the project migration supabase/migrations/20261122140000_initial_schema.sql (supabase db push, or paste it once in the Supabase SQL Editor), then reload this page.";
    else if (!status.ok && status.code === "NOT_CONFIGURED") tablesNote = "No key saved yet. Paste your Supabase Project URL and anon (publishable) key below and press Save & Test.";
    else if (!status.ok) tablesNote = "Connection failed: " + status.message + " (HTTP " + status.status + "). Check the URL and key.";
    root.innerHTML =
      H.pageHead("Supabase Cloud Sync", "Connect this app to your Supabase project — all data lives there, nothing is stored locally except settings") +
      '<div class="grid cols-2"><div class="card"><h3>Connection Status</h3><div class="sub">' +
      (status.ok ? '<span class="pill green">Connected</span> Products table is reachable and the key works.'
        : '<span class="pill red">Not Ready</span> ' + H.esc(tablesNote)) + "</div>" +
      '<div class="totals"><div class="row"><span>Database</span><b>Supabase (PostgreSQL)</b></div>' +
      '<div class="row"><span>Project URL</span><b>' + H.esc(cfg.url || "-") + "</b></div>" +
      '<div class="row"><span>Sync Status</span><b>' + (status.ok ? "Live — reads/writes go to Supabase" : "Not connected") + "</b></div></div>" +
      '<h3 style="margin-top:16px">How setup works</h3><p style="color:var(--muted)">' +
      "1. Create a free project at supabase.com.<br>2. Run the migration in this project at supabase/migrations/ to create the 18 tables.<br>" +
      "3. Copy the Project URL and anon key from Settings &gt; API.<br>4. Paste them here — they are saved in this browser's localStorage and sent as the apikey / Authorization headers on every request.</p></div>" +
      '<div class="card"><h3>Connection Settings</h3><div class="sub">Saved locally in your browser, never in the code</div><div class="form-grid">' +
      H.field("Supabase Project URL", H.inp("cfg_url", cfg.url, 'placeholder="https://your-project.supabase.co"'), true) +
      H.field("Supabase Anon Key", '<input id="cfg_key" type="password" placeholder="eyJhbGciOi... or sb_publishable_...">', true) + "</div>" +
      '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="cfgSave">Save &amp; Test Connection</button>' +
      '<button class="btn" id="cfgTest">Test Connection</button></div>' +
      '<p style="color:var(--muted);font-size:12.5px;margin-top:10px">Leave the key field blank to keep the key already saved in this browser. Tables this app uses: products, customers, suppliers, sales, sale_items, expenses, employees, branches and 10 more from the migration.</p></div></div>';
    H.q("#cfgSave", root).onclick = async function () {
      var key = H.val("cfg_key", root) || cfg.key;
      DB.saveCfg(H.val("cfg_url", root), key);
      await H.reloadCommon();
      H.toast("Settings saved — retesting...");
      window.PAGES.setup(root);
    };
    H.q("#cfgTest", root).onclick = async function () {
      var s2 = await DB.test();
      if (s2.ok) H.toast("Connection OK — Supabase is reachable");
      else H.toast("Failed: " + s2.message, true);
      window.PAGES.setup(root);
    };
  };
})();
