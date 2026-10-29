// Browser widget for /tools/print-resolution-checker/. The page ships a static first state (4000 × 6000); this
// enhances it. Files are read locally with createImageBitmap/Image only to get their size; nothing is sent anywhere.
import { report } from "./print-resolution.js?v=1";

const $ = (id) => document.getElementById(id);
const w = $("prc-w"), h = $("prc-h"), file = $("prc-file"), rows = $("prc-rows"), sum = $("prc-sum");
const n = (v) => v.toLocaleString("en-US");

// Invalid input: say why and clear the old table, so no stale sizes are read against new numbers.
function clear(msg) { sum.textContent = msg; rows.replaceChildren(); }

function render() {
  const pw = Math.round(+w.value), ph = Math.round(+h.value);
  if (!(pw > 0 && ph > 0 && pw <= 100000 && ph <= 100000)) { clear("Enter a width and height in pixels."); return; }
  const r = report(pw, ph);
  sum.textContent = `${n(pw)} × ${n(ph)} px, ${r.ratio} ${r.orientation}. Largest at 300 DPI: ${r.max300.in.w} × ${r.max300.in.h} in (${r.max300.cm.w} × ${r.max300.cm.h} cm).`;
  rows.replaceChildren(...r.sizes.map((s) => {
    const tr = document.createElement("tr");
    tr.className = `q-${s.band}`;
    const th = document.createElement("th"); th.scope = "row"; th.textContent = s.label;
    tr.append(th, ...[String(s.dpi), s.band, s.crop ? `${s.crop}%` : "none"].map((t) => { const td = document.createElement("td"); td.textContent = t; return td; }));
    return tr;
  }));
}

async function sizeOf(f) {
  if ("createImageBitmap" in window) { try { const b = await createImageBitmap(f); const s = [b.width, b.height]; b.close?.(); return s; } catch {} }
  return new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok([im.naturalWidth, im.naturalHeight]); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("unreadable")); }; im.src = u; });
}

file.addEventListener("change", async () => {
  const f = file.files?.[0];
  if (!f) return;
  try { const [pw, ph] = await sizeOf(f); w.value = pw; h.value = ph; render(); }
  catch { clear("That file couldn't be read as an image. Try a JPEG, PNG or WebP, or type the size."); }
});
for (const el of [w, h]) el.addEventListener("input", render);
$("prc").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
render();
addEventListener("pageshow", render);
