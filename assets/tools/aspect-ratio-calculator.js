// Browser widget for /tools/aspect-ratio-calculator/: width and height -> exact ratio, nearest standard print ratio and
// a same-ratio size. The page ships the static answer for 4000 x 6000 px; this recalculates from the form.
import { analyse, scaleTo } from "./aspect-ratio.js?v=1";

const $ = (id) => document.getElementById(id);
const w = $("arc-w"), h = $("arc-h"), unit = $("arc-unit"), sum = $("arc-sum"), body = $("arc-rows"), nw = $("arc-nw"), nout = $("arc-nout");

const row = (a, b) => { const tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td"); th.scope = "row"; th.textContent = a; td.textContent = b; tr.append(th, td); return tr; };

function render() {
  const W = Number(w.value), H = Number(h.value), u = unit.value;
  let a;
  try { a = analyse(W, H); } catch { sum.textContent = "Enter a width and a height above zero."; sum.className = "summary tool-err"; body.replaceChildren(); nout.textContent = ""; return; }
  sum.className = "summary";
  sum.textContent = a.nearest.exact ? `${W} × ${H} ${u} is exactly ${a.nearest.id}.` : `${W} × ${H} ${u} is closest to ${a.nearest.id}, ${a.nearest.offPct}% off.`;
  body.replaceChildren(row("Exact ratio", a.exact ?? "no simple whole-number ratio"), row("Decimal (long ÷ short)", String(a.decimal)), row("Orientation", a.orientation),
    row("Nearest standard ratio", `${a.nearest.id}${a.nearest.exact ? " (exact)" : ` (${a.nearest.offPct}% off)`}`), row("Sizes in that family", a.nearest.sizes), row("Next closest", `${a.next.id} (${a.next.offPct}% off)`));
  const v = Number(nw.value);
  nout.textContent = v > 0 ? (() => { const s = scaleTo(W, H, "w", v), sh = u === "px" ? Math.round(s.h) : s.h; return `Same ratio at ${s.w} ${u} wide: ${s.w} × ${sh} ${u}.`; })() : "";
}
for (const el of [w, h, nw]) el.addEventListener("input", render);
unit.addEventListener("change", render);
$("arc").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
