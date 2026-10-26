// Browser widget for /tools/gallery-wall-layout-planner/. The page ships a static first state (row of 3 over an
// 84 in sofa); this redraws the diagram, summary and table as the form changes. Nothing leaves the browser.
import { plan, describe, svg, rows, shareText, convert, GUIDE, LAYOUTS } from "./gallery-layout.js?v=1";

const $ = (id) => document.getElementById(id);
const form = $("gwl"), sum = $("gwl-sum"), fit = $("gwl-fit"), pic = $("gwl-svg"), body = $("gwl-rows");
const LEN = ["gwl-fw", "gwl-ft", "gwl-pw", "gwl-ph", "gwl-gap", "gwl-centre", "gwl-hook"];
const num = (id) => { const v = $(id).value.trim(); return v === "" ? undefined : Number(v); };
let unit = $("gwl-unit").value;

function read() {
  return {
    unit, layout: $("gwl-layout").value, count: num("gwl-count"),
    furnitureWidth: num("gwl-fw") ?? 0, furnitureTop: num("gwl-ft") ?? 0,
    pieceWidth: num("gwl-pw"), pieceHeight: num("gwl-ph"), gap: num("gwl-gap") ?? 0,
    centre: num("gwl-centre"), hookDrop: num("gwl-hook") ?? 0,
  };
}

function render() {
  let p;
  try { p = plan(read()); }
  catch (e) {
    // Invalid input: say why, grey out the old diagram and clear the old rows so no stale numbers are read.
    sum.textContent = `Check the numbers: ${e.message}.`; fit.textContent = "";
    pic.style.opacity = "0.25"; pic.setAttribute("aria-hidden", "true");
    body.replaceChildren();
    return;
  }
  pic.style.opacity = ""; pic.removeAttribute("aria-hidden");
  sum.textContent = describe(p);
  fit.textContent = p.share ? `Group width ${p.width} ${p.unit} is ${p.share.percent}% of the furniture: ${shareText(p.share.status)}. Two-thirds would be about ${p.share.idealWidth} ${p.unit}.` : "Add the furniture width to check the two-thirds guideline.";
  pic.innerHTML = svg(p); // svg() builds markup from numbers only
  body.replaceChildren(...rows(p).map((cells) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.scope = "row"; th.textContent = cells[0];
    tr.append(th, ...cells.slice(1).map((t) => { const td = document.createElement("td"); td.textContent = t; return td; }));
    return tr;
  }));
}

// Switching units converts what is typed, and swaps the defaults: eye-level centre 57 in <-> 145 cm, gap 3 in <-> 8 cm.
$("gwl-unit").addEventListener("change", () => {
  const to = $("gwl-unit").value;
  for (const id of LEN) {
    const v = num(id);
    if (v === undefined) continue;
    const c = convert(v, unit, to);
    const key = id === "gwl-centre" ? "centre" : id === "gwl-gap" ? "gap" : null;
    $(id).value = key && v === GUIDE[unit][key] ? GUIDE[to][key] : Math.round(c * 10) / 10;
  }
  for (const el of document.querySelectorAll("[data-unit]")) el.textContent = to;
  unit = to;
  render();
});

// A trio is always 3 pieces; grids cap the count.
$("gwl-layout").addEventListener("change", () => {
  const l = $("gwl-layout").value, c = $("gwl-count");
  if (l === "trio") c.value = 3;
  else if (l.startsWith("grid")) c.value = LAYOUTS[l].max; // a full grid; lower the count for a short last row
  render();
});
form.addEventListener("input", (e) => { if (e.target.id !== "gwl-unit" && e.target.id !== "gwl-layout") render(); });
form.addEventListener("submit", (e) => e.preventDefault());
