// Print size calculator: pure logic shared by the browser widget, the page's static first state and
// tests/print-size.test.mjs. Answers "which print sizes fit my art?": the file's ratio family, every standard size in
// that family (inches and cm) with the DPI the file gives, and the largest print at 300, 200 and 150 DPI.
//
// SEO-2 bugs fixed here (SEO2-CONTENT-REVIEW-1 B2):
//   - 7:10 files (2100 × 3000) were labelled ISO A: there is a 7:10 family and the match tolerance is 0.4% (7:10 and
//     ISO A are 1% apart);
//   - 3:1, 2:1, 1:2 and 1:3 files were "not a standard print ratio": the panorama families are listed, in the file's
//     own orientation (a 9000 × 3000 file gets 36 × 12, not 12 × 36);
//   - exact A3 (3508 × 4961) and A2 (4961 × 7016) files were graded below 300 DPI because ISO inches were rounded:
//     sizes are kept in their own unit and graded with print-resolution's half-pixel tolerance;
//   - a file that matches no family now gets its closest family and how much printing at it crops, not a dead end.
import { band, maxPrint, CM_PER_IN } from "./print-resolution.js?v=1";

export const TOLERANCE = 0.004; // relative; 5:7 (1.4), ISO A (1.4142) and 7:10 (1.4286) are each about 1% apart

const A = [["A5", 14.8, 21], ["A4", 21, 29.7], ["A3", 29.7, 42], ["A2", 42, 59.4], ["A1", 59.4, 84.1], ["A0", 84.1, 118.9]];

// Families by long side ÷ short side. Sizes are short × long, in the unit they are sold in.
export const FAMILIES = [
  { id: "1:1", r: 1, in: [[8, 8], [10, 10], [12, 12], [16, 16], [20, 20], [24, 24], [30, 30], [36, 36]], cm: [[20, 20], [30, 30], [40, 40], [50, 50], [60, 60], [70, 70]] },
  { id: "4:5", r: 5 / 4, in: [[4, 5], [8, 10], [16, 20], [24, 30], [32, 40]], cm: [[24, 30], [40, 50], [80, 100]] },
  { id: "11:14", r: 14 / 11, in: [[11, 14], [22, 28]], cm: [] },
  { id: "letter (8.5:11)", r: 11 / 8.5, in: [[8.5, 11], [17, 22]], cm: [] },
  { id: "3:4", r: 4 / 3, in: [[6, 8], [9, 12], [12, 16], [18, 24], [24, 32], [30, 40], [36, 48]], cm: [[30, 40], [45, 60], [60, 80], [75, 100], [90, 120]] },
  { id: "5:7", r: 7 / 5, in: [[5, 7], [10, 14], [20, 28]], cm: [[25, 35], [50, 70]] },
  { id: "ISO A", r: Math.SQRT2, in: [], cm: A.map(([, s, l]) => [s, l]), names: Object.fromEntries(A.map(([n, s, l]) => [`${s}x${l}`, n])) },
  { id: "7:10", r: 10 / 7, in: [[7, 10], [14, 20], [21, 30], [28, 40]], cm: [[35, 50], [70, 100]] },
  { id: "2:3", r: 3 / 2, in: [[4, 6], [8, 12], [12, 18], [16, 24], [20, 30], [24, 36], [32, 48], [40, 60]], cm: [[20, 30], [40, 60], [60, 90], [80, 120], [100, 150]] },
  { id: "1:2", r: 2, in: [[10, 20], [12, 24], [18, 36], [20, 40], [24, 48], [30, 60]], cm: [[30, 60], [40, 80], [50, 100], [60, 120]] },
  { id: "1:3", r: 3, in: [[8, 24], [10, 30], [12, 36], [14, 42], [16, 48], [20, 60], [24, 72]], cm: [[20, 60], [30, 90], [40, 120], [50, 150]] },
];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** The file's own ratio in its orientation: "2:3" for 4800 × 7200, "3:1" for 9000 × 3000, else "1:1.618". */
export function pixelRatio(w, h) {
  const g = gcd(w, h);
  if (w / g <= 40 && h / g <= 40) return `${w / g}:${h / g}`;
  const r = Math.max(w, h) / Math.min(w, h);
  return w < h ? `1:${r.toFixed(3)}` : `${r.toFixed(3)}:1`;
}

/** The family within TOLERANCE, else null; and the closest family with the share of the file printing at it crops. */
export function family(w, h) {
  const r = Math.max(w, h) / Math.min(w, h);
  const diff = (f) => Math.abs(f.r - r) / f.r;
  const closest = FAMILIES.reduce((a, b) => (diff(b) < diff(a) ? b : a));
  const crop = Math.round((1 - Math.min(r, closest.r) / Math.max(r, closest.r)) * 1000) / 10;
  return { exact: diff(closest) < TOLERANCE ? closest : null, closest, crop };
}

const label = (fam, s, l, unit, land) => {
  const [a, b] = land ? [l, s] : [s, l];
  const name = fam.names?.[`${s}x${l}`];
  return name ? `${name} (${a} × ${b} cm)` : `${a} × ${b} ${unit}`;
};

/**
 * printSizes(width, height) -> { ratio, orientation, exact, family, crop, sizes: [{ label, unit, dpi, band }], max }
 * Sizes follow the file's orientation. DPI is the lower of the two axes after the print is filled (cover fit).
 */
export function printSizes(pxW, pxH) {
  if (!(Number.isInteger(pxW) && Number.isInteger(pxH) && pxW > 0 && pxH > 0 && pxW <= 100000 && pxH <= 100000)) throw new RangeError("width and height must be whole pixels from 1 to 100,000");
  const f = family(pxW, pxH);
  const fam = f.exact ?? f.closest;
  const land = pxW > pxH, longPx = Math.max(pxW, pxH), shortPx = Math.min(pxW, pxH);
  const sizes = [];
  for (const unit of ["in", "cm"]) for (const [s, l] of fam[unit]) {
    const k = unit === "cm" ? CM_PER_IN : 1;
    const dpi = Math.min(longPx / (l / k), shortPx / (s / k));
    sizes.push({ label: label(fam, s, l, unit, land), unit, dpi: Math.round(dpi), band: band(dpi).id });
  }
  return {
    width: pxW, height: pxH, ratio: pixelRatio(pxW, pxH), orientation: pxW === pxH ? "square" : land ? "landscape" : "portrait",
    exact: Boolean(f.exact), family: fam.id, crop: f.exact ? 0 : f.crop, sizes,
    max: { 300: maxPrint(pxW, pxH, 300), 200: maxPrint(pxW, pxH, 200), 150: maxPrint(pxW, pxH, 150) },
  };
}

const n = (v) => v.toLocaleString("en-US");

/** A family named in the file's orientation: "2:3" for portrait, "3:2" for landscape; ISO A as its ratio. */
export function familyName(id, orientation) {
  if (id === "ISO A") return "ISO A-series (1:1.414)";
  if (orientation !== "landscape") return id;
  return id.replace(/(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)/, "$2:$1");
}

/** Summary lines for the live region and the static first state. Plain text. */
export function summary(r) {
  const fam = familyName(r.family, r.orientation);
  const lines = [`${n(r.width)} × ${n(r.height)} px is ${r.ratio}, ${r.orientation}.`];
  lines.push(r.exact
    ? `It matches the ${fam} family: every size below prints without cropping.`
    : `It is not an exact print ratio. The closest family is ${fam}; printing at those sizes crops about ${r.crop}% of the file, or add a border instead.`);
  const m = (k) => `${r.max[k].in.w} × ${r.max[k].in.h} in (${r.max[k].cm.w} × ${r.max[k].cm.h} cm)`;
  lines.push(`Largest print: ${m(300)} at 300 DPI, ${m(200)} at 200 DPI, ${m(150)} at 150 DPI.`);
  return lines;
}
