// Wishrack app: passcode gate, save strip, review with crop editor, rack grid, item sheet, settings.
// Talks to the Worker at /api/* (see worker/index.js). No framework, no build step.
(() => {
  "use strict";

  // ------------------------------------------------------------ helpers
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, attrs, ...kids) {
    const el = tag === "svg" || attrs?.svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false || k === "svg") continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== "string" && !(el instanceof SVGElement)) el[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const ICON = {
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.5A7.4 7.4 0 0 0 6.9 6.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.4 7.4 0 0 0 2.6-1.5l2.3 1 2-3.4-2-1.5Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-5 4 4 2.5-2.5 3.5 3.5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4L11.6 6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M9 7V4.5h6V7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    crop: '<path d="M7 3v13.5A.5.5 0 0 0 7.5 17H21"/><path d="M3 7h13.5a.5.5 0 0 1 .5.5V21"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19.5h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
  };
  const icon = (name, size = 20) => h("svg", { class: "ic", viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", html: ICON[name] });

  const num = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? n : null; };
  const money = (n, dec) => n == null ? "" : "Rs. " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: n % 1 ? 2 : 0 });
  const newId = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const isUrl = (s) => /^https?:\/\/\S+\.\S+/i.test(String(s || "").trim());
  const findUrl = (s) => (String(s || "").match(/https?:\/\/[^\s<>"']+/i) || [""])[0];
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\d?\./, ""); } catch { return ""; } };
  const daysAgo = (t) => { if (!t) return ""; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 45 ? d + " days ago" : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };
  const dateShort = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const query = (it) => [it.brand && !String(it.title || "").toLowerCase().includes(String(it.brand).toLowerCase()) ? it.brand : (it.store || ""), it.title].filter(Boolean).join(" ").trim();
  const pctOff = (it) => it.mrp && it.price && it.mrp > it.price ? Math.round((1 - it.price / it.mrp) * 100) : 0;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

  const SEARCH = [
    { name: "Myntra", url: (q) => "https://www.myntra.com/" + encodeURIComponent(q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) + "?rawQuery=" + encodeURIComponent(q) },
    { name: "Amazon", url: (q) => "https://www.amazon.in/s?k=" + encodeURIComponent(q) },
    { name: "Flipkart", url: (q) => "https://www.flipkart.com/search?q=" + encodeURIComponent(q) },
    { name: "Ajio", url: (q) => "https://www.ajio.com/search/?text=" + encodeURIComponent(q) },
    { name: "Google Shopping", url: (q) => "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(q) },
  ];
  const storeLink = (it) => it.url || "https://www.google.com/search?q=" + encodeURIComponent(query(it) + " " + (it.store || ""));
  const imgSrc = (it) => it.imageId ? "/api/images/" + it.imageId : "";
  const recentDrop = (it) => it.previousPrice && it.price != null && it.price < it.previousPrice && it.priceChangedAt && Date.now() - it.priceChangedAt < 14 * 864e5;

  // ------------------------------------------------------------ API
  let key = store.get("wr.key", "");
  class ApiError extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }
  async function api(path, opts = {}) {
    let r;
    try {
      r = await fetch(path, { ...opts, headers: { "x-wishrack-key": key, ...(opts.headers || {}) } });
    } catch { throw new ApiError(0, "offline", "Can't reach Wishrack. Check your connection."); }
    const type = r.headers.get("content-type") || "";
    if (!type.includes("json")) { if (r.ok) return r; throw new ApiError(r.status, "http", "Wishrack answered with an error (" + r.status + ")."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { lock("That passcode didn't work. Type it again."); }
      throw new ApiError(r.status, j.error || "http", j.message || "Something went wrong (" + r.status + ").");
    }
    return j;
  }

  // ------------------------------------------------------------ state
  const state = {
    items: [], loaded: false, store: store.get("wr.store", "all"), sort: store.get("wr.sort", "new"),
    review: null, openId: null, ai: null, note: "", view: null, query: "", slide: 0,
  };
  try { state.items = JSON.parse(store.get("wr.cache", "[]")) || []; } catch { state.items = []; }

  async function loadItems() {
    try {
      const j = await api("/api/items");
      state.items = j.items || []; state.loaded = true; state.note = "";
      store.set("wr.cache", JSON.stringify(state.items));
    } catch (e) {
      if (e.status === 401) return;
      state.loaded = true;
      state.note = state.items.length ? "Offline. Showing the rack saved on this device; changes need a connection." : e.message;
    }
    render();
    refreshFromPhone();
  }

  // ------------------------------------------------------------ Shopify stores, read from this phone
  // Many stores (Bonkers Corner and most Instagram brands) run on Shopify, which blocks Cloudflare's servers but
  // lets any site read its public product data. So for those, this phone reads price and photo itself.
  const shopifyJsUrl = (u) => { try { const x = new URL(u); return /\/products\/[^/]+/.test(x.pathname) ? x.origin + x.pathname.replace(/\/$/, "") + ".js" : ""; } catch { return ""; } };
  async function readShopify(url) {
    const js = shopifyJsUrl(url);
    if (!js) return null;
    try {
      const r = await fetch(js, { credentials: "omit" });
      if (!r.ok) return null;
      const p = await r.json();
      const v = (p.variants || []).find((x) => x.available) || (p.variants || [])[0] || {};
      const price = (v.price ?? p.price) / 100, cmp = (v.compare_at_price ?? p.compare_at_price) / 100;
      const img = p.featured_image || (p.images || [])[0] || "";
      return { title: p.title || "", brand: p.vendor || "", price: price > 0 ? price : null, mrp: cmp > price ? cmp : null,
        image: img ? new URL(img.startsWith("//") ? "https:" + img : img, url).href : "" };
    } catch { return null; }
  }
  async function fetchPhoto(src) {
    try { const r = await fetch(src, { credentials: "omit" }); if (r.ok) return await r.blob(); } catch {}
    try { return await (await api("/api/fetch-image?url=" + encodeURIComponent(src))).blob(); } catch { return null; }
  }
  // Finds a screenshot's product on its Shopify store by name, for the store's clean photo, link and live price.
  // The Android app searches from the phone (some stores block Cloudflare); elsewhere the Worker passes the search on.
  const shopWaits = {};
  window.__wrShop = (id, text) => { const f = shopWaits[id]; delete shopWaits[id]; if (f) f(text); };
  async function shopSearch(site, q) {
    const A = window.WishrackAndroid;
    if (A && A.shopSearch) {
      const id = newId();
      const text = await new Promise((res) => { shopWaits[id] = res; A.shopSearch(id, site, q); setTimeout(() => window.__wrShop(id, ""), 12000); });
      try { return (JSON.parse(text)?.resources?.results?.products || []).map((p) => ({ title: String(p.title || ""), url: String(p.url || "") })); } catch { return []; }
    }
    try { return (await api(`/api/shop-search?site=${encodeURIComponent(site)}&q=${encodeURIComponent(q)}`)).products || []; } catch { return []; }
  }
  const words = (t) => String(t || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  // Share of the screenshot's name (and colour) found in a store title; 1 means every word is there.
  function nameMatch(want, colour, title) {
    const have = new Set(words(title)), need = [...new Set([...words(want), ...words(colour)])];
    return need.length ? need.filter((w) => have.has(w)).length / need.length : 0;
  }
  async function findOnStore(raw) {
    if (!raw.site || !raw.title || isUrl(raw.url)) return null;
    const list = await shopSearch(raw.site, raw.title);
    let best = null, score = 0;
    // A different colour of the same product is a different photo, so a known colour must be in the store's title.
    const colour = words(raw.colour), sameColour = (t) => { const have = words(t); return colour.every((w) => have.includes(w)); };
    for (const p of list) { const sc = sameColour(p.title) ? nameMatch(raw.title, "", p.title) : 0; if (sc > score) { best = p; score = sc; } }
    if (!best || score < 0.75 || !/^\/products\//.test(best.url)) return null;
    const url = `https://${raw.site}${best.url.split("?")[0]}`;
    const s = await readShopify(url);
    if (!s || !s.image) return null;
    const blob = await fetchPhoto(s.image);
    return blob ? { ...s, url, blob } : null;
  }
  // Same bookkeeping as the server's daily check: record a changed price in the history.
  function withPrice(it, price, mrp) {
    const now = Date.now(), next = { ...it, lastChecked: now, checkError: "" };
    if (price != null && (it.price == null || Math.abs(price - it.price) >= 1)) {
      const hist = Array.isArray(it.priceHistory) ? it.priceHistory.slice(-29) : [];
      if (it.price != null && !hist.length) hist.push({ t: it.addedAt || now, p: it.price });
      hist.push({ t: now, p: price });
      next.priceHistory = hist;
      if (it.price != null) { next.previousPrice = it.price; next.priceChangedAt = now; }
      next.price = price;
    }
    if (mrp != null) next.mrp = mrp;
    return next;
  }
  async function refreshOne(it) {
    const s = await readShopify(it.url);
    if (!s) return null;
    const next = withPrice(it, s.price, s.mrp);
    if (!next.title && s.title) next.title = s.title;
    if (!it.imageId && s.image) { const blob = await fetchPhoto(s.image); if (blob) next.imageId = await uploadPhoto(blob, null); }
    await putItem(next);
    return next;
  }
  let refreshing = false;
  async function refreshFromPhone() {
    if (refreshing || !key) return;
    refreshing = true;
    try {
      const due = state.items.filter((x) => !x.bought && !x.removed && shopifyJsUrl(x.url) && (!x.imageId || x.checkError || Date.now() - (x.lastChecked || 0) > 12 * 3600e3)).slice(0, 4);
      for (const it of due) { try { await refreshOne(it); } catch {} }
    } finally { refreshing = false; }
  }
  async function putItem(item) {
    const { id, ...body } = item;
    body.updatedAt = Date.now();
    const j = await api("/api/items/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const i = state.items.findIndex((x) => x.id === id);
    if (i >= 0) state.items[i] = j.item; else state.items.unshift(j.item);
    store.set("wr.cache", JSON.stringify(state.items));
    render();
    return j.item;
  }

  // ------------------------------------------------------------ images
  function loadImg(blob) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("That file isn't an image this browser can open.")); }; im.src = u; });
  }
  function normBox(b) {
    if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && isFinite(n))) return null;
    let [x0, y0, x1, y1] = b.map((n) => Math.min(1, Math.max(0, n)));
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    return x1 - x0 < 0.05 || y1 - y0 < 0.05 ? null : [x0, y0, x1, y1];
  }
  // Paints over shop buttons and badges left inside the crop, blending in the pixels around each spot.
  // Looks clean on plain studio backgrounds; on patterned clothing it shows as a soft smudge.
  function fillSpots(g, W, H, rects) {
    for (const r of rects) {
      const x0 = Math.max(0, Math.floor(r[0]) - 3), y0 = Math.max(0, Math.floor(r[1]) - 3);
      const x1 = Math.min(W, Math.ceil(r[2]) + 3), y1 = Math.min(H, Math.ceil(r[3]) + 3);
      const w = x1 - x0, hh = y1 - y0;
      if (w < 2 || hh < 2 || w * hh > W * H * 0.25) continue;
      const hasL = x0 > 0, hasR = x1 < W, hasT = y0 > 0, hasB = y1 < H;
      if (!hasL && !hasR && !hasT && !hasB) continue;
      const ox = Math.max(0, x0 - 1), oy = Math.max(0, y0 - 1);
      const d = g.getImageData(ox, oy, Math.min(W, x1 + 1) - ox, Math.min(H, y1 + 1) - oy), px = d.data, DW = d.width;
      const at = (x, y) => ((y - oy) * DW + (x - ox)) * 4;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const u = (x - x0 + 1) / (w + 1), v = (y - y0 + 1) / (hh + 1);
        const sum = [0, 0, 0]; let wt = 0;
        const add = (i, k) => { for (let c = 0; c < 3; c++) sum[c] += px[i + c] * k; wt += k; };
        // Each side counts more the closer the pixel is to it.
        if (hasL) add(at(x0 - 1, y), 1 / u);
        if (hasR) add(at(x1, y), 1 / (1 - u));
        if (hasT) add(at(x, y0 - 1), 1 / v);
        if (hasB) add(at(x, y1), 1 / (1 - v));
        const i = at(x, y);
        for (let c = 0; c < 3; c++) px[i + c] = sum[c] / wt;
        px[i + 3] = 255;
      }
      g.putImageData(d, ox, oy);
    }
  }
  // Like normBox, but small spots (a carousel dot row) are allowed.
  function normSpot(b) {
    if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && isFinite(n))) return null;
    const [x0, x1] = [b[0], b[2]].map((n) => Math.min(1, Math.max(0, n))).sort((a, c) => a - c);
    const [y0, y1] = [b[1], b[3]].map((n) => Math.min(1, Math.max(0, n))).sort((a, c) => a - c);
    return x1 - x0 > 0.003 && y1 - y0 > 0.003 ? [x0, y0, x1, y1] : null;
  }
  async function cropBlob(blob, box, maxW = 900, q = 0.85, spots = null) {
    const im = await loadImg(blob);
    const W = im.naturalWidth, H = im.naturalHeight;
    const b = normBox(box) || [0, 0, 1, 1];
    const sx = b[0] * W, sy = b[1] * H, sw = (b[2] - b[0]) * W, sh = (b[3] - b[1]) * H;
    const scale = Math.min(1, maxW / sw, 1400 / sh);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (spots && spots.length) {
      const kx = c.width / (b[2] - b[0]), ky = c.height / (b[3] - b[1]);
      fillSpots(g, c.width, c.height, spots.map((o) => [(o[0] - b[0]) * kx, (o[1] - b[1]) * ky, (o[2] - b[0]) * kx, (o[3] - b[1]) * ky])
        .filter((r) => r[2] > 0 && r[3] > 0 && r[0] < c.width && r[1] < c.height));
    }
    URL.revokeObjectURL(im.src);
    return new Promise((r) => c.toBlob((x) => r(x || blob), "image/jpeg", q));
  }
  async function uploadPhoto(blob, box, spots) {
    const jpg = await cropBlob(blob, box, 900, 0.85, spots);
    const j = await api("/api/images", { method: "POST", headers: { "content-type": "image/jpeg" }, body: jpg });
    return j.id;
  }
  async function shrinkForReading(file) {
    if (file.size < 3_500_000 && /^image\/(png|jpeg|webp)$/.test(file.type)) return file;
    return cropBlob(file, null, 1600, 0.9);
  }

  // ------------------------------------------------------------ reading screenshots
  async function readShot(file) {
    if (state.ai !== false) {
      try {
        const body = await shrinkForReading(file);
        const j = await api("/api/read-image", { method: "POST", headers: { "content-type": body.type || "image/jpeg" }, body });
        return { items: j.items || [], via: "Gemini", skip: j.skip || "" };
      } catch (e) {
        if (!["no_ai", "ai_limit", "ai_busy", "ai_key", "ai_model", "ai_error", "ai_unreadable", "offline"].includes(e.code)) throw e;
        if (e.code === "no_ai") state.ai = false;
        status(e.code === "no_ai" ? "Reading on this phone instead…" : e.message + " Reading on this phone instead…", { busy: true });
      }
    }
    return { items: [await readOnDevice(file)], via: "this device" };
  }
  let tesseract = null;
  async function readOnDevice(file) {
    try {
      if (!tesseract) {
        await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.append(s); });
        tesseract = window.Tesseract;
      }
      const { data } = await tesseract.recognize(file, "eng");
      return parseOcr(data.text || "");
    } catch { return { title: "", price: null, mrp: null, box: null, ocrFailed: true }; }
  }
  function parseOcr(text) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const prices = [];
    for (const m of text.matchAll(/(?:₹|Rs\.?|INR|MRP)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi)) { const n = num(m[1]); if (n && n >= 99 && n < 200000) prices.push(n); }
    const title = lines.find((l) => /[a-z]{3,}/i.test(l) && l.length >= 8 && l.length <= 80 && !/₹|Rs\.?\s*\d|add to|buy now|size|sponsored|follow|likes?$/i.test(l)) || "";
    const uniq = [...new Set(prices)];
    const price = uniq.length ? Math.min(...uniq.slice(0, 2)) : null;
    const mrp = uniq.length > 1 ? Math.max(...uniq.slice(0, 2)) : null;
    return { title, price, mrp: mrp && mrp > price ? mrp : null, box: null };
  }

  // ------------------------------------------------------------ status line
  let busyCtl = null;
  function status(msg, opts = {}) {
    const el = $("#status");
    el.replaceChildren();
    el.className = "status" + (opts.err ? " err" : opts.ok ? " ok" : "");
    if (!msg) return;
    if (opts.busy) el.append(h("span", { class: "spin", "aria-hidden": "true" }));
    else if (opts.ok) el.append(icon("check", 16));
    el.append(h("span", { text: msg }));
  }
  function progress(frac) {
    const p = $("#progress");
    p.hidden = frac == null;
    if (frac != null) $("#progressBar").style.width = Math.round(frac * 100) + "%";
  }

  // ------------------------------------------------------------ adding
  function startReview() { if (!state.review) state.review = { items: [] }; }
  function addReviewItem(raw, blob, via) {
    startReview();
    state.review.items.push({
      key: newId(), checked: true, via: via || "you",
      title: raw.title || "", brand: raw.brand || "", store: raw.store || "",
      url: isUrl(raw.url) ? raw.url : "", price: num(raw.price), mrp: num(raw.mrp),
      colour: raw.colour || "", size: raw.size || "",
      blob: blob || null, preview: blob ? URL.createObjectURL(blob) : "", box: normBox(raw.box) || (blob ? [0, 0, 1, 1] : null),
      site: raw.site || "", overlays: (raw.overlays || []).map(normSpot).filter(Boolean), clean: true,
      missingPrice: raw.price == null && via !== "you",
    });
  }
  // Swap the screenshot crop for the store's own photo (and its link and live price); the crop stays one tap away.
  function useStorePhoto(it, s) {
    it.shot = { blob: it.blob, preview: it.preview, box: it.box, origBox: it.origBox };
    Object.assign(it, { blob: s.blob, preview: URL.createObjectURL(s.blob), box: [0, 0, 1, 1], origBox: null, fromStore: true, url: s.url });
    if (s.price != null) { it.price = s.price; it.missingPrice = false; }
    if (s.mrp != null) it.mrp = s.mrp;
  }
  function useScreenshot(it) {
    URL.revokeObjectURL(it.preview);
    Object.assign(it, it.shot, { fromStore: false, shot: null });
  }
  async function handleImages(files) {
    files = [...files].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    showView("save");
    
    let found = 0, skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      progress(i / files.length);
      status(files.length > 1 ? `Reading screenshot ${i + 1} of ${files.length}…` : "Reading your screenshot…", { busy: true });
      try {
        const { items, via } = await readShot(f);
        // Gemini returns no items for non-clothing; the on-device fallback can't tell, so it needs at least a price.
        const list = items.filter((x) => x && (via === "Gemini" ? (x.title || x.price != null || x.box) : x.price != null));
        if (!list.length) { skipped++; continue; }
        list.slice(0, 8).forEach((it) => addReviewItem(it, f, via));
        found += list.length;
        renderReview();
        for (const it of state.review.items.slice(-Math.min(list.length, 8))) {
          if (!it.site || !it.title || it.url) continue;
          status(`Looking for it on ${it.site}…`, { busy: true });
          const s = await findOnStore(it).catch(() => null);
          if (s) { useStorePhoto(it, s); renderReview(); }
        }
        if (i === 0) $("#review").scrollIntoView({ block: "start", behavior: "smooth" });
      } catch (e) {
        status(e.message, { err: true }); progress(null);
        return;
      }
    }
    progress(null);
    const cnt = state.review ? state.review.items.length : 0;
    const skipNote = skipped ? ` Skipped ${skipped === 1 ? "1 screenshot" : skipped + " screenshots"} with no clothes or shoes.` : "";
    status(cnt ? "Check the details below, then save." + skipNote
      : files.length === 1 ? "No clothes or shoes found in that screenshot, so nothing was added. Use Add by hand if it was one."
      : `No clothes or shoes found in those ${files.length} screenshots, so nothing was added.`, {});
  }
  async function handleLink(url) {
    url = findUrl(url) || String(url || "").trim();
    showView("save");
    if (!isUrl(url)) { status("That doesn't look like a link. It should start with https://", { err: true }); return; }
    $("#linkIn").value = "";
    if (/instagram\.com/i.test(url)) {
      addReviewItem({ url: "", store: "" }, null, "you");
      renderReview();
      status("Instagram hides posts from apps without a login. Share a screenshot of the ad instead, or fill this in.", { err: false });
      return;
    }
    status("Reading the store page…", { busy: true });
    try {
      let r = await api("/api/read-link?url=" + encodeURIComponent(url));
      if (r.price == null || !r.image) {
        const s = await readShopify(url); // stores that block the server often still answer this phone
        if (s) r = { ...r, title: r.title || s.title, brand: r.brand || s.brand, price: r.price ?? s.price, mrp: r.mrp ?? s.mrp, image: r.image || s.image, source: "store" };
      }
      const blob = r.image ? await fetchPhoto(r.image) : null;
      addReviewItem({ ...r, url }, blob, r.source === "ai" ? "Gemini" : r.source === "none" ? "you" : "the store page");
      renderReview();
      status(r.price == null ? "Couldn't find a price on that page. Add it below if you know it." : "Check the details below, then save.", {});
    } catch (e) {
      addReviewItem({ url, store: "" }, null, "you");
      renderReview();
      status(e.message + " Fill in the details below.", { err: true });
    }
  }

  // ------------------------------------------------------------ lists
  // Items the Android app saved without a readable price wait in the inbox until accepted.
  // Bought and removed items leave the rack for the "Bought & removed" list, where they can be put back.
  const isGone = (x) => !!(x.bought || x.removed);
  const onRack = () => state.items.filter((x) => !x.inbox && !isGone(x));
  const goneItems = () => state.items.filter(isGone).sort((a, b) => (b.boughtAt || b.removedAt || b.updatedAt || 0) - (a.boughtAt || a.removedAt || a.updatedAt || 0));
  const dropped = () => onRack().filter((x) => x.previousPrice && x.price != null && x.price < x.previousPrice).sort((a, b) => (b.priceChangedAt || 0) - (a.priceChangedAt || 0));
  const matches = (x) => { const q = state.query.trim().toLowerCase(); return !q || [x.title, x.store, x.brand, x.colour].some((v) => String(v || "").toLowerCase().includes(q)); };
  function visibleItems() {
    let list = onRack().filter(matches);
    if (state.store !== "all") list = list.filter((x) => (x.store || "Other") === state.store);
    const p = (x) => x.price == null ? Infinity : x.price;
    if (state.sort === "low") list.sort((a, b) => p(a) - p(b));
    else if (state.sort === "high") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else if (state.sort === "off") list.sort((a, b) => pctOff(b) - pctOff(a));
    else if (state.sort === "drop") list.sort((a, b) => (recentDrop(b) ? b.priceChangedAt : 0) - (recentDrop(a) ? a.priceChangedAt : 0) || (b.addedAt || 0) - (a.addedAt || 0));
    else list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return list;
  }

  // ------------------------------------------------------------ pieces
  const hanger = (size) => h("svg", { class: "ic", viewBox: "0 0 24 24", width: size || 40, height: size || 40, "aria-hidden": "true", html: '<use href="#i-hanger"/>' });
  function photoImg(it, onFail) {
    const src = imgSrc(it);
    const ph = h("span", { class: "ph", "aria-hidden": "true" }, hanger(), onFail === false ? null : h("span", { text: "No photo yet" }));
    if (!src) return ph;
    const img = h("img", { src, alt: "", loading: "lazy", decoding: "async" });
    img.addEventListener("error", () => img.replaceWith(ph));
    return img;
  }
  const storeA = (it, cls, label, ...kids) => h("a", { class: cls, href: storeLink(it), target: "_blank", rel: "noopener noreferrer", "aria-label": label || ((it.url ? "Open at " : "Search for ") + (it.title || "this product") + (it.store ? ", " + it.store : "")) }, ...kids);
  function flagFor(it) {
    if (it.inbox && it.price == null) return h("span", { class: "flag sale", text: "No price" });
    if (recentDrop(it)) return h("span", { class: "flag" }, icon("down", 12), money(it.previousPrice - it.price));
    const off = pctOff(it);
    return off ? h("span", { class: "flag sale", text: off + "% off" }) : null;
  }
  function card(it) {
    return h("article", { class: "card" },
      h("div", { class: "panel" },
        storeA(it, "pic", null, photoImg(it), flagFor(it)),
        h("button", { class: "body", type: "button", onclick: () => openSheet(it.id), "aria-label": "Details for " + (it.title || "product") },
          h("span", { class: "store", text: [it.store, it.size ? "Size " + it.size : "", it.colour].filter(Boolean).join(" · ") || "Saved " + daysAgo(it.addedAt) }),
          h("span", { class: "name", text: it.title || "Untitled product" }))),
      h("div", { class: "foot" },
        it.price == null ? h("span", { class: "noprice", text: "No price yet" })
          : h("span", { class: "price" }, money(it.price), pctOff(it) ? h("s", { text: money(it.mrp) }) : null),
        storeA(it, "go", null, icon("out", 16))));
  }
  function wideCard(it) {
    const removed = it.removed && !it.bought;
    return h("button", { class: "gone-card" + (removed ? " is-removed" : ""), type: "button", onclick: () => openSheet(it.id) },
      h("span", { class: "thumb" }, photoImg(it, false)),
      h("span", { class: "txt" },
        removed ? h("span", { class: "state removed", text: "Removed" }) : h("span", { class: "state bought" }, icon("check", 11), "Bought"),
        h("span", { class: "name", text: it.title || "Untitled product" }),
        h("span", { class: "meta", text: [it.store, it.price != null ? money(it.price) : ""].filter(Boolean).join(" · ") })));
  }
  function goneItem(it) {
    const removed = it.removed && !it.bought;
    let armed = false;
    return h("article", { class: "gone-item" },
      h("button", { class: "thumb", type: "button", onclick: () => openSheet(it.id), "aria-label": "Details for " + (it.title || "product") }, photoImg(it, false)),
      h("div", { class: "txt" },
        removed ? h("span", { class: "state removed", text: "Removed " + daysAgo(it.removedAt) }) : h("span", { class: "state bought" }, icon("check", 11), "Bought " + daysAgo(it.boughtAt)),
        h("button", { class: "name", type: "button", onclick: () => openSheet(it.id), text: it.title || "Untitled product" }),
        h("span", { class: "meta", text: [it.store, it.price != null ? money(it.price) : ""].filter(Boolean).join(" · ") }),
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", onclick: () => putBack(it) }, removed ? "Put back" : "Back to wishlist"),
          h("button", { class: "btn small danger", type: "button", onclick: async (e) => {
            const b = e.currentTarget;
            if (!armed) { armed = true; b.textContent = "Tap again to delete"; setTimeout(() => { armed = false; if (b.isConnected) b.textContent = "Delete forever"; }, 3000); return; }
            try { await deleteForever(it); toast("Deleted for good."); } catch (err) { toast(err.message); }
          } }, "Delete forever"))));
  }

  // ------------------------------------------------------------ price-drop banner
  function renderBanner() {
    const el = $("#banner");
    const list = dropped();
    if (!list.length) {
      const live = onRack(), total = live.reduce((s, x) => s + (x.price || 0), 0);
      el.setAttribute("aria-label", "Your rack");
      el.replaceChildren(h("div", { class: "slide" },
        h("h2", { text: "No price drops yet" }),
        h("p", null, live.length ? ["Your ", h("b", { text: live.length + (live.length === 1 ? " item is" : " items are") }), " worth ", h("b", { text: money(total) }), ". Wishrack checks their prices every morning and shows drops here."] : "Save something you like and Wishrack will watch its price every morning.")),
        h("span", { class: "art empty", "aria-hidden": "true" }, hanger(46)));
      return;
    }
    state.slide = ((state.slide % list.length) + list.length) % list.length;
    const it = list[state.slide];
    el.setAttribute("aria-label", "Price drops, " + (state.slide + 1) + " of " + list.length);
    const go = (d) => { state.slide += d; renderBanner(); };
    el.replaceChildren(...[
      h("span", { class: "tag" }, icon("down", 12), money(it.previousPrice - it.price)),
      h("button", { class: "slide", type: "button", onclick: () => openSheet(it.id) },
        h("h2", { text: "Price dropped" }),
        h("p", null, (it.title || "This item") + " is now ", h("b", { text: money(it.price) }), (it.store ? " at " + it.store : "") + ", down from " + money(it.previousPrice) + ".")),
      h("span", { class: "art", "aria-hidden": "true" }, photoImg(it, false)),
      list.length > 1 ? h("button", { class: "arrow l", type: "button", "aria-label": "Previous drop", onclick: () => go(-1) }, icon("left", 18)) : null,
      list.length > 1 ? h("button", { class: "arrow r", type: "button", "aria-label": "Next drop", onclick: () => go(1) }, icon("right", 18)) : null,
      list.length > 1 ? h("div", { class: "dots" }, list.slice(0, 8).map((_, i) => h("button", { type: "button", "aria-label": "Drop " + (i + 1), "aria-current": i === state.slide ? "true" : "false", onclick: () => { state.slide = i; renderBanner(); } }))) : null].filter(Boolean));
  }

  // ------------------------------------------------------------ render
  function render() {
    const waiting = state.items.filter((x) => x.inbox && !isGone(x)).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    $("#inbox").hidden = !waiting.length;
    $("#inboxTitle").textContent = waiting.length === 1 ? "1 waiting for you" : waiting.length + " waiting for you";
    $("#inboxGrid").replaceChildren(...waiting.map(card));

    const live = onRack();
    const total = live.reduce((s, x) => s + (x.price || 0), 0);
    $("#tally").replaceChildren(...[h("b", { text: live.length + (live.length === 1 ? " item" : " items") }), " on your rack", ...(total ? [", worth ", h("b", { text: money(total) })] : [])]);
    renderBanner();

    const gone = goneItems();
    $("#goneStrip").hidden = !gone.length;
    $("#goneRow").replaceChildren(...gone.slice(0, 8).map(wideCard));
    $("#goneList").replaceChildren(...(gone.length ? gone.map(goneItem) : [h("div", { class: "empty" }, h("h3", { text: "Nothing here yet" }), h("p", { text: "When you mark something as bought, or remove it from your rack, it moves here." }))]));

    const stores = [...new Set(live.map((x) => x.store || "Other"))].sort();
    if (state.store !== "all" && !stores.includes(state.store)) state.store = "all";
    const chip = (v, label) => h("button", { class: "chip" + (state.store === v ? " on" : ""), type: "button", "aria-pressed": state.store === v ? "true" : "false", onclick: () => { state.store = v; store.set("wr.store", v); render(); } }, label);
    $("#storeChips").replaceChildren(chip("all", "All"), ...stores.map((s) => chip(s, s)));
    $("#sortSel").value = state.sort;

    const list = visibleItems();
    const filtered = state.store !== "all" || state.query.trim();
    $("#count").textContent = filtered ? list.length + (list.length === 1 ? " item" : " items") + (state.store !== "all" ? " at " + state.store : "") + (state.query.trim() ? " matching “" + state.query.trim() + "”" : "") : "";
    $("#count").hidden = !filtered;
    const note = $("#note"); note.hidden = !state.note; note.textContent = state.note;

    const grid = $("#grid");
    if (!state.loaded && !state.items.length) {
      grid.replaceChildren(...[0, 1, 2, 3].map(() => h("div", { class: "card skel", "aria-hidden": "true" }, h("div", { class: "panel" }), h("div", { class: "foot" }))));
      grid.setAttribute("aria-busy", "true");
    } else {
      grid.removeAttribute("aria-busy");
      grid.replaceChildren(...(list.length ? list.map(card) : [h("div", { class: "empty" },
        h("h3", { text: live.length ? "Nothing matches" : "Your rack is empty" }),
        h("p", { text: live.length ? "Try All stores or a different search." : "Next time something catches your eye on Instagram or a store app, share the screenshot to Wishrack, or tap the green button below. It lands here with its photo and price." }))]));
    }
    const drops = dropped();
    $("#dropsGrid").replaceChildren(...(drops.length ? drops.map(card) : [h("div", { class: "empty" }, h("h3", { text: "No drops yet" }), h("p", { text: "When a saved item gets cheaper, it shows up here." }))]));

    renderProfileBits();
    if (state.openId === "profile") renderProfile();
    else if (state.openId === "settings") renderSettings();
    else if (state.openId) renderSheet();
  }

  // ------------------------------------------------------------ views (bottom bar)
  function showView(name, push = true) {
    if (!["home", "drops", "save", "gone"].includes(name)) name = "home";
    if (state.view === name) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    state.view = name;
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + name; });
    document.querySelectorAll(".tab[data-view]").forEach((t) => { if (t.dataset.view === name) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
    window.scrollTo(0, 0);
    if (push) { if (name === "home") history.replaceState({ view: "home" }, "", location.pathname + location.search); else history.pushState({ view: name }, "", "#" + name); }
  }
  function goBack() { if (history.state && history.state.view && history.state.view !== "home") history.back(); else showView("home"); }

  // ------------------------------------------------------------ moving items between rack and "Bought & removed"
  let toastTimer = 0;
  function toast(msg, undo) {
    const el = $("#toast");
    clearTimeout(toastTimer);
    el.replaceChildren(...[h("span", { text: msg }), undo ? h("button", { type: "button", onclick: () => { el.hidden = true; undo(); } }, "Undo") : null].filter(Boolean));
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }
  async function setGone(it, patch, msg) {
    const before = { bought: !!it.bought, boughtAt: it.boughtAt || null, removed: !!it.removed, removedAt: it.removedAt || null };
    try {
      await putItem({ ...it, ...patch });
      toast(msg, () => putItem({ ...(state.items.find((x) => x.id === it.id) || it), ...before }).catch((e) => toast(e.message)));
    } catch (e) { toast(e.message); }
  }
  const markBought = (it) => setGone(it, { bought: true, boughtAt: Date.now(), removed: false, inbox: false }, "Marked as bought. It's in Bought & removed.");
  const removeFromRack = (it) => setGone(it, { removed: true, removedAt: Date.now(), bought: false }, "Removed. It's in Bought & removed.");
  const putBack = (it) => setGone(it, { bought: false, removed: false }, "Back on your rack.");
  async function deleteForever(it) {
    await api("/api/items/" + it.id, { method: "DELETE" });
    state.items = state.items.filter((x) => x.id !== it.id);
    store.set("wr.cache", JSON.stringify(state.items));
    if (state.openId === it.id) closeSheet();
    render();
  }

  // ------------------------------------------------------------ crop editor
  function cropEditor(it) {
    const img = h("img", { src: it.preview, alt: "", draggable: "false" });
    const box = h("div", { class: "crop-box", tabindex: "0", role: "group", "aria-label": "Photo crop. Drag to move, drag a corner to resize, or use the arrow keys." },
      ...["nw", "ne", "sw", "se"].map((c) => h("span", { class: "hd " + c, "data-h": c })));
    const frame = h("div", { class: "crop" }, img, box);
    const place = () => { const b = it.box || [0, 0, 1, 1]; Object.assign(box.style, { left: b[0] * 100 + "%", top: b[1] * 100 + "%", width: (b[2] - b[0]) * 100 + "%", height: (b[3] - b[1]) * 100 + "%" }); };
    img.addEventListener("load", () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      frame.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
      frame.style.width = `min(100%, ${Math.round(460 * ratio)}px)`; // tall screenshots shrink in width, never stretch
      place();
    });
    place();
    let drag = null;
    box.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const r = frame.getBoundingClientRect();
      drag = { mode: e.target.dataset.h || "move", x: e.clientX, y: e.clientY, w: r.width, hgt: r.height, b: (it.box || [0, 0, 1, 1]).slice() };
      box.setPointerCapture(e.pointerId); box.classList.add("dragging");
    });
    box.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) / drag.w, dy = (e.clientY - drag.y) / drag.hgt, MIN = 0.08;
      let [x0, y0, x1, y1] = drag.b;
      if (drag.mode === "move") { const w = x1 - x0, hh = y1 - y0; x0 = Math.min(1 - w, Math.max(0, x0 + dx)); y0 = Math.min(1 - hh, Math.max(0, y0 + dy)); x1 = x0 + w; y1 = y0 + hh; }
      else {
        if (drag.mode.includes("w")) x0 = Math.min(x1 - MIN, Math.max(0, x0 + dx));
        if (drag.mode.includes("e")) x1 = Math.max(x0 + MIN, Math.min(1, x1 + dx));
        if (drag.mode.includes("n")) y0 = Math.min(y1 - MIN, Math.max(0, y0 + dy));
        if (drag.mode.includes("s")) y1 = Math.max(y0 + MIN, Math.min(1, y1 + dy));
      }
      it.box = [x0, y0, x1, y1]; place();
    });
    const end = () => { drag = null; box.classList.remove("dragging"); };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.05 : 0.01, map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!map[e.key]) return;
      e.preventDefault();
      let [x0, y0, x1, y1] = it.box || [0, 0, 1, 1];
      const [dx, dy] = map[e.key];
      if (e.altKey) { x1 = Math.max(x0 + 0.08, Math.min(1, x1 + dx)); y1 = Math.max(y0 + 0.08, Math.min(1, y1 + dy)); }
      else { const w = x1 - x0, hh = y1 - y0; x0 = Math.min(1 - w, Math.max(0, x0 + dx)); y0 = Math.min(1 - hh, Math.max(0, y0 + dy)); x1 = x0 + w; y1 = y0 + hh; }
      it.box = [x0, y0, x1, y1]; place();
    });
    return h("div", { class: "crop-wrap" }, frame,
      h("div", { class: "crop-actions" },
        h("button", { class: "linkish", type: "button", onclick: () => { it.box = [0, 0, 1, 1]; place(); } }, "Use whole screenshot"),
        it.origBox ? h("button", { class: "linkish", type: "button", onclick: () => { it.box = it.origBox.slice(); place(); } }, "Reset crop") : null,
        it.overlays && it.overlays.length ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: it.clean, onchange: (e) => { it.clean = e.target.checked; } }),
          it.overlays.length === 1 ? "Paint out 1 shop badge" : `Paint out ${it.overlays.length} shop badges`) : null));
  }

  // ------------------------------------------------------------ render: review
  function field(obj, k, label, opts = {}) {
    const id = "f-" + (obj.key || obj.id) + "-" + k;
    return h("div", { class: "field" + (opts.wide ? " wide" : "") + (opts.warn ? " warn" : "") },
      h("label", { for: id, text: label }),
      h("input", { id, type: opts.type || "text", inputmode: opts.num ? "decimal" : opts.type === "url" ? "url" : null, value: obj[k] ?? "", placeholder: opts.ph || "", autocomplete: "off",
        oninput: (e) => { obj[k] = opts.num ? num(e.target.value) : e.target.value; if (opts.onchange) opts.onchange(); } }),
      opts.hint ? h("small", { text: opts.hint }) : null);
  }
  function renderReview() {
    const box = $("#review");
    const r = state.review;
    if (!r || !r.items.length) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    r.items.forEach((it) => { if (it.box && !it.origBox) it.origBox = it.box.slice(); });
    const n = r.items.filter((x) => x.checked).length;
    const many = r.items.length > 1;
    box.replaceChildren(
      h("div", { class: "review-head" },
        h("h2", { text: many ? `Found ${r.items.length} products` : "Check it, then save" }),
        h("p", { class: "sub", text: "Fix anything that was read wrong. Drag the frame to choose the photo." })),
      h("div", { class: "rv-list" }, r.items.map((it) => h("section", { class: "rv" + (it.checked ? "" : " off"), "aria-label": it.title || "New product" },
        it.fromStore ? h("div", { class: "crop-wrap" }, h("img", { class: "rv-store", src: it.preview, alt: "" }),
          h("div", { class: "crop-actions" }, h("span", { class: "rv-from", text: "Photo from " + it.site }),
            h("button", { class: "linkish", type: "button", onclick: () => { useScreenshot(it); renderReview(); } }, "Use my screenshot instead")))
        : it.preview ? cropEditor(it) : h("div", { class: "rv-nophoto" }, icon("image", 22), h("span", { text: "No photo. You can add one later from the item." })),
        h("div", { class: "rv-fields" },
          many ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: it.checked, onchange: (e) => { it.checked = e.target.checked; renderReview(); } }), "Save this one") : null,
          field(it, "title", "Name", { wide: true }),
          field(it, "store", "Store"), field(it, "colour", "Colour"),
          field(it, "price", "Price (Rs.)", { num: true, warn: it.price == null && it.missingPrice, hint: it.price == null && it.missingPrice ? "Not found. Leave empty if you don't know." : "" }),
          field(it, "mrp", "MRP (Rs.)", { num: true }),
          field(it, "size", "My size", { ph: "M, 32, UK 9" }),
          field(it, "url", "Store link", { type: "url", ph: "https://", wide: true }),
          h("p", { class: "via", text: it.via === "you" ? "Typed by you" : "Read by " + it.via })),
      ))),
      h("div", { class: "review-actions" },
        h("button", { class: "btn primary", type: "button", id: "saveReview", disabled: n === 0, onclick: saveReview }, icon("save", 18), n > 1 ? `Save ${n} to rack` : "Save to rack"),
        h("button", { class: "btn", type: "button", onclick: discardReview }, "Discard")));
  }
  function discardReview() {
    state.review?.items.forEach((x) => { if (x.preview) URL.revokeObjectURL(x.preview); if (x.shot?.preview) URL.revokeObjectURL(x.shot.preview); });
    state.review = null; renderReview(); status("");
  }
  async function saveReview() {
    const r = state.review; if (!r) return;
    const btn = $("#saveReview"); btn.disabled = true;
    const todo = r.items.filter((x) => x.checked);
    try {
      for (let i = 0; i < todo.length; i++) {
        const it = todo[i];
        status(todo.length > 1 ? `Saving ${i + 1} of ${todo.length}…` : "Saving…", { busy: true });
        const imageId = it.blob ? await uploadPhoto(it.blob, it.box, it.clean && !it.fromStore ? it.overlays : null) : null;
        await putItem({
          id: newId(), title: it.title.trim(), brand: it.brand, store: it.store.trim() || "", url: isUrl(it.url) ? it.url.trim() : "",
          price: it.price, mrp: it.mrp && it.price && it.mrp > it.price ? it.mrp : null, currency: "INR", colour: it.colour.trim(), size: it.size.trim(),
          addedAt: Date.now() + i, bought: false, imageId,
        });
        r.items = r.items.filter((x) => x !== it);
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
      state.review = r.items.length ? r : null;
      renderReview();
      status(todo.length > 1 ? `Saved ${todo.length} items to your rack.` : "Saved to your rack.", { ok: true });
      if (!state.review) { toast(todo.length > 1 ? `Saved ${todo.length} items to your rack.` : "Saved to your rack."); showView("home"); }
      setTimeout(() => { if ($("#status").classList.contains("ok")) status(""); }, 3000);
    } catch (e) {
      renderReview();
      status(e.message || "Couldn't save. Try again.", { err: true });
    }
  }

  // ------------------------------------------------------------ price history as bars
  function historyChart(it) {
    const hist = (Array.isArray(it.priceHistory) ? it.priceHistory : []).filter((x) => x && x.p);
    const pts = hist.length ? hist.slice(-24) : it.price != null ? [{ t: it.addedAt || Date.now(), p: it.price }] : [];
    if (!pts.length) return null;
    const ps = pts.map((x) => x.p), lo = Math.min(...ps), hi = Math.max(...ps);
    const height = (p) => hi === lo ? 70 : 32 + Math.round(((p - lo) / (hi - lo)) * 68);
    const dir = (i) => !i ? "same" : pts[i].p < pts[i - 1].p ? "down" : pts[i].p > pts[i - 1].p ? "up" : "same";
    const anyDown = pts.some((_, i) => dir(i) === "down"), anyUp = pts.some((_, i) => dir(i) === "up");
    return h("figure", { style: "margin:0;display:grid;gap:8px" },
      h("div", { class: "bars", role: "img", "aria-label": "Price history: " + pts.map((x) => dateShort(x.t) + " " + money(x.p)).join(", ") },
        pts.map((x, i) => h("i", { class: dir(i), style: `height:${height(x.p)}%;--i:${i}`, title: dateShort(x.t) + ": " + money(x.p) }))),
      h("div", { class: "axis" }, h("span", { text: dateShort(pts[0].t) }), pts.length > 1 ? h("span", { text: "Lowest " + money(lo) }) : null, h("span", { text: pts.length > 1 ? dateShort(pts.at(-1).t) : "now" })),
      anyDown || anyUp ? h("div", { class: "legend" },
        anyDown ? h("span", null, h("i", { style: "background:var(--forest)" }), "price fell") : null,
        anyUp ? h("span", null, h("i", { style: "background:var(--rose)" }), "price rose") : null,
        h("span", null, h("i", { style: "background:var(--sage)" }), "no change")) : null,
      pts.length === 1 ? h("figcaption", { class: "hint", text: "One price so far. Each morning's check adds a bar." }) : null);
  }

  // ------------------------------------------------------------ sheet (item page, settings)
  let lastFocus = null;
  function openSheet(id) {
    lastFocus = document.activeElement; state.openId = id;
    history.pushState({ view: state.view, sheet: true }, "", location.hash || "#" + state.view); // phone's back button closes it
    id === "profile" ? renderProfile() : id === "settings" ? renderSettings() : renderSheet();
    $("#sheet").scrollTop = 0;
    requestAnimationFrame(() => $("#sheet .x")?.focus({ preventScroll: true }));
  }
  function hideSheet() {
    state.openId = null; $("#sheet").hidden = true; $("#shade").hidden = true; document.body.classList.remove("sheet-open");
    lastFocus?.focus?.({ preventScroll: true });
  }
  function closeSheet() { if (history.state && history.state.sheet) history.back(); else hideSheet(); }
  function showSheet(...kids) {
    const sheet = $("#sheet");
    sheet.hidden = false; $("#shade").hidden = false; document.body.classList.add("sheet-open");
    sheet.replaceChildren(...kids.flat().filter(Boolean)); // native replaceChildren would print a skipped (null) section as "null"
  }
  const closeBtn = (label) => h("button", { class: "circle x", type: "button", "aria-label": label || "Close", onclick: closeSheet }, icon("left", 20));
  function renderSheet() {
    const it = state.items.find((x) => x.id === state.openId);
    if (!it) { hideSheet(); return; }
    const sheet = $("#sheet");
    if (sheet.contains(document.activeElement) && document.activeElement.matches("input,textarea")) return;
    const draft = { ...it };
    const q = query(it);
    const gone = isGone(it);
    const photoIn = h("input", { type: "file", id: "ed-photo", accept: "image/*", hidden: true, onchange: async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try { const imageId = await uploadPhoto(file, null); const old = it.imageId; await putItem({ ...it, imageId }); if (old) api("/api/images/" + old, { method: "DELETE" }).catch(() => {}); }
      catch (err) { sheetMsg(err.message, true); }
    } });
    const checkBtn = h("button", { class: "btn small", type: "button", disabled: !it.url, onclick: async () => {
      checkBtn.disabled = true; sheetMsg("Checking " + (it.store || "the store") + "…", false, true);
      try {
        let n = shopifyJsUrl(it.url) ? await refreshOne(it).catch(() => null) : null; // Shopify: read from this phone
        if (!n) {
          const j = await api("/api/check/" + it.id, { method: "POST" });
          const i = state.items.findIndex((x) => x.id === it.id); if (i >= 0) state.items[i] = j.item;
          store.set("wr.cache", JSON.stringify(state.items));
          render();
          n = j.item;
        }
        sheetMsg(n.checkError ? n.checkError : n.price !== it.price ? "New price: " + money(n.price) : "Same price as before: " + money(n.price), !!n.checkError);
      } catch (e) { sheetMsg(e.message, true); checkBtn.disabled = false; }
    } }, icon("refresh", 16), "Check price now");
    const lastLine = it.lastChecked ? "Last checked " + daysAgo(it.lastChecked) + "." : it.url ? "Checked every morning at 8." : "Add a store link to track its price.";
    const off = pctOff(it);
    showSheet(
      h("div", { class: "sheet-top" }, closeBtn("Back"),
        gone ? null : h("button", { class: "circle", type: "button", "aria-label": "Remove from rack", title: "Remove from rack", onclick: () => removeFromRack(it) }, icon("trash", 20))),
      storeA(it, "hero-photo", null, photoImg(it), flagFor(it)),
      h("div", { class: "detail" },
        h("span", { class: "store", text: [it.store, it.colour].filter(Boolean).join(" · ") || "Saved " + daysAgo(it.addedAt) }),
        h("h2", { id: "sheetTitle", text: it.title || "Untitled product" }),
        h("div", { class: "pricebox" },
          it.price == null ? h("span", { class: "noprice", text: "No price yet" }) : h("b", { text: money(it.price) }),
          off ? h("s", { text: money(it.mrp) }) : null, off ? h("span", { class: "pct-off", text: off + "% off" }) : null),
        recentDrop(it) ? h("span", { class: "was" }, icon("down", 14), "Was " + money(it.previousPrice) + " until " + dateShort(it.priceChangedAt)) : null,
        h("div", { class: "pills" },
          it.size ? h("span", { class: "pill" }, h("small", { text: "My size" }), it.size) : null,
          h("span", { class: "pill" }, h("small", { text: "Saved" }), dateShort(it.addedAt || Date.now())),
          it.lastChecked ? h("span", { class: "pill" }, h("small", { text: "Checked" }), daysAgo(it.lastChecked).replace(/^./, (c) => c.toUpperCase())) : null,
          it.bought ? h("span", { class: "pill" }, h("small", { text: "Bought" }), dateShort(it.boughtAt || it.updatedAt || Date.now())) : null),
        h("label", { class: "linkish", for: "ed-photo", style: "justify-self:start" }, imgSrc(it) ? "Replace photo" : "Add a photo"), photoIn),
      gone ? h("section", { class: "card-box inbox-step" },
        h("h3", { text: it.bought ? "You bought this" : "Removed from your rack" }),
        h("p", { class: "hint", text: "It's in Bought & removed. Put it back to keep watching its price." }),
        h("div", { class: "row" }, h("button", { class: "btn small", type: "button", onclick: () => putBack(it) }, it.bought ? "Back to wishlist" : "Put back on rack"))) : null,
      it.inbox && !gone ? h("section", { class: "card-box inbox-step" },
        h("h3", { text: "Waiting for you" }),
        h("p", { class: "hint", text: "Saved from a screenshot, but " + (it.price == null ? "the price couldn't be read" : "some details are missing") + ". Fill in the details below, then add it to your rack." }),
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try { await putItem({ ...draft, url: isUrl(draft.url) ? String(draft.url).trim() : "", inbox: false }); toast("Added to your rack."); }
            catch (err) { sheetMsg(err.message, true); b.disabled = false; }
          } }, icon("check", 16), "Add to rack"))) : null,
      h("section", { class: "card-box" },
        h("h3", { text: "Price over time" }),
        historyChart(it) || h("p", { class: "hint", text: "No price saved yet." }),
        h("div", { class: "row" }, checkBtn, h("span", { class: "hint", text: lastLine })),
        it.checkError ? h("p", { class: "hint err", text: it.checkError }) : null,
        h("p", { class: "status", id: "sheetStatus", role: "status", "aria-live": "polite" })),
      h("section", { class: "card-box" },
        h("h3", { text: "Look for it elsewhere" }),
        h("p", { class: "hint", text: "Opens each store's search for “" + (q || "this product") + "”." }),
        h("div", { class: "search-chips" }, SEARCH.map((s) => h("a", { class: "chip", href: s.url(q), target: "_blank", rel: "noopener noreferrer" }, icon("search", 14), s.name)))),
      h("section", { class: "card-box" },
        h("h3", { text: "Details" }),
        h("div", { class: "form" },
          field(draft, "title", "Name", { wide: true }),
          field(draft, "store", "Store"), field(draft, "colour", "Colour"),
          field(draft, "price", "Price (Rs.)", { num: true }), field(draft, "mrp", "MRP (Rs.)", { num: true }),
          field(draft, "size", "My size", { ph: "M, 32, UK 9" }), field(draft, "note", "Note", { ph: "Matches my Ducati M" }),
          field(draft, "url", "Store link", { type: "url", wide: true, ph: "https://" })),
        h("div", { class: "row" },
          h("button", { class: "btn primary small", type: "button", onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try { await putItem({ ...draft, url: isUrl(draft.url) ? String(draft.url).trim() : "" }); toast("Saved your changes."); }
            catch (err) { sheetMsg(err.message, true); }
            b.disabled = false;
          } }, "Save changes"),
          gone ? null : h("button", { class: "btn small danger", type: "button", onclick: () => removeFromRack(it) }, icon("trash", 16), "Remove"))),
      h("div", { class: "cta" },
        h("button", { class: "btn square", type: "button", "aria-pressed": it.bought ? "true" : "false", "aria-label": it.bought ? "Bought. Tap to put back on your wishlist" : "Mark as bought", title: it.bought ? "Bought" : "Mark as bought",
          onclick: () => it.bought ? putBack(it) : markBought(it) }, icon("check", 22)),
        storeA(it, "btn primary", null, it.url ? "Go to " + (it.store || "store") : "Find it online", icon("out", 18))));
  }
  function sheetMsg(msg, err, busy) {
    const el = $("#sheetStatus"); if (!el) return;
    el.className = "status" + (err ? " err" : "");
    el.replaceChildren(...(busy ? [h("span", { class: "spin", "aria-hidden": "true" })] : []), h("span", { text: msg }));
  }

  // ------------------------------------------------------------ profile (the round avatar)
  // Kept on this device; also synced through /api/profile when the Worker has it (GET {profile}, PUT {name, photoId}).
  let profile = { name: "", photoId: "", photo: "" };
  try { profile = { ...profile, ...JSON.parse(store.get("wr.profile", "{}")) }; } catch {}
  const profilePhoto = () => profile.photoId ? "/api/images/" + profile.photoId : profile.photo || "";
  const initial = () => (profile.name.trim()[0] || "").toUpperCase();
  function saveProfileLocal() { store.set("wr.profile", JSON.stringify(profile)); renderProfileBits(); }
  function renderProfileBits() {
    const btn = $("#profileBtn"), src = profilePhoto();
    btn.replaceChildren(src ? h("img", { src, alt: "", "data-nozoom": "" }) : initial() || icon("user", 22));
    btn.setAttribute("aria-label", profile.name ? "Your profile, " + profile.name : "Set up your profile");
    const hello = $("#view-home .hello");
    hello.replaceChildren(...(profile.name.trim() ? ["Hi ", h("span", { class: "hello-name", text: profile.name.trim().split(/\s+/)[0] }), ", get your favourite fits for less"] : ["Get your favourite fits for less"]));
  }
  async function loadProfile() {
    try {
      const j = await api("/api/profile");
      const p = j.profile || j;
      if (p && (p.name || p.photoId)) { profile = { ...profile, name: p.name || profile.name, photoId: p.photoId || profile.photoId }; saveProfileLocal(); }
    } catch { /* no profile endpoint yet: this device's copy is used */ }
  }
  async function syncProfile() {
    try { await api("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: profile.name, photoId: profile.photoId || null }) }); return true; }
    catch { return false; }
  }
  async function squarePhoto(file) { // centre-crop to a square and shrink, so a profile photo stays small
    const im = await loadImg(file);
    const s = Math.min(im.naturalWidth, im.naturalHeight), out = 320;
    const c = document.createElement("canvas"); c.width = c.height = out;
    c.getContext("2d").drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, out, out);
    URL.revokeObjectURL(im.src);
    return new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.85));
  }
  function renderProfile() {
    const sheet = $("#sheet");
    if (sheet.contains(document.activeElement) && document.activeElement.matches("input")) return;
    const draft = { id: "profile", name: profile.name };
    const src = profilePhoto();
    const picIn = h("input", { type: "file", id: "pf-photo", accept: "image/*", hidden: true, onchange: async (e) => {
      const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
      sheetMsg("Updating your photo…", false, true);
      try {
        const blob = await squarePhoto(file);
        let photoId = "";
        try { photoId = (await api("/api/images", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob })).id; } catch {}
        const old = profile.photoId;
        profile.photoId = photoId;
        profile.photo = photoId ? "" : await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        saveProfileLocal(); await syncProfile();
        if (old && old !== photoId) api("/api/images/" + old, { method: "DELETE" }).catch(() => {});
        renderProfile(); toast("Profile photo updated.");
      } catch (err) { sheetMsg(err.message || "Couldn't use that photo. Try another one.", true); }
    } });
    showSheet(
      h("div", { class: "sheet-top" }, closeBtn(), h("h2", { id: "sheetTitle", text: "Your profile" })),
      h("section", { class: "card-box", style: "justify-items:center;text-align:center" },
        h("label", { class: "profile-pic", for: "pf-photo", "aria-label": src ? "Change profile photo" : "Add a profile photo" },
          src ? h("img", { src, alt: "", "data-nozoom": "" }) : (initial() || icon("user", 44))),
        picIn,
        h("div", { class: "profile-actions" },
          h("label", { class: "btn small", for: "pf-photo" }, icon("image", 16), src ? "Change photo" : "Add a photo"),
          src ? h("button", { class: "btn small danger", type: "button", onclick: async () => {
            const old = profile.photoId; profile.photoId = ""; profile.photo = ""; saveProfileLocal(); await syncProfile();
            if (old) api("/api/images/" + old, { method: "DELETE" }).catch(() => {});
            renderProfile();
          } }, "Remove photo") : null)),
      h("section", { class: "card-box" },
        h("h3", { text: profile.name ? "Your name" : "What should Wishrack call you?" }),
        h("div", { class: "form" }, field(draft, "name", "Name", { wide: true, ph: "Your name" })),
        h("div", { class: "row" },
          h("button", { class: "btn primary small", type: "button", onclick: async () => {
            profile.name = String(draft.name || "").trim().slice(0, 40);
            saveProfileLocal();
            const synced = await syncProfile();
            document.activeElement?.blur?.();
            toast(profile.name ? (synced ? "Saved." : "Saved on this device.") : "Name cleared.");
            renderProfile();
          } }, "Save name")),
        h("p", { class: "status", id: "sheetStatus", role: "status", "aria-live": "polite" })),
      h("section", { class: "card-box" },
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", onclick: () => { state.openId = "settings"; renderSettings(); $("#sheet").scrollTop = 0; } }, icon("gear", 16), "Settings"))));
  }

  // ------------------------------------------------------------ settings
  function renderSettings() {
    const theme = store.get("wr.theme", "system");
    const ai = state.ai;
    showSheet(
      h("div", { class: "sheet-top" }, closeBtn(), h("h2", { id: "sheetTitle", text: "Settings" })),
      h("section", { class: "card-box" },
        h("h3", { text: "Look" }),
        h("div", { class: "seg", role: "radiogroup", "aria-label": "Theme" },
          [["system", "Match phone"], ["light", "Day"], ["dark", "Night"]].map(([v, l]) => h("label", { class: "seg-opt" },
            h("input", { type: "radio", name: "theme", value: v, checked: theme === v, onchange: () => { setTheme(v); } }), h("span", { text: l }))))),
      h("section", { class: "card-box" },
        h("h3", { text: "Reading screenshots" }),
        h("p", { class: "setting-line" }, h("span", { class: "dot " + (ai ? "on" : ai === false ? "off" : "") }),
          ai ? "Gemini reads your screenshots (free tier, limited per day). When the limit runs out, this phone reads them itself, less accurately."
            : ai === false ? "No Gemini key is set, so this phone reads screenshots itself. It finds prices but often misses names. Add GEMINI_API_KEY to the Worker for better reading."
            : "Checking…"),
        h("p", { class: "hint", text: "Google may use free-tier screenshots to improve its models." })),
      // Only inside the Wishrack Android app, which exposes window.WishrackAndroid.
      window.WishrackAndroid ? h("section", { class: "card-box" },
        h("h3", { text: "Screenshots on this phone" }),
        h("label", { class: "check" },
          h("input", { type: "checkbox", id: "autoShots", checked: !!window.WishrackAndroid.isAuto(), onchange: (e) => { window.WishrackAndroid.setAuto(e.target.checked); renderSettings(); } }),
          h("span", { text: "Save new screenshots automatically" })),
        h("p", { class: "hint", text: "Clothes and shoes go straight onto your rack; ones without a readable price wait above your rack. Everything else is ignored." }),
        h("p", { class: "setting-line", text: String(window.WishrackAndroid.status() || "") })) : null,
      h("section", { class: "card-box" },
        h("h3", { text: "Price checks" }),
        h("p", { class: "setting-line", text: "Every morning at 8, Wishrack re-checks about 15 saved store pages, oldest first, and fetches the store's photo for items that have none. Bought and removed items are skipped." })),
      h("section", { class: "card-box" },
        h("h3", { text: "Your rack" }),
        h("p", { class: "setting-line", text: onRack().length + " on your rack, " + state.items.filter((x) => x.bought).length + " bought, " + state.items.filter((x) => x.removed && !x.bought).length + " removed." }),
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", onclick: exportRack }, icon("save", 16), "Download a backup (.json)"))),
      h("section", { class: "card-box" },
        h("h3", { text: "This device" }),
        h("p", { class: "setting-line", text: "This device remembers your passcode. Lock it to make the passcode needed again." }),
        h("div", { class: "row" },
          h("button", { class: "btn small danger", type: "button", onclick: () => { hideSheet(); lock(""); } }, icon("lock", 16), "Lock this device")),
        h("p", { class: "hint", text: "To change the passcode itself, run npx wrangler secret put APP_PASSCODE." })));
  }
  function exportRack() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: state.items }, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "wishrack-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function setTheme(v) {
    store.set("wr.theme", v);
    if (v === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v);
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    document.head.append(h("meta", { name: "theme-color", content: $("#appView").hidden ? "#12493b" : dark ? "#0e1d18" : "#eaf4ef" }));
  }

  // ------------------------------------------------------------ gate
  function lock(msg) {
    key = ""; store.set("wr.key", null);
    $("#appView").hidden = true; $("#gate").hidden = false;
    setTheme(store.get("wr.theme", "system"));
    $("#gateMsg").textContent = msg || "";
    $("#gateIn").value = "";
    setTimeout(() => $("#gateIn").focus(), 50);
  }
  async function unlock(pass) {
    key = pass;
    const btn = $("#gateBtn"); btn.disabled = true; $("#gateMsg").textContent = "";
    try {
      await api("/api/login", { method: "POST" });
      store.set("wr.key", key);
      enterApp();
    } catch (e) {
      key = "";
      $("#gateMsg").textContent = e.code === "wrong_passcode" ? "That passcode didn't work. Check it and try again." : e.code === "no_passcode" ? "No passcode is set on the Worker yet. Run npx wrangler secret put APP_PASSCODE, then try again." : e.message;
      $("#gate").hidden = false; $("#appView").hidden = true;
      $("#gateIn").select();
    } finally { btn.disabled = false; }
  }
  function enterApp() {
    $("#gate").hidden = true; $("#appView").hidden = false;
    setTheme(store.get("wr.theme", "system"));
    const start = location.hash.slice(1);
    state.view = null; showView("home", false); history.replaceState({ view: "home" }, "", location.pathname + location.search);
    if (["drops", "save", "gone"].includes(start)) showView(start);
    render(); loadItems(); loadProfile();
    fetch("/api/health").then((r) => r.json()).then((j) => { state.ai = !!j.ai; if (state.openId === "settings") renderSettings(); }).catch(() => {});
    takeShared();
  }

  // ------------------------------------------------------------ share target (files handed over by sw.js)
  async function takeShared() {
    const p = new URLSearchParams(location.search);
    if (!p.has("shared")) return;
    history.replaceState({ view: "home" }, "", "/");
    try {
      const cache = await caches.open("wr-share");
      const meta = await cache.match("/shared/meta");
      const info = meta ? await meta.json() : { files: 0, text: "" };
      const files = [];
      for (let i = 0; i < info.files; i++) { const r = await cache.match("/shared/" + i); if (r) files.push(new File([await r.blob()], "shared-" + i, { type: r.headers.get("content-type") || "image/png" })); }
      await Promise.all([cache.delete("/shared/meta"), ...files.map((_, i) => cache.delete("/shared/" + i))]);
      if (files.length) await handleImages(files);
      else if (findUrl(info.text)) await handleLink(findUrl(info.text));
      else if (p.get("shared") !== "0") { showView("save"); status("Nothing came through from the share. Try sharing the screenshot itself.", { err: true }); }
    } catch { /* no share cache */ }
  }

  // ------------------------------------------------------------ events
  $("#gateForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#gateIn").value.trim(); if (v) unlock(v); });
  $("#linkForm").addEventListener("submit", (e) => { e.preventDefault(); handleLink($("#linkIn").value); });
  $("#fileIn").addEventListener("change", (e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; handleImages(fs); });
  $("#manualBtn").addEventListener("click", () => { addReviewItem({}, null, "you"); renderReview(); $("#review input")?.focus(); });
  $("#sortSel").addEventListener("change", (e) => { state.sort = e.target.value; store.set("wr.sort", state.sort); render(); });
  $("#profileBtn").addEventListener("click", () => openSheet("profile"));
  $("#settingsTab").addEventListener("click", () => openSheet("settings"));
  $("#fabSave").addEventListener("click", () => { if (state.view === "save") $("#linkIn").focus(); else showView("save"); });
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  document.querySelectorAll(".view .back").forEach((b) => b.addEventListener("click", goBack));
  $("#searchBtn").addEventListener("click", () => {
    const row = $("#searchRow"), open = row.hidden;
    row.hidden = !open; $("#searchBtn").setAttribute("aria-expanded", String(open));
    // While searching, the headline and banner step aside so matches appear right under the field.
    document.body.classList.toggle("searching", open);
    window.scrollTo(0, 0);
    if (open) $("#searchIn").focus(); else { state.query = ""; $("#searchIn").value = ""; render(); }
  });
  $("#searchIn").addEventListener("keydown", (e) => { if (e.key === "Escape") $("#searchBtn").click(); else if (e.key === "Enter") e.target.blur(); });
  $("#searchIn").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("#shade").addEventListener("click", closeSheet);
  addEventListener("popstate", (e) => {
    if (state.openId) { hideSheet(); return; }
    showView((e.state && e.state.view) || location.hash.slice(1) || "home", false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.openId) closeSheet();
    if (e.key === "Tab" && state.openId) { // keep focus inside the sheet
      const f = [...$("#sheet").querySelectorAll("a[href],button:not([disabled]),input:not([hidden]),label[for],select,[tabindex='0']")].filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener("paste", (e) => {
    if ($("#appView").hidden) return;
    const cd = e.clipboardData; if (!cd) return;
    const files = [...(cd.files || [])].filter((f) => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); handleImages(files); return; }
    const t = (cd.getData("text") || "").trim();
    const inField = e.target?.matches?.("input,textarea");
    if (findUrl(t) && (!inField || e.target.id === "linkIn")) { e.preventDefault(); handleLink(t); }
  });
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) handleImages(files);
    else { const t = e.dataTransfer && (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text")); if (findUrl(t)) handleLink(t); }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => setTheme(store.get("wr.theme", "system")));

  // ------------------------------------------------------------ boot
  setTheme(store.get("wr.theme", "system"));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (key) { enterApp(); api("/api/login", { method: "POST" }).catch(() => {}); }
  else lock("");
})();
