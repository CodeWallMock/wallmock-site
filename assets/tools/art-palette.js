// Art colour palette: pure, deterministic colour quantiser shared by the browser widget and tests/art-palette.test.mjs.
// Method: count the image's pixels in a 5-bit-per-channel histogram (32,768 bins, each keeping the true average colour
// of its pixels), split the colours with median cut into up to k boxes, then refine with k-means (Lloyd's algorithm,
// started from the median-cut boxes, so there is no randomness: the same image always gives the same palette).
// Shares are the fraction of opaque pixels nearest each colour. Transparent pixels (alpha < 128) are ignored.

export const SAMPLE_MAX = 400;

/** Size to downsample to before quantising: the long side at most `max` px, never upscaled. */
export function sampleSize(w, h, max = SAMPLE_MAX) {
  if (!(w > 0 && h > 0)) throw new RangeError("image size must be positive");
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

const hex2 = (v) => Math.round(v).toString(16).padStart(2, "0");
export const toHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
export const toRgb = ({ r, g, b }) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
export function fromHex(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) throw new RangeError(`not a hex colour: ${h}`);
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/** WCAG relative luminance of an sRGB colour (0 black to 1 white). */
export function luminance({ r, g, b }) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** WCAG contrast ratio of two luminances, 1 to 21. */
export const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

// Histogram of opaque pixels: bins with count and colour sums.
function histogram(data) {
  const count = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    count[k]++; sr[k] += r; sg[k] += g; sb[k] += b; total++;
  }
  const bins = [];
  for (let k = 0; k < 32768; k++) if (count[k]) bins.push({ n: count[k], r: sr[k] / count[k], g: sg[k] / count[k], b: sb[k] / count[k] });
  return { bins, total };
}

const CH = ["r", "g", "b"];
function boxStats(box) {
  let n = 0, r = 0, g = 0, b = 0;
  const lo = { r: 255, g: 255, b: 255 }, hi = { r: 0, g: 0, b: 0 };
  for (const p of box) {
    n += p.n; r += p.r * p.n; g += p.g * p.n; b += p.b * p.n;
    for (const c of CH) { if (p[c] < lo[c]) lo[c] = p[c]; if (p[c] > hi[c]) hi[c] = p[c]; }
  }
  const range = Math.max(...CH.map((c) => hi[c] - lo[c]));
  const axis = CH.reduce((a, c) => (hi[c] - lo[c] > hi[a] - lo[a] ? c : a), "r");
  return { n, mean: { r: r / n, g: g / n, b: b / n }, range, axis };
}

// Median cut: split the box with the most pixels × colour range at the pixel median of its widest channel.
function medianCut(bins, k) {
  const boxes = [bins];
  while (boxes.length < k) {
    let best = -1, score = 0;
    boxes.forEach((b, i) => { const s = boxStats(b); const v = s.range > 1e-9 && b.length > 1 ? s.n * s.range : 0; if (v > score) { score = v; best = i; } });
    if (best < 0) break; // nothing left to split: the image has fewer distinct colours than k
    const box = boxes[best], { axis, n } = boxStats(box);
    box.sort((p, q) => p[axis] - q[axis] || p.r - q.r || p.g - q.g || p.b - q.b);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) { acc += box[i].n; if (acc >= n / 2) { cut = i + 1; break; } }
    cut = Math.min(box.length - 1, Math.max(1, cut));
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map((b) => boxStats(b).mean);
}

const dist2 = (p, c) => (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;

/**
 * palette(rgba, width, height, k = 6) -> [{ r, g, b, hex, rgb, share, percent }] sorted by share, largest first.
 * share is 0–1; percent is a whole number and the percents add up to 100. Fewer than k colours come back when the
 * image has fewer distinct colours.
 */
export function palette(data, width, height, k = 6) {
  if (!(width > 0 && height > 0) || !data || data.length < width * height * 4) throw new RangeError("pixel data does not match the size");
  const { bins, total } = histogram(data);
  if (!total) throw new RangeError("the image has no opaque pixels");
  let centres = medianCut(bins, k);
  const owner = new Int32Array(bins.length).fill(-1);
  for (let it = 0; it < 24; it++) {
    let moved = 0;
    for (let i = 0; i < bins.length; i++) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < centres.length; j++) { const d = dist2(bins[i], centres[j]); if (d < bd) { bd = d; bi = j; } }
      if (owner[i] !== bi) { owner[i] = bi; moved++; }
    }
    const acc = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < bins.length; i++) { const a = acc[owner[i]], p = bins[i]; a.n += p.n; a.r += p.r * p.n; a.g += p.g * p.n; a.b += p.b * p.n; }
    centres = acc.map((a, j) => (a.n ? { r: a.r / a.n, g: a.g / a.n, b: a.b / a.n, n: a.n } : { ...centres[j], n: 0 }));
    if (!moved) break;
  }
  const out = centres.filter((c) => c.n > 0).map((c) => {
    const col = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
    return { ...col, hex: toHex(col), rgb: toRgb(col), share: c.n / total };
  });
  out.sort((a, b) => b.share - a.share || luminance(a) - luminance(b));
  // Whole percents that add up to 100 (largest remainder).
  const raw = out.map((c) => c.share * 100), floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((s, v) => s + v, 0);
  raw.map((v, i) => [v - floor[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { floor[i]++; left--; } });
  out.forEach((c, i) => { c.percent = floor[i]; });
  return out;
}

// WallMock's seven frame finishes (data/product-facts.json finishes.list), as approximate swatches sampled from the
// frame faces in /assets/guides/frame-colours-for-wall-art-mockups-1.webp (the frame colours guide's comparison image,
// one painting in every finish): the mean of the top rail's face pixels over 170 px of each frame (black, white, oak,
// walnut: y 16–17/18; espresso, gold, silver: y 215–217). Lit renders, so approximate: used only for a brightness hint.
export const FINISHES = [
  { name: "Black", hex: "#2B2A26" },
  { name: "White", hex: "#E2E1D8" },
  { name: "Natural oak", hex: "#AF9777" },
  { name: "Walnut", hex: "#563E31" },
  { name: "Espresso", hex: "#3F3223" },
  { name: "Gold", hex: "#C9A975" },
  { name: "Silver", hex: "#CBCAC4" },
];

/** The art's overall brightness: share-weighted mean luminance of its palette. */
export const artLuminance = (pal) => pal.reduce((s, c) => s + c.share * luminance(c), 0) / pal.reduce((s, c) => s + c.share, 0);

/**
 * Frame finishes by luminance contrast with the art, highest first: [{ name, hex, ratio }]. A suggestion only: it uses
 * brightness, not hue, style or the room.
 */
export function finishContrast(pal) {
  const L = artLuminance(pal);
  return FINISHES.map((f) => ({ ...f, ratio: Math.round(contrast(L, luminance(fromHex(f.hex))) * 10) / 10 }))
    .sort((a, b) => b.ratio - a.ratio || FINISHES.findIndex((x) => x.name === a.name) - FINISHES.findIndex((x) => x.name === b.name));
}

/** One plain sentence for the hint. */
export function finishHint(pal) {
  const list = finishContrast(pal), [a, b] = list, low = list[list.length - 1];
  const tone = artLuminance(pal) > 0.35 ? "light" : artLuminance(pal) < 0.12 ? "dark" : "mid-toned";
  return `This art is ${tone} overall. By brightness alone, ${a.name.toLowerCase()} (${a.ratio}:1) and ${b.name.toLowerCase()} (${b.ratio}:1) frames would stand out most against it, and ${low.name.toLowerCase()} (${low.ratio}:1) would blend in most.`;
}
