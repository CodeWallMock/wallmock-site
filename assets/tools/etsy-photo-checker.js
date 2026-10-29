// Browser widget for /tools/etsy-photo-checker/. The page ships a static first state (a typed 3000 × 2250 photo); this
// rechecks typed sizes and checks chosen files. Files are decoded locally only to read their size and draw a small
// preview with the square thumbnail crop; nothing is sent anywhere. File names are shown with textContent only.
import { checkPhoto, verdict, squareCrop } from "./etsy-photo.js?v=1";

const $ = (id) => document.getElementById(id);
const MAX = 20, PREVIEW = 480, ICON = { ok: "✓", warn: "!", bad: "×", note: "i" };

function list(r) {
  const ul = document.createElement("ul");
  ul.className = "status-list";
  for (const x of r.rows) {
    const li = document.createElement("li"); li.className = `s-${x.status}`;
    const ico = document.createElement("span"); ico.className = "ico"; ico.setAttribute("aria-hidden", "true"); ico.textContent = ICON[x.status];
    const t = document.createElement("span"), b = document.createElement("strong");
    b.textContent = `${x.label}:`; t.append(b, ` ${x.text}.`);
    li.append(ico, t); ul.append(li);
  }
  return ul;
}

function typed() {
  const w = Number($("epc-w").value), h = Number($("epc-h").value);
  try {
    const r = checkPhoto({ width: Math.round(w), height: Math.round(h) });
    $("epc-sum").textContent = `${r.width} × ${r.height} px: ${verdict(r)}`;
    $("epc-sum").className = "summary";
    $("epc-list").replaceChildren(list(r));
  } catch {
    $("epc-sum").textContent = "Enter a width and height in whole pixels.";
    $("epc-sum").className = "summary tool-err";
    $("epc-list").replaceChildren();
  }
}

async function decode(f) {
  if ("createImageBitmap" in window) { try { return await createImageBitmap(f); } catch {} }
  return new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { ok(im); URL.revokeObjectURL(u); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("unreadable")); }; im.src = u; });
}

function preview(img, w, h) {
  const c = document.createElement("canvas"), k = Math.min(1, PREVIEW / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, c.width, c.height);
  const sq = squareCrop(w, h);
  if (sq.keeps < 100) {
    x.fillStyle = "rgba(24,43,48,.45)"; // shade what a square thumbnail cuts off
    if (w > h) { x.fillRect(0, 0, sq.x * k, c.height); x.fillRect((sq.x + sq.size) * k, 0, c.width - (sq.x + sq.size) * k, c.height); }
    else { x.fillRect(0, 0, c.width, sq.y * k); x.fillRect(0, (sq.y + sq.size) * k, c.width, c.height - (sq.y + sq.size) * k); }
  }
  x.setLineDash([8, 6]); x.lineWidth = 3; x.strokeStyle = "#ffffff";
  x.strokeRect(sq.x * k + 1.5, sq.y * k + 1.5, sq.size * k - 3, sq.size * k - 3);
  return c;
}

async function card(f) {
  const el = document.createElement("article"); el.className = "photo-card";
  const fig = document.createElement("div"), text = document.createElement("div");
  const h = document.createElement("h3"); h.textContent = f.name || "Image";
  text.append(h);
  el.append(fig, text);
  try {
    const img = await decode(f);
    const w = img.width ?? img.naturalWidth, hh = img.height ?? img.naturalHeight;
    const r = checkPhoto({ width: w, height: hh, bytes: f.size, type: f.type, name: f.name });
    const c = preview(img, w, hh);
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", `Preview of ${f.name || "the image"}; the dashed square is what a square thumbnail keeps (${r.crop.keeps}%)`);
    img.close?.();
    fig.append(c);
    const v = document.createElement("p"); v.className = "summary"; v.textContent = verdict(r);
    text.append(v, list(r));
  } catch {
    const p = document.createElement("p"); p.className = "tool-err";
    p.textContent = "This browser can't open this image, so its size is unknown. Etsy lists .jpg, .gif, .png, .svg and .heic; save it as a JPEG or PNG, or type its size above.";
    text.append(p);
  }
  return el;
}

$("epc-files").addEventListener("change", async () => {
  const files = [...($("epc-files").files ?? [])];
  const out = $("epc-cards");
  out.replaceChildren();
  if (!files.length) return;
  if (files.length > MAX) { const p = document.createElement("p"); p.textContent = `Showing the first ${MAX} of ${files.length} images.`; out.append(p); }
  for (const f of files.slice(0, MAX)) out.append(await card(f));
});
for (const id of ["epc-w", "epc-h"]) $(id).addEventListener("input", typed);
$("epc").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
typed();
addEventListener("pageshow", typed);
