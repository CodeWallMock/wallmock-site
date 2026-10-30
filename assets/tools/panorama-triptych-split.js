// Browser widget for /tools/panorama-triptych-split/: split one wide artwork into 2 or 3 panels with gaps, show the panel
// sizes and positions to scale, and optionally cut an image into the panels (one ZIP, made in this browser).
import { split, pixelBoxes, summary } from "./panel-split.js?v=1";
import { zipStore } from "./zip-store.js?v=1";

const $ = (id) => document.getElementById(id);
const W = $("pts-w"), H = $("pts-h"), unit = $("pts-unit"), n = $("pts-n"), gap = $("pts-gap"), mode = $("pts-mode"), sum = $("pts-sum"), body = $("pts-rows"), svg = $("pts-svg"), file = $("pts-file"), dl = $("pts-dl"), err = $("pts-err");
const S = { img: null, name: "panorama" };
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

function current() { return split({ width: Number(W.value), height: Number(H.value), panels: Number(n.value), gap: Number(gap.value), mode: mode.value }); }

function render() {
  let s;
  try { s = current(); } catch (e) { sum.replaceChildren(Object.assign(document.createElement("p"), { className: "summary tool-err", textContent: e.message === "gaps wider than the artwork" ? "The gaps are wider than the artwork. Make the gap smaller." : "Enter a width, a height and a gap." })); body.replaceChildren(); svg.replaceChildren(); dl.disabled = true; return; }
  const u = unit.value === "cm" ? "cm" : "in";
  const lines = summary(s, u);
  if (S.img) {
    const iw = S.img.width, ih = S.img.height, ir = iw / ih, ar = Number(W.value) / Number(H.value);
    if (Math.abs(ir / ar - 1) > 0.02) lines.push(`Your image is ${iw} × ${ih} px, a different shape from ${W.value} × ${H.value} ${u}. Panels are cut across its full height, so set the artwork size to the image's shape (${Math.round(ir * 100) / 100}:1) before you print.`);
  }
  sum.replaceChildren(...lines.map((t, i) => Object.assign(document.createElement("p"), { className: i ? (i === 3 ? "tool-err" : "") : "summary", textContent: t })));
  body.replaceChildren(...s.panels.map((p) => { const tr = document.createElement("tr"); for (const t of [`Panel ${p.i + 1}`, `${p.w} × ${p.h} ${u}`, `${p.x} ${u} from the left`]) { const td = document.createElement("td"); td.textContent = t; tr.append(td); } return tr; }));
  const vbW = s.wallW, vbH = s.panelH;
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`); svg.replaceChildren(el("rect", { x: 0, y: 0, width: vbW, height: vbH, fill: "#efece5" }));
  for (const p of s.panels) svg.append(el("rect", { x: p.x, y: 0, width: p.w, height: p.h, fill: "#fff", stroke: "#2b2c29", "stroke-width": vbW / 300 }));
  dl.disabled = !S.img;
}

dl.addEventListener("click", async () => {
  if (!S.img) return;
  let s; try { s = current(); } catch { return; }
  dl.disabled = true; err.hidden = true;
  try {
    const iw = S.img.width ?? S.img.naturalWidth, ih = S.img.height ?? S.img.naturalHeight, files = [];
    for (const [i, b] of pixelBoxes(s, iw, ih).entries()) {
      const cv = document.createElement("canvas"); cv.width = b.w; cv.height = b.h;
      cv.getContext("2d").drawImage(S.img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const blob = await new Promise((ok, no) => cv.toBlob((x) => (x ? ok(x) : no(new Error("encode"))), "image/png"));
      files.push({ name: `${S.name}-panel-${i + 1}-of-${s.n}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const u = URL.createObjectURL(new Blob([zipStore(files)], { type: "application/zip" })), a = document.createElement("a");
    a.href = u; a.download = `${S.name}-${s.n}-panels.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000);
  } catch { err.textContent = "This browser couldn't cut an image this large. Try a smaller file or a computer."; err.hidden = false; }
  finally { dl.disabled = false; }
});

file.addEventListener("change", async () => {
  const f = file.files?.[0]; if (!f) return;
  try { S.img = await createImageBitmap(f); S.name = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]+/g, "-").slice(0, 50) || "panorama"; err.hidden = true; }
  catch { S.img = null; err.textContent = "That file couldn't be read as an image. Try a JPEG, PNG or WebP."; err.hidden = false; }
  render();
});
for (const x of [W, H, gap]) x.addEventListener("input", render);
for (const x of [unit, n, mode]) x.addEventListener("change", render);
$("pts").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
