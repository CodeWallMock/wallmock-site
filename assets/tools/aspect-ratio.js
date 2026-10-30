// Aspect ratio calculator: width and height (pixels, inches or cm) -> exact ratio, decimal, the nearest standard print
// ratio and the sizes in that family. Pure functions; the page and its widget use the same code.
export const STANDARD = [
  { id: "1:1", a: 1, b: 1, sizes: "8 × 8, 12 × 12, 20 × 20, 30 × 30 in" },
  { id: "4:5", a: 4, b: 5, sizes: "8 × 10, 16 × 20, 24 × 30, 32 × 40 in" },
  { id: "3:4", a: 3, b: 4, sizes: "6 × 8, 12 × 16, 18 × 24, 30 × 40 in" },
  { id: "5:7", a: 5, b: 7, sizes: "5 × 7, 10 × 14, 20 × 28 in" },
  { id: "11:14", a: 11, b: 14, sizes: "11 × 14, 22 × 28 in" },
  { id: "ISO A (1:√2)", a: 1, b: Math.SQRT2, sizes: "A5, A4, A3, A2, A1, A0" },
  { id: "2:3", a: 2, b: 3, sizes: "4 × 6, 8 × 12, 12 × 18, 16 × 24, 20 × 30, 24 × 36 in" },
  { id: "9:16", a: 9, b: 16, sizes: "phone screens and video, rarely prints" },
  { id: "1:2", a: 1, b: 2, sizes: "10 × 20, 12 × 24, 20 × 40, 30 × 60 in" },
  { id: "1:3", a: 1, b: 3, sizes: "8 × 24, 12 × 36, 20 × 60 in panoramas" },
];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Exact reduced ratio of two positive numbers (decimals allowed up to 3 places). */
export function reduce(w, h) {
  if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) throw new Error("positive numbers only");
  const k = 1000, a = Math.round(w * k), b = Math.round(h * k), g = gcd(a, b);
  return [a / g, b / g];
}

/** Full answer for a width and height: exact ratio, decimal (long ÷ short), orientation, nearest standard and its gap. */
export function analyse(w, h) {
  const [a, b] = reduce(w, h), long = Math.max(w, h), short = Math.min(w, h), dec = long / short;
  const orientation = w === h ? "square" : w > h ? "landscape" : "portrait";
  const ranked = STANDARD.map((s) => ({ ...s, off: Math.abs(dec / (Math.max(s.a, s.b) / Math.min(s.a, s.b)) - 1) })).sort((x, y) => x.off - y.off);
  const best = ranked[0], name = (s) => (orientation === "landscape" && s.a !== s.b && !s.id.startsWith("ISO") ? s.id.split(":").reverse().join(":") : s.id);
  return {
    exact: a > 999 || b > 999 ? null : `${a}:${b}`, decimal: Math.round(dec * 1000) / 1000, orientation,
    nearest: { id: name(best), sizes: best.sizes, offPct: Math.round(best.off * 1000) / 10, exact: best.off < 0.005 },
    next: { id: name(ranked[1]), offPct: Math.round(ranked[1].off * 1000) / 10 },
  };
}

/** A size with the same ratio: give one side, get the other (rounded to 0.01). */
export function scaleTo(w, h, side, value) {
  if (!(value > 0)) throw new Error("positive value");
  return side === "w" ? { w: value, h: Math.round((h / w) * value * 100) / 100 } : { w: Math.round((w / h) * value * 100) / 100, h: value };
}
