// Draws app/icons/icon.svg (horn button on navy rib knit) as PNGs for Android and iOS install.
// The shapes are copied from icon.svg; rerun after changing it: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = { knit: hex("#1d2542"), rib: hex("#2a3459"), horn: hex("#c39a6b"), rim: hex("#8d6a43"), ring: hex("#a9825a"), hole: hex("#141a30"), thread: hex("#eee4cf") };
const stripes = [40, 124, 208, 292, 376, 460];
const holes = [[226, 226], [286, 226], [226, 286], [286, 286]];
const segs = [[226, 226, 286, 286], [286, 226, 226, 286]];

function segDist(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Colour at a point in the icon's 512-unit space, painted in the SVG's order.
function colourAt(x, y) {
  let c = C.knit;
  if (stripes.some((s) => x >= s && x < s + 22)) c = C.rib;
  const d = Math.hypot(x - 256, y - 256);
  if (d <= 132) c = C.horn;
  if (Math.abs(d - 132) <= 9) c = C.rim;
  if (Math.abs(d - 96) <= 3) c = C.ring;
  if (holes.some(([hx, hy]) => Math.hypot(x - hx, y - hy) <= 17)) c = C.hole;
  if (segs.some((s) => segDist(x, y, s) <= 4.5)) c = C.thread;
  return c;
}

function render(size) {
  const ss = 4, px = Buffer.alloc(size * size * 3), k = 512 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = colourAt((x + (sx + 0.5) / ss) * k, (y + (sy + 0.5) / ss) * k);
      r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * size + x) * 3, n = ss * ss;
    px[i] = Math.round(r / n); px[i + 1] = Math.round(g / n); px[i + 2] = Math.round(b / n);
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// Self-check: the centre of the button is thread-coloured, a stripe pixel is rib, a corner is knit.
console.assert(colourAt(256, 256) === C.thread && colourAt(50, 5) === C.rib && colourAt(1, 1) === C.knit, "icon geometry changed");

// The button sits well inside the maskable safe zone (radius 141 of 256 < 204), so one drawing serves both purposes.
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(new URL(`../app/icons/${name}`, import.meta.url), png(size, render(size)));
  console.log("wrote app/icons/" + name);
}
