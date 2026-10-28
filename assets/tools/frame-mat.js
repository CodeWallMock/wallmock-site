// Frame and mat size calculator: pure logic shared by the browser widget, the page's static first state and
// tests/frame-mat.test.mjs. Answers "what size frame and mat opening do I need for this print?".
//
// SEO-2 bugs fixed here (SEO2-CONTENT-REVIEW-1 S1):
//   - a 0 or blank border gave a frame rebate smaller than the print: 0 is now a no-mat mode (rebate = print size) and
//     blank is an error;
//   - a border at or under the 1/8 in overlap gave a mat narrower than the print: rejected with a reason;
//   - a tiny print gave a negative opening, and a negative frame face was accepted: both rejected;
//   - switching units did not convert the numbers: the widget converts them (convert());
//   - the default answer (11.75 × 13.75 in) is not a stock size: the result now also names the smallest ready-made
//     frame that gives at least the border asked for, with the borders it really gives.
import { MAT_OVERLAP, FRAMES, matBorders } from "./frame-sizes.js?v=1";

export const CM_PER_IN = 2.54;
export { MAT_OVERLAP };
export const BOTTOM = { 0: "Equal borders", 0.25: "Bottom border a quarter wider", 0.5: "Bottom border half as wide again" };
export const DEFAULTS = { in: { printWidth: 8, printHeight: 10, border: 1.5, face: 0.75 }, cm: { printWidth: 20, printHeight: 25, border: 4, face: 2 } };

const finite = (v) => typeof v === "number" && Number.isFinite(v);

export function convert(value, from, to) {
  if (from === to) return value;
  return from === "in" ? value * CM_PER_IN : value / CM_PER_IN;
}

/** Display a length: inches to 3 decimals so 1/8 in steps show exactly (0.125, 1.625), cm to 1 decimal. */
const r3 = (v) => Math.round(v * 1000) / 1000;
export const num = (v, unit) => String(unit === "in" ? r3(v) : Math.round(v * 10) / 10);
export const len = (v, unit) => `${num(v, unit)} ${unit}`;

/**
 * matPlan({ unit, printWidth, printHeight, border, bottom (0 | 0.25 | 0.5), face })
 * border 0 means no mat. Returns the mat opening, the frame's rebate (inside) size, its outside size, each border and
 * the smallest ready-made frame that fits with at least that border.
 */
export function matPlan({ unit = "in", printWidth, printHeight, border, bottom = 0, face = 0 }) {
  if (!(unit in MAT_OVERLAP)) throw new RangeError("unit must be in or cm");
  const ov = MAT_OVERLAP[unit];
  if (!(finite(printWidth) && finite(printHeight) && printWidth > 0 && printHeight > 0)) throw new RangeError("enter the print's width and height");
  if (!finite(border)) throw new RangeError("enter a mat border, or 0 for no mat");
  if (border < 0) throw new RangeError("the mat border can't be negative; enter 0 for no mat");
  if (!finite(face) || face < 0) throw new RangeError("the frame face width must be 0 or more");
  if (!(bottom in BOTTOM)) throw new RangeError("unknown bottom weighting");

  if (border === 0) {
    const rebate = [printWidth, printHeight];
    return {
      unit, mat: false, opening: null, rebate, outside: [rebate[0] + 2 * face, rebate[1] + 2 * face], face,
      borders: null, stock: stockExact(printWidth, printHeight, unit),
    };
  }
  if (border <= ov) throw new RangeError(`a mat border must be wider than the ${len(ov, unit)} the mat overlaps the print, or the mat would be smaller than the print; enter 0 for no mat`);
  if (printWidth <= 2 * ov || printHeight <= 2 * ov) throw new RangeError(`the print must be more than ${len(2 * ov, unit)} on each side for a mat to hold it`);

  const opening = [printWidth - 2 * ov, printHeight - 2 * ov];
  const bottomBorder = border * (1 + Number(bottom));
  const rebate = [opening[0] + 2 * border, opening[1] + border + bottomBorder];
  return {
    unit, mat: true, overlap: ov, opening, rebate, outside: [rebate[0] + 2 * face, rebate[1] + 2 * face], face,
    borders: { sides: border, top: border, bottom: bottomBorder },
    stock: stockMatted([printWidth, printHeight], border, Number(bottom), unit),
  };
}

/** A ready-made frame the same size as the print (no mat), or null. */
function stockExact(w, h, unit) {
  const same = (a, b) => Math.abs(a - b) < 0.051;
  const f = FRAMES[unit].find((f) => (same(f.w, w) && same(f.h, h)) || (same(f.w, h) && same(f.h, w)));
  return f ? { frame: w > h ? [Math.max(f.w, f.h), Math.min(f.w, f.h)] : [f.w, f.h], exact: true } : null;
}

/** Smallest ready-made frame whose mat leaves at least `border` on every side; extra height keeps the bottom weighting. */
function stockMatted(print, border, bottom, unit) {
  const square = print[0] === print[1];
  const fits = FRAMES[unit]
    .filter((f) => (f.w === f.h) === square)
    .map((f) => matBorders(print, [f.w, f.h], unit))
    .filter((b) => b && b.sides >= border - 1e-9 && 2 * b.ends >= border * (2 + bottom) - 1e-9)
    .sort((a, b) => a.frame[0] * a.frame[1] - b.frame[0] * b.frame[1]);
  const b = fits[0];
  if (!b) return null;
  const top = (2 * b.ends) / (2 + bottom);
  return { frame: b.frame, opening: b.opening, sides: b.sides, top, bottom: top * (1 + bottom), exact: false };
}

/** Plain-text result rows: [label, value]. */
export function resultRows(p) {
  const u = p.unit, sz = (a) => `${num(a[0], u)} × ${num(a[1], u)} ${u}`;
  const out = [];
  if (p.mat) {
    out.push(["Mat opening", `${sz(p.opening)} (overlaps the print by ${len(p.overlap, u)} on each edge)`]);
    out.push(["Mat outer size = frame rebate (inside) size", sz(p.rebate)]);
    out.push(["Borders", p.borders.bottom === p.borders.top ? `${len(p.borders.sides, u)} on every side` : `${len(p.borders.sides, u)} top and sides, ${len(p.borders.bottom, u)} bottom`]);
  } else {
    out.push(["Mat", "none: the frame holds the print edge to edge"]);
    out.push(["Frame rebate (inside) size", sz(p.rebate)]);
  }
  out.push(["Outside of the frame", `about ${sz(p.outside)} with a ${len(p.face, u)} frame face`]);
  return out;
}

/** The ready-made frame sentence. */
export function stockText(p) {
  const u = p.unit, s = p.stock, sz = (a) => `${num(a[0], u)} × ${num(a[1], u)} ${u}`;
  if (!p.mat) return s ? `${sz(s.frame)} is a ready-made frame size, so a standard frame fits without a mat.` : `${sz(p.rebate)} is not a common ready-made frame size: order a custom frame, or add a mat to fit a standard one.`;
  if (!s) return `No common ready-made frame gives a ${len(p.borders.sides, u)} border for this print: order the frame by its rebate size, ${sz(p.rebate)}.`;
  const ends = Math.abs(s.top - s.bottom) < 0.005 ? `${len(s.top, u)} top and bottom` : `${len(s.top, u)} top and ${len(s.bottom, u)} bottom`;
  return `Ready-made option: a standard ${sz(s.frame)} frame with a mat opening of ${sz(s.opening)} gives ${len(s.sides, u)} at the sides and ${ends}.`;
}
