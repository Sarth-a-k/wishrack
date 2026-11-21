// Hold a product photo to see it large; let go and it settles back into its card.
// Self-contained on purpose: it works on any <img> wider than 80px, so redesigns of the page don't break it.
// Opt an image out with data-nozoom (the crop editor already is, via .crop).
(() => {
  "use strict";
  const HOLD_MS = 350, MOVE_PX = 10, EASE = "cubic-bezier(.2, .8, .2, 1)";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const ms = () => (reduce.matches ? 0 : 280);

  const style = document.createElement("style");
  style.textContent = `
    img { -webkit-touch-callout: none; -webkit-user-drag: none; }
    .wr-zoom-shade { position: fixed; inset: 0; z-index: 9999; background: rgba(9, 12, 26, .78); opacity: 0; touch-action: none; }
    .wr-zoom-img { position: fixed; z-index: 10000; object-fit: cover; border-radius: 12px; box-shadow: 0 24px 60px rgba(0, 0, 0, .45); pointer-events: none; will-change: left, top, width, height; }`;
  document.head.append(style);

  let timer = 0, start = null, target = null, zoom = null, swallowClick = false;

  const zoomable = (el) => {
    const img = el && el.closest ? el.closest("img") : null;
    if (!img || img.closest("[data-nozoom], .crop") || !img.complete || !img.naturalWidth) return null;
    return img.getBoundingClientRect().width >= 80 ? img : null;
  };
  const place = (el, r, radius) => Object.assign(el.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: radius });

  function open(img) {
    const from = img.getBoundingClientRect();
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const k = Math.min((innerWidth * 0.92) / nw, (innerHeight * 0.82) / nh);
    const w = nw * k, h = nh * k;
    const to = { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h };
    const shade = document.createElement("div");
    shade.className = "wr-zoom-shade";
    const big = document.createElement("img");
    big.className = "wr-zoom-img";
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || "";
    place(big, from, getComputedStyle(img).borderRadius);
    document.body.append(shade, big);
    big.getBoundingClientRect(); // commit the start position so the change below animates
    const t = `${ms()}ms ${EASE}`;
    shade.style.transition = `opacity ${t}`;
    big.style.transition = `left ${t}, top ${t}, width ${t}, height ${t}, border-radius ${t}`;
    shade.style.opacity = "1";
    place(big, to, "14px");
    img.style.visibility = "hidden"; // the photo appears to lift out of its card
    zoom = { img, shade, big };
    swallowClick = true;
    navigator.vibrate?.(8);
  }

  function close() {
    if (!zoom) return;
    const { img, shade, big } = zoom;
    zoom = null;
    place(big, img.getBoundingClientRect(), getComputedStyle(img).borderRadius); // back to wherever the card is now
    shade.style.opacity = "0";
    setTimeout(() => { img.style.visibility = ""; shade.remove(); big.remove(); }, ms() + 20);
    setTimeout(() => { swallowClick = false; }, ms() + 400);
  }

  function cancelHold() { clearTimeout(timer); timer = 0; start = null; target = null; }

  addEventListener("pointerdown", (e) => {
    if (zoom || (e.pointerType === "mouse" && e.button !== 0)) return;
    const img = zoomable(e.target);
    if (!img) return;
    target = img;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { timer = 0; if (target) open(target); }, HOLD_MS);
  }, { passive: true });

  addEventListener("pointermove", (e) => {
    if (start && !zoom && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_PX) cancelHold(); // a scroll, not a hold
  }, { passive: true });

  // Lifting the finger ends the zoom. Android can send pointercancel during a long press, so only a real lift closes it.
  const release = () => { cancelHold(); close(); };
  addEventListener("pointerup", release);
  addEventListener("touchend", release);
  addEventListener("pointercancel", () => { if (!zoom) cancelHold(); });
  addEventListener("touchcancel", () => { if (!zoom) cancelHold(); });
  addEventListener("blur", release);
  addEventListener("scroll", () => { if (!zoom) cancelHold(); }, { passive: true, capture: true });

  // A hold must not also count as a tap (which would open the store), nor open the browser's image menu.
  addEventListener("click", (e) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; } }, true);
  addEventListener("contextmenu", (e) => { if (zoom || target || zoomable(e.target)) e.preventDefault(); }, true);
})();
