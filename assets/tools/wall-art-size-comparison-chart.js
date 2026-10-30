// Browser widget for /tools/wall-art-size-comparison-chart/: draws the chosen art sizes to one true scale over a typical
// piece of furniture, and saves the chart as a PNG made on this device. A diagram, not a room photo.
import { parseSize, layout, sizeLabel, DEFAULT_SIZES, toIn } from "./size-compare.js?v=1";

const $ = (id) => document.getElementById(id);
const unitEl = $("scc-unit"), sizesEl = $("scc-sizes"), furnEl = $("scc-furn"), sum = $("scc-sum"), body = $("scc-rows"), cv = $("scc-canvas"), dl = $("scc-dl");
let last = null;

const para = (text, cls) => { const p = document.createElement("p"); p.textContent = text; if (cls) p.className = cls; return p; };

function read() {
  const unit = unitEl.value === "cm" ? "cm" : "in";
  const raw = String(sizesEl.value).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const sizes = raw.map((t) => parseSize(t, unit)).filter(Boolean);
  return { unit, sizes, bad: raw.length - sizes.length, furn: furnEl.value };
}

function draw(L, unit, canvas, W) {
  const n = L.panels.length, pad = Math.round(W * 0.03), titleH = Math.round(W * 0.1), labelH = Math.round(W * 0.075);
  const panelPx = (W - pad * 2) / n, k = (panelPx * 0.92) / L.panelW, wallPx = L.wallH * k, H = Math.round(titleH + wallPx + labelH + pad);
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d"), font = "ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  x.fillStyle = "#fbfaf7"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#1c1d1b"; x.font = `650 ${Math.round(W * 0.026)}px ${font}`; x.textAlign = "left";
  x.fillText("Art size comparison, drawn to scale", pad, pad + W * 0.026);
  x.fillStyle = "#6b6f6a"; x.font = `400 ${Math.round(W * 0.014)}px ${font}`;
  x.fillText(`Sizes without frame · ${L.furniture.w ? L.furniture.label.replace(/ \(.*\)$/, "") + " (typical size)" : "no furniture"} · a diagram, not a room photo`, pad, pad + W * 0.05);
  const floorY = titleH + wallPx;
  L.panels.forEach((p, i) => {
    const ox = pad + i * panelPx + (panelPx - L.panelW * k) / 2, Y = (yIn) => floorY - yIn * k;
    x.fillStyle = "#efece5"; x.fillRect(ox, titleH, L.panelW * k, wallPx);
    x.fillStyle = "#cfc8bb"; x.fillRect(ox, floorY, L.panelW * k, Math.max(2, W * 0.002));
    if (p.furniture) {
      const f = p.furniture; x.fillStyle = "#8f8a80";
      x.fillRect(ox + f.x * k, Y(f.h * 0.55), f.w * k, f.h * 0.55 * k);
      x.fillRect(ox + f.x * k, Y(f.h), f.w * k, f.h * 0.45 * k * 0.9);
    }
    const a = p.art; x.save(); x.shadowColor = "rgba(0,0,0,.18)"; x.shadowBlur = W * 0.008; x.shadowOffsetY = W * 0.003;
    x.fillStyle = "#ffffff"; x.fillRect(ox + a.x * k, Y(a.y + a.h), a.w * k, a.h * k); x.restore();
    x.strokeStyle = "#2b2c29"; x.lineWidth = Math.max(1.5, W * 0.0015); x.strokeRect(ox + a.x * k, Y(a.y + a.h), a.w * k, a.h * k);
    x.textAlign = "center"; x.fillStyle = "#1c1d1b"; x.font = `600 ${Math.round(W * 0.016)}px ${font}`;
    const cx = pad + i * panelPx + panelPx / 2;
    x.fillText(sizeLabel(p.size, unit), cx, floorY + labelH * 0.45);
    x.fillStyle = "#6b6f6a"; x.font = `400 ${Math.round(W * 0.012)}px ${font}`;
    const other = unit === "in" ? `${Math.round(p.size.w * 2.54)} × ${Math.round(p.size.h * 2.54)} cm` : `${Math.round(toIn(p.size.w, "cm") * 10) / 10} × ${Math.round(toIn(p.size.h, "cm") * 10) / 10} in`;
    x.fillText(other + (p.fit.share ? ` · ${Math.round(p.fit.share * 100)}% of the width` : ""), cx, floorY + labelH * 0.8);
  });
}

function render() {
  const { unit, sizes, bad, furn } = read();
  if (!sizes.length) { sum.replaceChildren(para(`Enter sizes like ${DEFAULT_SIZES[unit][0].replace("x", " x ")}, one per line.`, "summary tool-err")); body.replaceChildren(); dl.disabled = true; return; }
  const L = layout(sizes, unit, furn);
  last = { L, unit };
  sum.replaceChildren(para(`${sizes.length} size${sizes.length > 1 ? "s" : ""} drawn to one scale. Furniture: ${L.furniture.w ? L.furniture.label : "none, bare wall"}.${bad ? ` ${bad} entr${bad > 1 ? "ies" : "y"} skipped: use width x height.` : ""}`, "summary"));
  body.replaceChildren(...L.panels.map((p) => {
    const tr = document.createElement("tr"), th = document.createElement("th"); th.scope = "row"; th.textContent = sizeLabel(p.size, unit);
    const td = document.createElement("td"); td.textContent = p.fit.verdict + (p.tooTall ? " Too tall for a 96 in (244 cm) ceiling at this height." : "");
    tr.append(th, td); return tr;
  }));
  draw(L, unit, cv, Math.min(1200, Math.max(600, cv.parentElement?.clientWidth || 900) * 1.5));
  dl.disabled = false;
}

dl.addEventListener("click", () => {
  if (!last) return;
  const c = document.createElement("canvas"); draw(last.L, last.unit, c, 2400);
  c.toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = "wall-art-size-comparison.png"; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }, "image/png");
});
unitEl.addEventListener("change", () => { sizesEl.value = DEFAULT_SIZES[unitEl.value === "cm" ? "cm" : "in"].join("\n"); render(); });
for (const el of [sizesEl, furnEl]) el.addEventListener("input", render);
furnEl.addEventListener("change", render);
$("scc").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
