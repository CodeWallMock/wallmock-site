// Etsy listing photo checker: pure logic shared by the browser widget, the page's static first state and
// tests/etsy-photo.test.mjs. Every threshold comes from Etsy's own help article "Requirements and Best Practices for
// Images in Your Etsy Shop" (read 2026-10-28; see ETSY.source):
//   - "We recommend your listing photos have a width and height of at least 2000 pixels or more."
//   - the first photo should be at least 635 px wide and tall, "to avoid showing up lower in searches";
//   - "The first photo in a listing should be horizontal (landscape) or square";
//   - thumbnails are cropped (Etsy: leave "enough of a border that they can be cropped to square");
//   - file types .jpg, .gif, .png, .svg or .heic;
//   - "Images larger than 1MB in file size may not finish uploading, especially on a slower internet connection."
//
// SEO-2 bugs fixed here (SEO2-CONTENT-REVIEW-1 S5): 1 MB was a pass/fail line with no source (now Etsy's own upload
// note, never a failure); a square image passed "without extra cropping" while a 4:3 crop box cut it and 3:2 got a
// warning with no source (now the only crop drawn is Etsy's square thumbnail, and the shape check is Etsy's
// landscape-or-square rule).

export const ETSY = {
  recommended: 2000,
  firstPhotoMin: 635,
  slowUploadBytes: 1_000_000,
  types: ["jpg", "gif", "png", "svg", "heic"],
  source: "https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop",
  checked: "2026-10-28",
};

const MIME = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg", "image/gif": "gif", "image/png": "png", "image/svg+xml": "svg", "image/heic": "heic", "image/heif": "heic", "image/webp": "webp", "image/tiff": "tiff", "image/avif": "avif", "image/bmp": "bmp" };
const EXT = { jpeg: "jpg", jpg: "jpg", jpe: "jpg", gif: "gif", png: "png", svg: "svg", heic: "heic", heif: "heic", webp: "webp", tif: "tiff", tiff: "tiff", avif: "avif", bmp: "bmp" };

/** File type from the MIME type, falling back to the extension (browsers often leave HEIC types blank). */
export function fileType(mime = "", name = "") {
  const m = MIME[String(mime).toLowerCase()];
  if (m) return m;
  const ext = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && EXT[ext]) || (ext ?? "unknown");
}

const COMMON = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 9], [2, 1], [3, 1]];

/** Shape name in the image's own orientation: "4:3 landscape", "square", "2:3 portrait", or "1.62:1 landscape". */
export function shapeName(w, h) {
  if (w === h) return "square";
  const long = Math.max(w, h), short = Math.min(w, h), r = long / short;
  const hit = COMMON.find(([a, b]) => Math.abs(a / b - r) / r < 0.01);
  const land = w > h;
  if (hit) return land ? `${hit[0]}:${hit[1]} landscape` : `${hit[1]}:${hit[0]} portrait`;
  return land ? `${r.toFixed(2)}:1 landscape` : `1:${r.toFixed(2)} portrait`;
}

export const megabytes = (bytes) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/** The centred square an Etsy thumbnail keeps, in image pixels, and the share of the long side it keeps. */
export function squareCrop(w, h) {
  const s = Math.min(w, h);
  return { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), size: s, keeps: Math.round((s / Math.max(w, h)) * 100) };
}

/**
 * checkPhoto({ width, height, bytes?, type?, name? }) -> { shape, crop, rows: [{ id, status, label, text }] }
 * status: "ok" | "warn" (Etsy recommends otherwise) | "bad" (Etsy says it may rank lower) | "note" (worth knowing).
 * bytes and type are optional so a typed-in size can be checked without a file.
 */
export function checkPhoto({ width, height, bytes, type, name }) {
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 100000 && height <= 100000)) throw new RangeError("width and height must be whole pixels from 1 to 100,000");
  const short = Math.min(width, height);
  const shape = shapeName(width, height);
  const crop = squareCrop(width, height);
  const rows = [];

  if (short >= ETSY.recommended) rows.push({ id: "size", status: "ok", label: `${width} × ${height} px`, text: `at least ${ETSY.recommended} px on both sides, as Etsy recommends` });
  else if (short >= ETSY.firstPhotoMin) rows.push({ id: "size", status: "warn", label: `${width} × ${height} px`, text: `Etsy recommends at least ${ETSY.recommended} px on both sides so buyers can zoom in; this one is ${short} px on its short side` });
  else rows.push({ id: "size", status: "bad", label: `${width} × ${height} px`, text: `under ${ETSY.firstPhotoMin} px on its short side: Etsy says a first photo this small may show up lower in searches` });

  if (width >= height) rows.push({ id: "shape", status: "ok", label: `Shape: ${shape}`, text: "Etsy asks for a horizontal (landscape) or square first photo" });
  else rows.push({ id: "shape", status: "warn", label: `Shape: ${shape}`, text: "Etsy asks for a horizontal (landscape) or square first photo; a vertical one loses more when thumbnails are cropped. Fine for later photos" });

  rows.push(width === height
    ? { id: "crop", status: "ok", label: "Square thumbnail: nothing cut", text: "a square photo is already the shape of a square thumbnail" }
    : { id: "crop", status: "note", label: `Square thumbnail keeps the middle ${crop.keeps}%`, text: "keep the artwork inside the dashed square so it stays whole when Etsy crops the thumbnail" });

  if (type !== undefined || name !== undefined) {
    const t = fileType(type, name);
    if (ETSY.types.includes(t)) rows.push({ id: "type", status: "ok", label: `File type: ${t.toUpperCase()}`, text: "one of the types Etsy lists (.jpg, .gif, .png, .svg, .heic)" });
    else rows.push({ id: "type", status: "warn", label: `File type: ${t.toUpperCase()}`, text: "not in Etsy's list (.jpg, .gif, .png, .svg, .heic): save it as a JPEG or PNG" });
  }
  if (Number.isFinite(bytes) && bytes >= 0) {
    if (bytes <= ETSY.slowUploadBytes) rows.push({ id: "bytes", status: "ok", label: `File size: ${megabytes(bytes)}`, text: "1 MB or less" });
    else rows.push({ id: "bytes", status: "note", label: `File size: ${megabytes(bytes)}`, text: "over 1 MB: Etsy notes that files this size may not finish uploading on a slow connection. On a fast one it is usually fine" });
  }
  return { width, height, shape, crop, rows };
}

/** One-line verdict for a checked photo. */
export function verdict(r) {
  if (r.rows.some((x) => x.status === "bad")) return "Not ready as a first photo.";
  if (r.rows.some((x) => x.status === "warn")) return "Usable, with a change Etsy recommends.";
  return "Ready as a first photo.";
}
