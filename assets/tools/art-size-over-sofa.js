// Browser widget for /tools/art-size-over-sofa/. The page ships a static first state (an 84 in sofa, 3:2 landscape);
// this redraws the summary and the size table as the form changes. Nothing leaves the browser.
import { artSize, summary, LIMITS, CM_PER_IN } from "./art-size.js?v=1";

const $ = (id) => document.getElementById(id);
const sum = $("asz-sum"), body = $("asz-rows"), w = $("asz-w"), unitSel = $("asz-unit");
let unit = unitSel.value;

const para = (text, cls) => { const p = document.createElement("p"); p.textContent = text; if (cls) p.className = cls; return p; };

function render() {
  let r;
  try { r = artSize({ width: w.value.trim() === "" ? NaN : Number(w.value), unit, spot: $("asz-spot").value, shape: $("asz-shape").value }); }
  catch (e) {
    // Invalid input: say why and clear the old table so no stale sizes are read against new numbers.
    sum.replaceChildren(para(`Check the width: ${e.message}.`, "summary tool-err"));
    body.replaceChildren();
    return;
  }
  sum.replaceChildren(...summary(r).map((l, i) => para(l, i === 0 ? "summary" : "")));
  body.replaceChildren(...r.sizes.map((s) => {
    const tr = document.createElement("tr");
    tr.className = `fit-${s.fit.replace(/ /g, "-")}`;
    const th = document.createElement("th"); th.scope = "row"; th.textContent = s.label;
    tr.append(th, ...[`${s.percent}%`, s.fit].map((t) => { const td = document.createElement("td"); td.textContent = t; return td; }));
    return tr;
  }));
}

function limits() { w.min = String(LIMITS[unit][0]); w.max = String(LIMITS[unit][1]); }

// Switching units converts the typed width (84 in -> 213.4 cm) and keeps it inside the unit's limits.
unitSel.addEventListener("change", () => {
  const to = unitSel.value, v = Number(w.value);
  if (w.value.trim() !== "" && Number.isFinite(v)) {
    const c = to === unit ? v : to === "cm" ? v * CM_PER_IN : v / CM_PER_IN;
    w.value = String(Math.round(c * 10) / 10);
  }
  unit = to;
  limits();
  render();
});
for (const id of ["asz-w", "asz-spot", "asz-shape"]) $(id).addEventListener("input", render);
$("asz").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
const start = () => { unit = unitSel.value; limits(); render(); };
start();
addEventListener("pageshow", start);
