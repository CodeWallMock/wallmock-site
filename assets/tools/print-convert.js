// Print size converter: inches <-> centimetres <-> pixels at a chosen DPI, and a table of common print sizes.
export const CM_PER_IN = 2.54;
export const DPIS = [72, 150, 200, 240, 300];
export const COMMON = [[4, 6], [5, 7], [8, 10], [8, 12], [11, 14], [12, 16], [12, 18], [16, 20], [16, 24], [18, 24], [20, 30], [24, 30], [24, 36], [30, 40], [36, 48], [40, 60]];
export const ISO = [["A5", 14.8, 21], ["A4", 21, 29.7], ["A3", 29.7, 42], ["A2", 42, 59.4], ["A1", 59.4, 84.1], ["A0", 84.1, 118.9]];

const r = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

/** One length in any unit -> all three units at the DPI. */
export function convert(value, unit, dpi = 300) {
  const v = Number(value);
  if (!(v > 0) || !Number.isFinite(v)) throw new Error("positive number");
  if (!(dpi > 0)) throw new Error("positive DPI");
  const inches = unit === "in" ? v : unit === "cm" ? v / CM_PER_IN : unit === "px" ? v / dpi : NaN;
  if (Number.isNaN(inches)) throw new Error("unit");
  return { in: r(inches, 2), cm: r(inches * CM_PER_IN, 1), px: Math.round(inches * dpi) };
}

/** Width and height together, in the same way. */
export const convertSize = (w, h, unit, dpi = 300) => ({ w: convert(w, unit, dpi), h: convert(h, unit, dpi) });

/** Rows for the common sizes table at a DPI: label, cm, pixels and megapixels. */
export function table(dpi = 300) {
  const rows = COMMON.map(([a, b]) => ({ label: `${a} × ${b} in`, cm: `${r(a * CM_PER_IN, 1)} × ${r(b * CM_PER_IN, 1)} cm`, px: `${a * dpi} × ${b * dpi} px`, mp: r((a * dpi * b * dpi) / 1e6, 1) }));
  const iso = ISO.map(([n, a, b]) => ({ label: `${n} (${a} × ${b} cm)`, cm: `${a} × ${b} cm`, px: `${Math.round((a / CM_PER_IN) * dpi)} × ${Math.round((b / CM_PER_IN) * dpi)} px`, mp: r(((a / CM_PER_IN) * dpi * (b / CM_PER_IN) * dpi) / 1e6, 1) }));
  return [...rows, ...iso];
}
