// Browser widget for /tools/frame-mat-calculator/. The page ships a static first state (8 × 10 in print, 1.5 in
// borders); this recalculates as the form changes. Switching units converts what is typed. Nothing leaves the browser.
import { matPlan, resultRows, stockText, convert } from "./frame-mat.js?v=1";

const $ = (id) => document.getElementById(id);
const LEN = ["fmc-pw", "fmc-ph", "fmc-border", "fmc-face"];
const num = (id) => { const v = $(id).value.trim(); return v === "" ? undefined : Number(v); };
let unit = $("fmc-unit").value;

// Unit labels and steps follow the unit in use.
function labels() {
  for (const el of document.querySelectorAll("#fmc [data-unit]")) el.textContent = unit;
  for (const id of ["fmc-border", "fmc-face"]) $(id).step = unit === "in" ? "0.125" : "0.1";
}

function render() {
  const table = $("fmc-table"), stock = $("fmc-stock");
  let p;
  try { p = matPlan({ unit, printWidth: num("fmc-pw"), printHeight: num("fmc-ph"), border: num("fmc-border"), bottom: $("fmc-bottom").value, face: num("fmc-face") ?? 0 }); }
  catch (e) {
    // Invalid input: say why and clear the old answer so no stale sizes are read.
    table.replaceChildren();
    stock.textContent = `Check the numbers: ${e.message}.`;
    stock.className = "summary tool-err";
    return;
  }
  const t = document.createElement("table"); t.className = "res";
  const tb = document.createElement("tbody");
  for (const [a, b] of resultRows(p)) {
    const tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td");
    th.scope = "row"; th.textContent = a; td.textContent = b; tr.append(th, td); tb.append(tr);
  }
  t.append(tb); table.replaceChildren(t);
  stock.textContent = stockText(p);
  stock.className = "summary";
}

$("fmc-unit").addEventListener("change", () => {
  const to = $("fmc-unit").value;
  for (const id of LEN) {
    const v = num(id);
    if (v === undefined || !Number.isFinite(v)) continue;
    const c = convert(v, unit, to);
    $(id).value = String(to === "in" ? Math.round(c * 1000) / 1000 : Math.round(c * 10) / 10);
  }
  unit = to;
  labels();
  render();
});
$("fmc").addEventListener("input", (e) => { if (e.target.id !== "fmc-unit") render(); });
$("fmc").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the typed values (and unit) after the load event, without input events, while the page
// still shows its static answer for the defaults. Recalculate from the form now and again on pageshow, which fires after
// that restore (and on a back/forward-cache return).
const start = () => { unit = $("fmc-unit").value; labels(); render(); };
start();
addEventListener("pageshow", start);
