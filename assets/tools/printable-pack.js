// Printable size pack: one artwork file -> one full-resolution crop per standard printable ratio (2:3, 3:4, 4:5, 11:14
// and ISO A), each the largest crop of that shape in the image's own orientation, with an adjustable position along the
// axis that is cropped. Built on the crop-to-print-size maths (crop-print.mjs). Everything happens in the browser.
import { ratioOf, maxCrop, shape } from "./crop-print.js?v=1";

export const PACK = ["2:3", "3:4", "4:5", "11:14", "iso"];
export const PACK_NAMES = { "2:3": "2x3", "3:4": "3x4", "4:5": "4x5", "11:14": "11x14", iso: "ISO-A" };

/** Largest crop of each pack ratio for a W x H image; `pos` 0..1 slides it along the cropped axis (0.5 = centred). */
export function packCrops(w, h, pos = 0.5) {
  if (!(Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0)) throw new Error("bad size");
  const p = Math.min(1, Math.max(0, Number(pos)));
  const orient = w > h ? "landscape" : "portrait";
  return PACK.map((id) => {
    const r = ratioOf(id, orient), c = maxCrop(w, h, r);
    const x = Math.round((w - c.w) * p), y = Math.round((h - c.h) * p);
    return { id, orient, x, y, w: c.w, h: c.h, kept: (c.w * c.h) / (w * h), largest: largestPrint(id, c.w, c.h) };
  });
}

/** The largest standard size of the shape that the crop prints at 300 DPI or more (null if none). */
export function largestPrint(id, cw, ch, dpi = 300) {
  const s = shape(id), long = Math.max(cw, ch), short = Math.min(cw, ch);
  const ok = s.sizes.filter(([a, b]) => { const toIn = s.cm ? 1 / 2.54 : 1; return short / (a * toIn) >= dpi - 0.5 && long / (b * toIn) >= dpi - 0.5; });
  const best = ok.at(-1);
  return best ? (best[2] ?? `${best[0]} × ${best[1]}${s.cm ? " cm" : " in"}`) : null;
}

/** File name for one crop: "<base>-<ratio>.<ext>", base from the original name, kept short and safe. */
export function packFileName(original, id, type = "png") {
  const base = String(original || "artwork").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artwork";
  return `${base}-${PACK_NAMES[id]}.${type === "jpeg" ? "jpg" : "png"}`;
}
