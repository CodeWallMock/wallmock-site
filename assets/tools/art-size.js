// Art size over a sofa, bed or sideboard: pure logic shared by the browser widget, the page's static first state and
// tests/art-size.test.mjs. Answers "what size art goes over my sofa?" with the same numbers as the guide
// /guides/what-size-art-over-sofa-and-bed/: art (frame included) about two-thirds to three-quarters of the furniture
// width, the bottom of the frame 6–10 in above a sofa, 8–12 in above a headboard and 4–8 in above a sideboard.
//
// SEO-2 bugs fixed here (FREE-TOOLS-3 §C.4, SEO2-CONTENT-REVIEW-1): the old page silently widened the range to 61–81%
// while saying "two-thirds to three-quarters"; cm mode still listed inch sizes; a set's size was shown in inches only.
// Now every size shows its share of the furniture and a plain label, and each unit lists its own standard sizes.

export const CM_PER_IN = 2.54;

// The guideline band (two-thirds to three-quarters) and the near band shown with a label (60–80%).
export const SHARE = { min: 0.6, low: 2 / 3, high: 0.75, max: 0.8 };

// Gap between the pieces of a pair or trio: the gallery wall planner's default (tools/lib/gallery-layout.mjs GUIDE).
export const SET_GAP = { in: 3, cm: 8 };

// Bottom of the frame above the furniture, from the sizing guide.
export const SPOTS = {
  sofa: { label: "Sofa", noun: "the sofa back", gap: { in: [6, 10], cm: [15, 25] } },
  bed: { label: "Bed (measure the headboard)", noun: "the headboard", gap: { in: [8, 12], cm: [20, 30] } },
  sideboard: { label: "Sideboard, console or dresser", noun: "the sideboard", gap: { in: [4, 8], cm: [10, 20] } },
};

// Common sizes per shape, width × height as hung (landscape shapes are wider than tall). Sets use 2:3 portrait panels.
const P23 = { in: [[12, 18], [16, 24], [20, 30], [24, 36], [32, 48], [40, 60]], cm: [[20, 30], [30, 45], [40, 60], [60, 90], [80, 120], [100, 150]] };
const flip = (list) => list.map(([w, h]) => [h, w]);
export const SHAPES = {
  "3:2": { label: "Landscape 3:2", pieces: 1, sizes: { in: flip(P23.in), cm: flip(P23.cm) } },
  "4:3": { label: "Landscape 4:3", pieces: 1, sizes: { in: [[16, 12], [24, 18], [32, 24], [40, 30], [48, 36], [60, 45]], cm: [[40, 30], [60, 45], [80, 60], [100, 75], [120, 90], [160, 120]] } },
  "1:1": { label: "Square 1:1", pieces: 1, sizes: { in: [[12, 12], [16, 16], [20, 20], [24, 24], [30, 30], [36, 36], [40, 40], [48, 48]], cm: [[30, 30], [40, 40], [50, 50], [60, 60], [70, 70], [80, 80], [100, 100]] } },
  "2:3": { label: "Portrait 2:3", pieces: 1, sizes: P23 },
  "3:4": { label: "Portrait 3:4", pieces: 1, sizes: { in: [[12, 16], [18, 24], [24, 32], [30, 40], [36, 48]], cm: [[30, 40], [45, 60], [60, 80], [75, 100], [90, 120]] } },
  "2:1": { label: "Panorama 2:1", pieces: 1, sizes: { in: [[24, 12], [36, 18], [40, 20], [48, 24], [60, 30], [72, 36]], cm: [[60, 30], [80, 40], [100, 50], [120, 60], [140, 70], [160, 80]] } },
  "3:1": { label: "Panorama 3:1", pieces: 1, sizes: { in: [[30, 10], [36, 12], [42, 14], [48, 16], [54, 18], [60, 20], [72, 24]], cm: [[60, 20], [90, 30], [120, 40], [150, 50], [180, 60]] } },
  pair: { label: "Pair of 2:3 portraits", pieces: 2, sizes: P23 },
  trio: { label: "Trio of 2:3 portraits", pieces: 3, sizes: P23 },
  trio34: { label: "Trio of 3:4 portraits", pieces: 3, sizes: { in: [[9, 12], [12, 16], [18, 24], [24, 32]], cm: [[30, 40], [45, 60], [60, 80]] } },
};

export const LIMITS = { in: [12, 400], cm: [30, 1000] };

const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (v) => (Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1));

/** "in range" (two-thirds to three-quarters), "a little narrow" (60% to two-thirds) or "a little wide" (to 80%). */
export function fitLabel(share) {
  const e = 1e-9;
  if (share < SHARE.min - e || share > SHARE.max + e) return null;
  if (share < SHARE.low - e) return "a little narrow";
  if (share > SHARE.high + e) return "a little wide";
  return "in range";
}

/**
 * artSize({ width, unit: "in" | "cm", spot: "sofa" | "bed" | "sideboard", shape })
 * Returns the art width range, every common size of the shape at 60–80% of the furniture with its share and label,
 * the one closest to the middle of the range, the nearest size when none lands in the band, and the hanging gap.
 */
export function artSize({ width, unit = "in", spot = "sofa", shape = "3:2" }) {
  if (!(unit in LIMITS)) throw new RangeError("unit must be in or cm");
  const S = SHAPES[shape];
  if (!S) throw new RangeError(`unknown shape ${shape}`);
  const P = SPOTS[spot];
  if (!P) throw new RangeError(`unknown furniture ${spot}`);
  const [lo, hi] = LIMITS[unit];
  if (!(typeof width === "number" && Number.isFinite(width) && width >= lo && width <= hi)) throw new RangeError(`furniture width must be ${lo} to ${hi} ${unit}`);
  const gap = S.pieces > 1 ? SET_GAP[unit] : 0;
  const all = S.sizes[unit].map(([w, h]) => {
    const group = w * S.pieces + gap * (S.pieces - 1);
    const share = group / width;
    return { w, h, group: r1(group), share, percent: Math.round(share * 100), fit: fitLabel(share), label: sizeLabel(w, h, unit, S.pieces, group) };
  });
  const sizes = all.filter((s) => s.fit);
  const mid = (SHARE.low + SHARE.high) / 2;
  const byMid = (a, b) => Math.abs(a.share - mid) - Math.abs(b.share - mid);
  const best = sizes.filter((s) => s.fit === "in range").sort(byMid)[0] ?? null;
  const nearest = sizes.length ? null : [...all].sort(byMid)[0];
  return {
    unit, width, spot, shape, pieces: S.pieces, gap,
    range: [Math.round(width * SHARE.low), Math.round(width * SHARE.high)],
    sizes, best, nearest,
    hang: { from: P.gap[unit][0], to: P.gap[unit][1], noun: P.noun },
  };
}

export function sizeLabel(w, h, unit, pieces = 1, group = w) {
  const one = `${fmt(w)} × ${fmt(h)} ${unit}`;
  if (pieces === 1) return one;
  return `${pieces === 2 ? "2" : "3"} × ${one} (group ${fmt(group)} ${unit} wide)`;
}

/** Summary sentences for the live region and the static first state. Plain text. */
export function summary(r) {
  const u = r.unit;
  const lines = [`Art width: ${r.range[0]} to ${r.range[1]} ${u}, about two-thirds to three-quarters of the ${fmt(r.width)} ${u} furniture.`];
  if (r.best) lines.push(`Closest to the middle of that range: ${r.best.label}, ${r.best.percent}% of the width.`);
  else if (r.sizes.length) lines.push(`No common ${SHAPES[r.shape].label.toLowerCase()} size lands between two-thirds and three-quarters; the sizes below are just outside it.`);
  else lines.push(`No common ${SHAPES[r.shape].label.toLowerCase()} size lands at 60–80% of the width. The nearest is ${r.nearest.label} at ${r.nearest.percent}%: consider another shape, a set or a custom size.`);
  lines.push(`Hang it with the bottom of the frame ${r.hang.from}–${r.hang.to} ${u} above ${r.hang.noun}.`);
  return lines;
}
