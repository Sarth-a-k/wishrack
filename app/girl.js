// The Lost in Play girl. On the home screen she takes one of a few routes each time the app opens: hopping onto the
// price-drop banner, jumping down to the curved bottom bar, hopping over the save button, saying bye and walking off.
// She also reacts: skips while a screenshot is read, skips across the bar after a save, skips along the banner when
// there's a new price drop, and wags her finger when a search finds nothing. Tap her and she hops.
// Self-contained: reads #view-home, #view-save, #banner (.art, .slide), .tabbar-bg, #status and #grid. Off for reduced motion.
(() => {
  const BASE = "/girl/", SCALE = 0.5; // the strips are drawn at 2x
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let meta, el, shade, W, H, FX, FY;
  const rand = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------ drawing
  function frame(name, i) {
    const n = meta.frames[name];
    i = Math.max(0, Math.min(n - 1, i | 0));
    if (el.dataset.a !== name) { el.dataset.a = name; el.style.backgroundImage = `url(${BASE}${name}.png)`; el.style.backgroundSize = `${n * W}px ${H}px`; }
    el.style.backgroundPosition = `${-i * W}px 0`;
  }
  // Feet at (x, y) in viewport pixels. Her shadow goes on the nearest surface below her and shrinks as she rises.
  // A tap adds a little hop on top of whatever she is doing.
  let hopAt = -1e9, last = null;
  function place(name, i, x, y, rot = 0, sx = 1, sy = 1) {
    last = { x, y };
    const h = (performance.now() - hopAt) / 1000;
    if (h < 0.46) { y -= 4 * 34 * (h / 0.46) * (1 - h / 0.46); name = el.dataset.dir === "L" ? "skipL" : "skipR"; i = h < 0.08 ? 9 : h > 0.4 ? 19 : 16; }
    else el.dataset.dir = /L$/.test(name) ? "L" : "R";
    frame(name, i);
    el.style.transform = `translate(${x - FX}px, ${y - FY}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
    const g = ground(x, y), up = g == null ? Infinity : g - y;
    const k = up > 240 ? 0 : Math.max(0.25, 1 - up / 240);
    shade.style.opacity = k;
    if (k) shade.style.transform = `translate(${x - 16}px, ${g - 4}px) scale(${k})`;
  }
  const loop = (name, secs, fps = 24) => Math.floor(secs * fps) % meta.frames[name];
  const rectOf = (sel) => { const n = document.querySelector(sel); return n && n.offsetParent !== null ? n.getBoundingClientRect() : null; };
  // Surfaces she can stand on or cast a shadow on: the banner, the "Nothing matches" box, the status line, the bottom bar.
  function ground(x, y) {
    let best = null;
    const take = (v) => { if (v != null && v >= y - 2 && (best == null || v < best)) best = v; };
    for (const r of [rectOf("#banner"), rectOf("#grid .empty"), rectOf("#status")]) if (r && r.height && x > r.left + 8 && x < r.right - 8) take(r.top);
    const t = bar();
    take(t && t.yAt(x));
    return best;
  }
  // A little puff of dust either side of her feet when she lands.
  function dust(x, y) {
    for (const dir of [-1, 1]) {
      const d = document.createElement("div");
      Object.assign(d.style, { position: "fixed", left: "0", top: "0", width: "12px", height: "8px", borderRadius: "50%", zIndex: "11",
        pointerEvents: "none", background: "radial-gradient(closest-side, rgba(214,228,220,.9), rgba(214,228,220,0))" });
      document.body.append(d);
      const at = (dx, dy, k) => `translate(${x - 6 + dx}px, ${y - 7 + dy}px) scale(${k})`;
      d.animate([{ transform: at(dir * 6, 0, 0.6), opacity: 0.9 }, { transform: at(dir * 22, -6, 1.7), opacity: 0 }],
        { duration: 420, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => d.remove();
    }
  }

  // ------------------------------------------------------------ where things are
  const shown = (id) => { const v = document.getElementById(id); return !!v && !v.hidden && v.offsetParent !== null; };
  const onHome = () => shown("view-home") && !document.body.classList.contains("searching");
  let edge;
  // The bottom bar's top curve (same shape as the bar's own path), in viewport pixels. `off` is the distance, in bar
  // units, past either end of the bar at which she is fully off the screen.
  function bar() {
    const svg = document.querySelector(".tabbar-bg");
    if (!svg) return null;
    if (!edge || !svg.contains(edge)) {
      edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
      edge.setAttribute("d", "M26 4C84 4 126 50 195 50S306 4 364 4");
      edge.setAttribute("style", "fill:none;stroke:none");
      svg.append(edge);
    }
    const r = svg.getBoundingClientRect(), len = edge.getTotalLength(), vb = svg.viewBox.baseVal;
    const kx = r.width / vb.width, ky = r.height / vb.height;
    const y = (vx) => { let lo = 0, hi = len; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (edge.getPointAtLength(m).x < vx) lo = m; else hi = m; } return r.top + edge.getPointAtLength(lo).y * ky; };
    return { at: (vx) => ({ x: r.left + vx * kx, y: y(vx) }), yAt: (px) => { const vx = (px - r.left) / kx; return vx < -4 || vx > vb.width + 4 ? null : y(vx); }, off: (W + 20) / kx };
  }
  // The walkable top of the banner: from its left corner to just before the photo that pokes up on the right.
  function ledge() {
    const b = document.getElementById("banner");
    if (!b || b.offsetParent === null) return null;
    const r = b.getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight * 0.6) return null;
    let end = r.right - 34;
    const art = b.querySelector(".art");
    if (art) { const a = art.getBoundingClientRect(); if (a.top < r.top - 4) end = a.left - 14; }
    return { y: r.top, x0: r.left + 26, x1: end };
  }
  // Ends a route instead of leaving her in mid-air when what she stands on goes away (search opened, page scrolled).
  const need = (v) => { if (!v) throw new Error("gone"); return v; };

  // ------------------------------------------------------------ a jump: steady sideways speed, real gravity
  const G = 2600;
  function jump(x0, y0, x1, y1, apex) {
    const v0 = Math.sqrt(2 * G * apex), T = (v0 + Math.sqrt(v0 * v0 + 2 * G * Math.max(-apex * 0.9, y1 - y0))) / G;
    return { T, at: (s) => ({ x: x0 + (x1 - x0) * s / T, y: y0 - v0 * s + G * s * s / 2, vy: -v0 + G * s }) };
  }
  // Skip frames: 5-9 crouch, 12-16 push off, 17 falling, 18 legs out, 19-24 landing bend.
  const airFrame = (s, T) => (s < 0.16 ? 12 + Math.floor(s / 0.04) : T - s < 0.08 ? 18 : 17);
  function airborne(set, from, to, apex, crouch = 0.18) {
    let j, landed = false;
    return [
      { d: crouch, run: (t) => { const p = from(); place(set, 5 + t * 5, p.x, p.y); } },
      { d: () => { const a = from(), b = to(); j = jump(a.x, a.y, b.x, b.y, apex); return j.T; }, run: (t) => {
          const s = t * j.T, p = j.at(s), dir = Math.sign(to().x - from().x);
          const fast = Math.min(1, Math.max(0, (p.vy - 300) / 900)); // stretches a little as she falls faster
          place(set, airFrame(s, j.T), p.x, p.y, Math.max(-6, Math.min(8, p.vy / 140)) * dir, 1 - 0.05 * fast, 1 + 0.07 * fast);
        } },
      { d: 0.3, run: (t) => {
          const k = Math.max(0, 1 - t / 0.45), p = to();
          if (!landed) { landed = true; dust(p.x, p.y); }
          place(set, 19 + t * 6, p.x, p.y, 0, 1 + 0.1 * k, 1 - 0.14 * k);
        } },
    ];
  }
  // Moving along a surface (walking, or skipping: a run of small hops), and standing still.
  const move = (set, fps, path, secs) => ({ d: secs, run: (t, e) => { const p = path(t); place(set, loop(set, e, fps), p.x, p.y); } });
  const still = (set, n, secs, at, from = 0) => ({ d: secs, run: (t) => { const p = at(); place(set, from + t * n, p.x, p.y); } });

  // ------------------------------------------------------------ home routes (one picked at random per app open)
  const REST = 40; // where she says bye: near the bar's left end, in bar units (the bar is 390 wide)
  const hopOn = () => airborne("skipR", () => { const n = need(ledge()); return { x: -W, y: n.y + 34 }; }, () => { const n = need(ledge()); return { x: n.x0, y: n.y }; }, 70);
  const alongBar = (b, a, z, skip) => skip
    ? move("skipL", 30, (t) => b.at(a + (z - a) * t), (a - z) / 75)
    : move("walkL", 18, (t) => b.at(a + (z - a) * t), (a - z) / 48);
  const overButton = (b) => airborne("skipL", () => b.at(262), () => b.at(128), 60);
  const sayBye = (b) => [still("stopL", 11, 0.45, () => b.at(REST)), still("byeL", meta.frames.byeL, 1.6, () => b.at(REST))];
  const walkOff = (b) => alongBar(b, REST, -b.off, false);

  function homeRoute(b, l, newDrop) {
    const routes = l ? ["walk", "walk", "skip", "peek", "front"] : ["front", "bar"];
    const pick = newDrop && l ? "skip" : routes[Math.floor(rand(0, routes.length))];
    if (pick === "walk" || pick === "skip") {
      // Banner, a jump down to the bar, over the save button, bye, off the left edge. Skipping when a price dropped.
      const skip = pick === "skip", dist = Math.max(0, Math.min(l.x1, l.x0 + 230) - l.x0);
      const on = (t) => { const n = need(ledge()); return { x: n.x0 + dist * t, y: n.y }; }, top = () => on(1);
      return [...hopOn(), skip ? move("skipR", 30, on, dist / 95) : move("walkR", 18, on, dist / 62),
        still("stopR", 11, 0.45, top), still("stopR", 0, 0.4, top, 10), // at the edge she stops and looks down
        ...airborne("skipR", top, () => b.at(352), 34), still("turnL", 4, 0.18, () => b.at(352)),
        alongBar(b, 352, 262, skip), ...overButton(b), alongBar(b, 128, REST, skip), ...sayBye(b), walkOff(b)];
    }
    if (pick === "peek") {
      // Hops on, walks halfway, looks around, then hops back off the left edge.
      const half = Math.max(40, (l.x1 - l.x0) * 0.5), at = (t) => { const n = need(ledge()); return { x: n.x0 + half * t, y: n.y }; };
      return [...hopOn(), move("walkR", 18, at, half / 62), still("stopR", 11, 0.45, () => at(1)), still("idleR", meta.frames.idleR, 2.4, () => at(1)),
        still("turnL", 4, 0.18, () => at(1)), move("walkL", 18, (t) => at(1 - t), half / 62),
        ...airborne("skipL", () => at(0), () => { const n = need(ledge()); return { x: -W, y: n.y + 40 }; }, 40)];
    }
    // "front" and "bar": in from the right along the bar; "front" also walks toward you before saying bye.
    const steps = [alongBar(b, 390 + b.off, 262, false), ...overButton(b), alongBar(b, 128, REST, false)];
    if (pick === "front") steps.push(
      { d: 1.4, run: (t, e) => { const p = b.at(REST); place("frontL", loop("frontL", e, 18), p.x, p.y, 0, 1 + 0.12 * t, 1 + 0.12 * t); } },
      { d: 0.3, run: (t) => { const p = b.at(REST), k = 1.12 - 0.12 * t; place("frontL", 0, p.x, p.y, 0, k, k); } });
    return [...steps, ...sayBye(b), walkOff(b)];
  }
  // After a save: she skips across the bottom bar, right to left, over the save button.
  const savedRoute = (b) => [alongBar(b, 390 + b.off, 262, true), ...overButton(b), alongBar(b, 128, -b.off, true)];
  // A search found nothing: she jumps onto the "Nothing matches" box, wags her finger, and hops off.
  function noRoute() {
    const box = () => need(rectOf("#grid .empty")), spot = () => { const r = box(); return { x: r.right - 48, y: r.top }; };
    return [...airborne("skipL", () => ({ x: innerWidth + W, y: box().top + 30 }), spot, 70),
      still("stopL", 11, 0.3, spot), still("byeL", meta.frames.byeL, 1.6, spot),
      ...airborne("skipL", spot, () => ({ x: -W, y: box().top + 60 }), 40)];
  }
  // A screenshot is being read: she hops onto the status line and skips in place until it's done, then skips off.
  let readSpot = null; // the status line hides itself when reading ends, so remember where she stood
  const statusSpot = () => { const r = need(rectOf("#status")); return (readSpot = { x: Math.min(innerWidth - 40, r.right - 30), y: r.top }); };
  const readingRoute = () => [...airborne("skipL", () => ({ x: innerWidth + W, y: statusSpot().y + 30 }), statusSpot, 60),
    { d: 600, run: (t, e) => { if (!document.querySelector("#status .spin")) throw new Error("done"); const p = statusSpot(); place("skipR", loop("skipR", e, 30), p.x, p.y); } }];
  function readingDone() {
    const spot = readSpot;
    if (!spot) return [];
    return airborne("skipR", () => spot, () => ({ x: innerWidth + W, y: spot.y + 40 }), 50);
  }

  // ------------------------------------------------------------ running a route
  let playing = null;
  // `where` says where she belongs; leaving it ends the route. A step can end it early by throwing, and then
  // `after` (if given) supplies a closing bit to play instead.
  function run(name, steps, where, after) {
    const me = { name };
    playing = me;
    el.hidden = false;
    el.style.pointerEvents = "auto";
    let i = 0, t0 = performance.now(), d = null;
    const stop = () => { if (playing === me) { el.hidden = true; shade.style.opacity = 0; playing = null; el.style.pointerEvents = "none"; } };
    const tick = (now) => {
      if (playing !== me) return; // replaced by another route
      if (!where() || document.hidden) { stop(); return; }
      for (;;) {
        const s = steps[i];
        if (!s) { stop(); return; }
        try {
          if (d == null) d = typeof s.d === "function" ? s.d() : s.d;
          const e = (now - t0) / 1000;
          if (e < d) { s.run(e / d, e); break; }
        } catch {
          const more = after ? after() : [];
          after = null;
          if (more.length) { steps = more; i = 0; t0 = now; d = null; continue; }
          stop(); return;
        }
        i++; t0 += d * 1000; d = null;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ what starts her
  function newestDrop() {
    try {
      const items = JSON.parse(localStorage.getItem("wr.cache") || "[]");
      return Math.max(0, ...items.filter((x) => !x.bought && !x.removed && !x.inbox && x.previousPrice && x.price < x.previousPrice).map((x) => x.priceChangedAt || 0));
    } catch { return 0; }
  }
  function watch() {
    // The home walk, once per app open, when the home screen is at the top with the rack drawn.
    const begin = Date.now();
    const ready = () => {
      const b = bar();
      if (!playing && b && onHome() && !document.hidden && scrollY < 40 && document.querySelector("#banner .slide")) {
        let seen = 0;
        try { seen = +(localStorage.getItem("wr.girl.drop") || 0); localStorage.setItem("wr.girl.drop", String(newestDrop())); } catch {}
        run("home", homeRoute(b, ledge(), seen > 0 && newestDrop() > seen), onHome);
      } else if (Date.now() - begin < 30000) setTimeout(ready, 400);
    };
    setTimeout(ready, 900);

    // Reading a screenshot, and the save that follows it.
    let savedPending = false;
    const status = document.getElementById("status");
    if (status) new MutationObserver(() => {
      if (status.querySelector(".spin") && shown("view-save") && playing?.name !== "reading") run("reading", readingRoute(), () => shown("view-save"), readingDone);
      if (status.classList.contains("ok") && /^Saved/.test(status.textContent)) savedPending = true;
    }).observe(status, { childList: true, subtree: true, attributes: true, characterData: true });
    const home = document.getElementById("view-home");
    if (home) new MutationObserver(() => {
      if (!savedPending || !onHome()) return;
      savedPending = false;
      setTimeout(() => { const b = bar(); if (b && onHome()) run("saved", savedRoute(b), onHome); }, 500);
    }).observe(home, { attributes: true, attributeFilter: ["hidden"] });

    // A search that finds nothing (at most once every 10 seconds).
    let noAt = 0;
    const grid = document.getElementById("grid");
    if (grid) new MutationObserver(() => {
      const empty = grid.querySelector(".empty h3");
      if (!empty || !/Nothing matches/.test(empty.textContent) || !shown("view-home") || Date.now() - noAt < 10000 || playing?.name === "no") return;
      noAt = Date.now();
      setTimeout(() => { if (rectOf("#grid .empty")) run("no", noRoute(), () => shown("view-home") && !!rectOf("#grid .empty")); }, 350);
    }).observe(grid, { childList: true });
  }

  async function start() {
    try { meta = await (await fetch(BASE + "girl.json")).json(); } catch { return; }
    W = meta.w * SCALE; H = meta.h * SCALE; FX = meta.feetX * SCALE; FY = meta.feetY * SCALE;
    el = document.createElement("div");
    el.className = "wr-girl";
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: W + "px", height: H + "px", zIndex: "11",
      backgroundRepeat: "no-repeat", transformOrigin: `${FX}px ${FY}px`, pointerEvents: "none", willChange: "transform", touchAction: "manipulation" });
    // Tap her and she hops (a small extra jump on top of what she's doing), with a puff of dust as she lands.
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (performance.now() - hopAt < 500) return;
      hopAt = performance.now();
      setTimeout(() => { if (last && playing) dust(last.x, last.y); }, 460);
    });
    shade = document.createElement("div");
    Object.assign(shade.style, { position: "fixed", left: "0", top: "0", width: "32px", height: "8px", borderRadius: "50%", zIndex: "11",
      pointerEvents: "none", opacity: "0", background: "radial-gradient(closest-side, rgba(0,0,0,.32), rgba(0,0,0,0))" });
    document.body.append(shade, el);
    const ok = await Promise.all(Object.keys(meta.frames).map((n) => new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = BASE + n + ".png"; })));
    if (ok.includes(false)) return; // offline without her pictures: skip this time
    watch();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
