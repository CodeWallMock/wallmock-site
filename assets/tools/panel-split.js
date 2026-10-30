// Panorama, diptych and triptych split calculator. Two ways to split one artwork into 2 or 3 panels hung with gaps:
//  "even"   - the image is cut into equal panels and nothing is lost; the gaps add to the width on the wall;
//  "window" - the overall width on the wall is fixed and the gap strips are cut out of the image, so lines in the scene
//             stay straight across the gaps, as if seen through a window.
// Sizes are in one unit (in or cm); pixel boxes split an image of W x H pixels the same way.
const r2 = (v) => Math.round(v * 100) / 100;

export function split({ width, height, panels = 3, gap = 2, mode = "even" }) {
  const n = Number(panels), W = Number(width), H = Number(height), g = Number(gap);
  if (![2, 3].includes(n)) throw new Error("2 or 3 panels");
  if (!(W > 0 && H > 0) || !(g >= 0)) throw new Error("positive sizes");
  if (mode === "even") {
    const pw = W / n, wall = W + (n - 1) * g;
    return { mode, n, unitW: pw, panelH: H, wallW: r2(wall), panels: Array.from({ length: n }, (_, i) => ({ i, x: r2(i * (pw + g)), w: r2(pw), h: H, imgX: i / n, imgW: 1 / n })) };
  }
  if (mode === "window") {
    const pw = (W - (n - 1) * g) / n;
    if (pw <= 0) throw new Error("gaps wider than the artwork");
    return { mode, n, unitW: pw, panelH: H, wallW: W, lostPct: r2(((n - 1) * g / W) * 100), panels: Array.from({ length: n }, (_, i) => ({ i, x: r2(i * (pw + g)), w: r2(pw), h: H, imgX: (i * (pw + g)) / W, imgW: pw / W })) };
  }
  throw new Error("mode");
}

/** Pixel boxes for an image of iw x ih, from a split's image fractions (rounded so the panels meet exactly in "even"). */
export function pixelBoxes(s, iw, ih) {
  return s.panels.map((p, i) => {
    const x0 = Math.round(p.imgX * iw), x1 = s.mode === "even" ? Math.round(((i + 1) / s.n) * iw) : Math.round((p.imgX + p.imgW) * iw);
    return { x: x0, y: 0, w: x1 - x0, h: ih };
  });
}

/** Plain summary lines for the result. */
export function summary(s, unit) {
  const u = unit === "cm" ? "cm" : "in", f = (v) => String(r2(v));
  const lines = [`${s.n} panels, each ${f(s.unitW)} × ${f(s.panelH)} ${u}.`, `Width on the wall, gaps included: ${f(s.wallW)} ${u}.`];
  if (s.mode === "window") lines.push(`The gap strips (${f(s.lostPct)}% of the width) are cut out of the image, so lines carry straight across the gaps.`);
  else lines.push("Nothing is cut out of the image; the gaps add to the width on the wall.");
  return lines;
}
