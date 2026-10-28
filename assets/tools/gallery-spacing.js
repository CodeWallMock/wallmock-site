// Gallery wall spacing calculator: pure logic shared by the browser widget, the page's static first state and
// tests/gallery-spacing.test.mjs. Answers "how far apart do I hang these, and where does each nail go?" for a pair, a
// trio, a row of four or a grid of equal frames. The geometry comes from the gallery wall layout planner
// (tools/lib/gallery-layout.mjs plan()); this tool adds what a tape measure needs: positions from the left end of the
// furniture, nail-to-nail spacing, hook heights from the furniture's own hanging gap, and a ceiling check.
//
// SEO-2 bugs fixed here (SEO2-CONTENT-REVIEW-1 S6):
//   - it promised "where to put each hook" but gave left edges only: now every frame has its hook height and its
//     distance from the left end and from the centre line;
//   - a group wider than the furniture printed negative positions ("-12.5 in from the left edge") with only "may feel
//     crowded": that is now a plain "wider than the furniture" result, measured from the centre line instead;
//   - it never asked the frame height, so tall grids passed: the group's height sets the hook heights and is checked
//     against the ceiling;
//   - the message said "two thirds to three quarters" but accepted 60–80%: it now uses the planner's 60–75% band;
//   - switching units did not convert the numbers: the widget converts them.
import { plan, GUIDE, shareText, convert } from "./gallery-layout.js?v=1";

export { convert, GUIDE };

export const SETS = {
  pair: { label: "Pair, side by side", layout: "row", count: 2 },
  trio: { label: "Trio in a row", layout: "row", count: 3 },
  row4: { label: "Row of four", layout: "row", count: 4 },
  grid2x2: { label: "Grid 2 × 2", layout: "grid-2x2", count: 4 },
  grid2x3: { label: "Grid 2 × 3 (two rows of three)", layout: "grid-2x3", count: 6 },
};

// What sits below the group: the bottom of the frames this far above it (the same numbers as the sizing guide), or an
// open wall with the group centred at gallery eye level.
export const BELOW = {
  sofa: { label: "Sofa", noun: "the sofa back", gap: { in: [6, 10], cm: [15, 25] } },
  bed: { label: "Bed (headboard)", noun: "the headboard", gap: { in: [8, 12], cm: [20, 30] } },
  sideboard: { label: "Sideboard or console", noun: "the sideboard", gap: { in: [4, 8], cm: [10, 20] } },
  wall: { label: "Open wall", noun: "the floor", gap: null },
};

export const CEILING_ROOM = { in: 6, cm: 15 }; // less space than this above the group reads as cramped
export const DEFAULTS = {
  in: { width: 84, furnitureTop: 34, ceiling: 96, pieceWidth: 16, pieceHeight: 20, gap: 3, hookDrop: 0 },
  cm: { width: 213, furnitureTop: 86, ceiling: 244, pieceWidth: 40, pieceHeight: 50, gap: 8, hookDrop: 0 },
};

const r1 = (v) => Math.round(v * 10) / 10;
const rs = (v) => Math.sign(v) * r1(Math.abs(v)); // symmetric rounding, so mirrored frames read the same left and right
const finite = (v) => typeof v === "number" && Number.isFinite(v);
export const fmt = (v) => (Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1));

/**
 * spacing({ unit, set, below, width, furnitureTop?, ceiling?, pieceWidth, pieceHeight, gap, hookDrop? })
 * width: the furniture's width, or for an open wall the wall section's width. Returns the group size, nail spacing,
 * every frame's position and hook height, the width check and the ceiling check.
 */
export function spacing(input) {
  const unit = input.unit ?? "in";
  if (!(unit in GUIDE) || unit === "widthShare") throw new RangeError("unit must be in or cm");
  const S = SETS[input.set];
  if (!S) throw new RangeError(`unknown layout ${input.set}`);
  const B = BELOW[input.below ?? "sofa"];
  if (!B) throw new RangeError(`unknown furniture ${input.below}`);
  const { width, furnitureTop, ceiling, pieceWidth, pieceHeight, gap, hookDrop = 0 } = input;
  if (!(finite(width) && width > 0)) throw new RangeError(B.gap ? "enter the furniture width" : "enter the width of the wall");
  if (!(finite(gap) && gap >= 0)) throw new RangeError("the gap must be 0 or more");
  if (!(finite(pieceWidth) && pieceWidth > 0 && finite(pieceHeight) && pieceHeight > 0)) throw new RangeError("enter each frame's width and height");
  if (B.gap && !(finite(furnitureTop) && furnitureTop > 0)) throw new RangeError("enter the height of the furniture's top (or the sofa back)");
  if (ceiling !== undefined && ceiling !== 0 && !(finite(ceiling) && ceiling > 0)) throw new RangeError("the ceiling height must be a positive number, or leave it blank");

  // Group height first (a dry run at the eye-level centre), then the centre that puts the bottom at the middle of the
  // furniture's hanging gap.
  const base = { unit, layout: S.layout, count: S.count, pieceWidth, pieceHeight, gap, hookDrop };
  const height = plan({ ...base, centre: 1e6 }).height;
  const target = B.gap ? (B.gap[unit][0] + B.gap[unit][1]) / 2 : null;
  const centre = B.gap ? furnitureTop + target + height / 2 : GUIDE[unit].centre;
  const p = plan({ ...base, centre, furnitureWidth: width });

  const wider = p.width > width + 1e-9;
  const share = B.gap ? p.share : { percent: Math.round((p.width / width) * 100), status: wider ? "wider-than-wall" : "fits" };
  const startOffset = (width - p.width) / 2;
  const frames = p.frames.map((f) => ({
    n: f.n, row: Math.round(f.y / (pieceHeight + gap)) + 1,
    left: wider ? null : r1(startOffset + f.x),
    centreFromLeft: wider ? null : r1(startOffset + f.x + f.w / 2),
    fromMid: rs(f.x + f.w / 2 - p.width / 2), top: f.top, hook: f.hook,
  }));
  let ceilingCheck = null;
  if (finite(ceiling) && ceiling > 0) {
    const room = ceiling - p.top;
    ceilingCheck = { height: ceiling, room: r1(room), status: room < 0 ? "above" : room < CEILING_ROOM[unit] ? "tight" : "ok" };
  }
  return {
    unit, set: input.set, below: input.below ?? "sofa", width, gap, pieceWidth, pieceHeight,
    groupWidth: p.width, groupHeight: p.height, centre: r1(p.centre), top: p.top, bottom: p.bottom,
    clearance: B.gap ? r1(p.bottom - furnitureTop) : null, gapRange: B.gap ? B.gap[unit] : null,
    nailSpacing: r1(pieceWidth + gap), rowSpacing: S.layout === "row" ? null : r1(pieceHeight + gap),
    wider, share, frames, ceiling: ceilingCheck,
  };
}

/** Plain-text summary lines for the live region and the static first state. */
export function summary(r) {
  const u = r.unit, B = BELOW[r.below], lines = [];
  lines.push(`${SETS[r.set].label}: the group is ${fmt(r.groupWidth)} × ${fmt(r.groupHeight)} ${u}, with ${fmt(r.gap)} ${u} gaps. Nails for neighbouring frames are ${fmt(r.nailSpacing)} ${u} apart${r.rowSpacing ? `, and the rows ${fmt(r.rowSpacing)} ${u} apart` : ""}.`);
  if (r.wider) lines.push(`The group is wider than the ${B.gap ? "furniture" : "wall"} (${fmt(r.width)} ${u}) by ${fmt(r.groupWidth - r.width)} ${u}: use smaller frames, fewer frames or a smaller gap. Positions below are measured from the centre line.`);
  else if (B.gap) lines.push(`It is ${r.share.percent}% of the ${fmt(r.width)} ${u} furniture: ${shareText(r.share.status)}.`);
  else lines.push(`It takes ${r.share.percent}% of the ${fmt(r.width)} ${u} wall section.`);
  lines.push(B.gap
    ? `Bottom edge ${fmt(r.bottom)} ${u} from the floor, ${fmt(r.clearance)} ${u} above ${B.noun} (the usual gap is ${r.gapRange[0]}–${r.gapRange[1]} ${u}); top edge ${fmt(r.top)} ${u}.`
    : `Centred ${fmt(r.centre)} ${u} above the floor, gallery eye level; top edge ${fmt(r.top)} ${u}.`);
  if (r.ceiling?.status === "above") lines.push(`The top edge (${fmt(r.top)} ${u}) is above the ${fmt(r.ceiling.height)} ${u} ceiling: use shorter frames or fewer rows.`);
  else if (r.ceiling?.status === "tight") lines.push(`Only ${fmt(r.ceiling.room)} ${u} is left below the ceiling, so the group may look cramped: shorter frames or one row would sit better.`);
  return lines;
}

/** Table rows: [frame, from the left end, from the centre line, hook height]. Plain text. */
export function rows(r) {
  const u = r.unit;
  const across = (v) => (v === 0 ? "on the centre line" : `${fmt(Math.abs(v))} ${u} ${v < 0 ? "left" : "right"}`);
  return r.frames.map((f) => [`Frame ${f.n}${r.rowSpacing ? ` (row ${f.row})` : ""}`, f.centreFromLeft === null ? "n/a (group too wide)" : `${fmt(f.centreFromLeft)} ${u}`, across(f.fromMid), `${fmt(f.hook)} ${u}`]);
}
