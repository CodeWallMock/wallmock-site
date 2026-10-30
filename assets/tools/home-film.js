// Home film (seo-8-dark, 2026-10-30): one artwork file becomes a finished listing as the page scrolls. src/home.css draws every
// state from one number on the film, --t: the segments scrolled past (18 segments, alternating a transition and a hold; their
// lengths in viewport heights come from the CSS, --tr and --hold, set from content/pages/home.mjs PACE). This module measures --t,
// loads the room, the product layers, the close-up and the hero's finish layers after load, marks each layer data-ready only once
// decoded (the CSS never fades to a layer without it), names the product on show (always a ready layer), runs the hero's finish
// swatches and shows only the step being read. The CSS decides whether the film runs (--film: on needs scripting and no
// reduced-motion preference); otherwise the page is static and only the frames showcase below is wired. No network calls beyond
// the page's own images.
const film = document.querySelector("[data-film]");
if (film && getComputedStyle(film).getPropertyValue("--film").trim() === "on") {
  const steps = [...film.querySelectorAll("[data-step]")], segments = +film.dataset.segments || 18;
  const products = JSON.parse(film.dataset.products); // [[t, group index, finish]]
  const layers = [...film.querySelectorAll(".fm-over figure")], corner = film.querySelector(".fm-corner");
  const objects = [...film.querySelectorAll(".fm-object img")], swatches = [...film.querySelectorAll(".fm-swatches .sw")];
  const tabs = [...film.querySelectorAll(".fm-tab")], finish = film.querySelector(".fm-finish"), live = film.querySelector(".fm-live");
  const lines = [...film.querySelectorAll(".p-lines [data-p]")], swRow = film.querySelector(".fm-swatches"), swName = film.querySelector(".sw-name");
  // swatches: over the stage on laptops, under it on phones (44 px targets need the full width)
  const phone = matchMedia("(max-width: 860px)"), place = () => { const box = film.querySelector(".fm-box"); if (phone.matches) box.after(swRow); else box.append(swRow); };
  phone.addEventListener("change", () => { place(); size(); }); place();
  let anchor = 0.6, textLine = 0.6, hold = 1, tr = 0.5, frame = 0, shown = 0, reading = -1, loading = false, off = false;

  // After load (or at the first scroll), fetch the room, every layer and the hero's finish layers together; mark each ready when it
  // can be drawn. They wait for load so the opening oak frame, the page's largest image, loads first.
  const ready = (fig) => { const im = fig.querySelector("img"); im.loading = "eager"; im.decode().then(() => { fig.dataset.ready = ""; ask(); }, () => {}); };
  const preload = () => {
    if (loading) return; loading = true; film.classList.add("fm-go");
    [...layers.slice(1), corner].forEach(ready);
    for (const im of objects.slice(1)) { im.loading = "eager"; im.decode().then(() => { im.dataset.ready = ""; }, () => {}); }
  };

  // --t: the segment the reading line is in, plus the fraction read of it (transitions and holds alternate, starting with one)
  const tOf = (d) => { const len = (i) => innerHeight * (i % 2 ? hold : tr); let t = 0; for (let i = 0; i < segments && d > 0; i++) { const l = len(i); t += Math.min(1, d / l); d -= l; } return t; };
  const measure = () => {
    frame = 0;
    const t = tOf(innerHeight * anchor - steps[0].getBoundingClientRect().top);
    film.style.setProperty("--t", t.toFixed(4));
    if (t > 0) preload();
    // the hero's swatches only while the hero frame is on screen
    if ((t > 0.25) !== off) { off = t > 0.25; film.toggleAttribute("data-swatches-off", off); swatches.forEach((b) => (b.tabIndex = off ? -1 : 0)); }
    let on = -1;
    for (let i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= innerHeight * textLine) on = i;
    if (on !== reading) { reading = on; steps.forEach((el, i) => el.toggleAttribute("data-on", i === on)); film.toggleAttribute("data-read", on >= 0); }
    // the product on top: its layer is decoded and at least half faded in (src/home.css: opacity reaches 0.5 at t = its --at)
    let k = 0;
    for (let i = 1; i < products.length; i++) if (t >= products[i][0] && "ready" in layers[i].dataset) k = i;
    if (k !== shown) {
      shown = k;
      const [, g, name] = products[k];
      tabs.forEach((el, i) => el.toggleAttribute("data-on", i === g));
      finish.textContent = name;
      live.textContent = `Showing: ${name}`;
      lines.forEach((li) => li.classList.toggle("on", +li.dataset.p === k));
    }
  };
  const ask = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const size = () => {
    const cs = getComputedStyle(film), num = (k, d) => parseFloat(cs.getPropertyValue(k)) || d;
    anchor = num("--anchor", 0.6); textLine = num("--textline", anchor); hold = num("--hold", 1); tr = num("--tr", 0.5); ask();
  };

  // Hero finish swatches: the frame on the painting changes at once (a short cross-fade), from the real render of that product
  const pick = (b) => {
    const k = b.dataset.k, im = objects.find((o) => o.dataset.k === k);
    swatches.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const show = () => { objects.forEach((o) => o.classList.toggle("on", o === im)); film.dataset.sel = k; swName.textContent = b.dataset.name; live.textContent = `Showing: ${b.dataset.name}`; };
    if ("ready" in im.dataset || im.complete && im.naturalWidth) show(); else { film.classList.add("fm-go"); im.loading = "eager"; im.decode().then(show, show); }
  };
  swatches.forEach((b) => b.addEventListener("click", () => pick(b)));

  lines.forEach((li) => li.classList.toggle("on", li.dataset.p === "0"));
  addEventListener("scroll", () => { document.documentElement.toggleAttribute("data-scrolled", true); ask(); }, { passive: true });
  addEventListener("resize", size);
  if (document.readyState === "complete") setTimeout(preload, 0); else addEventListener("load", () => setTimeout(preload, 0), { once: true });
  size();
}

// Frames showcase (seo-6-frames): each frame's corner at 100% (a crop of the 4096 px image) on hover with a mouse, or on tap of
// "Corner at 100%"; the crop is fetched only then. Without JavaScript the link opens the crop itself.
for (const fig of document.querySelectorAll(".fx")) {
  const box = fig.querySelector(".fx-img"), link = fig.querySelector(".fx-zoom");
  const show = (on) => {
    if (on && !box.querySelector(".fx-c")) { const im = new Image(); im.className = "fx-c"; im.alt = `${fig.querySelector("strong").textContent}: the corner at 100%, a crop of the 4096 px image`; im.decoding = "async"; im.src = link.getAttribute("href"); box.append(im); }
    fig.toggleAttribute("data-zoom", on);
    link.textContent = on ? "Back to the room" : "Corner at 100%";
    link.setAttribute("aria-expanded", String(on));
  };
  link.setAttribute("role", "button"); link.setAttribute("aria-expanded", "false");
  if (matchMedia("(hover: hover)").matches) { box.addEventListener("mouseenter", () => show(true)); box.addEventListener("mouseleave", () => show(false)); }
  link.addEventListener("click", (e) => { e.preventDefault(); show(!fig.hasAttribute("data-zoom")); });
  box.addEventListener("click", () => show(!fig.hasAttribute("data-zoom")));
}

// Jump bar: a tap glides to the section (the page itself always scrolls natively); with reduced motion it jumps.
for (const a of document.querySelectorAll(".jump a[href^='#']")) a.addEventListener("click", (e) => {
  const to = document.getElementById(a.getAttribute("href").slice(1)); if (!to) return;
  e.preventDefault(); to.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); history.pushState(null, "", a.getAttribute("href"));
});
