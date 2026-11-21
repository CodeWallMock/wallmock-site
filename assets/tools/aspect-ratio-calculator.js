// Browser widget for /tools/aspect-ratio-calculator/: width and height -> exact ratio, nearest standard print ratio and
// a same-ratio size. The page ships the static answer for 4000 x 6000 px; this recalculates from the form.
// seo-14: the "same ratio at this width" default is a real size for the unit (2000 px, 16 in, 40 cm) and follows a unit change
// until the visitor types their own width; the Try link under the result names the ratio just calculated.
import { analyse, scaleTo } from "./aspect-ratio.js?v=1";

const $ = (id) => document.getElementById(id);
const w = $("arc-w"), h = $("arc-h"), unit = $("arc-unit"), sum = $("arc-sum"), body = $("arc-rows"), nw = $("arc-nw"), nout = $("arc-nout"), bridge = $("arc-bridge");
const WIDTH_DEFAULT = { px: "2000", in: "16", cm: "40" };
let lastUnit = unit.value;

const row = (a, b) => { const tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td"); th.scope = "row"; th.textContent = a; td.textContent = b; tr.append(th, td); return tr; };

function render() {
  const W = Number(w.value), H = Number(h.value), u = unit.value;
  let a;
  try { a = analyse(W, H); } catch { sum.textContent = "Enter a width and a height above zero."; sum.className = "summary tool-err"; body.replaceChildren(); nout.textContent = ""; if (bridge) bridge.textContent = "See this ratio framed on a wall: free preview"; return; }
  if (bridge) bridge.textContent = `Your file is ${a.nearest.exact ? a.nearest.id : a.exact ?? `close to ${a.nearest.id}`}. See it on a wall in 8 rooms, free.`;
  sum.className = "summary";
  sum.textContent = a.nearest.exact ? `${W} × ${H} ${u} is exactly ${a.nearest.id}.` : `${W} × ${H} ${u} is closest to ${a.nearest.id}, ${a.nearest.offPct}% off.`;
  body.replaceChildren(row("Exact ratio", a.exact ?? "no simple whole-number ratio"), row("Decimal (long ÷ short)", String(a.decimal)), row("Orientation", a.orientation),
    row("Nearest standard ratio", `${a.nearest.id}${a.nearest.exact ? " (exact)" : ` (${a.nearest.offPct}% off)`}`), row("Sizes in that family", a.nearest.sizes), row("Next closest", `${a.next.id} (${a.next.offPct}% off)`));
  const v = Number(nw.value);
  nout.textContent = v > 0 ? (() => { const s = scaleTo(W, H, "w", v), sh = u === "px" ? Math.round(s.h) : s.h; return `Same ratio at ${s.w} ${u} wide: ${s.w} × ${sh} ${u}.`; })() : "";
}
for (const el of [w, h, nw]) el.addEventListener("input", render);
unit.addEventListener("change", () => { if (nw.value === WIDTH_DEFAULT[lastUnit]) nw.value = WIDTH_DEFAULT[unit.value]; lastUnit = unit.value; render(); });
$("arc").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
