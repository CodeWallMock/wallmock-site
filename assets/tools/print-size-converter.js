// Browser widget for /tools/print-size-converter/: a width and height in inches, cm or pixels -> all three at the chosen DPI,
// plus the common sizes table at that DPI. The page ships the static answer for 8 x 10 in at 300 DPI.
import { convertSize, table } from "./print-convert.js?v=1";

const $ = (id) => document.getElementById(id);
const w = $("pcv-w"), h = $("pcv-h"), unit = $("pcv-unit"), dpi = $("pcv-dpi"), sum = $("pcv-sum"), body = $("pcv-rows"), tbody = $("pcv-table");

const cells = (tag, ...t) => { const tr = document.createElement("tr"); t.forEach((v, i) => { const c = document.createElement(i === 0 ? "th" : tag); if (i === 0) c.scope = "row"; c.textContent = v; tr.append(c); }); return tr; };

function render() {
  const d = Number(dpi.value) || 300;
  let s;
  try { s = convertSize(Number(w.value), Number(h.value), unit.value, d); }
  catch { sum.textContent = "Enter a width and a height above zero."; sum.className = "summary tool-err"; body.replaceChildren(); return; }
  sum.className = "summary";
  sum.textContent = `${s.w.in} × ${s.h.in} in = ${s.w.cm} × ${s.h.cm} cm = ${s.w.px} × ${s.h.px} px at ${d} DPI.`;
  body.replaceChildren(cells("td", "Inches", `${s.w.in} × ${s.h.in}`), cells("td", "Centimetres", `${s.w.cm} × ${s.h.cm}`), cells("td", `Pixels at ${d} DPI`, `${s.w.px} × ${s.h.px} (${Math.round(s.w.px * s.h.px / 1e5) / 10} MP)`));
  tbody.replaceChildren(...table(d).map((r) => cells("td", r.label, r.cm, r.px, String(r.mp))));
}
for (const el of [w, h]) el.addEventListener("input", render);
for (const el of [unit, dpi]) el.addEventListener("change", render);
$("pcv").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
