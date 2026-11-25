// XonaERP — Supabase PostgREST data layer (plain fetch, no SDK, no build step)
// All reads/writes go through here so every page uses ONE source of truth: the tables.
(function () {
  var LS_KEY = "xona_cfg";

  function getCfg() {
    var file = window.XONA_CONFIG || {};
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { saved = {}; }
    return {
      url: (saved.supabaseUrl || file.supabaseUrl || "").replace(/\/+$/, ""),
      key: saved.supabaseAnonKey || file.supabaseAnonKey || ""
    };
  }
  function saveCfg(url, key) {
    localStorage.setItem(LS_KEY, JSON.stringify({
      supabaseUrl: (url || "").replace(/\/+$/, ""),
      supabaseAnonKey: key || ""
    }));
  }
  function configured() { var c = getCfg(); return !!(c.url && c.key); }

  function headers(extra) {
    var c = getCfg();
    var h = { "apikey": c.key, "Authorization": "Bearer " + c.key, "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  // request(method, path, body, prefer) -> parsed JSON; throws {status, code, message}
  async function request(method, path, body, prefer) {
    var c = getCfg();
    if (!c.url || !c.key) throw { status: 0, code: "NOT_CONFIGURED", message: "Supabase URL / anon key not set. Open the Setup page." };
    var hdrs = headers(prefer ? { "Prefer": prefer } : null);
    var res;
    try {
      res = await fetch(c.url + "/rest/v1/" + path, {
        method: method,
        headers: hdrs,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw { status: 0, code: "NETWORK", message: "Network error reaching Supabase: " + e.message };
    }
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      var msg = (data && (data.message || data.hint)) || ("HTTP " + res.status);
      throw { status: res.status, code: (data && data.code) || ("HTTP_" + res.status), message: msg, details: data };
    }
    return data;
  }

  // get(table, params) params = {select:'*', order:'created_at.desc', limit:100, 'branch_id':'eq.<uuid>'}
  function buildQuery(params) {
    if (!params) return "";
    var parts = [];
    for (var k in params) {
      if (params[k] === undefined || params[k] === null || params[k] === "") continue;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    }
    return parts.length ? "?" + parts.join("&") : "";
  }

  var DB = {
    getCfg: getCfg, saveCfg: saveCfg, configured: configured,
    get: function (table, params) { return request("GET", table + buildQuery(params)); },
    insert: function (table, row) { return request("POST", table, row, "return=representation"); },
    upsert: function (table, row) { return request("POST", table, row, "resolution=merge-duplicates,return=representation"); },
    update: function (table, id, patch) { return request("PATCH", table + "?id=eq." + encodeURIComponent(id), patch, "return=representation"); },
    updateWhere: function (table, query, patch) { return request("PATCH", table + "?" + query, patch, "return=representation"); },
    remove: function (table, id) { return request("DELETE", table + "?id=eq." + encodeURIComponent(id), null, "return=representation"); },
    // Friendly connection test used by the Setup page and the global banner.
    test: async function () {
      try {
        await DB.get("products", { select: "id", limit: 1 });
        return { ok: true };
      } catch (e) {
        return { ok: false, status: e.status, code: e.code, message: e.message };
      }
    }
  };
  window.DB = DB;
})();
