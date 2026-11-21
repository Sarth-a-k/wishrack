// Builds the Android app icon and the splash animation frames from the Lost in Play girl sprites.
// Usage: node tools/girl-assets.mjs "<path to GirlCharacter/Sprites>"
// The sprites are the game's artwork: fine on your own phone, but don't publish them (keep the repo and APK private).
import { inflateSync, deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] || "C:/Users/xitsp/Downloads/assests/loastinplay/LostInPlay_Unity/Assets/GirlCharacter/Sprites";
const RES = new URL("../android/app/src/main/res/", import.meta.url);
const NAVY = [0x12, 0x49, 0x3b]; // forest #12493b

// ---------------------------------------------------------------- PNG in and out (8-bit RGBA, non-interlaced)
function decode(file) {
  const b = readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error(file + ": expected 8-bit RGBA, non-interlaced");
  const idat = [];
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p), type = b.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0, up = y ? px[(y - 1) * stride + x] : 0, ul = y && x >= 4 ? px[(y - 1) * stride + x - 4] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pa = Math.abs(up - ul), pb = Math.abs(a - ul), pc = Math.abs(a + up - 2 * ul); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode({ w, h, px }) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- image operations
function crop(img, x0, y0, w, h) {
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x + x0, sy = y + y0;
    if (sx >= 0 && sy >= 0 && sx < img.w && sy < img.h) img.px.copy(px, (y * w + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
  }
  return { w, h, px };
}
// Area-average downscale with premultiplied alpha (no dark fringes around the outline).
function scale(img, w, h) {
  const px = Buffer.alloc(w * h * 4), kx = img.w / w, ky = img.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(y * ky); sy < Math.min(img.h, Math.ceil((y + 1) * ky)); sy++)
      for (let sx = Math.floor(x * kx); sx < Math.min(img.w, Math.ceil((x + 1) * kx)); sx++) {
        const i = (sy * img.w + sx) * 4, al = img.px[i + 3];
        r += img.px[i] * al; g += img.px[i + 1] * al; b += img.px[i + 2] * al; a += al; n++;
      }
    const o = (y * w + x) * 4;
    if (a) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(b / a); }
    px[o + 3] = Math.round(a / n);
  }
  return { w, h, px };
}
// Place img inside a size×size canvas at (x, y), over a solid colour or transparent.
function canvas(size, img, x, y, bg) {
  const px = Buffer.alloc(size * size * 4);
  if (bg) for (let i = 0; i < size * size; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
  for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
    const tx = x + i, ty = y + j;
    if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
    const s = (j * img.w + i) * 4, d = (ty * size + tx) * 4, a = img.px[s + 3] / 255;
    for (let c = 0; c < 3; c++) px[d + c] = Math.round(img.px[s + c] * a + px[d + c] * (1 - a));
    px[d + 3] = Math.round(255 * (a + (px[d + 3] / 255) * (1 - a)));
  }
  return { w: size, h: size, px };
}
function bbox(imgs) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const img of imgs) for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++)
    if (img.px[(y * img.w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const out = (dir, name, img) => { const d = new URL(dir + "/", RES); mkdirSync(d, { recursive: true }); writeFileSync(new URL(name, d), encode(img)); };

// ---------------------------------------------------------------- icon: head and shoulders from the standing frame
const stand = decode(join(SRC, "girl_0001.png"));
const head = crop(stand, 25, 100, 380, 380); // whole head with a little air, square
out("mipmap-xxxhdpi", "ic_launcher.png", canvas(192, scale(head, 180, 180), 6, 10, NAVY));
// Adaptive icon foreground: 432px canvas, head inside the central 66% safe zone so any launcher mask keeps it.
out("drawable-nodpi", "ic_launcher_fg.png", canvas(432, scale(head, 290, 290), 71, 78, null));

// ---------------------------------------------------------------- splash: "Skip Right", 30 frames, trimmed and halved
const frames = Array.from({ length: 30 }, (_, i) => decode(join(SRC, `girl_${2124 + i}.png`)));
const box = bbox(frames);
const W = Math.round(box.w / 2), H = Math.round(box.h / 2);
frames.forEach((f, i) => out("drawable-nodpi", `girl_skip_${String(i).padStart(2, "0")}.png`, scale(crop(f, box.x0, box.y0, box.w, box.h), W, H)));

console.assert(head.w === 380 && frames.length === 30, "unexpected sizes");
console.log(`icon done; 30 splash frames at ${W}x${H}`);

// ---------------------------------------------------------------- web app: one picture sheet for app/girl.js
// Every frame of every move sits on one sheet, so switching moves never loads a new picture (no blink).
// All frames share one crop box, so her feet stay at the same spot in every frame.
// The game draws a soft shadow under her feet (black at about 30% opacity); the app draws its own on whatever
// surface is below her, so remove it here, or it would fly through the air with her when she jumps.
function noShadow(img) {
  for (let y = 540; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (img.px[i + 3] <= 100 && img.px[i] < 24 && img.px[i + 1] < 24 && img.px[i + 2] < 24) img.px[i + 3] = 0;
  }
  return img;
}
const lowest = (img) => { for (let y = img.h - 1; y >= 0; y--) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 200) return y; return img.h; };
const ANIMS = {
  walkR: [914, 929], walkL: [1899, 1914], skipR: [2124, 2153], skipL: [2095, 2123],
  turnL: [1895, 1898], stopL: [930, 940], stopR: [974, 984], byeL: [2021, 2057],
  frontL: [1915, 1930], idleR: [985, 1044, 2],
};
const SHOWN = 2.5, K = 0.27 * SHOWN / 2, FEET_Y = 626; // drawn at 2.5x the 51 px she is shown at, sharp on 3x phone screens
const all = Object.fromEntries(Object.entries(ANIMS).map(([k, [a, b, step = 1]]) => {
  const list = [];
  for (let i = a; i <= b; i += step) list.push(noShadow(decode(join(SRC, `girl_${String(i).padStart(4, "0")}.png`))));
  return [k, list];
}));
const wb = bbox(Object.values(all).flat());
const FW = Math.round(wb.w * K), FH = Math.round(wb.h * K), COLS = 16, PAD = 3; // a clear gap round each frame stops neighbours bleeding in
const CW = FW + 2 * PAD, CH = FH + 2 * PAD;
const small = Object.fromEntries(Object.entries(all).map(([k, list]) => [k, list.map((f) => scale(crop(f, wb.x0, wb.y0, wb.w, wb.h), FW, FH))]));
const total = Object.values(small).reduce((n, l) => n + l.length, 0), ROWS = Math.ceil(total / COLS);
const sheet = { w: CW * COLS, h: CH * ROWS, px: Buffer.alloc(CW * COLS * CH * ROWS * 4) };
const meta = { w: CW, h: CH, cols: COLS, rows: ROWS, scale: 1 / SHOWN, feetX: PAD + Math.round((215 - wb.x0) * K), feetY: PAD + Math.round((FEET_Y - wb.y0) * K), anims: {}, air: {}, endOn: {}, startAt: {} };
let n = 0;
for (const [k, list] of Object.entries(small)) {
  meta.anims[k] = { start: n, n: list.length };
  for (const f of list) {
    const cx = (n % COLS) * CW + PAD, cy = Math.floor(n / COLS) * CH + PAD;
    for (let y = 0; y < FH; y++) f.px.copy(sheet.px, ((cy + y) * sheet.w + cx) * 4, y * FW * 4, (y + 1) * FW * 4);
    n++;
  }
}
// Skips: how far off the ground her feet are in each frame (1 = in the air), so she only moves forward while airborne.
for (const k of ["skipR", "skipL"]) {
  const lows = all[k].map(lowest), max = Math.max(...lows);
  meta.air[k] = lows.map((l) => +Math.max(0.06, Math.min(1, (max - l) / 22)).toFixed(2));
}
// Which frame of one move looks most like a frame of another, so moves join without a visible jump.
const diff = (a, b) => { let d = 0; for (let i = 0; i < a.px.length; i += 16) d += Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 3] - b.px[i + 3]); return d; };
const best = (set, target) => small[set].reduce((bi, f, i) => (diff(f, target) < diff(small[set][bi], target) ? i : bi), 0);
for (const [mv, stop] of [["walkR", "stopR"], ["walkL", "stopL"], ["skipR", "stopR"], ["skipL", "stopL"]]) meta.endOn[mv] = best(mv, small[stop][0]);
meta.startAt.walkLAfterTurn = best("walkL", small.turnL[3]);
meta.startAt.walkRAfterLand = best("walkR", small.skipR[24]);
meta.startAt.walkLAfterLand = best("walkL", small.skipL[24]);
meta.startAt.skipLAfterTurn = best("skipL", small.turnL[3]);
const WEB = new URL("../app/girl/", import.meta.url);
mkdirSync(WEB, { recursive: true });
writeFileSync(new URL("girl.png", WEB), encode(sheet));
writeFileSync(new URL("girl.json", WEB), JSON.stringify(meta));
console.log(`web sheet: ${sheet.w}x${sheet.h}, ${total} frames of ${FW}x${FH}`, JSON.stringify({ air: meta.air, endOn: meta.endOn, startAt: meta.startAt }));
