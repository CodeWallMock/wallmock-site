// Browser widget for /tools/art-color-palette/. The image is decoded in the browser, drawn into a canvas at most 400 px
// on its long side, and its pixels are measured by art-palette.mjs. Nothing is sent anywhere.
import { sampleSize, palette, finishHint, luminance } from "./art-palette.js?v=1";

const $ = (id) => document.getElementById(id);
let current = [];

async function decode(f) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(f, { imageOrientation: "from-image" }); } catch {}
    try { return await createImageBitmap(f); } catch {}
  }
  return new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("unreadable")); }; im.src = u; });
}

// Copy with the Clipboard API, but never wait on it for long: a browser can leave the promise pending (seen in an
// embedded browser), so after 1.5 s fall back to the older copy command while the click still counts as the user's.
function legacyCopy(text) {
  const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
  document.body.append(t); t.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  t.remove();
  return ok;
}

async function copy(text, what) {
  let ok = false;
  if (navigator.clipboard?.writeText) {
    ok = await Promise.race([navigator.clipboard.writeText(text).then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 1500))]);
  }
  if (!ok) ok = legacyCopy(text);
  $("acp-live").textContent = ok ? `Copied ${what}.` : `Couldn't copy. Select the text and copy it yourself: ${text}`;
  return ok;
}

function button(label, text, what) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "copy"; b.textContent = label;
  b.setAttribute("aria-label", `Copy ${what}`);
  b.addEventListener("click", async () => { if (await copy(text, what)) { b.textContent = "Copied"; setTimeout(() => { b.textContent = label; }, 1500); } });
  return b;
}

function show(pal) {
  current = pal;
  $("acp-strip").replaceChildren(...pal.map((c) => { const s = document.createElement("span"); s.style.background = c.hex; s.style.flexGrow = String(Math.max(c.share, 0.005)); return s; }));
  $("acp-list").replaceChildren(...pal.map((c) => {
    const li = document.createElement("li");
    const chip = document.createElement("span"); chip.className = "swatch"; chip.style.background = c.hex;
    chip.style.color = luminance(c) > 0.4 ? "#182b30" : "#ffffff"; chip.textContent = `${c.percent}%`;
    const text = document.createElement("div");
    const hex = document.createElement("code"), rgb = document.createElement("code");
    hex.textContent = c.hex; rgb.textContent = c.rgb;
    const row1 = document.createElement("p"), row2 = document.createElement("p");
    row1.append(hex, " ", button("Copy HEX", c.hex, c.hex)); row2.append(rgb, " ", button("Copy RGB", c.rgb, c.rgb));
    const share = document.createElement("p"); share.className = "small";
    share.textContent = `Covers ${c.percent < 1 ? "under 1" : c.percent}% of the image`;
    text.append(row1, row2, share);
    li.append(chip, text);
    return li;
  }));
  $("acp-hint").textContent = `Frame suggestion: ${finishHint(pal)}`;
  $("acp-sum").textContent = pal.length === 1 ? "This image has one colour." : pal.length < 6 ? `This image has ${pal.length} main colours, largest first.` : "The six main colours in this image, largest first.";
  $("acp-out").hidden = false;
  $("acp-live").textContent = `Found ${pal.length} colours: ${pal.map((c) => `${c.hex} ${c.percent}%`).join(", ")}.`;
}

$("acp-file").addEventListener("change", async () => {
  const f = $("acp-file").files?.[0];
  if (!f) return;
  const err = $("acp-err");
  err.hidden = true;
  $("acp-sum").textContent = "Measuring your image…";
  try {
    const img = await decode(f);
    const w = img.naturalWidth ?? img.width, h = img.naturalHeight ?? img.height;
    const s = sampleSize(w, h);
    const cv = $("acp-canvas");
    cv.width = s.w; cv.height = s.h;
    const x = cv.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "high";
    x.clearRect(0, 0, s.w, s.h);
    x.drawImage(img, 0, 0, s.w, s.h);
    img.close?.();
    show(palette(x.getImageData(0, 0, s.w, s.h).data, s.w, s.h, 6));
  } catch (e) {
    $("acp-out").hidden = true;
    $("acp-sum").textContent = "Choose an image to see its six main colours.";
    err.textContent = /opaque/.test(e?.message ?? "") ? "That image is fully transparent, so it has no colours to measure." : "This browser couldn't open that file as an image. Try a JPEG, PNG or WebP.";
    err.hidden = false;
  }
});

$("acp-copy-all").addEventListener("click", async () => {
  const b = $("acp-copy-all"), label = "Copy all HEX codes";
  if (current.length && (await copy(current.map((c) => c.hex).join(", "), "all HEX codes"))) { b.textContent = "Copied"; setTimeout(() => { b.textContent = label; }, 1500); }
});
$("acp").addEventListener("submit", (e) => e.preventDefault());
