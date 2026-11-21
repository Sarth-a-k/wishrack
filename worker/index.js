// Wishrack Worker: serves the app from ./app and answers /api/*.
// Storage: Cloudflare D1 (tables in schema.sql). AI: Google Gemini, only when GEMINI_API_KEY is set.

const MAX_ITEM_BYTES = 200_000;
const MAX_IMAGE_BYTES = 1_500_000;   // stored photos (the app shrinks them first)
const MAX_READ_BYTES = 7_000_000;    // screenshots sent for reading
const CHECKS_PER_RUN = 15;           // free plan allows 50 outbound requests per run; an item can need 3 (product JSON, page, photo)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // The share sheet posts here. The app's service worker normally catches it first;
    // this is the fallback when the service worker isn't running yet.
    if (url.pathname === "/share") return Response.redirect(url.origin + "/?shared=0", 303);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e);
      return json({ error: "server_error", message: String((e && e.message) || e) }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(checkPrices(env, CHECKS_PER_RUN));
  },
};

// ---------------------------------------------------------------- routing
async function api(req, env, url, ctx) {
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, ai: !!env.GEMINI_API_KEY, passcodeSet: !!env.APP_PASSCODE, model: liveModel || env.GEMINI_MODEL || "gemini-flash-latest" });
  }

  // Photos are public by unguessable id so <img> tags can load them.
  let m = path.match(/^\/api\/images\/([a-f0-9]{32})$/);
  if (m && method === "GET") return getImage(env, m[1]);

  if (!env.APP_PASSCODE) throw new HttpError(503, "no_passcode", "Set APP_PASSCODE first (see SETUP.md).");
  if (!sameSecret(req.headers.get("x-wishrack-key") || "", env.APP_PASSCODE)) throw new HttpError(401, "wrong_passcode", "Wrong passcode.");

  if (path === "/api/login" && method === "POST") return json({ ok: true });

  if (path === "/api/items" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, data FROM items ORDER BY updated_at DESC").all();
    const items = results.map((r) => ({ ...safeParse(r.data), id: r.id }));
    // After answering, quietly fetch store photos for a few items that have none (at most once every 6 hours each).
    const now = Date.now();
    const photoless = items.filter((x) => x.url && !x.imageId && !x.bought && !x.removed && now - (x.lastChecked || 0) > 6 * 3600e3).slice(0, 3);
    if (photoless.length && ctx) ctx.waitUntil(Promise.all(photoless.map((x) => checkOne(env, x).catch(() => {}))));
    return json({ items });
  }

  m = path.match(/^\/api\/items\/([A-Za-z0-9_-]{1,64})$/);
  if (m && method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_ITEM_BYTES) throw new HttpError(413, "too_big", "That item is too large to save.");
    const data = safeParse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "bad_item", "Item must be a JSON object.");
    delete data.id;
    await env.DB.prepare("INSERT OR REPLACE INTO items (id, data, updated_at) VALUES (?1, ?2, ?3)")
      .bind(m[1], JSON.stringify(data), Date.now()).run();
    return json({ ok: true, item: { ...data, id: m[1] } });
  }
  if (m && method === "DELETE") {
    const row = await env.DB.prepare("SELECT data FROM items WHERE id = ?1").bind(m[1]).first();
    const imageId = row && safeParse(row.data)?.imageId;
    const stmts = [env.DB.prepare("DELETE FROM items WHERE id = ?1").bind(m[1])];
    if (imageId) stmts.push(env.DB.prepare("DELETE FROM images WHERE id = ?1").bind(imageId));
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  m = path.match(/^\/api\/check\/([A-Za-z0-9_-]{1,64})$/);
  if (m && method === "POST") {
    const row = await env.DB.prepare("SELECT data FROM items WHERE id = ?1").bind(m[1]).first();
    if (!row) throw new HttpError(404, "not_found", "That item no longer exists.");
    const item = await checkOne(env, { ...safeParse(row.data), id: m[1] });
    return json({ item });
  }

  if (path === "/api/profile") {
    // One row in a small key-value table; created on first use so the live database needs no migration step.
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)").run();
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT data FROM settings WHERE key = 'profile'").first();
      return json({ profile: row ? safeParse(row.data) : null });
    }
    if (method === "PUT") {
      const text = await req.text();
      if (text.length > 2000) throw new HttpError(413, "too_big", "That profile is too large to save.");
      const body = safeParse(text);
      if (!body || typeof body !== "object") throw new HttpError(400, "bad_json", "Send the profile as JSON.");
      const profile = {
        name: String(body.name ?? "").trim().slice(0, 40),
        photoId: typeof body.photoId === "string" && /^[a-f0-9]{32}$/.test(body.photoId) ? body.photoId : null,
      };
      await env.DB.prepare("INSERT INTO settings (key, data, updated_at) VALUES ('profile', ?1, ?2) ON CONFLICT(key) DO UPDATE SET data = ?1, updated_at = ?2")
        .bind(JSON.stringify(profile), Date.now()).run();
      return json({ ok: true, profile });
    }
  }

  if (path === "/api/images" && method === "POST") return putImage(req, env);
  m = path.match(/^\/api\/images\/([a-f0-9]{32})$/);
  if (m && method === "DELETE") {
    await env.DB.prepare("DELETE FROM images WHERE id = ?1").bind(m[1]).run();
    return json({ ok: true });
  }

  if (path === "/api/read-image" && method === "POST") return readImage(req, env);
  if (path === "/api/read-link" && method === "GET") return json(await readLink(env, url.searchParams.get("url"), true));
  if (path === "/api/fetch-image" && method === "GET") return fetchImage(url.searchParams.get("url"));
  if (path === "/api/shop-search" && method === "GET") return shopSearch(url.searchParams.get("site"), url.searchParams.get("q"));

  throw new HttpError(404, "not_found", "No such endpoint.");
}

function sameSecret(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ---------------------------------------------------------------- images
async function putImage(req, env) {
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new HttpError(415, "bad_type", "Photos must be JPEG, PNG or WebP.");
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw new HttpError(400, "empty", "The photo was empty.");
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, "too_big", "That photo is too large.");
  const id = crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("INSERT INTO images (id, mime, data, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, type, buf, Date.now()).run();
  return json({ id });
}
async function getImage(env, id) {
  const row = await env.DB.prepare("SELECT mime, data FROM images WHERE id = ?1").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(bytes, { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" } });
}

// Lets the app load a store's product photo (browsers block that across sites).
async function fetchImage(target) {
  const u = checkUrl(target);
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*;q=0.8" }, signal: AbortSignal.timeout(12000) });
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!r.ok || !type.startsWith("image/")) throw new HttpError(502, "image_unavailable", "The store didn't return a photo.");
  const len = Number(r.headers.get("content-length") || 0);
  if (len > 8_000_000) throw new HttpError(413, "too_big", "That photo is too large.");
  return new Response(r.body, { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
}

function checkUrl(s) {
  let u;
  try { u = new URL(String(s || "")); } catch { throw new HttpError(400, "bad_url", "That isn't a valid link."); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, "bad_url", "Links must start with http or https.");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(u.hostname)) throw new HttpError(400, "bad_url", "That link points to a private address.");
  return u.toString();
}

// Shopify's product search for a store, passed through because browsers can't read it directly (no CORS).
// Some Shopify stores block Cloudflare; then this answers "blocked" and the Android app searches from the phone.
async function shopSearch(site, q) {
  site = String(site || "").toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site) || !q) throw new HttpError(400, "bad_request", "Needs a store site and a product name.");
  const u = checkUrl(`https://${site}/search/suggest.json?q=${encodeURIComponent(String(q).slice(0, 120))}&resources%5Btype%5D=product&resources%5Blimit%5D=5`);
  let r;
  try { r = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new HttpError(502, "blocked", "Couldn't reach that store."); }
  const j = r.ok ? safeParse(await r.text()) : null;
  const list = j?.resources?.results?.products;
  if (!Array.isArray(list)) throw new HttpError(502, "blocked", "That store didn't answer a search.");
  return json({ products: list.map((p) => ({ title: String(p.title || ""), url: String(p.url || "") })) });
}

// ---------------------------------------------------------------- Gemini
const FIELDS = `For each product give:
- "title": the product name as written, without the brand at the front
- "brand": the brand if shown, else null
- "store": who sells it (for example "H&M", "Uniqlo", "Bonkers Corner"); for an Instagram ad, the advertiser
- "url": a full product link only if it is fully visible or given, else null
- "price": the current selling price as a plain number, or null if no price is shown
- "mrp": the original or struck-through price as a plain number, or null
- "currency": ISO code; "INR" when prices show Rs. or ₹
- "colour": the colour if shown, else null`;

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
let liveModel = ""; // a working model found at run time, kept while this Worker instance lives

async function gemini(env, parts) {
  if (!env.GEMINI_API_KEY) throw new HttpError(503, "no_ai", "Screenshot reading isn't set up. Add a Gemini key (see SETUP.md).");
  // GEMINI_MODEL pins a model; empty means use the newest stable Flash model Google lists (looked up once per Worker instance).
  if (!env.GEMINI_MODEL && !liveModel) liveModel = await pickFlashModel(env);
  let model = env.GEMINI_MODEL || liveModel || "gemini-flash-latest";
  // Time limits keep the whole attempt, fallbacks included, under the phone app's 90-second wait.
  let r = await callGemini(env, model, parts, 35000);
  let errText = r.ok ? "" : await r.text();
  // Google retires model names over time. When ours is gone, ask Google which Flash models exist now and use the newest.
  if (r.status === 404 || (r.status === 400 && /not found|not supported|no longer|deprecated|retired/i.test(errText))) {
    const found = await pickFlashModel(env);
    if (found && found !== model) {
      model = liveModel = found;
      r = await callGemini(env, model, parts, 25000);
      errText = r.ok ? "" : await r.text();
    }
  }
  // 500/503: overloaded on Google's side, so retry once after a pause. 504 (too slow) goes straight to other models.
  if (r.status >= 500 && r.status !== 504) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await callGemini(env, model, parts, 20000);
    errText = r.ok ? "" : await r.text();
  }
  if (r.status >= 500) {
    for (const alt of await fallbackModels(env, model)) {
      r = await callGemini(env, alt, parts, 20000); // not remembered: being busy is temporary
      errText = r.ok ? "" : await r.text();
      if (r.ok || (r.status < 500 && r.status !== 404)) break;
    }
  }
  if (r.status === 429) throw new HttpError(429, "ai_limit", "Gemini's free daily limit is used up. It resets tomorrow; the app reads screenshots on your device meanwhile.");
  if (r.status === 400 || r.status === 403) {
    throw new HttpError(502, "ai_key", /API key|PERMISSION|api_key/i.test(errText) ? "Gemini rejected the key. Check GEMINI_API_KEY (see SETUP.md)." : "Gemini refused the request: " + errText.slice(0, 200));
  }
  if (r.status === 404) throw new HttpError(502, "ai_model", `Gemini has no model called "${model}" and no other Flash model was found. Set GEMINI_MODEL in wrangler.toml to a model from ai.google.dev/gemini-api/docs/models.`);
  if (r.status >= 500) throw new HttpError(503, "ai_busy", (r.status === 504 ? "Gemini is too slow right now" : "Gemini is overloaded right now (" + r.status + ")") + ". Screenshots wait and are read again in a few minutes.");
  if (!r.ok) throw new HttpError(502, "ai_error", "Gemini didn't answer (" + r.status + "). Try again.");
  const j = await r.json();
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const parsed = looseJson(text);
  if (parsed == null) throw new HttpError(502, "ai_unreadable", "Gemini's answer couldn't be read. Try again.");
  return parsed;
}
async function callGemini(env, model, parts, ms) {
  try {
    return await fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
      signal: AbortSignal.timeout(ms),
    });
  } catch {
    return new Response("Gemini took too long or couldn't be reached", { status: 504 }); // handled like a busy model
  }
}
// From Google's live model list: the "latest" Flash alias if offered, else the newest stable Flash model that reads images.
async function pickFlashModel(env) {
  try {
    const r = await fetch(`${GEMINI}?pageSize=200`, { headers: { "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return "";
    const names = ((await r.json()).models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""));
    return chooseFlash(names);
  } catch { return ""; }
}
// Up to two other models to try while ours is overloaded: other stable Flash models, newest first, then Flash-Lite.
async function fallbackModels(env, current) {
  try {
    const r = await fetch(`${GEMINI}?pageSize=200`, { headers: { "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const names = ((await r.json()).models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""));
    return orderFallbacks(names, current);
  } catch { return []; }
}
function orderFallbacks(names, current) {
  const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const stable = (n) => /^gemini-\d/.test(n) && /flash/.test(n) && !/image|tts|audio|live|embed|exp|preview|8b/.test(n);
  const full = names.filter((n) => stable(n) && !/lite/.test(n)).sort((a, b) => version(b) - version(a));
  const lite = names.filter((n) => stable(n) && /lite/.test(n)).sort((a, b) => version(b) - version(a));
  return [...full, ...lite].filter((n) => n !== current).slice(0, 2);
}
// The newest stable numbered Flash model (faster than the "latest" alias, which can point at a slower new release).
function chooseFlash(names) {
  const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const flash = names.filter((n) => /^gemini-\d/.test(n) && /flash/.test(n) && !/lite|image|tts|audio|live|embed|exp|preview|8b|\d{3,}$/.test(n)).sort((a, b) => version(b) - version(a));
  return flash[0] || (names.includes("gemini-flash-latest") ? "gemini-flash-latest" : names.find((n) => /flash/.test(n)) || "");
}
function looseJson(t) {
  t = String(t || "").trim();
  const v = safeParse(t);
  if (v != null) return v;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { const f = safeParse(fence[1]); if (f != null) return f; }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  return a >= 0 && b > a ? safeParse(t.slice(a, b + 1)) : null;
}
function b64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function cleanItem(o) {
  const n = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.]/g, "")); return isFinite(x) && x > 0 ? x : null; };
  const s = (v) => (v == null ? "" : String(v).trim().slice(0, 300));
  const url = s(o.url);
  return {
    title: s(o.title), brand: s(o.brand), store: s(o.store), url: /^https?:\/\//i.test(url) ? url : "",
    price: n(o.price), mrp: n(o.mrp), currency: s(o.currency).toUpperCase().slice(0, 3) || "INR", colour: s(o.colour),
  };
}

async function readImage(req, env) {
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type)) throw new HttpError(415, "bad_type", "Use a PNG or JPG screenshot.");
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_READ_BYTES) throw new HttpError(413, "too_big", "That screenshot is too large.");
  const prompt = `You read phone screenshots for a personal wishlist of CLOTHES AND SHOES. A screenshot may come from a store website or app, an Instagram ad, post or reel, or a chat, but most screenshots on a phone are not shopping at all.
Only clothing and footwear count (tops, shirts, t-shirts, sweaters, jackets, coats, trousers, jeans, shorts, dresses, skirts, ethnic wear, innerwear, shoes, sneakers, sandals). Ignore everything else: gadgets, food, furniture, beauty products, people's photos, memes, chats, documents, and outfits in a photo that is not selling them.
If the screenshot shows no clothing or footwear product offered for sale or named by a brand or store, reply {"items":[],"skip":"<a few words on what it shows>"}.
Otherwise find the clothes and shoes the person wants to save. Usually that is ONE main product. If the screenshot is a product grid or list, include every clothing or footwear product that shows its own name and price (at most 8), in reading order.
${FIELDS}
- "site": the store's website domain, for example "wrogn.com": from the screenshot if it shows one (such as a browser address bar), otherwise the official website of that store or brand if you are sure of it, else null
- "box_2d": [ymin, xmin, ymax, xmax] of that product's photo, on a 0-1000 scale of the image's height and width; null if there is no photo of it. Keep the whole product (and the model wearing it) but leave out the shop's interface on or around the photo: buttons such as VIEW PRODUCTS or ADD TO BAG, badges such as NEW DROP or SALE, ratings, arrows, carousel dots, icons, captions, price text and navigation bars. Cutting off some empty background is better than including any of those.
- "overlays_2d": a list of [ymin, xmin, ymax, xmax] boxes, same scale, for any of that interface that is still inside your box_2d (a badge, arrow, dot row, icon or button drawn over the photo); [] if none
Never guess a price. Reply with only JSON: {"items":[...]}`;
  const out = await gemini(env, [{ text: prompt }, { inline_data: { mime_type: type, data: b64(buf) } }]);
  const list = Array.isArray(out?.items) ? out.items : Array.isArray(out) ? out : [];
  return json({
    skip: list.length ? "" : String(out?.skip || "no clothes or shoes").slice(0, 80),
    items: list.slice(0, 8).map((o) => {
      const b = Array.isArray(o.box_2d) && o.box_2d.length === 4 && o.box_2d.every((v) => typeof v === "number") ? o.box_2d : null;
      const site = String(o.site || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
      const overlays = (Array.isArray(o.overlays_2d) ? o.overlays_2d : [])
        .filter((v) => Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && isFinite(n))).slice(0, 8)
        .map((v) => [v[1] / 1000, v[0] / 1000, v[3] / 1000, v[2] / 1000]);
      return { ...cleanItem(o), site: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site) ? site : "", box: b ? [b[1] / 1000, b[0] / 1000, b[3] / 1000, b[2] / 1000] : null, overlays };
    }),
  });
}

// ---------------------------------------------------------------- links
// Reads a product page. Order: Shopify's product JSON, the page's schema.org Product data,
// its meta tags, and (if allowed and still missing a price) Gemini on the page text.
async function readLink(env, target, allowAi) {
  const url = checkUrl(target);
  const result = { title: "", brand: "", store: "", url, price: null, mrp: null, currency: "", colour: "", image: "", source: "none" };
  const host = new URL(url).hostname.replace(/^www\d?\./, "");

  if (/\/products\/[^/?#]+/.test(url)) {
    try {
      const js = url.split(/[?#]/)[0].replace(/\/$/, "") + ".js";
      const r = await fetch(js, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10000) });
      // Shopify serves this product JSON as text/javascript, so parse the body rather than trusting the type.
      const p = r.ok ? safeParse(await r.text()) : null;
      if (p && (p.variants || p.price != null)) {
        const v = (p.variants || []).find((x) => x.available) || (p.variants || [])[0] || {};
        const price = (v.price ?? p.price) / 100, cmp = (v.compare_at_price ?? p.compare_at_price) / 100;
        Object.assign(result, {
          title: p.title || "", brand: p.vendor || "", price: isFinite(price) && price > 0 ? price : null,
          mrp: isFinite(cmp) && cmp > price ? cmp : null, currency: "INR",
          image: absUrl(p.featured_image || (p.images || [])[0] || "", url), source: "store",
        });
      }
    } catch { /* fall through to the page */ }
  }

  let html = "";
  if (!result.price || !result.image) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-IN,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
      if (r.ok) html = (await r.text()).slice(0, 3_000_000);
    } catch { /* site blocked or slow */ }
  }
  if (html) {
    const p = parseProduct(html, url);
    for (const k of ["title", "brand", "store", "currency", "image", "colour"]) if (!result[k] && p[k]) result[k] = p[k];
    if (result.price == null && p.price != null) { result.price = p.price; result.source = "page"; }
    if (result.mrp == null && p.mrp != null && p.mrp > (result.price || 0)) result.mrp = p.mrp;
    if (result.source === "none" && (p.title || p.image)) result.source = "page";
  }

  if (allowAi && env.GEMINI_API_KEY && html && (result.price == null || !result.title)) {
    try {
      const text = pageText(html).slice(0, 14000);
      const out = await gemini(env, [{ text: `You read a product page for a wishlist app. Page URL: ${url}\nReturn the ONE main product.\n${FIELDS}\nReply with only JSON: {"item":{...}}\n\nPAGE TEXT:\n${text}` }]);
      const it = cleanItem(out?.item || out?.items?.[0] || out || {});
      for (const k of ["title", "brand", "store", "colour"]) if (!result[k] && it[k]) result[k] = it[k];
      if (result.price == null && it.price != null) { result.price = it.price; result.source = "ai"; }
      if (result.mrp == null && it.mrp != null) result.mrp = it.mrp;
      if (!result.currency && it.currency) result.currency = it.currency;
    } catch { /* keep what we have */ }
  }

  // A known store's own name beats whatever its page calls itself ("BonkersCorner", "UNIQLO").
  result.store = knownStore(host) || result.store || storeName(host);
  if (!result.currency) result.currency = "INR";
  if (result.title) result.title = decode(result.title).replace(/\s*[|–-]\s*(H&M|UNIQLO|Uniqlo|Myntra|Amazon\.in|Flipkart|AJIO|Bonkers ?Corner).*$/i, "").trim();
  return result;
}

const STORE_NAMES = { "hm.com": "H&M", "uniqlo.com": "Uniqlo", "bonkerscorner.com": "Bonkers Corner", "myntra.com": "Myntra", "amazon.in": "Amazon", "flipkart.com": "Flipkart", "ajio.com": "Ajio", "zara.com": "Zara", "instagram.com": "Instagram" };
function knownStore(host) {
  for (const [k, v] of Object.entries(STORE_NAMES)) if (host === k || host.endsWith("." + k)) return v;
  return "";
}
function storeName(host) {
  const base = host.split(".").slice(-2, -1)[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function parseProduct(html, pageUrl) {
  const out = { title: "", brand: "", store: "", price: null, mrp: null, currency: "", image: "", colour: "" };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = safeParse(m[1].trim().replace(/^<!--|-->$/g, ""));
    const p = findProduct(data);
    if (!p) continue;
    out.title = text1(p.name);
    out.brand = text1(p.brand && (p.brand.name || p.brand));
    out.colour = text1(p.color);
    out.image = absUrl(firstImage(p.image), pageUrl);
    const offer = pickOffer(p.offers) || pickOffer(p.hasVariant && [].concat(p.hasVariant).map((v) => v.offers));
    if (offer) {
      out.price = num(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
      out.currency = text1(offer.priceCurrency || offer.priceSpecification?.priceCurrency);
      const list = [].concat(offer.priceSpecification || []).find((s) => /ListPrice|StrikethroughPrice/i.test(String(s.priceType || "")));
      if (list) out.mrp = num(list.price);
    }
    break;
  }
  const meta = {};
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(tag[0]);
    const k = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (k && a.content != null && !(k in meta)) meta[k] = decode(a.content);
  }
  out.title ||= meta["og:title"] || meta["twitter:title"] || decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "");
  out.image ||= absUrl(meta["og:image"] || meta["og:image:secure_url"] || meta["twitter:image"] || "", pageUrl);
  out.store ||= meta["og:site_name"] || "";
  if (out.price == null) out.price = num(meta["product:price:amount"] || meta["og:price:amount"] || meta["price"]);
  out.currency ||= meta["product:price:currency"] || meta["og:price:currency"] || "";
  return out;
}
function findProduct(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findProduct(n, depth + 1); if (f) return f; } return null; }
  const t = [].concat(node["@type"] || []);
  if (t.some((x) => /^(Product|ProductGroup|IndividualProduct)$/.test(x))) return node;
  if (node["@graph"]) return findProduct(node["@graph"], depth + 1);
  if (node.mainEntity) return findProduct(node.mainEntity, depth + 1);
  return null;
}
function pickOffer(o) {
  if (!o) return null;
  const list = [].concat(o).flat().filter(Boolean);
  return list.find((x) => /InStock/i.test(String(x.availability || ""))) || list[0] || null;
}
const num = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.]/g, "")); return isFinite(x) && x > 0 ? x : null; };
const text1 = (v) => (Array.isArray(v) ? text1(v[0]) : v == null ? "" : typeof v === "object" ? text1(v.name || v["@value"] || "") : decode(String(v)).trim());
function firstImage(v) { if (!v) return ""; if (Array.isArray(v)) return firstImage(v[0]); if (typeof v === "object") return v.url || v.contentUrl || ""; return String(v); }
function absUrl(u, base) { if (!u) return ""; try { return new URL(u.startsWith("//") ? "https:" + u : u, base).toString(); } catch { return ""; } }
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? "";
  return out;
}
function decode(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function pageText(html) {
  return decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- price tracking
async function checkOne(env, item) {
  const now = Date.now();
  let found = null;
  if (item.url) {
    try { found = await readLink(env, item.url, false); } catch { found = null; }
  }
  const next = { ...item, lastChecked: now };
  if (found && found.price != null) {
    if (item.price == null || Math.abs(found.price - item.price) >= 1) {
      const hist = Array.isArray(item.priceHistory) ? item.priceHistory.slice(-29) : [];
      if (item.price != null && !hist.length) hist.push({ t: item.addedAt || now, p: item.price });
      hist.push({ t: now, p: found.price });
      next.priceHistory = hist;
      if (item.price != null) { next.previousPrice = item.price; next.priceChangedAt = now; }
      next.price = found.price;
    }
    if (found.mrp != null) next.mrp = found.mrp;
    next.checkError = "";
  }
  // Items saved from a bare link have no photo; borrow the store's own product photo when the page names one.
  if (found && found.image && !item.imageId) {
    try {
      const r = await fetch(checkUrl(found.image), { headers: { "user-agent": UA, accept: "image/webp,image/jpeg,image/*" }, signal: AbortSignal.timeout(12000) });
      const type = (r.headers.get("content-type") || "").split(";")[0];
      const buf = r.ok && /^image\/(jpeg|png|webp)$/.test(type) ? await r.arrayBuffer() : null;
      if (buf && buf.byteLength && buf.byteLength <= MAX_IMAGE_BYTES) {
        const imageId = crypto.randomUUID().replace(/-/g, "");
        await env.DB.prepare("INSERT INTO images (id, mime, data, created_at) VALUES (?1, ?2, ?3, ?4)").bind(imageId, type, buf, now).run();
        next.imageId = imageId;
      }
    } catch { /* keep the item without a photo */ }
  }
  if (!found || found.price == null) next.checkError = !item.url ? "No store link saved." : found && (found.title || found.image) ? "The store page doesn't show its price to Wishrack. Update it by hand if it changed." : "The store page couldn't be read.";
  const { id, ...data } = next;
  await env.DB.prepare("UPDATE items SET data = ?1, updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(data), now, id).run();
  return next;
}

async function checkPrices(env, limit) {
  const { results } = await env.DB.prepare("SELECT id, data FROM items").all();
  const due = results
    .map((r) => ({ ...safeParse(r.data), id: r.id }))
    .filter((x) => x.url && !x.bought && !x.removed)
    .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0))
    .slice(0, limit);
  for (const item of due) {
    try { await checkOne(env, item); } catch (e) { console.error("check failed", item.id, e); }
  }
}
