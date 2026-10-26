// Gallery wall layout planner: pure logic shared by the browser widget, the page's static first state and
// tests/gallery-layout.test.mjs. Answers "where does each frame go, and how high do I hang it?".
// All lengths are in the chosen unit ("in" or "cm"); heights are measured up from the floor.

export const CM_PER_IN = 2.54;

// Common guidelines, not rules: a group centred about 57 in (145 cm) above the floor (gallery eye level), gaps of
// 3–6 in (8–15 cm), the group about two-thirds (up to three-quarters) of the furniture width, and 6–10 in (15–25 cm)
// between furniture and frames, aiming for 8 in (20 cm).
export const GUIDE = {
  in: { centre: 57, gap: 3, clearanceMin: 6, clearanceTarget: 8, clearanceMax: 10 },
  cm: { centre: 145, gap: 8, clearanceMin: 15, clearanceTarget: 20, clearanceMax: 25 },
  widthShare: { min: 0.6, ideal: 2 / 3, max: 0.75 },
};

// Layouts: cols per row and the most pieces each takes. Grids fill row by row; a short last row is centred.
export const LAYOUTS = {
  row: { label: "Row", cols: 9, max: 9 },
  "grid-2x2": { label: "Grid 2 × 2", cols: 2, max: 4 },
  "grid-2x3": { label: "Grid 2 × 3", cols: 3, max: 6 },
  "grid-3x3": { label: "Grid 3 × 3", cols: 3, max: 9 },
  trio: { label: "Trio (large centre, two smaller sides)", cols: 3, max: 3 },
};

export const TRIO_SIDE_SCALE = 0.7; // side pieces of a trio are 70% of the centre piece's height, same shape

const r1 = (v) => Math.round(v * 10) / 10;
const pos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

export function convert(value, from, to) {
  if (from === to) return value;
  return from === "in" ? value * CM_PER_IN : value / CM_PER_IN;
}

/** Parse "2:3", "16x20" or "16 × 20" into a width/height ratio (w/h). */
export function parseRatio(s) {
  const m = String(s ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*[:x×\/]\s*(\d+(?:\.\d+)?)$/i);
  if (!m || !(+m[1] > 0 && +m[2] > 0)) throw new RangeError("ratio must look like 2:3");
  return +m[1] / +m[2];
}

/**
 * plan({ unit, layout, count, pieceWidth, pieceHeight | ratio, gap, centre, furnitureWidth?, furnitureTop?, hookDrop? })
 * Returns the group size, each frame's position (x, y from the group's top-left), its top edge, centre and hook
 * heights above the floor, its offset from the centre line, and the furniture checks.
 */
export function plan(input) {
  const unit = input.unit ?? "in";
  if (!(unit in { in: 1, cm: 1 })) throw new RangeError("unit must be in or cm");
  const g = GUIDE[unit];
  const layout = input.layout ?? "row";
  const L = LAYOUTS[layout];
  if (!L) throw new RangeError(`unknown layout ${layout}`);
  const count = input.count ?? (layout === "trio" ? 3 : undefined);
  if (!Number.isInteger(count) || count < 1 || count > 9) throw new RangeError("count must be a whole number from 1 to 9");
  if (count > L.max) throw new RangeError(`${L.label} holds at most ${L.max} pieces`);
  if (layout === "trio" && count !== 3) throw new RangeError("a trio has 3 pieces");
  const pw = input.pieceWidth;
  const ph = input.pieceHeight ?? (input.ratio != null && pos(pw) ? pw / parseRatio(input.ratio) : undefined);
  if (!pos(pw) || !pos(ph)) throw new RangeError("piece width and height must be positive");
  const gap = input.gap ?? g.gap;
  if (!(Number.isFinite(gap) && gap >= 0)) throw new RangeError("gap must be zero or more");
  const centre = input.centre ?? g.centre;
  if (!pos(centre)) throw new RangeError("centre height must be positive");
  const hookDrop = input.hookDrop ?? 0;
  if (!(Number.isFinite(hookDrop) && hookDrop >= 0)) throw new RangeError("hook drop must be zero or more");
  const fw = input.furnitureWidth || 0, ft = input.furnitureTop || 0;
  if (!(Number.isFinite(fw) && fw >= 0 && Number.isFinite(ft) && ft >= 0)) throw new RangeError("furniture sizes must be zero or more");

  // Lay pieces out in group coordinates (x right, y down from the group's top edge).
  let boxes = [];
  if (layout === "trio") {
    const sh = ph * TRIO_SIDE_SCALE, sw = pw * TRIO_SIDE_SCALE, off = (ph - sh) / 2;
    boxes = [
      { x: 0, y: off, w: sw, h: sh },
      { x: sw + gap, y: 0, w: pw, h: ph },
      { x: sw + gap + pw + gap, y: off, w: sw, h: sh },
    ];
  } else {
    const cols = Math.min(L.cols, count), rows = Math.ceil(count / cols);
    const fullW = cols * pw + (cols - 1) * gap;
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(cols, count - r * cols);
      const rowW = inRow * pw + (inRow - 1) * gap, x0 = (fullW - rowW) / 2;
      for (let c = 0; c < inRow; c++) boxes.push({ x: x0 + c * (pw + gap), y: r * (ph + gap), w: pw, h: ph });
    }
  }
  const minH = Math.min(...boxes.map((b) => b.h));
  if (hookDrop > minH + 1e-9) throw new RangeError(`hook drop (${fmt(r1(hookDrop))} ${unit}) is more than the frame height (${fmt(r1(minH))} ${unit}): measure from the top of the frame down to the taut wire or hook`);
  const width = Math.max(...boxes.map((b) => b.x + b.w));
  const height = Math.max(...boxes.map((b) => b.y + b.h));
  const top = centre + height / 2, bottom = centre - height / 2;
  if (bottom < 0) throw new RangeError("the group would reach the floor: raise the centre or use smaller pieces");

  const frames = boxes.map((b, i) => {
    const t = top - b.y;
    return {
      n: i + 1, x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h),
      top: r1(t), centre: r1(t - b.h / 2), bottom: r1(t - b.h), hook: r1(t - hookDrop),
      fromMid: r1(b.x + b.w / 2 - width / 2), // negative = left of the centre line
      fromFurnitureLeft: fw ? r1((fw - width) / 2 + b.x) : null,
    };
  });

  let share = null;
  if (fw) {
    const s = width / fw;
    const status = s < GUIDE.widthShare.min ? "narrow" : s <= GUIDE.widthShare.max + 0.005 ? "good" : s <= 1 ? "wide" : "wider-than-furniture";
    share = { ratio: Math.round(s * 1000) / 1000, percent: Math.round(s * 100), status, idealWidth: r1(fw * GUIDE.widthShare.ideal), range: [r1(fw * GUIDE.widthShare.min), r1(fw * GUIDE.widthShare.max)] };
  }
  let clearance = null;
  if (ft) {
    // overlap: frames come down over the furniture; low: under the minimum gap; high: more than the maximum gap.
    const c = bottom - ft;
    const status = c < -0.05 ? "overlap" : c < g.clearanceMin - 0.05 ? "low" : c > g.clearanceMax + 0.05 ? "high" : "good";
    clearance = { value: r1(c), ok: status === "good", status, target: g.clearanceTarget, max: g.clearanceMax, suggestedCentre: status === "good" ? null : r1(ft + g.clearanceTarget + height / 2) };
  }
  return { unit, layout, count, gap, centre, hookDrop, furnitureWidth: fw || null, furnitureTop: ft || null, width: r1(width), height: r1(height), top: r1(top), bottom: r1(bottom), frames, share, clearance };
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** One-sentence summary for screen readers and the page's live region. */
export function describe(p) {
  const u = p.unit;
  let s = `${p.count} ${p.count === 1 ? "piece" : "pieces"}, ${LAYOUTS[p.layout].label.toLowerCase()}: the group is ${fmt(p.width)} × ${fmt(p.height)} ${u}, centred ${fmt(p.centre)} ${u} above the floor, top edge at ${fmt(p.top)} ${u}.`;
  if (p.share) s += ` It is ${p.share.percent}% of the furniture width (guideline about 67%, range 60–75%).`;
  if (p.clearance) s += " " + clearanceText(p);
  return s;
}

/** The furniture-gap sentence: fine, overlapping, too low or too high, with the centre height that gives the target gap. */
export function clearanceText(p) {
  const c = p.clearance, u = p.unit;
  if (!c) return "";
  if (c.status === "good") return `It clears the furniture by ${fmt(c.value)} ${u}.`;
  const y = `${fmt(c.suggestedCentre)} ${u}`;
  if (c.status === "overlap") return `The frames overlap the furniture by ${fmt(Math.abs(c.value))} ${u}: raise the centre to about ${y}.`;
  if (c.status === "low") return `Only ${fmt(c.value)} ${u} above the furniture: raise the centre to about ${y}.`;
  if (c.status === "high") return `The gap above the furniture is ${fmt(c.value)} ${u}, more than ${c.max} ${u}, so the group may look disconnected: a centre of about ${y} leaves a gap of ${c.target} ${u}.`;
  return `It clears the furniture by ${fmt(c.value)} ${u}.`;
}

const SHARE_TEXT = {
  narrow: "narrower than the usual two-thirds guideline; bigger pieces or a wider gap would fill the space",
  good: "within the usual guideline of about two-thirds (60 to 75%)",
  wide: "wider than three-quarters; it can feel crowded over the furniture",
  "wider-than-furniture": "wider than the furniture itself",
};
export const shareText = (status) => SHARE_TEXT[status];

/** Proportional SVG of the wall: floor, furniture, centre line and frames with sizes. Numbers only, no user text. */
export function svg(p) {
  const u = p.unit;
  const fw = p.furnitureWidth ?? 0;
  const sceneW = Math.max(fw, p.width) * 1.2;
  const pad = sceneW * 0.06;
  const floorY = p.top + pad * 2.2; // y grows down; y = floorY - height above floor
  const yy = (h) => floorY - h;
  const gx = (sceneW - p.width) / 2; // group left edge in scene units
  const fs = sceneW / 38;
  const t = (x, y, s, extra = "") => `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(fs)}" text-anchor="middle" fill="#182b30"${extra}>${s}</text>`;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${r1(sceneW)}" height="${r1(floorY)}" fill="#f2f5f1"/>`);
  parts.push(`<line x1="0" y1="${r1(floorY)}" x2="${r1(sceneW)}" y2="${r1(floorY)}" stroke="#536369" stroke-width="${r1(fs / 6)}"/>`);
  if (fw) {
    const fx = (sceneW - fw) / 2, ftop = p.furnitureTop ?? Math.min(p.bottom * 0.7, fs * 8);
    parts.push(`<rect x="${r1(fx)}" y="${r1(yy(ftop))}" width="${r1(fw)}" height="${r1(ftop)}" fill="#d5ddda" rx="${r1(fs / 2)}"/>`);
    parts.push(t(sceneW / 2, yy(ftop / 2) + fs / 3, `furniture ${fmt(fw)} ${u}${p.furnitureTop ? ` × ${fmt(p.furnitureTop)} ${u} high` : ""}`));
  }
  parts.push(`<line x1="0" y1="${r1(yy(p.centre))}" x2="${r1(sceneW)}" y2="${r1(yy(p.centre))}" stroke="#698146" stroke-width="${r1(fs / 8)}" stroke-dasharray="${r1(fs / 2)} ${r1(fs / 3)}"/>`);
  parts.push(`<text x="${r1(fs / 2)}" y="${r1(yy(p.centre) - fs / 3)}" font-size="${r1(fs * 0.85)}" fill="#3f5a22">centre ${fmt(p.centre)} ${u}</text>`);
  for (const f of p.frames) {
    const x = gx + f.x, y = yy(f.top);
    parts.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${f.w}" height="${f.h}" fill="#e6ece4" stroke="#182b30" stroke-width="${r1(fs / 5)}"/>`);
    const label = `${fmt(f.w)} × ${fmt(f.h)}`, sub = `top ${fmt(f.top)}`;
    const size = Math.min(fs, (f.w * 0.86) / (label.length * 0.56)); // shrink the label to fit narrow frames
    const showSub = f.h > size * 3.2;
    parts.push(`<text x="${r1(x + f.w / 2)}" y="${r1(y + f.h / 2 + (showSub ? -size * 0.15 : size * 0.35))}" font-size="${r1(size)}" text-anchor="middle" fill="#182b30">${label}</text>`);
    if (showSub) parts.push(`<text x="${r1(x + f.w / 2)}" y="${r1(y + f.h / 2 + size)}" font-size="${r1(size * 0.8)}" text-anchor="middle" fill="#536369">${sub}</text>`);
  }
  // Total width dimension above the group.
  const dy = yy(p.top) - fs * 0.9;
  parts.push(`<path d="M${r1(gx)} ${r1(dy)}H${r1(gx + p.width)}M${r1(gx)} ${r1(dy - fs / 3)}v${r1(fs * 2 / 3)}M${r1(gx + p.width)} ${r1(dy - fs / 3)}v${r1(fs * 2 / 3)}" stroke="#182b30" stroke-width="${r1(fs / 8)}" fill="none"/>`);
  parts.push(t(gx + p.width / 2, dy - fs * 0.45, `${fmt(p.width)} × ${fmt(p.height)} ${u} group`));
  const label = describe(p).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<svg class="layout-svg" viewBox="0 0 ${r1(sceneW)} ${r1(floorY + fs * 0.5)}" width="100%" role="img" aria-label="${label}" style="max-width:min(100%,760px);height:auto;display:block;margin:0 auto;font-family:inherit"><title>${label}</title>${parts.join("")}</svg>`;
}

/** Table rows for the page and widget: [frame, size, top edge, hook, across from the centre line]. Plain text. */
export function rows(p) {
  const u = p.unit;
  const across = (v) => (v === 0 ? "on the centre line" : `${fmt(Math.abs(v))} ${u} ${v < 0 ? "left" : "right"}`);
  return p.frames.map((f) => [`Frame ${f.n}`, `${fmt(f.w)} × ${fmt(f.h)} ${u}`, `${fmt(f.top)} ${u}`, `${fmt(f.hook)} ${u}`, across(f.fromMid)]);
}
