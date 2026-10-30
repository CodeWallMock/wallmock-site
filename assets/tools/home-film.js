// Home film (2026-10-30): one artwork file becomes a finished listing as the page scrolls. src/home.css draws every state from one
// number on the film, --t: 0 before the first step, then i + the fraction read of step i (1 frame, 2 room, 3 up close, 4 canvas,
// 5 framed print, 6 metal). This module measures --t, loads the product layers and the close-up ahead of time, marks each one
// data-ready only once decoded (the CSS never fades to a layer without it), and names the product on show, which is always a ready
// layer. The CSS decides whether the film runs (--film: on needs scripting and no reduced-motion preference); otherwise the page is
// static and this does nothing. No network calls beyond the page's own images.
const film = document.querySelector("[data-film]");
if (film && getComputedStyle(film).getPropertyValue("--film").trim() === "on") {
  const steps = [...film.querySelectorAll("[data-step]")];
  const products = JSON.parse(film.dataset.products); // [[t, group index, finish]]
  const layers = [...film.querySelectorAll(".fm-over figure")], corner = film.querySelector(".fm-corner");
  const tabs = [...film.querySelectorAll(".fm-tab")], finish = film.querySelector(".fm-finish"), live = film.querySelector(".fm-live");
  let anchor = 0.6, textLine = 0.6, frame = 0, shown = 0, reading = -1, loading = false;

  // Once the page has loaded (or at the first scroll), fetch the room and every layer together and mark each ready when it can be
  // drawn. The room waits until then so the opening oak layer, the page's largest image, loads first.
  const ready = (fig) => { const im = fig.querySelector("img"); im.loading = "eager"; im.decode().then(() => { fig.dataset.ready = ""; ask(); }, () => {}); };
  const preload = () => { if (loading) return; loading = true; film.classList.add("fm-go"); [...layers.slice(1), corner].forEach(ready); };

  const measure = () => {
    frame = 0;
    const line = innerHeight * anchor;
    let t = 0;
    for (let i = 0; i < steps.length; i++) {
      const r = steps[i].getBoundingClientRect();
      if (r.top <= line) t = i + 1 + Math.min(1, (line - r.top) / r.height);
    }
    film.style.setProperty("--t", t.toFixed(4));
    // the step being read (its top above the text line): only its words show, so a finished step's words never linger
    let on = -1;
    for (let i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= innerHeight * textLine) on = i;
    if (on !== reading) { reading = on; steps.forEach((el, i) => el.toggleAttribute("data-on", i === on)); film.toggleAttribute("data-read", on >= 0); }
    if (t > 0) preload();
    let k = 0;
    // the product on top: its layer is decoded and at least half faded in (src/home.css: opacity reaches 0.5 at t = its --at)
    for (let i = 1; i < products.length; i++) if (t >= products[i][0] && "ready" in layers[i].dataset) k = i;
    if (k !== shown) {
      shown = k;
      const [, g, name] = products[k];
      tabs.forEach((el, i) => el.toggleAttribute("data-on", i === g));
      finish.textContent = name;
      live.textContent = `Showing: ${name}`;
    }
  };
  const ask = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const size = () => { const cs = getComputedStyle(film); anchor = parseFloat(cs.getPropertyValue("--anchor")) || 0.6; textLine = parseFloat(cs.getPropertyValue("--textline")) || anchor; ask(); };
  addEventListener("scroll", ask, { passive: true });
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
