// Print resolution checker: pure logic shared by the browser widget and tests/print-resolution.test.mjs.
// Answers "how big can I print this file?" and "how many pixels do I need for a 24x36 print?".

export const CM_PER_IN = 2.54;

// Common print sizes sellers list. width x height in the unit given, portrait orientation (short side first).
export const SIZES = [
  { id: "5x7", label: "5 × 7 in", w: 5, h: 7, unit: "in" },
  { id: "8x10", label: "8 × 10 in", w: 8, h: 10, unit: "in" },
  { id: "8x12", label: "8 × 12 in", w: 8, h: 12, unit: "in" },
  { id: "11x14", label: "11 × 14 in", w: 11, h: 14, unit: "in" },
  { id: "12x16", label: "12 × 16 in", w: 12, h: 16, unit: "in" },
  { id: "12x18", label: "12 × 18 in", w: 12, h: 18, unit: "in" },
  { id: "16x20", label: "16 × 20 in", w: 16, h: 20, unit: "in" },
  { id: "18x24", label: "18 × 24 in", w: 18, h: 24, unit: "in" },
  { id: "20x30", label: "20 × 30 in", w: 20, h: 30, unit: "in" },
  { id: "24x36", label: "24 × 36 in", w: 24, h: 36, unit: "in" },
  { id: "A5", label: "A5 (14.8 × 21 cm)", w: 14.8, h: 21, unit: "cm" },
  { id: "A4", label: "A4 (21 × 29.7 cm)", w: 21, h: 29.7, unit: "cm" },
  { id: "A3", label: "A3 (29.7 × 42 cm)", w: 29.7, h: 42, unit: "cm" },
  { id: "A2", label: "A2 (42 × 59.4 cm)", w: 42, h: 59.4, unit: "cm" },
  { id: "A1", label: "A1 (59.4 × 84.1 cm)", w: 59.4, h: 84.1, unit: "cm" },
  { id: "30x40", label: "30 × 40 cm", w: 30, h: 40, unit: "cm" },
  { id: "50x70", label: "50 × 70 cm", w: 50, h: 70, unit: "cm" },
  { id: "60x90", label: "60 × 90 cm", w: 60, h: 90, unit: "cm" },
];

// Quality bands by the lower of the two axis DPIs. 300 is the usual fine-art print target; large prints viewed from
// further away are often printed at 150–200.
export const BANDS = [
  { min: 300, id: "excellent", label: "Excellent (300 DPI or more)" },
  { min: 200, id: "good", label: "Good (200–299 DPI)" },
  { min: 150, id: "fair", label: "Fair (150–199 DPI): fine for large prints seen from a distance" },
  { min: 0, id: "low", label: "Low (under 150 DPI): may look soft" },
];

const toIn = (v, unit) => (unit === "cm" ? v / CM_PER_IN : v);

export function band(dpi) {
  return BANDS.find((b) => dpi >= b.min - 0.5); // half-pixel tolerance: A3 at 3508 × 4961 px counts as 300 DPI
}

/** Fit the file to a print size, matching orientation. Returns DPI per axis, effective DPI and crop share. */
export function checkSize(pxW, pxH, size) {
  if (!(pxW > 0 && pxH > 0)) throw new RangeError("pixel sizes must be positive");
  const landscape = pxW > pxH;
  let w = toIn(size.w, size.unit), h = toIn(size.h, size.unit);
  if (landscape !== w > h) [w, h] = [h, w];
  const fileRatio = pxW / pxH, printRatio = w / h;
  // Cover-fit: the print is filled, the extra part of the file is cropped.
  const crop = 1 - Math.min(fileRatio, printRatio) / Math.max(fileRatio, printRatio);
  const dpi = fileRatio >= printRatio ? pxH / h : pxW / w; // the axis that limits after cropping
  return { id: size.id, label: size.label, dpi: Math.round(dpi), crop: Math.round(crop * 1000) / 10, band: band(dpi).id };
}

/** Pixels needed for a print size at a DPI, in the file's orientation (short side first unless landscape). */
export function pixelsFor(size, dpi = 300, landscape = false) {
  let w = Math.round(toIn(size.w, size.unit) * dpi), h = Math.round(toIn(size.h, size.unit) * dpi);
  if (landscape) [w, h] = [h, w];
  return { w, h };
}

/** Largest size of the file's own shape at a DPI, in inches and cm. */
export function maxPrint(pxW, pxH, dpi = 300) {
  const wIn = pxW / dpi, hIn = pxH / dpi;
  const r = (v) => Math.round(v * 10) / 10;
  return { in: { w: r(wIn), h: r(hIn) }, cm: { w: r(wIn * CM_PER_IN), h: r(hIn * CM_PER_IN) } };
}

/** Ratio name for a file, short side first, e.g. "2:3", "4:5", "ISO A-series (1:1.414)", or "1:1.62". */
export function ratioName(pxW, pxH) {
  const r = Math.max(pxW, pxH) / Math.min(pxW, pxH);
  const known = [[1, "1:1"], [1.25, "4:5"], [4 / 3, "3:4"], [1.4, "5:7"], [Math.SQRT2, "ISO A-series (1:1.414)"], [1.5, "2:3"], [2, "1:2"], [3, "1:3"]];
  const hit = known.find(([v]) => Math.abs(v - r) / v < 0.006);
  return hit ? hit[1] : `1:${r.toFixed(2)}`;
}

export const orientation = (pxW, pxH) => (pxW === pxH ? "square" : pxW > pxH ? "landscape" : "portrait");

export function report(pxW, pxH) {
  return { ratio: ratioName(pxW, pxH), orientation: orientation(pxW, pxH), max300: maxPrint(pxW, pxH, 300), max150: maxPrint(pxW, pxH, 150), sizes: SIZES.map((s) => checkSize(pxW, pxH, s)) };
}
