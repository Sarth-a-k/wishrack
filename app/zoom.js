// Hold a product photo to see it large; let go and it settles back into its card.
// Self-contained on purpose: it works on any <img> wider than 80px, so redesigns of the page don't break it.
// Opt an image out with data-nozoom (the crop editor already is, via .crop).
(() => {
  "use strict";
  const HOLD_MS = 350, MOVE_PX = 10, OPEN = "cubic-bezier(.22, 1, .36, 1)", SHUT = "cubic-bezier(.4, 0, .2, 1)";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const ms = (n) => (reduce.matches ? 0 : n);

  const style = document.createElement("style");
  style.textContent = `
    img { -webkit-touch-callout: none; -webkit-user-drag: none; }
    .wr-zoom-shade { position: fixed; inset: 0; z-index: 9999; background: rgba(9, 12, 26, .78); opacity: 0; touch-action: none; }
    .wr-zoom-img { position: fixed; z-index: 10000; pointer-events: none; transform-origin: 50% 50%; will-change: transform, clip-path; }`;
  document.head.append(style);

  let timer = 0, start = null, target = null, zoom = null, swallowClick = false;

  const zoomable = (el) => {
    const img = el && el.closest ? el.closest("img") : null;
    if (!img || img.closest("[data-nozoom], .crop") || !img.complete || !img.naturalWidth) return null;
    return img.getBoundingClientRect().width >= 80 ? img : null;
  };
  // The big photo sits at its final size the whole time; the animation only scales and crops it (transform and
  // clip-path), which the phone's graphics chip handles smoothly. "card" makes it look exactly like the photo in its
  // card: scaled down to cover the card and cropped to the card's shape and corners.
  function card(to, from, radius) {
    const s = Math.max(from.width / to.width, from.height / to.height);
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const ix = Math.max(0, (to.width - from.width / s) / 2), iy = Math.max(0, (to.height - from.height / s) / 2);
    return { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px round ${(parseFloat(radius) || 0) / s}px)` };
  }
  const full = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(0px 0px round 14px)" };

  async function open(img) {
    const from = img.getBoundingClientRect(), radius = getComputedStyle(img).borderRadius;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const k = Math.min((innerWidth * 0.92) / nw, (innerHeight * 0.82) / nh);
    const to = { left: (innerWidth - nw * k) / 2, top: (innerHeight - nh * k) / 2, width: nw * k, height: nh * k };
    const shade = document.createElement("div");
    shade.className = "wr-zoom-shade";
    const big = document.createElement("img");
    big.className = "wr-zoom-img";
    big.alt = img.alt || "";
    big.src = img.currentSrc || img.src;
    Object.assign(big.style, { left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px" }, card(to, from, radius));
    zoom = { img, shade, big, to, radius };
    swallowClick = true;
    navigator.vibrate?.(8);
    try { await big.decode(); } catch {} // already downloaded; decoding first avoids a stutter on the first frame
    if (!zoom || zoom.big !== big) return; // let go while decoding
    document.body.append(shade, big);
    img.style.visibility = "hidden"; // the photo appears to lift out of its card
    zoom.anim = big.animate([card(to, from, radius), full], { duration: ms(340), easing: OPEN, fill: "forwards" });
    zoom.fade = shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(300), easing: "linear", fill: "forwards" });
  }

  function close() {
    if (!zoom) return;
    const { img, shade, big, to, radius, anim, fade } = zoom;
    zoom = null;
    const done = () => { img.style.visibility = ""; shade.remove(); big.remove(); };
    setTimeout(() => { swallowClick = false; }, ms(260) + 400);
    if (!anim) { done(); return; } // let go before it even opened
    if (anim.playState === "running") { anim.reverse(); fade.reverse(); anim.onfinish = done; return; } // still growing: shrink back the same way
    const back = big.animate([full, card(to, img.getBoundingClientRect(), radius)], { duration: ms(260), easing: SHUT, fill: "forwards" });
    shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(240), easing: "linear", fill: "forwards" });
    back.onfinish = done;
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
