// Crop image for print: pure crop-rectangle maths shared by the browser widget, the page and tests/crop-print.test.mjs.
// Every rectangle is in the original image's pixels, integers, and always inside the image. The widget only draws and
// exports what these functions return, so the download is exactly the box the seller sees.
import { maxPrint } from "./print-resolution.js?v=1";

// Print shapes, short side first. sizes: common print sizes of exactly that shape (inches unless cm is given).
export const SHAPES = [
  { id: "2:3", label: "2:3 (4 × 6, 8 × 12, 12 × 18, 24 × 36)", short: 2, long: 3, sizes: [[4, 6], [8, 12], [12, 18], [16, 24], [20, 30], [24, 36]] },
  { id: "3:4", label: "3:4 (6 × 8, 12 × 16, 18 × 24)", short: 3, long: 4, sizes: [[6, 8], [9, 12], [12, 16], [18, 24], [24, 32], [30, 40]] },
  { id: "4:5", label: "4:5 (8 × 10, 16 × 20)", short: 4, long: 5, sizes: [[4, 5], [8, 10], [16, 20], [24, 30], [32, 40]] },
  { id: "5:7", label: "5:7 (5 × 7, 10 × 14)", short: 5, long: 7, sizes: [[5, 7], [10, 14], [20, 28]] },
  { id: "11:14", label: "11:14 (11 × 14, 22 × 28)", short: 11, long: 14, sizes: [[11, 14], [22, 28]] },
  { id: "1:1", label: "1:1 square (8 × 8, 12 × 12, 20 × 20)", short: 1, long: 1, sizes: [[8, 8], [10, 10], [12, 12], [16, 16], [20, 20], [24, 24], [30, 30]] },
  { id: "iso", label: "ISO A sizes, 1:√2 (A4, A3, A2)", short: 1, long: Math.SQRT2, cm: true, sizes: [[14.8, 21, "A5"], [21, 29.7, "A4"], [29.7, 42, "A3"], [42, 59.4, "A2"], [59.4, 84.1, "A1"], [84.1, 118.9, "A0"]] },
  { id: "1:3", label: "1:3 panorama (12 × 36, 20 × 60)", short: 1, long: 3, sizes: [[8, 24], [10, 30], [12, 36], [16, 48], [20, 60]] },
];
export const shape = (id) => SHAPES.find((s) => s.id === id);

/** Width ÷ height of a shape in an orientation ("portrait" or "landscape"; a square ignores it). */
export function ratioOf(id, orientation = "portrait") {
  const s = shape(id);
  if (!s) throw new RangeError(`unknown shape ${id}`);
  return orientation === "landscape" ? s.long / s.short : s.short / s.long;
}

const okSize = (w, h) => Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 100000 && h <= 100000;

/** The largest crop of a ratio (width ÷ height) that fits the image, centred. Integer pixels, never outside the image. */
export function maxCrop(imgW, imgH, ratio) {
  if (!okSize(imgW, imgH)) throw new RangeError("image size must be whole pixels from 1 to 100,000");
  if (!(ratio > 0 && Number.isFinite(ratio))) throw new RangeError("ratio must be positive");
  let w, h;
  if (imgW / imgH > ratio) { h = imgH; w = Math.min(imgW, Math.max(1, Math.round(h * ratio))); }
  else { w = imgW; h = Math.min(imgH, Math.max(1, Math.round(w / ratio))); }
  return { x: Math.floor((imgW - w) / 2), y: Math.floor((imgH - h) / 2), w, h };
}

/** Keep a crop inside the image: shrink it if it is too big (keeping its shape), then move it back in. */
export function clampCrop(c, imgW, imgH) {
  let { x, y, w, h } = c;
  if (w > imgW || h > imgH) { const k = Math.min(imgW / w, imgH / h); w = Math.max(1, Math.floor(w * k)); h = Math.max(1, Math.floor(h * k)); }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  x = Math.min(Math.max(0, Math.round(x)), imgW - w);
  y = Math.min(Math.max(0, Math.round(y)), imgH - h);
  return { x, y, w, h };
}

/** Move a crop by (dx, dy) image pixels, stopping at the image edges. */
export const moveCrop = (c, dx, dy, imgW, imgH) => clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, imgW, imgH);

/**
 * Resize a crop to `scale` (0–1] of the largest crop of its ratio, keeping its centre where possible.
 * The ratio is held exactly as integer pixels allow; the result is clamped inside the image.
 */
export function scaleCrop(c, scale, ratio, imgW, imgH) {
  const max = maxCrop(imgW, imgH, ratio);
  const s = Math.min(1, Math.max(0.05, scale));
  // Scale both sides of the largest crop: at 100% this is exactly the largest crop (deriving one side from the other
  // lost a pixel, e.g. 3999 × 1333 instead of 4000 × 1333 for 3:1 on a 4000 px wide image).
  const w = Math.max(1, Math.round(max.w * s)), h = Math.max(1, Math.round(max.h * s));
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, imgW, imgH);
}

/**
 * Resize from the bottom-right corner to a new width, keeping the top-left corner fixed and the ratio exact.
 * Stops at the image edges and at a minimum of `minW` pixels wide (or the largest crop, if that is smaller).
 */
export function resizeFromCorner(c, newW, ratio, imgW, imgH, minW = 16) {
  const room = Math.min(imgW - c.x, (imgH - c.y) * ratio);
  let w = Math.min(room, Math.max(Math.min(minW, room), newW));
  w = Math.max(1, Math.floor(w));
  let h = Math.max(1, Math.round(w / ratio));
  if (c.y + h > imgH) { h = imgH - c.y; w = Math.max(1, Math.min(w, Math.round(h * ratio))); }
  return { x: c.x, y: c.y, w, h };
}

/** The crop's size as a share (0–1) of the largest crop of the same ratio. */
export const cropScale = (c, ratio, imgW, imgH) => { const m = maxCrop(imgW, imgH, ratio); return Math.min(1, c.w / m.w); };

/** Change the ratio, keeping the crop's centre and its scale relative to the largest crop. */
export function reshapeCrop(c, oldRatio, newRatio, imgW, imgH) {
  return scaleCrop(c, cropScale(c, oldRatio, imgW, imgH), newRatio, imgW, imgH);
}

/** How the crop prints: largest size at 300 and 150 DPI, and the shape's standard sizes it prints at 300 and 150 DPI. */
export function printInfo(c, shapeId, orientation = "portrait") {
  const s = shape(shapeId);
  const at300 = maxPrint(c.w, c.h, 300), at150 = maxPrint(c.w, c.h, 150);
  const longPx = Math.max(c.w, c.h), shortPx = Math.min(c.w, c.h);
  const toIn = (v) => (s.cm ? v / 2.54 : v);
  const fits = (dpi) => s.sizes.filter(([a, b]) => shortPx / toIn(a) >= dpi - 0.5 && longPx / toIn(b) >= dpi - 0.5);
  const name = ([a, b, n]) => {
    const [w, h] = orientation === "landscape" && a !== b ? [b, a] : [a, b];
    return n ? `${n} (${w} × ${h} cm)` : `${w} × ${h} in`;
  };
  const largest = (dpi) => { const f = fits(dpi); return f.length ? name(f[f.length - 1]) : null; };
  return { px: { w: c.w, h: c.h }, megapixels: Math.round((c.w * c.h) / 1e5) / 10, at300, at150, largest300: largest(300), largest150: largest(150), sizes300: fits(300).map(name), sizes150: fits(150).map(name) };
}

/** A download name: "artwork-8x10-crop.png" style, safe for every file system. */
export function cropFileName(original, shapeId, orientation, type = "png") {
  const base = String(original || "artwork").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artwork";
  const s = shape(shapeId);
  const tag = s.id === "iso" ? "iso-a" : s.short === s.long ? "square" : orientation === "landscape" ? `${String(s.long).replace(".", "-")}x${s.short}` : `${s.short}x${String(s.long).replace(".", "-")}`;
  return `${base}-${tag}-crop.${type === "jpeg" ? "jpg" : "png"}`;
}

/** "4:5 portrait", "5:4 landscape", "square", "ISO A landscape", "3:1 landscape". */
export function shapeName(shapeId, orientation = "portrait") {
  const s = shape(shapeId);
  if (s.short === s.long) return "square";
  if (s.id === "iso") return `ISO A ${orientation}`;
  return orientation === "landscape" ? `${s.long}:${s.short} landscape` : `${s.short}:${s.long} portrait`;
}

const n = (v) => v.toLocaleString("en-US");

/** Result rows for a crop, shared by the page's first state and the widget: [label, value]. */
export function infoRows(c, shapeId, orientation = "portrait") {
  const i = printInfo(c, shapeId, orientation);
  const s = shape(shapeId), tag = s.id === "iso" ? "A" : s.short === s.long ? "square" : orientation === "landscape" ? `${s.long}:${s.short}` : `${s.short}:${s.long}`;
  const size = (m) => `${m.in.w} × ${m.in.h} in (${m.cm.w} × ${m.cm.h} cm)`;
  const list = (l) => (l.length ? l.join(", ") : `none: smaller than the smallest ${tag} size`);
  return [
    ["Crop", `${n(c.w)} × ${n(c.h)} px (${i.megapixels} MP), ${shapeName(shapeId, orientation)}`],
    ["Largest print at 300 DPI", size(i.at300)],
    ["Largest print at 150 DPI", size(i.at150)],
    [`Common ${tag} sizes at 300 DPI`, list(i.sizes300)],
    [`Common ${tag} sizes at 150 DPI`, list(i.sizes150)],
  ];
}

/** Share of a file (width × height) that a crop to a ratio removes, in % to one decimal. */
export function cropLoss(imgW, imgH, ratio) {
  const c = maxCrop(imgW, imgH, ratio);
  return Math.round((1 - (c.w * c.h) / (imgW * imgH)) * 1000) / 10;
}

/** The first-state line before an image is chosen: a 4000 × 6000 px example cropped to the chosen shape. */
export function exampleText(shapeId, orientation = "portrait") {
  const c = maxCrop(4000, 6000, ratioOf(shapeId, orientation));
  return `Example: a 4,000 × 6,000 px image cropped to ${shapeName(shapeId, orientation)} keeps ${n(c.w)} × ${n(c.h)} px. Choose your image to crop it.`;
}
