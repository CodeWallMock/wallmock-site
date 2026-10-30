// Browser widget for /tools/printable-size-pack/: one artwork file -> five full-resolution crops (2:3, 3:4, 4:5, 11:14,
// ISO A) in one ZIP. The file is decoded and cropped in this browser; nothing is uploaded.
import { packCrops, packFileName } from "./printable-pack.js?v=1";
import { zipStore } from "./zip-store.js?v=1";

const $ = (id) => document.getElementById(id);
const file = $("psp-file"), pos = $("psp-pos"), posOut = $("psp-pos-out"), type = $("psp-type"), dl = $("psp-dl"), grid = $("psp-grid"), sum = $("psp-sum"), err = $("psp-err"), body = $("psp-rows");
const S = { img: null, name: "artwork", w: 0, h: 0 };

const say = (el, text) => { el.textContent = text; el.hidden = !text; };
const pct = (v) => `${Math.round(v * 100)}%`;

function render() {
  posOut.textContent = `${pos.value}%`;
  if (!S.img) { dl.disabled = true; return; }
  const crops = packCrops(S.w, S.h, Number(pos.value) / 100);
  sum.textContent = `${S.w} × ${S.h} px: five crops, each the largest of its shape. Move the slider to choose what each crop keeps.`;
  body.replaceChildren(...crops.map((c) => {
    const tr = document.createElement("tr");
    for (const t of [c.id === "iso" ? "ISO A (A4, A3…)" : c.id, `${c.w} × ${c.h} px`, pct(c.kept), c.largest ?? "under 300 DPI at the smallest size"]) { const td = document.createElement("td"); td.textContent = t; tr.append(td); }
    return tr;
  }));
  grid.replaceChildren(...crops.map((c) => {
    const fig = document.createElement("figure"), cv = document.createElement("canvas"), k = 200 / Math.max(c.w, c.h);
    cv.width = Math.max(1, Math.round(c.w * k)); cv.height = Math.max(1, Math.round(c.h * k));
    cv.getContext("2d").drawImage(S.img, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height);
    const cap = document.createElement("figcaption"); cap.textContent = c.id === "iso" ? "ISO A" : c.id;
    fig.append(cv, cap); return fig;
  }));
  dl.disabled = false;
}

const blobOf = (canvas, mime) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), mime, 0.95));

dl.addEventListener("click", async () => {
  if (!S.img) return;
  dl.disabled = true; say(err, "");
  const mime = type.value === "jpeg" ? "image/jpeg" : "image/png", files = [];
  try {
    for (const c of packCrops(S.w, S.h, Number(pos.value) / 100)) {
      sum.textContent = `Making ${c.id === "iso" ? "ISO A" : c.id} (${c.w} × ${c.h} px)…`;
      const cv = document.createElement("canvas"); cv.width = c.w; cv.height = c.h;
      const x = cv.getContext("2d"); if (mime === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.w, c.h); }
      x.drawImage(S.img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
      files.push({ name: packFileName(S.name, c.id, type.value), data: new Uint8Array(await (await blobOf(cv, mime)).arrayBuffer()) });
      cv.width = cv.height = 1;
    }
    const zip = new Blob([zipStore(files)], { type: "application/zip" }), u = URL.createObjectURL(zip), a = document.createElement("a");
    a.href = u; a.download = packFileName(S.name, "2:3").replace(/-2x3\.\w+$/, "-printable-sizes.zip"); a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000);
    sum.textContent = `Saved ${files.length} crops in one ZIP.`;
  } catch { say(err, "This browser couldn't make a crop this large. Try a smaller file, JPEG, or a computer."); }
  finally { dl.disabled = false; }
});

file.addEventListener("change", async () => {
  const f = file.files?.[0]; if (!f) return; say(err, "");
  try {
    const img = "createImageBitmap" in window ? await createImageBitmap(f) : await new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("read")); im.src = u; });
    S.img = img; S.w = img.width ?? img.naturalWidth; S.h = img.height ?? img.naturalHeight; S.name = f.name; render();
  } catch { say(err, "That file couldn't be read as an image. Try a JPEG, PNG or WebP."); }
});
pos.addEventListener("input", render);
type.addEventListener("change", render);
$("psp").addEventListener("submit", (e) => e.preventDefault());
render();
addEventListener("pageshow", render);
