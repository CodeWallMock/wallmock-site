// Browser widget for /tools/frame-size-chart/. The page ships the full chart and a static first answer (8 × 10 in);
// this answers "which frame fits my print?" as the form changes. Switching units converts what is typed.
import { finderLines, CM_PER_IN } from "./frame-sizes.js?v=1";

const $ = (id) => document.getElementById(id);
const out = $("fsc-out");
let unit = $("fsc-unit").value;

function render() {
  const w = Number($("fsc-w").value), h = Number($("fsc-h").value);
  if (!($("fsc-w").value.trim() && $("fsc-h").value.trim() && w > 0 && h > 0 && w < 10000 && h < 10000)) {
    const li = document.createElement("li"); li.className = "tool-err"; li.textContent = "Enter the print's width and height.";
    out.replaceChildren(li);
    return;
  }
  out.replaceChildren(...finderLines(w, h, unit).map((t) => { const li = document.createElement("li"); li.textContent = t; return li; }));
}

$("fsc-unit").addEventListener("change", () => {
  const to = $("fsc-unit").value;
  for (const id of ["fsc-w", "fsc-h"]) {
    const v = Number($(id).value);
    if ($(id).value.trim() === "" || !Number.isFinite(v) || to === unit) continue;
    $(id).value = String(Math.round((to === "cm" ? v * CM_PER_IN : v / CM_PER_IN) * 10) / 10);
  }
  unit = to;
  render();
});
for (const id of ["fsc-w", "fsc-h"]) $(id).addEventListener("input", render);
$("fsc").addEventListener("submit", (e) => e.preventDefault());
