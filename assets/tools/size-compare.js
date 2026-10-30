// Wall art size comparison chart: art sizes drawn to one true scale over a typical piece of furniture, for a listing image.
// It is a diagram (rectangles at real proportions), not a room photo. Furniture sizes are typical, stated on the page.
export const CM_PER_IN = 2.54;

export const SIZE_PRESETS = {
  in: [[8, 10], [11, 14], [12, 16], [12, 18], [16, 20], [16, 24], [18, 24], [20, 30], [24, 30], [24, 36], [30, 40], [32, 48], [40, 60]],
  cm: [[20, 30], [30, 40], [40, 50], [40, 60], [50, 70], [60, 80], [60, 90], [70, 100], [80, 120], [100, 150], [21, 29.7, "A4"], [29.7, 42, "A3"], [42, 59.4, "A2"], [59.4, 84.1, "A1"]],
};
export const DEFAULT_SIZES = { in: ["12x18", "16x24", "24x36", "32x48", "40x60"], cm: ["30x40", "40x60", "50x70", "70x100"] };

// Typical widths and top heights from the floor, in inches (cm shown converted). Rounded, common retail dimensions.
export const FURNITURE = [
  { id: "sofa", label: "Sofa, 84 in wide (213 cm)", w: 84, h: 34 },
  { id: "loveseat", label: "Loveseat, 60 in wide (152 cm)", w: 60, h: 34 },
  { id: "queen", label: "Queen bed, 60 in wide (152 cm)", w: 60, h: 48 },
  { id: "king", label: "King bed, 76 in wide (193 cm)", w: 76, h: 50 },
  { id: "console", label: "Console table, 48 in wide (122 cm)", w: 48, h: 30 },
  { id: "dresser", label: "Dresser, 60 in wide (152 cm)", w: 60, h: 34 },
  { id: "none", label: "No furniture (art centred at 57 in / 145 cm)", w: 0, h: 0 },
];
export const furniture = (id) => FURNITURE.find((f) => f.id === id) ?? FURNITURE[0];

/** "24x36" or "21x29.7" -> { w, h, name } in the given unit; null if invalid. */
export function parseSize(text, unit = "in") {
  const m = String(text).trim().toLowerCase().replace(/[×*]/g, "x").match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]), max = unit === "in" ? 120 : 300, min = unit === "in" ? 2 : 5;
  if (!(w >= min && h >= min && w <= max && h <= max)) return null;
  const preset = SIZE_PRESETS[unit].find(([a, b]) => (a === w && b === h) || (a === h && b === w));
  return { w, h, name: preset?.[2] ?? null };
}
export const toIn = (v, unit) => (unit === "in" ? v : v / CM_PER_IN);
export const fmt = (v) => String(Math.round(v * 10) / 10);
export const sizeLabel = (s, unit) => (s.name ? `${s.name} (${fmt(s.w)} × ${fmt(s.h)} cm)` : `${fmt(s.w)} × ${fmt(s.h)} ${unit}`);

/** Share of the furniture width an artwork covers, and a plain verdict against the two-thirds to three-quarters guide. */
export function fit(artWIn, furn) {
  if (!furn.w) return { share: null, verdict: "No furniture: hung with its centre at eye level." };
  const share = artWIn / furn.w;
  const pct = Math.round(share * 100);
  if (share < 0.5) return { share, verdict: `${pct}% of the furniture width: small over it; works as part of a group.` };
  if (share < 0.6) return { share, verdict: `${pct}% of the furniture width: a little small on its own.` };
  if (share <= 0.75) return { share, verdict: `${pct}% of the furniture width: within the usual two-thirds to three-quarters.` };
  if (share <= 1) return { share, verdict: `${pct}% of the furniture width: bold, wider than the usual guide.` };
  return { share, verdict: `${pct}% of the furniture width: wider than the furniture.` };
}

/**
 * Layout of one chart in inches: one panel per size, all at the same scale, each with the furniture and the art hung
 * with its bottom `gapIn` above the furniture (or centred at 57 in with no furniture). Returns panels and the scale.
 */
export function layout(sizes, unit, furnId, { gapIn = 8, ceilingIn = 96 } = {}) {
  if (!sizes.length) throw new Error("no sizes");
  const furn = furniture(furnId), arts = sizes.map((s) => ({ ...s, wIn: toIn(s.w, unit), hIn: toIn(s.h, unit) }));
  const panelW = Math.max(furn.w + 24, ...arts.map((a) => a.wIn + 24), 72);
  const panels = arts.map((a) => {
    const bottom = furn.w ? furn.h + gapIn : 57 - a.hIn / 2, top = bottom + a.hIn;
    return { size: a, art: { x: (panelW - a.wIn) / 2, y: bottom, w: a.wIn, h: a.hIn }, furniture: furn.w ? { x: (panelW - furn.w) / 2, y: 0, w: furn.w, h: furn.h } : null, tooTall: top > ceilingIn, fit: fit(a.wIn, furn) };
  });
  return { panelW, wallH: Math.max(ceilingIn, ...panels.map((p) => p.art.y + p.art.h + 6)), panels, furniture: furn };
}
