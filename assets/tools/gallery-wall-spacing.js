// Browser widget for /tools/gallery-wall-spacing/. The page ships a static first state (a trio of 16 × 20 in frames
// over an 84 in sofa); this recalculates as the form changes. Switching units converts what is typed (the 3 in default
// gap becomes 8 cm, the guideline value). Nothing leaves the browser.
import { spacing, summary, rows, convert, GUIDE } from "./gallery-spacing.js?v=1";

const $ = (id) => document.getElementById(id);
const LEN = ["gws-width", "gws-top", "gws-ceiling", "gws-pw", "gws-ph", "gws-gap", "gws-hook"];
const num = (id) => { const v = $(id).value.trim(); return v === "" ? undefined : Number(v); };
const sum = $("gws-sum"), body = $("gws-rows");
let unit = $("gws-unit").value;

const para = (text, cls) => { const p = document.createElement("p"); p.textContent = text; if (cls) p.className = cls; return p; };

function render() {
  const below = $("gws-below").value;
  $("gws-top").disabled = below === "wall"; // an open wall has no furniture top
  let r;
  try {
    r = spacing({
      unit, set: $("gws-set").value, below, width: num("gws-width"), furnitureTop: num("gws-top"),
      ceiling: num("gws-ceiling") ?? 0, pieceWidth: num("gws-pw"), pieceHeight: num("gws-ph"), gap: num("gws-gap"), hookDrop: num("gws-hook") ?? 0,
    });
  } catch (e) {
    // Invalid input: say why and clear the old rows so no stale positions are read.
    sum.replaceChildren(para(`Check the numbers: ${e.message}.`, "summary tool-err"));
    body.replaceChildren();
    return;
  }
  sum.replaceChildren(...summary(r).map((l, i) => para(l, i === 0 ? "summary" : "")));
  body.replaceChildren(...rows(r).map((cells) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.scope = "row"; th.textContent = cells[0];
    tr.append(th, ...cells.slice(1).map((t) => { const td = document.createElement("td"); td.textContent = t; return td; }));
    return tr;
  }));
}

$("gws-unit").addEventListener("change", () => {
  const to = $("gws-unit").value;
  for (const id of LEN) {
    const v = num(id);
    if (v === undefined || !Number.isFinite(v)) continue;
    $(id).value = id === "gws-gap" && v === GUIDE[unit].gap ? String(GUIDE[to].gap) : String(Math.round(convert(v, unit, to) * 10) / 10);
  }
  for (const el of document.querySelectorAll("#gws [data-unit]")) el.textContent = to;
  unit = to;
  render();
});
$("gws").addEventListener("input", (e) => { if (e.target.id !== "gws-unit") render(); });
$("gws").addEventListener("submit", (e) => e.preventDefault());
