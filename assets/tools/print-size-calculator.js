// Browser widget for /tools/print-size-calculator/. The page ships a static first state (4800 × 7200 px); this
// recalculates as the size changes. A chosen file is decoded locally only to read its pixel size; nothing is sent.
import { printSizes, summary } from "./print-size.js?v=1";

const $ = (id) => document.getElementById(id);
const w = $("psc-w"), h = $("psc-h"), sum = $("psc-sum"), body = $("psc-rows"), file = $("psc-file");

const para = (text, cls) => { const p = document.createElement("p"); p.textContent = text; if (cls) p.className = cls; return p; };
function clear(msg) { sum.replaceChildren(para(msg, "summary tool-err")); body.replaceChildren(); }

function render() {
  let r;
  try { r = printSizes(Math.round(Number(w.value)), Math.round(Number(h.value))); }
  catch { clear("Enter a width and height in pixels."); return; }
  sum.replaceChildren(...summary(r).map((l, i) => para(l, i === 0 ? "summary" : "")));
  body.replaceChildren(...r.sizes.map((s) => {
    const tr = document.createElement("tr"); tr.className = `q-${s.band}`;
    const th = document.createElement("th"); th.scope = "row"; th.textContent = s.label;
    tr.append(th, ...[String(s.dpi), s.band].map((t) => { const td = document.createElement("td"); td.textContent = t; return td; }));
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
$("psc").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
render();
addEventListener("pageshow", render);
