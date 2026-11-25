// XonaERP — pages part 2: Products, Categories & Brands, Inventory, Transfers,
// Purchases, Purchase Returns, Suppliers, Customers. Totals are always computed.
window.PAGES = window.PAGES || {};
(function () {
  var H = window.H, X = window.X;

  function margin(p) {
    var price = H.num(p.price);
    return price > 0 ? Math.round(((price - H.num(p.cost)) / price) * 100) : 0;
  }
  async function addStock(productId, delta, type, ref, note) {
    var fresh = await DB.get("products", { select: "stock", id: "eq." + productId });
    if (!fresh.length) return;
    await DB.update("products", productId, { stock: H.num(fresh[0].stock) + delta });
    await DB.insert("stock_movements", { product_id: productId, type: type, qty: delta, ref: ref || "", note: note || "" });
  }

  // ---------------- Products ----------------
  window.PAGES.products = async function (root) {
    var data = await Promise.all([
      DB.get("products", { select: "*", order: "name.asc", limit: 1000 }),
      DB.get("categories", { select: "*", order: "name.asc" }),
      DB.get("brands", { select: "*", order: "name.asc" })
    ]);
    var products = data[0], categories = data[1], brands = data[2];
    var catName = {}; categories.forEach(function (c) { catName[c.id] = c.name; });
    var brandName = {}; brands.forEach(function (b) { brandName[b.id] = b.name; });
    var stockValue = products.reduce(function (a, p) { return a + H.num(p.stock) * H.num(p.cost); }, 0);
    var low = products.filter(function (p) { return H.num(p.stock) <= H.num(p.low_stock_at); });
    var avgMargin = products.length ? Math.round(products.reduce(function (a, p) { return a + margin(p); }, 0) / products.length) : 0;

    function productForm(p) {
      p = p || {};
      return '<div class="form-grid">' +
        H.field("Product Name *", H.inp("f_name", p.name, 'placeholder="e.g. Wireless Earbuds"')) +
        H.field("SKU *", H.inp("f_sku", p.sku, 'placeholder="e.g. EL-001"')) +
        H.field("Category", H.sel("f_category", [{ value: "", label: "Uncategorized" }].concat(categories.map(function (c) { return { value: c.id, label: c.name }; })), p.category_id || "")) +
        H.field("Brand", H.sel("f_brand", [{ value: "", label: "No brand" }].concat(brands.map(function (b) { return { value: b.id, label: b.name }; })), p.brand_id || "")) +
        H.field("Price *", H.inp("f_price", p.price, 'type="number" min="0" step="0.01"')) +
        H.field("Cost Price", H.inp("f_cost", p.cost, 'type="number" min="0" step="0.01"')) +
        H.field("Stock Quantity", H.inp("f_stock", p.stock, 'type="number" step="0.01"')) +
        H.field("Low Stock Alert At", H.inp("f_low", p.low_stock_at === undefined ? 5 : p.low_stock_at, 'type="number" step="0.01"')) +
        H.field("Description", '<textarea id="f_desc" rows="2" placeholder="Product description...">' + H.esc(p.description || "") + "</textarea>", true) +
        H.field("Image URL (optional)", H.inp("f_img", p.image_url, 'placeholder="https://..."'), true) + "</div>";
    }
    function openForm(p) {
      var isEdit = !!(p && p.id);
      H.openModal({
        title: isEdit ? "Edit Product" : "Add New Product", sub: "Margin is computed automatically from price and cost.",
        body: productForm(p), submitLabel: isEdit ? "Save Changes" : "Save Product",
        onSubmit: async function (form) {
          var row = {
            name: H.val("f_name", form), sku: H.val("f_sku", form),
            category_id: H.val("f_category", form) || null, brand_id: H.val("f_brand", form) || null,
            price: H.num(H.val("f_price", form)), cost: H.num(H.val("f_cost", form)),
            stock: H.num(H.val("f_stock", form)), low_stock_at: H.num(H.val("f_low", form)),
            description: H.val("f_desc", form), image_url: H.val("f_img", form)
          };
          if (!row.name || !row.sku) { H.toast("Name and SKU are required", true); return false; }
          if (isEdit) { await DB.update("products", p.id, row); await H.audit("Update", "Product " + row.sku + " (" + row.name + ")"); H.toast("Product updated"); }
          else { await DB.insert("products", row); await H.audit("Create", "Product " + row.sku + " (" + row.name + ")"); H.toast("Product added"); }
          window.PAGES.products(root);
        }
      });
    }
    function draw(list) {
      H.q("#prodTable", root).innerHTML = list.length ?
        '<div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Brand</th><th class="num">Price</th><th class="num">Cost</th><th class="num">Stock</th><th class="num">Margin</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          var isLow = H.num(p.stock) <= H.num(p.low_stock_at);
          return "<tr><td><b>" + H.esc(p.name) + '</b></td><td>' + H.esc(p.sku) + "</td><td>" + H.esc(catName[p.category_id] || "-") + "</td><td>" + H.esc(brandName[p.brand_id] || "-") +
            '</td><td class="num">' + H.fmt(p.price) + '</td><td class="num">' + H.fmt(p.cost) + '</td><td class="num">' + H.num(p.stock) +
            '</td><td class="num">' + margin(p) + "%</td><td>" + (isLow ? H.pill("Low Stock") : H.pill("In Stock")) +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-edit="' + p.id + '">Edit</button><button class="btn btn-sm" data-del="' + p.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No products yet", "Add your first product to start selling.", null, "");
      H.qa("[data-edit]", root).forEach(function (b) { b.onclick = function () { openForm(products.find(function (p) { return p.id === b.dataset.edit; })); }; });
      H.qa("[data-del]", root).forEach(function (b) {
        b.onclick = function () {
          var p = products.find(function (x) { return x.id === b.dataset.del; });
          H.confirmDelete("product " + p.name, async function () {
            await DB.remove("products", p.id); await H.audit("Delete", "Product " + p.sku); H.toast("Product deleted"); window.PAGES.products(root);
          });
        };
      });
    }
    root.innerHTML =
      H.pageHead("Products", "Manage your product catalog and pricing", '<button class="btn btn-primary" id="addProd">Add New Product</button>') +
      '<div class="grid kpis">' +
      H.kpi("Total Products", products.length, "In catalog") +
      H.kpi("Total Stock Value (Cost)", H.fmt(stockValue), "Computed: sum of stock x cost") +
      H.kpi("Low Stock Items", low.length, low.length ? low.map(function (p) { return p.name; }).join(", ") : "None") +
      H.kpi("Average Margin", avgMargin + "%", "Computed from listed price/cost") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="toolbar"><input type="search" id="pSearch" placeholder="Search products...">' +
      '<select id="pCat"><option value="">All Categories</option>' + categories.map(function (c) { return '<option value="' + c.id + '">' + H.esc(c.name) + "</option>"; }).join("") + "</select></div>" +
      '<div id="prodTable"></div></div>';
    H.q("#addProd", root).onclick = function () { openForm(null); };
    function apply() {
      var list = H.searchFilter(products, H.q("#pSearch", root).value, ["name", "sku"]);
      var cat = H.q("#pCat", root).value;
      if (cat) list = list.filter(function (p) { return p.category_id === cat; });
      draw(list);
    }
    H.q("#pSearch", root).addEventListener("input", apply);
    H.q("#pCat", root).addEventListener("change", apply);
    draw(products);
  };

  // ---------------- Categories & Brands ----------------
  window.PAGES.categories = async function (root) {
    var data = await Promise.all([
      DB.get("categories", { select: "*", order: "name.asc" }),
      DB.get("brands", { select: "*", order: "name.asc" }),
      DB.get("products", { select: "id,category_id,brand_id", limit: 1000 })
    ]);
    var categories = data[0], brands = data[1], products = data[2];
    function countBy(key, id) { return products.filter(function (p) { return p[key] === id; }).length; }
    function openCat(c) {
      c = c || {};
      H.openModal({
        title: c.id ? "Edit Category" : "Add New Category", body: '<div class="form-grid">' +
          H.field("Category Name *", H.inp("f_name", c.name, 'placeholder="e.g. Home & Kitchen"')) +
          H.field("Status", H.sel("f_active", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }], String(c.is_active !== false))) +
          H.field("Description", '<textarea id="f_desc" rows="2">' + H.esc(c.description || "") + "</textarea>", true) + "</div>",
        onSubmit: async function (form) {
          var row = { name: H.val("f_name", form), description: H.val("f_desc", form), is_active: H.val("f_active", form) === "true" };
          if (!row.name) { H.toast("Name is required", true); return false; }
          if (c.id) { await DB.update("categories", c.id, row); await H.audit("Update", "Category " + row.name); }
          else { await DB.insert("categories", row); await H.audit("Create", "Category " + row.name); }
          H.toast("Category saved"); window.PAGES.categories(root);
        }
      });
    }
    function openBrand(b) {
      b = b || {};
      H.openModal({
        title: b.id ? "Edit Brand" : "Add New Brand", body: '<div class="form-grid">' +
          H.field("Brand Name *", H.inp("f_name", b.name, 'placeholder="e.g. Sony"')) +
          H.field("Description", '<textarea id="f_desc" rows="2">' + H.esc(b.description || "") + "</textarea>", true) + "</div>",
        onSubmit: async function (form) {
          var row = { name: H.val("f_name", form), description: H.val("f_desc", form) };
          if (!row.name) { H.toast("Name is required", true); return false; }
          if (b.id) { await DB.update("brands", b.id, row); await H.audit("Update", "Brand " + row.name); }
          else { await DB.insert("brands", row); await H.audit("Create", "Brand " + row.name); }
          H.toast("Brand saved"); window.PAGES.categories(root);
        }
      });
    }
    root.innerHTML =
      H.pageHead("Categories & Brands", "Organize the catalog — brands are linked to products", '<span class="btn-row"><button class="btn btn-primary" id="addCat">Add Category</button><button class="btn" id="addBrand">Add Brand</button></span>') +
      '<div class="grid kpis">' + H.kpi("Total Categories", categories.length, "In catalog") + H.kpi("Brands", brands.length, "Linked on products") + H.kpi("Products", products.length, "In catalog") + "</div>" +
      '<div class="grid cols-2" style="margin-top:14px"><div class="card"><h3>Categories</h3><div class="sub">Product counts are computed live</div>' +
      (categories.length ? '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th class="num">Products</th><th>Status</th><th></th></tr></thead><tbody>' +
        categories.map(function (c) {
          return "<tr><td><b>" + H.esc(c.name) + "</b></td><td>" + H.esc(c.description || "-") + '</td><td class="num">' + countBy("category_id", c.id) + "</td><td>" + (c.is_active === false ? H.pill("Inactive") : H.pill("Active")) +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-ecat="' + c.id + '">Edit</button><button class="btn btn-sm" data-dcat="' + c.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>" : H.emptyState("No categories yet", "Create a category to organize products.", null, "")) +
      '</div><div class="card"><h3>Brands</h3><div class="sub">Assign brands from the product form</div>' +
      (brands.length ? brands.map(function (b) {
        return '<div class="switch-row"><span><b>' + H.esc(b.name) + "</b><br><small style='color:var(--muted)'>" + H.esc(b.description || "") + " &middot; " + countBy("brand_id", b.id) + ' product(s)</small></span><span class="btn-row"><button class="btn btn-sm" data-ebrand="' + b.id + '">Edit</button><button class="btn btn-sm" data-dbrand="' + b.id + '">Delete</button></span></div>';
      }).join("") : H.emptyState("No brands yet", "Add a brand, then link it on a product.", null, "")) +
      "</div></div>";
    H.q("#addCat", root).onclick = function () { openCat(null); };
    H.q("#addBrand", root).onclick = function () { openBrand(null); };
    H.qa("[data-ecat]", root).forEach(function (b) { b.onclick = function () { openCat(categories.find(function (c) { return c.id === b.dataset.ecat; })); }; });
    H.qa("[data-ebrand]", root).forEach(function (b) { b.onclick = function () { openBrand(brands.find(function (x) { return x.id === b.dataset.ebrand; })); }; });
    H.qa("[data-dcat]", root).forEach(function (b) { b.onclick = function () { var c = categories.find(function (x) { return x.id === b.dataset.dcat; }); H.confirmDelete("category " + c.name, async function () { await DB.remove("categories", c.id); await H.audit("Delete", "Category " + c.name); window.PAGES.categories(root); }); }; });
    H.qa("[data-dbrand]", root).forEach(function (b) { b.onclick = function () { var br = brands.find(function (x) { return x.id === b.dataset.dbrand; }); H.confirmDelete("brand " + br.name, async function () { await DB.remove("brands", br.id); await H.audit("Delete", "Brand " + br.name); window.PAGES.categories(root); }); }; });
  };

  // ---------------- Inventory ----------------
  var invTab = "levels";
  window.PAGES.inventory = async function (root) {
    var data = await Promise.all([
      DB.get("products", { select: "*", order: "name.asc", limit: 1000 }),
      DB.get("stock_movements", { select: "*", order: "created_at.desc", limit: 500 })
    ]);
    var products = data[0], movements = data[1];
    var prodName = {}; products.forEach(function (p) { prodName[p.id] = p.name + " (" + p.sku + ")"; });
    var totalValue = products.reduce(function (a, p) { return a + H.num(p.stock) * H.num(p.cost); }, 0);
    var low = products.filter(function (p) { return H.num(p.stock) <= H.num(p.low_stock_at); });
    var out = products.filter(function (p) { return H.num(p.stock) <= 0; });

    var bodyHtml = "";
    if (invTab === "levels" || invTab === "low") {
      var list = invTab === "low" ? low : products;
      bodyHtml = list.length ? '<div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th class="num">Current Stock</th><th class="num">Low Stock At</th><th class="num">Stock Value (stock x cost)</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          return "<tr><td><b>" + H.esc(p.name) + "</b></td><td>" + H.esc(p.sku) + '</td><td class="num">' + H.num(p.stock) + ' units</td><td class="num">' + H.num(p.low_stock_at) +
            '</td><td class="num">' + H.fmt(H.num(p.stock) * H.num(p.cost)) + '</td><td><button class="btn btn-sm" data-adjust="' + p.id + '">Adjust Stock</button></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState(invTab === "low" ? "No low-stock items" : "No products yet", invTab === "low" ? "Everything is above its reorder level." : "Add products to see stock levels.", "#/products", "Go to Products");
    } else {
      bodyHtml = movements.length ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th class="num">Qty</th><th>Ref</th><th>Note</th></tr></thead><tbody>' +
        movements.map(function (mv) {
          return "<tr><td>" + H.fmtDate(mv.created_at) + "</td><td>" + H.esc(prodName[mv.product_id] || "-") + "</td><td>" + H.esc(mv.type) + '</td><td class="num">' + H.num(mv.qty) + "</td><td>" + H.esc(mv.ref || "-") + "</td><td>" + H.esc(mv.note || "-") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No stock movements found", "Sales, returns, purchases and adjustments will appear here automatically.", null, "");
    }
    root.innerHTML =
      H.pageHead("Stock & Inventory", "Monitor stock levels, valuations and low-stock alerts",
        '<button class="btn" id="invCsv">Export CSV</button>') +
      '<div class="grid kpis">' + H.kpi("Total Items", products.length, "Products tracked") +
      H.kpi("Total Stock Value", H.fmt(totalValue), "Computed: sum of stock x cost") +
      H.kpi("Low Stock", low.length, "At or below reorder level", low.length ? "warn" : "") +
      H.kpi("Out of Stock", out.length, "Zero units", out.length ? "bad" : "") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="tabs">' +
      [["levels", "Stock Levels (" + products.length + ")"], ["low", "Low Stock Alerts (" + low.length + ")"], ["moves", "Movement Audit (" + movements.length + ")"]]
        .map(function (t) { return '<button class="tab' + (invTab === t[0] ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
      "</div>" + bodyHtml + "</div>";
    H.qa("[data-tab]", root).forEach(function (b) { b.onclick = function () { invTab = b.dataset.tab; window.PAGES.inventory(root); }; });
    H.q("#invCsv", root).onclick = function () {
      H.csvExport("inventory.csv", products.map(function (p) { return { product: p.name, sku: p.sku, stock: p.stock, low_stock_at: p.low_stock_at, unit_cost: p.cost, stock_value: H.num(p.stock) * H.num(p.cost) }; }));
    };
    H.qa("[data-adjust]", root).forEach(function (b) {
      b.onclick = function () {
        var p = products.find(function (x) { return x.id === b.dataset.adjust; });
        H.openModal({
          title: "Adjust Stock — " + p.name, sub: "Current stock: " + H.num(p.stock) + " units. The change is written to the movement audit.",
          body: '<div class="form-grid">' +
            H.field("Mode", H.sel("f_mode", [{ value: "add", label: "Add units" }, { value: "remove", label: "Remove units" }, { value: "set", label: "Set exact stock" }], "add")) +
            H.field("Quantity", H.inp("f_qty", "0", 'type="number" step="0.01" min="0"')) +
            H.field("Note", H.inp("f_note", "", 'placeholder="Reason for adjustment..."'), true) + "</div>",
          submitLabel: "Save Adjustment",
          onSubmit: async function (form) {
            var mode = H.val("f_mode", form), qty = H.num(H.val("f_qty", form));
            var delta = mode === "add" ? qty : mode === "remove" ? -qty : qty - H.num(p.stock);
            if (!delta) { H.toast("No change to apply"); return; }
            await DB.update("products", p.id, { stock: H.num(p.stock) + delta });
            await DB.insert("stock_movements", { product_id: p.id, branch_id: X.branchId !== "all" ? X.branchId : null, type: "Adjustment", qty: delta, ref: "", note: H.val("f_note", form) || ("Manual " + mode) });
            await H.audit("Update", "Stock adjustment " + p.sku + " by " + delta);
            H.toast("Stock updated"); window.PAGES.inventory(root);
          }
        });
      };
    });
  };

  // ---------------- Stock Transfers ----------------
  window.PAGES.transfers = async function (root) {
    var data = await Promise.all([
      DB.get("stock_transfers", { select: "*", order: "created_at.desc", limit: 500 }),
      DB.get("branches", { select: "*", order: "name.asc" }),
      DB.get("products", { select: "*", order: "name.asc", limit: 1000 })
    ]);
    var transfers = data[0], branches = data[1], products = data[2];
    var brName = {}; branches.forEach(function (b) { brName[b.id] = b.name; });
    var prodName = {}; products.forEach(function (p) { prodName[p.id] = p.name; });
    var STATUSES = ["Pending", "Approved", "In Transit", "Received", "Rejected"];
    root.innerHTML =
      H.pageHead("Stock Transfers", "Move inventory between branches and manage transfer requests", '<button class="btn btn-primary" id="newTr">New Stock Transfer</button>') +
      '<div class="grid kpis">' + H.kpi("Total Transfers", transfers.length, "") +
      H.kpi("Pending", transfers.filter(function (t) { return t.status === "Pending"; }).length, "Awaiting approval") +
      H.kpi("In Transit", transfers.filter(function (t) { return t.status === "In Transit"; }).length, "") +
      H.kpi("Received", transfers.filter(function (t) { return t.status === "Received"; }).length, "") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (transfers.length ? '<div class="table-wrap"><table><thead><tr><th>Transfer ID</th><th>From</th><th>To</th><th>Product</th><th class="num">Qty</th><th>Status</th><th></th></tr></thead><tbody>' +
        transfers.map(function (t) {
          return "<tr><td><b>" + H.esc(t.transfer_no) + "</b></td><td>" + H.esc(brName[t.from_branch_id] || "-") + "</td><td>" + H.esc(brName[t.to_branch_id] || "-") + "</td><td>" + H.esc(prodName[t.product_id] || "-") +
            '</td><td class="num">' + H.num(t.qty) + "</td><td>" + H.pill(t.status) + '</td><td><button class="btn btn-sm" data-etr="' + t.id + '">Update Status</button></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No stock transfers found", "Create your first stock transfer to move inventory between branches.", null, "")) + "</div>";
    H.q("#newTr", root).onclick = function () {
      if (branches.length < 2) { H.toast("Add at least 2 branches first (Branches page).", true); return; }
      if (!products.length) { H.toast("Add a product first.", true); return; }
      H.openModal({
        title: "New Stock Transfer", sub: "Transfer products between branches.",
        body: '<div class="form-grid">' +
          H.field("From Branch", H.sel("f_from", branches.map(function (b) { return { value: b.id, label: b.name }; }), branches[0].id)) +
          H.field("To Branch", H.sel("f_to", branches.map(function (b) { return { value: b.id, label: b.name }; }), branches[1].id)) +
          H.field("Select Product", H.sel("f_prod", products.map(function (p) { return { value: p.id, label: p.name + " (stock " + H.num(p.stock) + ")" }; }), products[0].id), true) +
          H.field("Quantity to Transfer", H.inp("f_qty", "1", 'type="number" min="0" step="0.01"')) +
          H.field("Notes (Optional)", H.inp("f_notes", "", 'placeholder="Reason for transfer..."')) + "</div>",
        submitLabel: "Create Transfer",
        onSubmit: async function (form) {
          if (H.val("f_from", form) === H.val("f_to", form)) { H.toast("From and To branches must differ", true); return false; }
          var rows = await DB.insert("stock_transfers", {
            transfer_no: H.uid("TRF"), from_branch_id: H.val("f_from", form), to_branch_id: H.val("f_to", form),
            product_id: H.val("f_prod", form), qty: H.num(H.val("f_qty", form)), status: "Pending", notes: H.val("f_notes", form)
          });
          await H.audit("Create", "Stock transfer " + rows[0].transfer_no);
          H.toast("Transfer created"); window.PAGES.transfers(root);
        }
      });
    };
    H.qa("[data-etr]", root).forEach(function (b) {
      b.onclick = function () {
        var t = transfers.find(function (x) { return x.id === b.dataset.etr; });
        H.openModal({
          title: "Transfer " + t.transfer_no, body: H.field("Status", H.sel("f_status", STATUSES.map(function (s) { return { value: s, label: s }; }), t.status), true),
          submitLabel: "Save Status",
          onSubmit: async function (form) {
            var next = H.val("f_status", form);
            await DB.update("stock_transfers", t.id, { status: next });
            if (next === "Received" && t.status !== "Received") {
              // Stock is tracked globally per product in this schema, so a received transfer
              // nets to zero units overall; both legs are written to the movement audit.
              await DB.insert("stock_movements", { product_id: t.product_id, branch_id: t.from_branch_id, type: "Transfer Out", qty: -H.num(t.qty), ref: t.transfer_no, note: "To " + (brName[t.to_branch_id] || "") });
              await DB.insert("stock_movements", { product_id: t.product_id, branch_id: t.to_branch_id, type: "Transfer In", qty: H.num(t.qty), ref: t.transfer_no, note: "From " + (brName[t.from_branch_id] || "") });
            }
            await H.audit("Update", "Transfer " + t.transfer_no + " -> " + next);
            H.toast("Status updated"); window.PAGES.transfers(root);
          }
        });
      };
    });
  };

  // ---------------- Purchases ----------------
  window.PAGES.purchases = async function (root) {
    var data = await Promise.all([
      DB.get("purchases", H.branchQ({ select: "*", order: "created_at.desc", limit: 500 })),
      DB.get("suppliers", { select: "*", order: "name.asc" }),
      DB.get("products", { select: "*", order: "name.asc", limit: 1000 }),
      DB.get("purchase_items", { select: "*", limit: 5000 })
    ]);
    var purchases = data[0], suppliers = data[1], products = data[2], allItems = data[3];
    var supName = {}; suppliers.forEach(function (s) { supName[s.id] = s.name; });
    var totalAmt = purchases.reduce(function (a, p) { return a + H.num(p.total); }, 0);
    var totalUnits = allItems.reduce(function (a, i) { return a + H.num(i.qty); }, 0);

    root.innerHTML =
      H.pageHead("Purchase Orders", "Manage supplier orders and goods receipts", '<button class="btn btn-primary" id="newPo">New Purchase Order</button>') +
      '<div class="grid kpis">' + H.kpi("Total Purchases", H.fmt(totalAmt), purchases.length + " orders") +
      H.kpi("Pending Orders", purchases.filter(function (p) { return p.status === "Pending"; }).length, "Awaiting approval") +
      H.kpi("Received Orders", purchases.filter(function (p) { return p.status === "Received"; }).length, "Goods received") +
      H.kpi("Total Items Ordered", totalUnits, "Units ordered") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (purchases.length ? '<div class="table-wrap"><table><thead><tr><th>PO No</th><th>Date</th><th>Supplier</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th><th></th></tr></thead><tbody>' +
        purchases.map(function (p) {
          return "<tr><td><b>" + H.esc(p.po_no) + "</b></td><td>" + H.fmtDay(p.order_date || p.created_at) + "</td><td>" + H.esc(supName[p.supplier_id] || "-") +
            '</td><td class="num">' + H.fmt(p.total) + '</td><td class="num">' + H.fmt(p.amount_paid) + '</td><td class="num">' + H.fmt(Math.max(0, H.num(p.total) - H.num(p.amount_paid))) +
            "</td><td>" + H.pill(p.status) + '</td><td><span class="btn-row"><button class="btn btn-sm" data-epo="' + p.id + '">Edit</button><button class="btn btn-sm" data-dpo="' + p.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No purchase orders found", "Create your first purchase order to start ordering from suppliers.", null, "")) + "</div>";

    H.q("#newPo", root).onclick = function () {
      if (!suppliers.length) { H.toast("Add a supplier first.", true); return; }
      if (!products.length) { H.toast("Add a product first.", true); return; }
      var lines = [];
      var body = '<div class="form-grid">' +
        H.field("Supplier", H.sel("f_sup", suppliers.map(function (s) { return { value: s.id, label: s.name }; }), suppliers[0].id)) +
        H.field("Order Date", H.inp("f_date", new Date().toISOString().slice(0, 10), 'type="date"')) +
        H.field("Status", H.sel("f_status", ["Pending", "Approved", "Received", "Cancelled"].map(function (s) { return { value: s, label: s }; }), "Pending")) +
        H.field("Amount Paid", H.inp("f_paid", "0", 'type="number" min="0" step="0.01"')) +
        H.field("Select Product", H.sel("f_prod", products.map(function (p) { return { value: p.id, label: p.name }; }), products[0].id), true) +
        H.field("Quantity", H.inp("f_qty", "1", 'type="number" min="0" step="0.01"')) +
        H.field("Unit Cost", H.inp("f_cost", H.num(products[0].cost), 'type="number" min="0" step="0.01"')) +
        '</div><div class="btn-row" style="margin:10px 0"><button type="button" class="btn" id="addLine">Add Item</button></div>' +
        '<div id="poLines"><p style="color:var(--muted)">No items added yet. Select a product and click Add Item.</p></div>' +
        '<div class="totals"><div class="row grand"><span>Total Amount</span><span id="poTotal">$0.00</span></div></div>';
      var m = H.openModal({
        title: "New Purchase Order", sub: "If status is Received, stock is added automatically.", body: body, wide: true, submitLabel: "Create Purchase Order",
        onSubmit: async function (form) {
          if (!lines.length) { H.toast("Add at least one item", true); return false; }
          var total = lines.reduce(function (a, l) { return a + l.qty * l.unit_cost; }, 0);
          var rows = await DB.insert("purchases", {
            po_no: H.uid("PO"), supplier_id: H.val("f_sup", form), order_date: H.val("f_date", form) || null,
            branch_id: X.branchId !== "all" ? X.branchId : null, status: H.val("f_status", form),
            total: +total.toFixed(2), amount_paid: H.num(H.val("f_paid", form))
          });
          var po = rows[0];
          for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            await DB.insert("purchase_items", { purchase_id: po.id, product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_cost: l.unit_cost, line_total: +(l.qty * l.unit_cost).toFixed(2) });
            if (po.status === "Received") await addStock(l.product_id, l.qty, "Purchase", po.po_no, "Goods received");
          }
          await H.audit("Create", "Purchase order " + po.po_no + " total " + H.fmt(total));
          H.toast("Purchase order created"); window.PAGES.purchases(root);
        }
      });
      function drawLines() {
        H.q("#poLines", m).innerHTML = lines.length ? lines.map(function (l, i) {
          return '<div class="cart-line"><div class="grow"><b>' + H.esc(l.product_name) + "</b><small>" + l.qty + " x " + H.fmt(l.unit_cost) + '</small></div><b>' + H.fmt(l.qty * l.unit_cost) + '</b><button type="button" class="btn btn-ghost btn-sm" data-rl="' + i + '">&times;</button></div>';
        }).join("") : '<p style="color:var(--muted)">No items added yet.</p>';
        H.q("#poTotal", m).textContent = H.fmt(lines.reduce(function (a, l) { return a + l.qty * l.unit_cost; }, 0));
        H.qa("[data-rl]", m).forEach(function (b) { b.onclick = function () { lines.splice(+b.dataset.rl, 1); drawLines(); }; });
      }
      H.q("#f_prod", m).onchange = function () {
        var p = products.find(function (x) { return x.id === H.q("#f_prod", m).value; });
        if (p) H.q("#f_cost", m).value = H.num(p.cost);
      };
      H.q("#addLine", m).onclick = function () {
        var p = products.find(function (x) { return x.id === H.q("#f_prod", m).value; });
        lines.push({ product_id: p.id, product_name: p.name, qty: H.num(H.q("#f_qty", m).value), unit_cost: H.num(H.q("#f_cost", m).value) });
        drawLines();
      };
    };
    H.qa("[data-epo]", root).forEach(function (b) {
      b.onclick = function () {
        var p = purchases.find(function (x) { return x.id === b.dataset.epo; });
        H.openModal({
          title: "Edit Purchase Order " + p.po_no, sub: "Changing status to Received adds the ordered items into stock (once).",
          body: '<div class="form-grid">' +
            H.field("Status", H.sel("f_status", ["Pending", "Approved", "Received", "Cancelled"].map(function (s) { return { value: s, label: s }; }), p.status)) +
            H.field("Amount Paid", H.inp("f_paid", p.amount_paid, 'type="number" min="0" step="0.01"')) + "</div>",
          onSubmit: async function (form) {
            var next = H.val("f_status", form);
            await DB.update("purchases", p.id, { status: next, amount_paid: H.num(H.val("f_paid", form)) });
            if (next === "Received" && p.status !== "Received") {
              var items = allItems.filter(function (i) { return i.purchase_id === p.id; });
              for (var i = 0; i < items.length; i++) if (items[i].product_id) await addStock(items[i].product_id, H.num(items[i].qty), "Purchase", p.po_no, "Goods received");
            }
            await H.audit("Update", "Purchase " + p.po_no + " -> " + next);
            H.toast("Purchase updated"); window.PAGES.purchases(root);
          }
        });
      };
    });
    H.qa("[data-dpo]", root).forEach(function (b) {
      b.onclick = function () {
        var p = purchases.find(function (x) { return x.id === b.dataset.dpo; });
        H.confirmDelete("purchase order " + p.po_no, async function () { await DB.remove("purchases", p.id); await H.audit("Delete", "Purchase " + p.po_no); window.PAGES.purchases(root); });
      };
    });
  };

  // ---------------- Purchase Returns ----------------
  window.PAGES["purchase-returns"] = async function (root) {
    var data = await Promise.all([
      DB.get("purchase_returns", { select: "*", order: "created_at.desc", limit: 500 }),
      DB.get("purchases", { select: "id,po_no,total", order: "created_at.desc", limit: 500 })
    ]);
    var returns = data[0], purchases = data[1];
    var poById = {}; purchases.forEach(function (p) { poById[p.id] = p; });
    var totalRefunds = returns.reduce(function (a, r) { return a + H.num(r.amount); }, 0);
    root.innerHTML =
      H.pageHead("Purchase Returns", "Return goods to suppliers and track refunds", '<button class="btn btn-primary" id="newPr">New Purchase Return</button>') +
      '<div class="grid kpis">' + H.kpi("Total Refunds", H.fmt(totalRefunds), returns.length + " returns") + H.kpi("Total Returns", returns.length, "") +
      H.kpi("Pending Returns", returns.filter(function (r) { return r.status === "Pending"; }).length, "Awaiting approval") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (returns.length ? '<div class="table-wrap"><table><thead><tr><th>Return ID</th><th>PO Number</th><th>Date</th><th class="num">Amount</th><th>Status</th><th>Reason</th></tr></thead><tbody>' +
        returns.map(function (r) {
          return "<tr><td><b>" + H.esc(r.return_no) + "</b></td><td>" + (r.purchase_id && poById[r.purchase_id] ? H.esc(poById[r.purchase_id].po_no) : "-") + "</td><td>" + H.fmtDate(r.created_at) + '</td><td class="num">' + H.fmt(r.amount) + "</td><td>" + H.pill(r.status) + "</td><td>" + H.esc(r.reason || "-") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No purchase returns found", "Return damaged or defective goods to your suppliers.", null, "")) + "</div>";
    H.q("#newPr", root).onclick = function () {
      if (!purchases.length) { H.toast("No purchase orders exist yet.", true); return; }
      H.openModal({
        title: "New Purchase Return", body: '<div class="form-grid">' +
          H.field("Purchase Order", H.sel("f_po", purchases.map(function (p) { return { value: p.id, label: p.po_no + " — " + H.fmt(p.total) }; }), purchases[0].id), true) +
          H.field("Amount", H.inp("f_amount", H.num(purchases[0].total), 'type="number" min="0" step="0.01"')) +
          H.field("Status", H.sel("f_status", ["Processed", "Pending", "Rejected"].map(function (s) { return { value: s, label: s }; }), "Processed")) +
          H.field("Reason", H.inp("f_reason", "", 'placeholder="e.g. Defective goods"'), true) + "</div>",
        submitLabel: "Create Purchase Return",
        onSubmit: async function (form) {
          var rows = await DB.insert("purchase_returns", {
            return_no: H.uid("PRT"), purchase_id: H.val("f_po", form) || null,
            amount: H.num(H.val("f_amount", form)), status: H.val("f_status", form), reason: H.val("f_reason", form)
          });
          await H.audit("Create", "Purchase return " + rows[0].return_no);
          H.toast("Purchase return saved"); window.PAGES["purchase-returns"](root);
        }
      });
    };
  };

  // ---------------- Suppliers ----------------
  window.PAGES.suppliers = async function (root) {
    var data = await Promise.all([
      DB.get("suppliers", { select: "*", order: "name.asc" }),
      DB.get("purchases", { select: "*", limit: 1000 })
    ]);
    var suppliers = data[0], purchases = data[1];
    function totalsFor(id) {
      var list = purchases.filter(function (p) { return p.supplier_id === id; });
      var total = list.reduce(function (a, p) { return a + H.num(p.total); }, 0);
      var paid = list.reduce(function (a, p) { return a + H.num(p.amount_paid); }, 0);
      return { total: total, paid: paid, due: Math.max(0, total - paid) };
    }
    var allDue = suppliers.reduce(function (a, s) { return a + totalsFor(s.id).due; }, 0);
    function openForm(s) {
      s = s || {};
      H.openModal({
        title: s.id ? "Edit Supplier" : "Add New Supplier",
        body: '<div class="form-grid">' +
          H.field("Supplier Name *", H.inp("f_name", s.name)) +
          H.field("Contact Person", H.inp("f_contact", s.contact_name)) +
          H.field("Email", H.inp("f_email", s.email, 'type="email"')) +
          H.field("Phone", H.inp("f_phone", s.phone)) +
          H.field("Address", '<textarea id="f_addr" rows="2">' + H.esc(s.address || "") + "</textarea>", true) + "</div>",
        onSubmit: async function (form) {
          var row = { name: H.val("f_name", form), contact_name: H.val("f_contact", form), email: H.val("f_email", form), phone: H.val("f_phone", form), address: H.val("f_addr", form) };
          if (!row.name) { H.toast("Name is required", true); return false; }
          if (s.id) { await DB.update("suppliers", s.id, row); await H.audit("Update", "Supplier " + row.name); }
          else { await DB.insert("suppliers", row); await H.audit("Create", "Supplier " + row.name); }
          H.toast("Supplier saved"); window.PAGES.suppliers(root);
        }
      });
    }
    root.innerHTML =
      H.pageHead("Suppliers & Dues", "Totals below are computed from real purchase orders", '<button class="btn btn-primary" id="addSup">Add New Supplier</button>') +
      '<div class="grid kpis">' + H.kpi("Total Suppliers", suppliers.length, "") +
      H.kpi("Total Outstanding Dues", H.fmt(allDue), "Computed from purchases", allDue > 0 ? "warn" : "") +
      H.kpi("Suppliers With Dues", suppliers.filter(function (s) { return totalsFor(s.id).due > 0; }).length, "") + "</div>" +
      '<div class="card" style="margin-top:14px">' +
      (suppliers.length ? '<div class="table-wrap"><table><thead><tr><th>Supplier</th><th>Contact</th><th class="num">Total Purchases</th><th class="num">Total Paid</th><th class="num">Outstanding Dues</th><th>Status</th><th></th></tr></thead><tbody>' +
        suppliers.map(function (s) {
          var t = totalsFor(s.id);
          return "<tr><td><b>" + H.esc(s.name) + "</b></td><td>" + H.esc([s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") || "-") +
            '</td><td class="num">' + H.fmt(t.total) + '</td><td class="num">' + H.fmt(t.paid) + '</td><td class="num">' + H.fmt(t.due) + "</td><td>" +
            (t.due > 0 ? H.pill("Due") : H.pill("Clear")) +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-esup="' + s.id + '">Edit</button><button class="btn btn-sm" data-dsup="' + s.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No suppliers yet", "Add your first supplier to start purchasing.", null, "")) + "</div>";
    H.q("#addSup", root).onclick = function () { openForm(null); };
    H.qa("[data-esup]", root).forEach(function (b) { b.onclick = function () { openForm(suppliers.find(function (s) { return s.id === b.dataset.esup; })); }; });
    H.qa("[data-dsup]", root).forEach(function (b) { b.onclick = function () { var s = suppliers.find(function (x) { return x.id === b.dataset.dsup; }); H.confirmDelete("supplier " + s.name, async function () { await DB.remove("suppliers", s.id); await H.audit("Delete", "Supplier " + s.name); window.PAGES.suppliers(root); }); }; });
  };

  // ---------------- Customers ----------------
  window.PAGES.customers = async function (root) {
    var data = await Promise.all([
      DB.get("customers", { select: "*", order: "name.asc" }),
      DB.get("sales", { select: "*", limit: 1000 })
    ]);
    var customers = data[0], sales = data[1];
    function totalsFor(id) {
      var list = sales.filter(function (s) { return s.customer_id === id; });
      var total = list.reduce(function (a, s) { return a + H.num(s.total); }, 0);
      var paid = list.reduce(function (a, s) { return a + H.num(s.amount_paid); }, 0);
      return { total: total, due: Math.max(0, total - paid) };
    }
    var allDue = customers.reduce(function (a, c) { return a + totalsFor(c.id).due; }, 0);
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var newThisMonth = customers.filter(function (c) { return new Date(c.created_at) >= monthStart; }).length;
    function openForm(c) {
      c = c || {};
      H.openModal({
        title: c.id ? "Edit Customer" : "Add New Customer", sub: "Create a customer profile.",
        body: '<div class="form-grid">' +
          H.field("Full Name *", H.inp("f_name", c.name, 'placeholder="e.g. John Smith"')) +
          H.field("Email", H.inp("f_email", c.email, 'type="email" placeholder="john@example.com"')) +
          H.field("Phone", H.inp("f_phone", c.phone, 'placeholder="+1 (555) 123-4567"')) +
          H.field("Credit Limit", H.inp("f_credit", c.credit_limit, 'type="number" min="0" step="0.01"')) +
          H.field("Address", '<textarea id="f_addr" rows="2">' + H.esc(c.address || "") + "</textarea>", true) + "</div>",
        submitLabel: "Save Customer",
        onSubmit: async function (form) {
          var row = { name: H.val("f_name", form), email: H.val("f_email", form), phone: H.val("f_phone", form), credit_limit: H.num(H.val("f_credit", form)), address: H.val("f_addr", form) };
          if (!row.name) { H.toast("Name is required", true); return false; }
          if (c.id) { await DB.update("customers", c.id, row); await H.audit("Update", "Customer " + row.name); }
          else { await DB.insert("customers", row); await H.audit("Create", "Customer " + row.name); }
          H.toast("Customer saved"); window.PAGES.customers(root);
        }
      });
    }
    root.innerHTML =
      H.pageHead("Customers & Credit", "Balances below are computed from real sales", '<button class="btn btn-primary" id="addCust">Add New Customer</button>') +
      '<div class="grid kpis">' + H.kpi("Total Customers", customers.length, "") +
      H.kpi("Total Credit Outstanding", H.fmt(allDue), "Computed from unpaid sales", allDue > 0 ? "warn" : "") +
      H.kpi("Active Customers", customers.filter(function (c) { return c.is_active !== false; }).length, "Of " + customers.length + " total") +
      H.kpi("New This Month", newThisMonth, "") + "</div>" +
      '<div class="card" style="margin-top:14px"><div class="toolbar"><input type="search" id="cSearch" placeholder="Search by name, phone or email..."></div><div id="custTable"></div></div>';
    function draw(list) {
      H.q("#custTable", root).innerHTML = list.length ?
        '<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th class="num">Total Purchases</th><th class="num">Outstanding</th><th class="num">Credit Limit</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          var t = totalsFor(c.id);
          return "<tr><td><b>" + H.esc(c.name) + "</b></td><td>" + H.esc([c.email, c.phone].filter(Boolean).join(" · ") || "-") +
            '</td><td class="num">' + H.fmt(t.total) + '</td><td class="num">' + H.fmt(t.due) + '</td><td class="num">' + H.fmt(c.credit_limit) +
            "</td><td>" + (c.is_active === false ? H.pill("Inactive") : H.pill("Active")) +
            '</td><td><span class="btn-row"><button class="btn btn-sm" data-ecust="' + c.id + '">Edit</button><button class="btn btn-sm" data-dcust="' + c.id + '">Delete</button></span></td></tr>';
        }).join("") + "</tbody></table></div>"
        : H.emptyState("No customers yet", "Add your first customer profile.", null, "");
      H.qa("[data-ecust]", root).forEach(function (b) { b.onclick = function () { openForm(customers.find(function (c) { return c.id === b.dataset.ecust; })); }; });
      H.qa("[data-dcust]", root).forEach(function (b) { b.onclick = function () { var c = customers.find(function (x) { return x.id === b.dataset.dcust; }); H.confirmDelete("customer " + c.name, async function () { await DB.remove("customers", c.id); await H.audit("Delete", "Customer " + c.name); window.PAGES.customers(root); }); }; });
    }
    H.q("#addCust", root).onclick = function () { openForm(null); };
    H.q("#cSearch", root).addEventListener("input", function (e) { draw(H.searchFilter(customers, e.target.value, ["name", "email", "phone"])); });
    draw(customers);
  };
})();
