// Standard frame and poster sizes: data and pure helpers shared by /tools/frame-size-chart/, the frame and mat
// calculator (tools/lib/frame-mat.mjs) and tests/frame-sizes.test.mjs.
//
// SEO-2 bugs fixed here (SEO2-CONTENT-REVIEW-1 nit): the old chart called 11 × 17 "about 2:3" (it is 1:1.55, a 2:3 file
// loses about 3% to cropping) and claimed buyers "are far more likely" to order frame-ready sizes, which nothing backs.
// Ratios are now computed from the sizes, never typed by hand, and the pairings are checked to leave a real mat border.

export const CM_PER_IN = 2.54;
export const MAT_OVERLAP = { in: 0.125, cm: 0.3 }; // the mat opening overlaps each edge of the print by about 1/8 in (3 mm)

// Ready-made frame sizes, short side first. mat: the print a matted frame of this size usually holds (null: rarely matted).
export const FRAMES = {
  in: [
    { w: 4, h: 6, use: "Photos, small prints", mat: null },
    { w: 5, h: 7, use: "Photos, cards, small prints", mat: [[4, 6]] },
    { w: 8, h: 10, use: "Prints and photos", mat: [[5, 7]] },
    { w: 8.5, h: 11, use: "Letter-size prints and certificates", mat: null },
    { w: 11, h: 14, use: "Prints and photography", mat: [[8, 10]] },
    { w: 12, h: 12, use: "Square prints", mat: [[8, 8]] },
    { w: 12, h: 16, use: "3:4 prints", mat: [[9, 12], [8, 10]] },
    { w: 16, h: 20, use: "Medium wall art", mat: [[11, 14]] },
    { w: 18, h: 24, use: "Posters and medium wall art", mat: [[12, 18]] },
    { w: 20, h: 24, use: "Medium wall art", mat: [[16, 20]] },
    { w: 24, h: 36, use: "Large posters and wall art", mat: null },
    { w: 27, h: 40, use: "Film posters", mat: null },
    { w: 30, h: 40, use: "Large wall art", mat: [[24, 36]] },
  ],
  cm: [
    { w: 13, h: 18, use: "Photos, small prints", mat: [[9, 13]] },
    { w: 18, h: 24, use: "Prints and photos", mat: [[13, 18]] },
    { w: 21, h: 29.7, name: "A4", use: "A4 prints", mat: [[14.8, 21]] },
    { w: 24, h: 30, use: "Prints and photos", mat: [[18, 24]] },
    { w: 30, h: 40, use: "Prints and posters", mat: [[21, 29.7], [20, 30]] },
    { w: 29.7, h: 42, name: "A3", use: "A3 prints", mat: [[21, 29.7]] },
    { w: 40, h: 50, use: "Wall art", mat: [[30, 40]] },
    { w: 42, h: 59.4, name: "A2", use: "A2 posters", mat: [[29.7, 42]] },
    { w: 50, h: 70, use: "Posters and wall art", mat: [[40, 50]] },
    { w: 61, h: 91.5, use: "Large posters", mat: null },
    { w: 70, h: 100, use: "Large posters and wall art", mat: [[50, 70]] },
  ],
};

// Poster sizes in both units. `base` is the unit the size is defined in (A sizes and European posters in cm, US posters
// in inches); the other unit is rounded, so ratios are computed from the base unit.
export const POSTERS = [
  { name: "A4", base: "cm", in: [8.3, 11.7], cm: [21, 29.7] },
  { name: "A3", base: "cm", in: [11.7, 16.5], cm: [29.7, 42] },
  { name: "A2", base: "cm", in: [16.5, 23.4], cm: [42, 59.4] },
  { name: "A1", base: "cm", in: [23.4, 33.1], cm: [59.4, 84.1] },
  { name: "A0", base: "cm", in: [33.1, 46.8], cm: [84.1, 118.9] },
  { name: "Small (US)", base: "in", in: [11, 17], cm: [27.9, 43.2] },
  { name: "Medium (US)", base: "in", in: [18, 24], cm: [45.7, 61] },
  { name: "Large (US)", base: "in", in: [24, 36], cm: [61, 91.4] },
  { name: "Film poster", base: "in", in: [27, 40], cm: [68.6, 101.6] },
  { name: "European poster", base: "cm", in: [19.7, 27.6], cm: [50, 70] },
  { name: "Large European poster", base: "cm", in: [27.6, 39.4], cm: [70, 100] },
];

const NAMED = [[1, "1:1"], [5 / 4, "4:5"], [4 / 3, "3:4"], [7 / 5, "5:7"], [Math.SQRT2, "ISO A"], [10 / 7, "7:10"], [3 / 2, "2:3"], [2, "1:2"], [3, "1:3"]];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * Ratio of a size (either orientation), short side first: the exact whole-number ratio when it is simple ("3:4",
 * "11:17"), the decimal ("1:1.41"), the nearest common print ratio and how much of a file in that ratio is cropped.
 */
export function ratioInfo(w, h) {
  const s = Math.min(w, h), l = Math.max(w, h), r = l / s;
  const a = Math.round(s * 10), b = Math.round(l * 10), g = gcd(a, b);
  const exact = a / g <= 24 && b / g <= 24 && Math.abs(a / 10 - s) < 1e-9 && Math.abs(b / 10 - l) < 1e-9 ? `${a / g}:${b / g}` : null;
  const [nr, name] = NAMED.reduce((best, n) => (Math.abs(n[0] - r) < Math.abs(best[0] - r) ? n : best));
  const crop = Math.round((1 - Math.min(r, nr) / Math.max(r, nr)) * 1000) / 10;
  return { decimal: Math.round(r * 1000) / 1000, two: (Math.round(r * 100) / 100).toFixed(2), exact, nearest: name, crop };
}

/** Table text for a ratio: "3:4", "11:17 (1:1.55); a 2:3 file loses 2.9%" or "1:1.41 (ISO A)". */
export function ratioText(w, h) {
  const i = ratioInfo(w, h);
  if (i.crop < 0.25) return i.nearest === "ISO A" ? "1:1.414 (ISO A)" : i.nearest;
  const dec = `1:${i.two}`;
  return `${i.exact ? `${i.exact} (${dec})` : dec}; ${i.nearest === "ISO A" ? "an ISO A" : `a ${i.nearest}`} file loses ${i.crop}% to cropping`;
}

const fmt = (v) => String(Math.round(v * 100) / 100);
export const sizeText = (w, h, unit) => `${fmt(w)} × ${fmt(h)}${unit ? ` ${unit}` : ""}`;

/**
 * Borders a mat leaves when a print is centred in a frame: sides and top/bottom, after the opening overlaps the print
 * by MAT_OVERLAP on each edge. Orientation follows the print. Returns null when the frame is too small for the opening.
 */
export function matBorders(print, frame, unit) {
  const ov = MAT_OVERLAP[unit];
  const land = print[0] > print[1];
  let [fw, fh] = frame;
  if (land !== fw > fh && fw !== fh) [fw, fh] = [fh, fw];
  const ow = print[0] - 2 * ov, oh = print[1] - 2 * ov;
  const sides = (fw - ow) / 2, ends = (fh - oh) / 2;
  if (!(sides > 0 && ends > 0)) return null;
  return { frame: [fw, fh], opening: [ow, oh], sides, ends };
}

/**
 * Ready-made frames for a print: { exact } the frame that equals the print (no mat), and { matted } frames whose mat
 * border is between minBorder and maxBorder on every side, smallest first.
 */
export function framesFor(printW, printH, unit, { minBorder, maxBorder, limit = 3 } = {}) {
  if (!(unit in FRAMES)) throw new RangeError("unit must be in or cm");
  if (!(printW > 0 && printH > 0)) throw new RangeError("print width and height must be positive");
  const lo = minBorder ?? (unit === "in" ? 1 : 2.5), hi = maxBorder ?? (unit === "in" ? 5 : 12.5);
  const same = (a, b) => Math.abs(a - b) < 0.051;
  const exact = FRAMES[unit].find((f) => (same(f.w, printW) && same(f.h, printH)) || (same(f.w, printH) && same(f.h, printW))) ?? null;
  const square = Math.abs(printW - printH) < 1e-9;
  const matted = FRAMES[unit]
    .filter((f) => (f.w === f.h) === square) // square prints in square frames, others in rectangular ones
    .map((f) => ({ f, b: matBorders([printW, printH], [f.w, f.h], unit) }))
    .filter(({ b }) => b && Math.min(b.sides, b.ends) >= lo - 1e-9 && Math.max(b.sides, b.ends) <= hi + 1e-9)
    .sort((x, y) => x.f.w * x.f.h - y.f.w * y.f.h)
    .slice(0, limit)
    .map(({ f, b }) => ({ ...f, ...b }));
  return { exact, matted };
}

/** "a" or "an" before a size read aloud: an 8 × 10, an 11 × 14, an 18 × 24, a 12 × 16. */
export const article = (size) => (/^(8|11(?![\d.])|18(?![\d.]))/.test(String(size)) ? "an" : "a");

/** "Which frame fits my print?" as plain-text lines, for the chart page's finder (static first state and widget). */
export function finderLines(w, h, unit) {
  const r = framesFor(w, h, unit);
  const one = (v) => Math.round(v * 10) / 10;
  const lines = [r.exact
    ? `Without a mat: ${article(r.exact.w)} ${sizeText(r.exact.w, r.exact.h, unit)} frame holds the print edge to edge.`
    : `Without a mat: ${sizeText(w, h, unit)} is not a common ready-made frame size, so the print needs a custom frame or a mat.`];
  if (r.matted.length) for (const m of r.matted) lines.push(`With a mat: ${article(m.frame[0])} ${sizeText(...m.frame, unit)} frame, borders about ${one(m.sides)} ${unit} at the sides and ${one(m.ends)} ${unit} top and bottom.`);
  else lines.push(`With a mat: no common ready-made frame leaves a border of ${unit === "in" ? "1 to 5 in" : "2.5 to 12.5 cm"}; the frame and mat calculator works out a custom size.`);
  return lines;
}
