// Home hero before/after: the seller's flat art file (left of the line) and the same file in a WallMock room (right).
// Plays by itself (room -> file -> middle -> next example); any drag, key or click hands control to the visitor.
// No autoplay with prefers-reduced-motion; pauses while off screen or in a hidden tab. Without JS the page shows a 50/50 split.
const root = document.querySelector("[data-compare]");
if (root) {
  const stage = root.querySelector(".cmp-stage"), before = root.querySelector(".cmp-before"), after = root.querySelector(".cmp-after");
  const range = root.querySelector(".cmp-range"), dots = [...root.querySelectorAll(".cmp-dot")], cap = root.querySelector(".cmp-cap");
  const examples = JSON.parse(root.dataset.examples);
  let pos = 50, index = 0, auto = !matchMedia("(prefers-reduced-motion: reduce)").matches, visible = true, timer = 0, anim = 0;

  const set = (p) => { pos = Math.max(0, Math.min(100, p)); root.style.setProperty("--pos", pos + "%"); range.value = String(Math.round(pos)); };
  function show(i) {
    index = (i + examples.length) % examples.length;
    const e = examples[index];
    stage.style.aspectRatio = `${e.w} / ${e.h}`;
    // srcset first: with a srcset the browser picks a right-sized copy, and src alone would be ignored
    before.srcset = e.beforeSet ?? ""; before.src = e.before; before.alt = e.beforeAlt; after.srcset = e.afterSet ?? ""; after.src = e.after; after.alt = e.afterAlt;
    before.width = after.width = e.w; before.height = after.height = e.h;
    cap.textContent = e.caption;
    dots.forEach((d, j) => d.setAttribute("aria-current", j === index ? "true" : "false"));
    set(50);
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const tween = (to, ms) => new Promise((done) => {
    const from = pos, t0 = performance.now();
    const step = (now) => { if (!auto) return done(); const t = Math.min(1, (now - t0) / ms); set(from + (to - from) * ease(t)); t < 1 ? (anim = requestAnimationFrame(step)) : done(); };
    anim = requestAnimationFrame(step);
  });
  const wait = (ms) => new Promise((r) => (timer = setTimeout(r, ms)));
  async function play() {
    while (auto) {
      if (!visible || document.hidden) { await wait(400); continue; }
      await wait(900); await tween(4, 1300); await wait(1300);   // the room result
      await tween(96, 1600); await wait(1100);                  // the original file
      await tween(50, 1000); await wait(1200);
      if (auto) show(index + 1);
    }
  }
  function stop() { if (!auto) return; auto = false; cancelAnimationFrame(anim); clearTimeout(timer); root.classList.add("cmp-manual"); }

  range.addEventListener("input", () => { stop(); set(+range.value); });
  for (const ev of ["pointerdown", "keydown", "focusin"]) root.addEventListener(ev, stop, { passive: true });
  stage.addEventListener("pointerdown", (e) => {
    const move = (ev) => { const r = stage.getBoundingClientRect(); set(((ev.clientX - r.left) / r.width) * 100); };
    move(e); stage.setPointerCapture?.(e.pointerId);
    const up = () => { stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerup", up); };
    stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", up);
  });
  dots.forEach((d, j) => d.addEventListener("click", () => { stop(); show(j); }));
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  // warm the cache for the other examples so switching doesn't flash
  const warm = (src, set) => { const i = new Image(); i.sizes = after.sizes; if (set) i.srcset = set; i.src = src; };
  examples.slice(1).forEach((e) => { warm(e.before, e.beforeSet); warm(e.after, e.afterSet); });
  root.classList.add("cmp-ready");
  if (auto) play();
}
