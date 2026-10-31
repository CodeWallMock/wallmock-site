// Home film (seo-8-dark, 2026-10-30): one artwork file becomes a finished listing as the page scrolls. src/home.css draws every
// state from one number on the film, --t: the segments scrolled past (18 segments, alternating a transition and a hold; their
// lengths in screen heights come from content/pages/home.mjs PACE, on the film's inline style). This module measures --t, loads
// the room, the product layers, the close-up and the hero's finish layers after load, marks each layer data-ready only once it can
// be drawn (the CSS never fades to a layer without it), names the product on show (always a ready layer), runs the hero's finish
// swatches and shows only the step being read. The film runs under html.film-on (the home page's head script sets it before the
// first paint when motion is allowed); otherwise the page is static and only the frames showcase below is wired. No network calls
// beyond the page's own images.
const film = document.querySelector("[data-film]"), root = document.documentElement;
// The head script turns html.film-on on before the first paint when motion is allowed; the film runs only under it. If setting it
// up fails, or anything goes wrong later, the page drops back to the static layout: never a film stuck half way (2026-10-30, iOS).
// The film plays when motion is allowed and the screen is not a phone on its side (a landscape phone, under 500 px tall, reads the
// static page); the same test as the head script's, re-checked when the setting or the orientation changes.
const filmFits = () => matchMedia("(prefers-reduced-motion: no-preference)").matches && !matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
const toStatic = () => { root.classList.remove("film-on"); film?.style.removeProperty("--t"); };
if (film) {
  try { startFilm(); window.__wmFilm = true; } catch (e) { toStatic(); }
}

function startFilm() {
  const steps = [...film.querySelectorAll("[data-step]")], segments = +film.dataset.segments || 18;
  const products = JSON.parse(film.dataset.products); // [[t, group index, finish]]
  const layers = [...film.querySelectorAll(".fm-over figure")], corner = film.querySelector(".fm-corner");
  const objects = [...film.querySelectorAll(".fm-object img")], swatches = [...film.querySelectorAll(".fm-swatches .sw")];
  const tabs = [...film.querySelectorAll(".fm-tab")], finish = film.querySelector(".fm-finish"), live = film.querySelector(".fm-live");
  const lines = [...film.querySelectorAll(".p-lines [data-p]")], swRow = film.querySelector(".fm-swatches"), swName = film.querySelector(".sw-name");
  const media = (q, f) => { const m = matchMedia(q); if (f) m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return m; };
  // the pace (segment lengths in screen heights, and the reading line) comes from the page's own inline style, never from home.css,
  // which may arrive after this script on a slow connection
  const pace = (k) => parseFloat(film.style.getPropertyValue(k));
  // one screen height = 100svh, the unit the steps' heights use in home.css: on iOS innerHeight grows as the toolbars collapse, and
  // measuring with it made the film fall behind the words
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:${CSS.supports?.("height", "100svh") ? "100svh" : "100vh"}`;
  document.body.append(probe);
  // swatches: over the foot of the stage, under the artwork (seo-9-phone: on phones too); the product pills over the stage on laptops,
  // on a strip under it on phones (review phone-1: never over the picture there)
  const box = film.querySelector(".fm-box"), pills = film.querySelector(".fm-tabs");
  const place = () => { box.append(swRow); (phone.matches ? film.querySelector(".film-media") : box).append(pills); };
  // the phone film is for portrait phones; a landscape phone gets the laptop film (src/home.css: orientation:portrait)
  const phone = media("(max-width: 860px) and (orientation: portrait)", () => { place(); size(); });
  place();
  let anchor = 0.6, hold = 1, tr = 0.5, vh = 0, frame = 0, settle = 0, shown = 0, reading = -1, loading = false, off = false;

  // After load (or at the first scroll), fetch the room, every layer and the hero's finish layers together; mark each ready when it
  // can be drawn: decoded, or loaded where decode() gives up (WebKit can reject it for an image that is not on screen yet). They wait
  // for load so the opening oak frame, the page's largest image, loads first.
  const drawable = (im, ok) => { im.loading = "eager"; const loaded = () => (im.complete && im.naturalWidth ? ok() : im.addEventListener("load", ok, { once: true })); im.decode ? im.decode().then(ok, loaded) : loaded(); };
  const ready = (fig) => drawable(fig.querySelector("img"), () => { fig.dataset.ready = ""; ask(); });
  const preload = () => {
    if (loading) return; loading = true; film.classList.add("fm-go");
    [...layers.slice(1), corner].forEach(ready);
    for (const im of objects.slice(1)) drawable(im, () => { im.dataset.ready = ""; });
  };

  // --t: the segment the reading line is in, plus the fraction read of it (transitions and holds alternate, starting with one)
  const tOf = (d) => { const len = (i) => vh * (i % 2 ? hold : tr); let t = 0; for (let i = 0; i < segments && d > 0; i++) { const l = len(i); t += Math.min(1, d / l); d -= l; } return t; };
  const measure = () => {
    frame = 0;
    if (!root.classList.contains("film-on")) return;
    try {
      const line = vh * anchor, t = tOf(line - steps[0].getBoundingClientRect().top);
      film.style.setProperty("--t", t.toFixed(4));
      if (t > 0) preload();
      // the hero's swatches only while the hero frame is on screen
      if ((t > 0.25) !== off) { off = t > 0.25; film.toggleAttribute("data-swatches-off", off); swatches.forEach((b) => (b.tabIndex = off ? -1 : 0)); }
      let on = -1;
      for (let i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= line) on = i;
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
    } catch (e) { toStatic(); }
  };
  const ask = () => { if (!frame) frame = requestAnimationFrame(measure); };
  // the screen height is measured once per width (a new orientation or window width), never as the iOS bars collapse and come back
  // (Chrome on iPhone: an address bar and a bottom toolbar); home.css reads it as --vh0 for the steps' lengths and the stage
  let measuredFor = 0;
  const size = () => {
    const p = phone.matches ? "p" : "d";
    hold = pace(`--hold-${p}`) || 1; tr = pace(`--tr-${p}`) || 0.5; anchor = pace(`--anchor-${p}`) || 0.6;
    if (innerWidth !== measuredFor || !vh) { measuredFor = innerWidth; vh = probe.offsetHeight || innerHeight; film.style.setProperty("--vh0", `${vh}px`); }
    ask();
  };
  // reduced motion switched on, or the phone turned on its side, while the page is open: the static page; and back again: the film
  const fit = () => { if (filmFits()) { root.classList.add("film-on"); place(); size(); } else toStatic(); };
  media("(prefers-reduced-motion: reduce)", fit); media("(orientation: landscape) and (max-height: 500px)", fit);

  // Hero finish swatches: the frame on the painting changes at once (a short cross-fade), from the real render of that product
  const pick = (b) => {
    const k = b.dataset.k, im = objects.find((o) => o.dataset.k === k);
    swatches.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const show = () => { objects.forEach((o) => o.classList.toggle("on", o === im)); film.dataset.sel = k; swName.textContent = b.dataset.name; live.textContent = `Showing: ${b.dataset.name}`; };
    if ("ready" in im.dataset || im.complete && im.naturalWidth) show(); else { film.classList.add("fm-go"); drawable(im, show); }
  };
  swatches.forEach((b) => b.addEventListener("click", () => pick(b)));

  lines.forEach((li) => li.classList.toggle("on", li.dataset.p === "0"));
  // measured on every scroll (iOS sends them through momentum too), once more when the scrolling settles, and whenever the screen
  // changes size (toolbars, rotation, a page restored from the back-forward cache)
  addEventListener("scroll", () => { root.toggleAttribute("data-scrolled", true); ask(); clearTimeout(settle); settle = setTimeout(ask, 120); }, { passive: true });
  for (const ev of ["resize", "orientationchange", "pageshow"]) addEventListener(ev, size);
  window.visualViewport?.addEventListener("resize", ask);
  if (document.readyState === "complete") setTimeout(preload, 0); else addEventListener("load", () => setTimeout(preload, 0), { once: true });
  // home.css can arrive after this script on a slow connection: measure again once it has (and at load)
  for (const l of document.querySelectorAll('link[rel="stylesheet"]')) l.addEventListener("load", size);
  addEventListener("load", size, { once: true });
  size();
}

// Frames showcase (seo-6-frames): each frame's corner at 100% (a crop of the 4096 px image) on hover with a mouse, or on tap of
// "Corner at 100%"; the crop is fetched only then. Without JavaScript the link opens the crop itself.
for (const fig of document.querySelectorAll(".fx")) {
  const box = fig.querySelector(".fx-img"), link = fig.querySelector(".fx-zoom");
  const show = (on) => {
    if (on && !box.querySelector(".fx-c")) { const im = new Image(); im.className = "fx-c"; im.alt = `${fig.querySelector("strong").textContent}: the corner at 100%, a crop of the 4096 px image`; im.decoding = "async"; im.src = link.getAttribute("href"); box.append(im); }
    fig.toggleAttribute("data-zoom", on);
    link.textContent = on ? "Back to the room" : matchMedia("(max-width: 860px)").matches ? "Tap for corner at 100%" : "Corner at 100%";
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

// Phones (seo-9-phone): longer descriptions sit closed under a "Details" toggle (still in the page for search and screen readers);
// the frames' corner links say what a tap does.
if (matchMedia("(max-width: 860px)").matches) {
  // one Details per step: the metal step's product list joins its description
  for (const step of document.querySelectorAll(".step-in")) { const [first, ...rest] = step.querySelectorAll(":scope > .step-more"); for (const d of rest) { first.append(...[...d.childNodes].filter((n) => n.nodeName !== "SUMMARY")); d.remove(); } }
  // longer section intros go under a toggle named by data-more: the paragraph's tail (.more-x), or the whole paragraph
  for (const p of document.querySelectorAll("[data-more]")) {
    const d = document.createElement("details"), s = document.createElement("summary"), tail = p.querySelector(".more-x");
    d.className = "ph-more"; s.textContent = p.dataset.more; d.append(s);
    if (tail) { const q = document.createElement("p"); q.className = p.className; q.textContent = tail.textContent.trim(); tail.remove(); d.append(q); p.after(d); }
    else { p.before(d); d.append(p); }
  }
  for (const d of document.querySelectorAll(".step-more, .ph-more")) d.open = false;
  for (const a of document.querySelectorAll(".fx-zoom")) if (a.textContent === "Corner at 100%") a.textContent = "Tap for corner at 100%";
}
