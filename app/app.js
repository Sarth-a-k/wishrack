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
    review: null, openId: null, ai: null, note: "",
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
  async function removeItem(it) {
    await api("/api/items/" + it.id, { method: "DELETE" });
    state.items = state.items.filter((x) => x.id !== it.id);
    store.set("wr.cache", JSON.stringify(state.items));
    render();
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
  async function cropBlob(blob, box, maxW = 900, q = 0.85) {
    const im = await loadImg(blob);
    const W = im.naturalWidth, H = im.naturalHeight;
    const b = normBox(box) || [0, 0, 1, 1];
    const sx = b[0] * W, sy = b[1] * H, sw = (b[2] - b[0]) * W, sh = (b[3] - b[1]) * H;
    const scale = Math.min(1, maxW / sw, 1400 / sh);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    URL.revokeObjectURL(im.src);
    return new Promise((r) => c.toBlob((x) => r(x || blob), "image/jpeg", q));
  }
  async function uploadPhoto(blob, box) {
    const jpg = await cropBlob(blob, box);
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
        if (!["no_ai", "ai_limit", "ai_key", "ai_model", "ai_error", "ai_unreadable", "offline"].includes(e.code)) throw e;
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
      missingPrice: raw.price == null && via !== "you",
    });
  }
  async function handleImages(files) {
    files = [...files].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    
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
      const r = await api("/api/read-link?url=" + encodeURIComponent(url));
      let blob = null;
      if (r.image) {
        try { const res = await api("/api/fetch-image?url=" + encodeURIComponent(r.image)); blob = await res.blob(); } catch { blob = null; }
      }
      addReviewItem({ ...r, url }, blob, r.source === "ai" ? "Gemini" : r.source === "none" ? "you" : "the store page");
      renderReview();
      status(r.price == null ? "Couldn't find a price on that page. Add it below if you know it." : "Check the details below, then save.", {});
    } catch (e) {
      addReviewItem({ url, store: "" }, null, "you");
      renderReview();
      status(e.message + " Fill in the details below.", { err: true });
    }
  }

  // ------------------------------------------------------------ render: tally, toolbar, grid
  function visibleItems() {
    let list = state.items.slice();
    if (state.store !== "all") list = list.filter((x) => (x.store || "Other") === state.store);
    const p = (x) => x.price == null ? Infinity : x.price;
    if (state.sort === "low") list.sort((a, b) => p(a) - p(b));
    else if (state.sort === "high") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else if (state.sort === "off") list.sort((a, b) => pctOff(b) - pctOff(a));
    else if (state.sort === "drop") list.sort((a, b) => (recentDrop(b) ? b.priceChangedAt : 0) - (recentDrop(a) ? a.priceChangedAt : 0) || (b.addedAt || 0) - (a.addedAt || 0));
    else list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    list.sort((a, b) => (a.bought ? 1 : 0) - (b.bought ? 1 : 0));
    return list;
  }
  function priceLine(it, big) {
    if (it.price == null) return h("p", { class: "price" + (big ? " big" : "") }, h("span", { class: "noprice", text: "No price yet" }));
    const off = pctOff(it);
    return h("p", { class: "price" + (off ? " sale" : "") + (big ? " big" : "") },
      h("span", { class: "now", text: money(it.price) }),
      off ? h("span", { class: "mrp" }, h("span", { class: "sr", text: "MRP " }), h("s", { text: money(it.mrp) })) : null,
      off ? h("span", { class: "pct-off", text: off + "% off" }) : null);
  }
  // Muted tint for photo-less tiles, from the colour the owner or the store gave (never invented).
  const TINTS = [[/olive|khaki/, "#6f7347"], [/taupe|beige|camel|sand|stone/, "#8c7a63"], [/black|charcoal/, "#1b1c22"], [/gr[ae]y|marl|silver/, "#5c616d"],
    [/navy|indigo/, "#26345e"], [/blue|denim/, "#3f5f97"], [/green|sage/, "#4f6e4c"], [/brown|chocolate|coffee/, "#6a4a35"], [/red|maroon|wine|burgundy/, "#8a3340"],
    [/pink|rose/, "#b06a7c"], [/white|cream|ivory|off.?white|ecru/, "#d8d2c4"], [/yellow|mustard/, "#b58d2e"], [/orange|rust/, "#a8552e"], [/purple|lilac|lavender/, "#6b5a8c"]];
  const tintOf = (c) => { c = String(c || "").toLowerCase(); const t = TINTS.find(([re]) => re.test(c)); return t ? t[1] : ""; };
  function photo(it, cls) {
    const src = imgSrc(it);
    const tint = !src && tintOf(it.colour);
    const a = h("a", { class: "photo" + (cls ? " " + cls : "") + (tint ? " tinted" : ""), style: tint ? "--tint:" + tint : null, href: storeLink(it), target: "_blank", rel: "noopener noreferrer", "aria-label": (it.url ? "Open at " : "Search for ") + (it.title || "this product") + (it.store ? ", " + it.store : "") });
    const ph = h("span", { class: "ph", "aria-hidden": "true" }, h("b", { text: (it.store || it.brand || "?").replace(/Bonkers Corner/i, "Bonkers") }), h("span", { text: "No photo yet" }));
    if (src) {
      const img = h("img", { src, alt: "", loading: "lazy", decoding: "async" });
      img.addEventListener("error", () => img.replaceWith(ph));
      a.append(img);
    } else a.append(ph);
    if (it.bought) a.append(h("span", { class: "flag bought" }, icon("check", 14), "Bought"));
    else if (recentDrop(it)) a.append(h("span", { class: "flag fell" }, icon("down", 14), money(it.previousPrice - it.price) + " drop"));
    return a;
  }
  function render() {
    const live = state.items.filter((x) => !x.bought);
    const total = live.reduce((s, x) => s + (x.price || 0), 0);
    $("#tally").replaceChildren(
      h("span", { class: "tally-n", text: live.length + " to buy" }),
      total ? h("b", { text: money(total) }) : null);

    const stores = [...new Set(state.items.map((x) => x.store || "Other"))].sort();
    if (state.store !== "all" && !stores.includes(state.store)) state.store = "all";
    const sel = $("#storeSel");
    sel.replaceChildren(h("option", { value: "all", text: "All stores" }), ...stores.map((s) => h("option", { value: s, text: s + " (" + state.items.filter((x) => (x.store || "Other") === s).length + ")" })));
    sel.value = state.store;
    $("#sortSel").value = state.sort;

    const list = visibleItems();
    $("#count").textContent = list.length + (list.length === 1 ? " item" : " items") + (state.store !== "all" ? " at " + state.store : "");
    const note = $("#note"); note.hidden = !state.note; note.textContent = state.note;

    const grid = $("#grid");
    if (!state.loaded && !state.items.length) {
      grid.replaceChildren(...[0, 1, 2, 3].map(() => h("div", { class: "card skel", "aria-hidden": "true" }, h("span", { class: "photo" }), h("span", { class: "skel-line" }), h("span", { class: "skel-line short" }))));
      grid.setAttribute("aria-busy", "true");
      return;
    }
    grid.removeAttribute("aria-busy");
    if (!list.length) {
      grid.replaceChildren(h("div", { class: "empty" },
        h("h3", { text: state.items.length ? "Nothing from " + state.store + " yet" : "Your rack is empty" }),
        h("p", { text: state.items.length ? "Pick All stores to see everything." : "Next time something catches your eye on Instagram or a store app, share the screenshot to Wishrack, or paste its link above. It lands here with its photo and price." })));
      return;
    }
    grid.replaceChildren(...list.map((it) => h("article", { class: "card" + (it.bought ? " is-bought" : "") },
      photo(it),
      h("button", { class: "info", type: "button", onclick: () => openSheet(it.id), "aria-label": "Details for " + (it.title || "product") },
        h("span", { class: "meta", text: [it.store, it.colour, it.size].filter(Boolean).join(" · ") || "Saved " + daysAgo(it.addedAt) }),
        h("span", { class: "title", text: it.title || "Untitled product" }),
        priceLine(it)))));
    if (state.openId === "settings") renderSettings();
    else if (state.openId) renderSheet();
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
        it.origBox ? h("button", { class: "linkish", type: "button", onclick: () => { it.box = it.origBox.slice(); place(); } }, "Reset crop") : null));
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
        it.preview ? cropEditor(it) : h("div", { class: "rv-nophoto" }, icon("image", 22), h("span", { text: "No photo. You can add one later from the item." })),
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
        h("button", { class: "btn ghost", type: "button", onclick: discardReview }, "Discard")));
  }
  function discardReview() {
    state.review?.items.forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
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
        const imageId = it.blob ? await uploadPhoto(it.blob, it.box) : null;
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
      setTimeout(() => { if ($("#status").classList.contains("ok")) status(""); }, 3000);
    } catch (e) {
      renderReview();
      status(e.message || "Couldn't save. Try again.", { err: true });
    }
  }

  // ------------------------------------------------------------ knitting: one stitch (a "V" of two leaning loops)
  const STITCH = "M5 9.4C2.6 8 1 5.2 1.3 1.2 3.4 1.8 5 4.6 5 9.4ZM5 9.4C7.4 8 9 5.2 8.7 1.2 6.6 1.8 5 4.6 5 9.4Z";
  // cols x rows grid of stitches; cls(c, r) names each stitch's yarn ("" = background yarn).
  function knitSvg(cols, rows, cls, extra) {
    const svg = h("svg", { class: "knit-svg", viewBox: `0 0 ${cols * 10} ${rows * 10}`, role: extra?.role || null, "aria-hidden": extra?.role ? null : "true", "aria-label": extra?.label || null });
    if (extra?.bg) svg.append(h("rect", { svg: 1, class: "bg", width: cols * 10, height: rows * 10 }));
    for (let c = 0; c < cols; c++) {
      const g = h("g", { svg: 1, class: "col", style: "--i:" + c });
      if (extra?.title) g.append(h("title", { svg: 1, text: extra.title(c) }));
      for (let r = 0; r < rows; r++) g.append(h("path", { svg: 1, class: "st " + (cls(c, r) || ""), d: STITCH, transform: `translate(${c * 10} ${r * 10})` }));
      svg.append(g);
    }
    return svg;
  }

  // ------------------------------------------------------------ price history as a knitted colourwork chart
  function historyChart(it) {
    const hist = (Array.isArray(it.priceHistory) ? it.priceHistory : []).filter((x) => x && x.p);
    const pts = hist.length ? hist.slice(-24) : it.price != null ? [{ t: it.addedAt || Date.now(), p: it.price }] : [];
    if (!pts.length) return null;
    const ps = pts.map((x) => x.p), lo = Math.min(...ps), hi = Math.max(...ps);
    const ROWS = 6, COLS = pts.length;
    const filled = (p) => hi === lo ? ROWS - 3 : 2 + Math.round(((p - lo) / (hi - lo)) * (ROWS - 3));
    // Each check is one stitch column; its filled height is the price. Colour says which way it moved.
    const colPt = (c) => pts[c - (COLS - pts.length)];
    const dir = (c) => { const i = c - (COLS - pts.length); if (i < 0) return null; const p = pts[i].p, prev = i ? pts[i - 1].p : p; return p < prev ? "down" : p > prev ? "up" : "same"; };
    const svg = knitSvg(COLS, ROWS, (c, r) => { const d = dir(c); if (!d) return ""; return ROWS - r <= filled(colPt(c).p) ? d : ""; },
      { role: "img", label: pts.map((x) => dateShort(x.t) + " " + money(x.p)).join(", "), title: (c) => colPt(c) ? dateShort(colPt(c).t) + ": " + money(colPt(c).p) : "" });
    const anyDown = pts.some((_, i) => i && pts[i].p < pts[i - 1].p), anyUp = pts.some((_, i) => i && pts[i].p > pts[i - 1].p);
    const fig = h("figure", { class: "knit", style: `--chart-w:${COLS * 34 + 20}px` }); // about 34px a stitch column, shrinks to fit
    // Native append() would print a skipped (null) legend as the text "null", so drop empties first.
    fig.append(...[svg,
      h("div", { class: "knit-axis" }, h("span", { text: dateShort(pts[0].t) }), h("span", { text: pts.length > 1 ? dateShort(pts.at(-1).t) : "now" })),
      anyDown || anyUp ? h("div", { class: "knit-legend" },
        anyDown ? h("span", null, h("i", { style: "background:var(--moss)" }), "price fell") : null,
        anyUp ? h("span", null, h("i", { style: "background:var(--berry)" }), "price rose") : null,
        h("span", null, h("i", { style: "background:var(--yarn-2)" }), "no change")) : null,
      h("figcaption", { text: pts.length > 1 ? `${pts.length} prices since ${dateShort(pts[0].t)}. Lowest ${money(lo)}, highest ${money(hi)}.` : "One price so far. Each morning's check adds a stitch." })].filter(Boolean));
    return fig;
  }

  // Passcode screen swatch: a small Fair Isle band (peerie pattern) in the same stitch.
  function peerieBand() {
    const el = $(".peerie"); if (!el || el.firstChild) return;
    const motif = ["a...a...", ".a.a.a.a", "..b...b."];
    el.append(knitSvg(300, 3, (c, r) => { const ch = motif[r][c % 8]; return ch === "." ? "" : ch; }, { bg: true }));
  }
  function gateSwatch() {
    const motif = ["..........", ".a...a...a", "a.a.a.a.a.", ".a...a...a", "..........", "bb.bb.bb.b", ".........."];
    const el = $(".swatch"); if (!el || el.firstChild) return;
    el.append(knitSvg(26, 7, (c, r) => { const ch = motif[r][c % 10]; return ch === "." ? "" : ch; }, { bg: true }));
  }

  // ------------------------------------------------------------ sheet
  let lastFocus = null;
  function openSheet(id) { lastFocus = document.activeElement; state.openId = id; id === "settings" ? renderSettings() : renderSheet(); requestAnimationFrame(() => $("#sheet .x")?.focus()); }
  function closeSheet() {
    state.openId = null; $("#sheet").hidden = true; $("#shade").hidden = true; document.body.classList.remove("sheet-open");
    lastFocus?.focus?.();
  }
  function showSheet(...kids) {
    const sheet = $("#sheet");
    sheet.hidden = false; $("#shade").hidden = false; document.body.classList.add("sheet-open");
    sheet.replaceChildren(...kids);
  }
  function sheetTop(title) {
    return h("div", { class: "sheet-top" + (title ? "" : " bare") }, h("span", { class: "grab", "aria-hidden": "true" }), title ? h("h2", { id: "sheetTitle", text: title }) : null,
      h("button", { class: "x icon-btn", type: "button", "aria-label": "Close", onclick: closeSheet }, icon("close")));
  }
  let delArmed = false;
  function renderSheet() {
    const it = state.items.find((x) => x.id === state.openId);
    if (!it) { closeSheet(); return; }
    const sheet = $("#sheet");
    if (sheet.contains(document.activeElement) && document.activeElement.matches("input,textarea")) return;
    const draft = { ...it };
    const q = query(it);
    const photoIn = h("input", { type: "file", id: "ed-photo", accept: "image/*", hidden: true, onchange: async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try { const imageId = await uploadPhoto(file, null); const old = it.imageId; await putItem({ ...it, imageId }); if (old) api("/api/images/" + old, { method: "DELETE" }).catch(() => {}); }
      catch (err) { sheetMsg(err.message, true); }
    } });
    const checkBtn = h("button", { class: "btn ghost small", type: "button", disabled: !it.url, onclick: async () => {
      checkBtn.disabled = true; sheetMsg("Checking " + (it.store || "the store") + "…", false, true);
      try {
        const j = await api("/api/check/" + it.id, { method: "POST" });
        const i = state.items.findIndex((x) => x.id === it.id); if (i >= 0) state.items[i] = j.item;
        store.set("wr.cache", JSON.stringify(state.items));
        render();
        const n = j.item;
        sheetMsg(n.checkError ? n.checkError : n.price !== it.price ? "New price: " + money(n.price) : "Same price as before: " + money(n.price), !!n.checkError);
      } catch (e) { sheetMsg(e.message, true); checkBtn.disabled = false; }
    } }, icon("refresh", 16), "Check price now");
    const lastLine = it.lastChecked ? "Last checked " + daysAgo(it.lastChecked) + "." : it.url ? "Checked every morning at 8." : "Add a store link to track its price.";
    showSheet(
      sheetTop(""),
      h("div", { class: "hero" }, photo(it, "hero-photo"),
        h("div", { class: "hero-text" },
          h("h2", { id: "sheetTitle", class: "item-title", text: it.title || "Untitled product" }),
          priceLine(it, true),
          recentDrop(it) ? h("p", { class: "was" }, icon("down", 14), "Was " + money(it.previousPrice) + " until " + dateShort(it.priceChangedAt)) : null,
          h("p", { class: "hint", text: [it.colour, it.size ? "size " + it.size : "", "saved " + daysAgo(it.addedAt)].filter(Boolean).join(" · ") }),
          h("a", { class: "btn primary", href: storeLink(it), target: "_blank", rel: "noopener noreferrer" }, it.url ? "Go to " + (it.store || "store") : "Find it online", icon("out", 16)),
          h("label", { class: "linkish", for: "ed-photo" }, imgSrc(it) ? "Replace photo" : "Add a photo"), photoIn)),
      h("section", { class: "section" },
        h("h4", { text: "Price over time" }),
        historyChart(it) || h("p", { class: "hint", text: "No price saved yet." }),
        h("div", { class: "row" }, checkBtn, h("span", { class: "hint", text: lastLine })),
        it.checkError ? h("p", { class: "hint err", text: it.checkError }) : null,
        h("p", { class: "status", id: "sheetStatus", role: "status", "aria-live": "polite" })),
      h("section", { class: "section" },
        h("h4", { text: "Look for it elsewhere" }),
        h("p", { class: "hint", text: "Opens each store's search for “" + (q || "this product") + "”." }),
        h("div", { class: "chips" }, SEARCH.map((s) => h("a", { class: "chip", href: s.url(q), target: "_blank", rel: "noopener noreferrer" }, icon("search", 14), s.name)))),
      h("section", { class: "section" },
        h("h4", { text: "Details" }),
        h("div", { class: "form" },
          field(draft, "title", "Name", { wide: true }),
          field(draft, "store", "Store"), field(draft, "colour", "Colour"),
          field(draft, "price", "Price (Rs.)", { num: true }), field(draft, "mrp", "MRP (Rs.)", { num: true }),
          field(draft, "size", "My size", { ph: "M, 32, UK 9" }), field(draft, "note", "Note", { ph: "Matches my Ducati M" }),
          field(draft, "url", "Store link", { type: "url", wide: true, ph: "https://" })),
        h("div", { class: "row" },
          h("button", { class: "btn primary small", type: "button", onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try { await putItem({ ...draft, url: isUrl(draft.url) ? String(draft.url).trim() : "" }); sheetMsg("Saved your changes.", false); }
            catch (err) { sheetMsg(err.message, true); }
            b.disabled = false;
          } }, "Save changes"),
          h("button", { class: "btn ghost small", type: "button", onclick: () => putItem({ ...it, bought: !it.bought }).catch((e) => sheetMsg(e.message, true)) }, icon("check", 16), it.bought ? "Back to wishlist" : "Mark as bought"),
          h("button", { class: "btn danger small", type: "button", onclick: async (e) => {
            const b = e.currentTarget;
            if (!delArmed) { delArmed = true; b.lastChild.textContent = "Tap again to delete"; setTimeout(() => { delArmed = false; if (b.isConnected) b.lastChild.textContent = "Delete"; }, 3000); return; }
            delArmed = false;
            try { await removeItem(it); closeSheet(); } catch (err) { sheetMsg(err.message, true); }
          } }, icon("trash", 16), h("span", { text: "Delete" })))));
  }
  function sheetMsg(msg, err, busy) {
    const el = $("#sheetStatus"); if (!el) return;
    el.className = "status" + (err ? " err" : "");
    el.replaceChildren(...(busy ? [h("span", { class: "spin", "aria-hidden": "true" })] : []), h("span", { text: msg }));
  }

  // ------------------------------------------------------------ settings
  function renderSettings() {
    const theme = store.get("wr.theme", "system");
    const ai = state.ai;
    showSheet(
      sheetTop("Settings"),
      h("section", { class: "section first" },
        h("h4", { text: "Look" }),
        h("div", { class: "seg", role: "radiogroup", "aria-label": "Theme" },
          [["system", "Match phone"], ["dark", "Night"], ["light", "Day"]].map(([v, l]) => h("label", { class: "seg-opt" },
            h("input", { type: "radio", name: "theme", value: v, checked: theme === v, onchange: () => { setTheme(v); } }), h("span", { text: l }))))),
      h("section", { class: "section" },
        h("h4", { text: "Reading screenshots" }),
        h("p", { class: "setting-line" }, h("span", { class: "dot " + (ai ? "on" : ai === false ? "off" : "") }),
          ai ? "Gemini reads your screenshots (free tier, limited per day). When the limit runs out, this phone reads them itself, less accurately."
            : ai === false ? "No Gemini key is set, so this phone reads screenshots itself. It finds prices but often misses names. Add GEMINI_API_KEY to the Worker for better reading."
            : "Checking…"),
        h("p", { class: "hint", text: "Google may use free-tier screenshots to improve its models." })),
      h("section", { class: "section" },
        h("h4", { text: "Price checks" }),
        h("p", { class: "setting-line", text: "Every morning at 8, Wishrack re-checks about 20 saved store pages, oldest first. Items marked as bought are skipped." })),
      h("section", { class: "section" },
        h("h4", { text: "Your rack" }),
        h("p", { class: "setting-line", text: state.items.length + " items saved, " + state.items.filter((x) => x.bought).length + " bought." }),
        h("div", { class: "row" },
          h("button", { class: "btn ghost small", type: "button", onclick: exportRack }, icon("save", 16), "Download a backup (.json)"))),
      h("section", { class: "section" },
        h("h4", { text: "This device" }),
        h("p", { class: "setting-line", text: "This device remembers your passcode. Lock it to make the passcode needed again." }),
        h("div", { class: "row" },
          h("button", { class: "btn danger small", type: "button", onclick: () => { closeSheet(); lock(""); } }, icon("lock", 16), "Lock this device")),
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
    document.head.append(h("meta", { name: "theme-color", content: dark ? "#141a30" : "#d6ddeb" }));
  }

  // ------------------------------------------------------------ gate
  function lock(msg) {
    key = ""; store.set("wr.key", null); gateSwatch();
    $("#appView").hidden = true; $("#gate").hidden = false;
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
    peerieBand(); render(); loadItems();
    fetch("/api/health").then((r) => r.json()).then((j) => { state.ai = !!j.ai; if (state.openId === "settings") renderSettings(); }).catch(() => {});
    takeShared();
  }

  // ------------------------------------------------------------ share target (files handed over by sw.js)
  async function takeShared() {
    const p = new URLSearchParams(location.search);
    if (!p.has("shared")) return;
    history.replaceState(null, "", "/");
    try {
      const cache = await caches.open("wr-share");
      const meta = await cache.match("/shared/meta");
      const info = meta ? await meta.json() : { files: 0, text: "" };
      const files = [];
      for (let i = 0; i < info.files; i++) { const r = await cache.match("/shared/" + i); if (r) files.push(new File([await r.blob()], "shared-" + i, { type: r.headers.get("content-type") || "image/png" })); }
      await Promise.all([cache.delete("/shared/meta"), ...files.map((_, i) => cache.delete("/shared/" + i))]);
      if (files.length) await handleImages(files);
      else if (findUrl(info.text)) await handleLink(findUrl(info.text));
      else if (p.get("shared") !== "0") status("Nothing came through from the share. Try sharing the screenshot itself.", { err: true });
    } catch { /* no share cache */ }
  }

  // ------------------------------------------------------------ events
  $("#gateForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#gateIn").value.trim(); if (v) unlock(v); });
  $("#linkForm").addEventListener("submit", (e) => { e.preventDefault(); handleLink($("#linkIn").value); });
  $("#fileIn").addEventListener("change", (e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; handleImages(fs); });
  $("#manualBtn").addEventListener("click", () => { addReviewItem({}, null, "you"); renderReview(); $("#review input")?.focus(); });
  $("#storeSel").addEventListener("change", (e) => { state.store = e.target.value; store.set("wr.store", state.store); render(); });
  $("#sortSel").addEventListener("change", (e) => { state.sort = e.target.value; store.set("wr.sort", state.sort); render(); });
  $("#settingsBtn").addEventListener("click", () => openSheet("settings"));
  $("#shade").addEventListener("click", closeSheet);
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
