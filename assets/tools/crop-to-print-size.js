// Browser widget for /tools/crop-to-print-size/. The image is decoded in the browser (createImageBitmap, off the main
// thread where supported), previewed small, and the crop is exported at full resolution from a canvas: in a worker with
// an OffscreenCanvas where available, so a 40 MP export does not freeze the page. Nothing is sent anywhere. All crop
// maths is in crop-print.mjs; this file only draws the box and moves it.
import { shape, ratioOf, maxCrop, clampCrop, moveCrop, scaleCrop, resizeFromCorner, cropScale, reshapeCrop, infoRows, cropFileName, shapeName, exampleText } from "./crop-print.js?v=1";

const $ = (id) => document.getElementById(id);
const PREVIEW_MAX = 1600; // preview canvas long side in device pixels
const S = { file: null, src: null, prev: null, W: 0, H: 0, crop: null, busy: false };

const shapeId = () => $("ctp-shape").value;
const orientation = () => (shape(shapeId()).short === shape(shapeId()).long ? "portrait" : $("ctp-landscape").checked ? "landscape" : "portrait");
const ratio = () => ratioOf(shapeId(), orientation());

function err(msg) { $("ctp-err").textContent = msg; $("ctp-err").hidden = !msg; }

function rows() {
  $("ctp-rows").replaceChildren(...infoRows(S.crop, shapeId(), orientation()).map(([a, b]) => {
    const tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td");
    th.scope = "row"; th.textContent = a; td.textContent = b; tr.append(th, td); return tr;
  }));
}

// Draw the box from S.crop and refresh the numbers. `announce` also updates the screen-reader live line.
function update(announce = false) {
  const c = S.crop, box = $("ctp-box");
  box.style.left = `${(c.x / S.W) * 100}%`; box.style.top = `${(c.y / S.H) * 100}%`;
  box.style.width = `${(c.w / S.W) * 100}%`; box.style.height = `${(c.h / S.H) * 100}%`;
  const pct = Math.round(cropScale(c, ratio(), S.W, S.H) * 100);
  $("ctp-scale").value = String(pct); $("ctp-scale-out").textContent = `${pct}%`;
  const text = `${c.w.toLocaleString("en-US")} × ${c.h.toLocaleString("en-US")} px crop, ${shapeName(shapeId(), orientation())}, from a ${S.W.toLocaleString("en-US")} × ${S.H.toLocaleString("en-US")} px image.`;
  $("ctp-sum").textContent = text;
  box.setAttribute("aria-valuetext", text);
  rows();
  if (announce) $("ctp-live").textContent = text;
}

// Size the preview to the page width and the viewport height, then draw the image into it.
function layout() {
  if (!S.src) return;
  const wrap = $("ctp-wrap"), cv = $("ctp-canvas");
  const maxW = wrap.clientWidth, maxH = Math.max(240, window.innerHeight * 0.7);
  const k = Math.min(maxW / S.W, maxH / S.H);
  const cssW = Math.max(1, Math.floor(S.W * k)), cssH = Math.max(1, Math.floor(S.H * k));
  cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const kk = Math.min(1, PREVIEW_MAX / Math.max(S.W, S.H), (cssW * dpr) / S.W);
  const pw = Math.max(1, Math.round(S.W * kk)), ph = Math.max(1, Math.round(S.H * kk));
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw; cv.height = ph;
    const x = cv.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(S.prev ?? S.src, 0, 0, pw, ph);
  }
}

async function decode(f) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(f, { imageOrientation: "from-image" }); } catch {}
    try { return await createImageBitmap(f); } catch {}
  }
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(f), im = new Image();
    im.decoding = "async";
    im.onload = () => { URL.revokeObjectURL(u); ok(im); };
    im.onerror = () => { URL.revokeObjectURL(u); no(new Error("unreadable")); };
    im.src = u;
  });
}

const dims = (img) => [img.naturalWidth ?? img.width, img.naturalHeight ?? img.height];

function release() {
  for (const b of [S.src, S.prev]) b?.close?.();
  S.src = S.prev = null;
}

$("ctp-file").addEventListener("change", async () => {
  const f = $("ctp-file").files?.[0];
  if (!f) return;
  err("");
  $("ctp-sum").textContent = "Opening your image…";
  release();
  try {
    const img = await decode(f);
    const [w, h] = dims(img);
    if (!(w > 0 && h > 0)) throw new Error("empty");
    S.file = f; S.src = img; S.W = w; S.H = h;
    // A small copy for the preview, made off the main thread where the browser can.
    const k = Math.min(1, PREVIEW_MAX / Math.max(w, h));
    if (k < 1 && "createImageBitmap" in window) {
      const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
      try { S.prev = await createImageBitmap(img, { resizeWidth: pw, resizeHeight: ph, resizeQuality: "high" }); } catch { S.prev = null; }
      if (S.prev && S.prev.width !== pw) { S.prev.close?.(); S.prev = null; } // a browser that ignores resizing made a full-size copy
    }
    // Start in the image's own orientation.
    if (shape(shapeId()).short !== shape(shapeId()).long) (w > h ? $("ctp-landscape") : $("ctp-portrait")).checked = true;
    S.crop = maxCrop(w, h, ratio());
    $("ctp-ui").hidden = false;
    $("ctp-canvas").width = 0; // force a redraw
    layout();
    update(true);
  } catch {
    S.file = null; S.crop = null; $("ctp-ui").hidden = true;
    $("ctp-sum").textContent = "Choose an image to crop it.";
    $("ctp-rows").replaceChildren(); // no numbers left over from the previous image
    err("This browser couldn't open that file as an image. Try a JPEG, PNG or WebP.");
  }
});

function reshape(oldRatio) {
  if (!S.crop) return;
  const o = shape(shapeId()).short === shape(shapeId()).long;
  for (const id of ["ctp-portrait", "ctp-landscape"]) $(id).disabled = o;
  S.crop = reshapeCrop(S.crop, oldRatio, ratio(), S.W, S.H);
  update(true);
}
let lastRatio = ratio();
for (const el of [$("ctp-shape"), $("ctp-portrait"), $("ctp-landscape")]) el.addEventListener("change", () => {
  const sq = shape(shapeId()).short === shape(shapeId()).long;
  for (const id of ["ctp-portrait", "ctp-landscape"]) $(id).disabled = sq;
  if (S.crop) reshape(lastRatio);
  else example();
  lastRatio = ratio();
});

// No image yet: show the 4000 × 6000 px example in the chosen shape.
function example() {
  const sq = shape(shapeId()).short === shape(shapeId()).long;
  for (const id of ["ctp-portrait", "ctp-landscape"]) $(id).disabled = sq;
  const c = maxCrop(4000, 6000, ratio());
  $("ctp-rows").replaceChildren(...infoRows(c, shapeId(), orientation()).map(([a, b]) => { const tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td"); th.scope = "row"; th.textContent = a; td.textContent = b; tr.append(th, td); return tr; }));
  $("ctp-sum").textContent = exampleText(shapeId(), orientation());
}

$("ctp-scale").addEventListener("input", () => { if (S.crop) { S.crop = scaleCrop(S.crop, Number($("ctp-scale").value) / 100, ratio(), S.W, S.H); update(); } });
$("ctp-scale").addEventListener("change", () => S.crop && update(true));
$("ctp-centre").addEventListener("click", () => {
  if (!S.crop) return;
  const c = S.crop;
  S.crop = clampCrop({ ...c, x: (S.W - c.w) / 2, y: (S.H - c.h) / 2 }, S.W, S.H);
  update(true);
});

// Pointer: drag the box to move it, drag the corner handle to resize it. Distances are converted from screen to image px.
let drag = null;
const toImage = () => S.W / $("ctp-stage").getBoundingClientRect().width;
$("ctp-box").addEventListener("pointerdown", (e) => {
  if (!S.crop || e.button > 0) return;
  e.preventDefault();
  $("ctp-box").focus({ preventScroll: true });
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: { ...S.crop }, resize: e.target === $("ctp-handle"), k: toImage() };
  $("ctp-box").setPointerCapture(e.pointerId);
});
$("ctp-box").addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k;
  S.crop = drag.resize ? resizeFromCorner(drag.start, drag.start.w + Math.max(dx, dy * ratio()), ratio(), S.W, S.H) : moveCrop(drag.start, Math.round(dx), Math.round(dy), S.W, S.H);
  update();
});
const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; update(true); } };
$("ctp-box").addEventListener("pointerup", end);
$("ctp-box").addEventListener("pointercancel", end);

// Keyboard: arrows move 1% of the image (Shift: 10%), + and − resize by 5% of the largest crop.
$("ctp-box").addEventListener("keydown", (e) => {
  if (!S.crop) return;
  const step = Math.max(1, Math.round((e.shiftKey ? 0.1 : 0.01) * Math.max(S.W, S.H)));
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) S.crop = moveCrop(S.crop, ...moves[e.key], S.W, S.H);
  else if (["+", "="].includes(e.key)) S.crop = scaleCrop(S.crop, cropScale(S.crop, ratio(), S.W, S.H) + 0.05, ratio(), S.W, S.H);
  else if (["-", "_", "−"].includes(e.key)) S.crop = scaleCrop(S.crop, cropScale(S.crop, ratio(), S.W, S.H) - 0.05, ratio(), S.W, S.H);
  else return;
  e.preventDefault();
  update(true);
});

let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 120); });

// ---- export at full resolution ----
function viaWorker(piece, type) {
  return new Promise((ok, no) => {
    let w;
    try { w = new Worker(new URL("./crop-export-worker.js?v=1", import.meta.url)); } catch (e) { no(e); return; }
    const done = (fn, v) => { w.terminate(); fn(v); };
    w.onmessage = (e) => (e.data?.blob ? done(ok, e.data.blob) : done(no, new Error(e.data?.error || "export failed")));
    w.onerror = (e) => { e.preventDefault?.(); done(no, new Error("worker failed")); };
    w.postMessage({ bitmap: piece, type, quality: 0.95 }, [piece]);
  });
}

function viaCanvas(c, type) {
  return new Promise((ok) => {
    const cv = document.createElement("canvas");
    cv.width = c.w; cv.height = c.h;
    const x = cv.getContext("2d");
    if (!x) { ok(null); return; }
    if (type === "image/jpeg") { x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.w, c.h); } // JPEG has no transparency
    x.drawImage(S.src, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    cv.toBlob((b) => { cv.width = cv.height = 0; ok(b); }, type, 0.95);
  });
}

$("ctp-dl").addEventListener("click", async () => {
  if (!S.crop || S.busy) return;
  const c = { ...S.crop }, kind = $("ctp-type").value, type = kind === "jpeg" ? "image/jpeg" : "image/png";
  S.busy = true; err("");
  const btn = $("ctp-dl"), label = btn.textContent;
  btn.disabled = true; btn.textContent = "Making your file…";
  let blob = null;
  try {
    if ("OffscreenCanvas" in window && "Worker" in window && "createImageBitmap" in window) {
      try { blob = await viaWorker(await createImageBitmap(S.src, c.x, c.y, c.w, c.h), type); } catch { blob = null; }
    }
    if (!blob) blob = await viaCanvas(c, type);
    if (!blob || !blob.size) throw new Error("no blob");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = cropFileName(S.file?.name, shapeId(), orientation(), kind);
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    $("ctp-live").textContent = `Downloaded ${a.download}, ${c.w} × ${c.h} px.`;
  } catch {
    err(`This browser couldn't make a ${c.w.toLocaleString("en-US")} × ${c.h.toLocaleString("en-US")} px image. Phones limit the size of images a page can make; try a smaller crop, JPEG, or a computer.`);
  } finally {
    S.busy = false; btn.disabled = false; btn.textContent = label;
  }
});

$("ctp").addEventListener("submit", (e) => e.preventDefault());
// After Back, Chrome restores the chosen shape and orientation (never the file) after the load event, without change
// events: match the example to them now and again on pageshow, which fires after that restore.
const start = () => { if (!S.crop) example(); lastRatio = ratio(); };
start();
addEventListener("pageshow", start);
