(() => {
  const image = document.getElementById('showcase-image');
  const caption = document.getElementById('showcase-caption');
  const scenes = {
    framed: {src: '/assets/hero.webp', alt: 'A watercolour fig branch in a natural oak floating canvas frame above a low daybed', caption: 'Framed canvas · Landscape setting', width:1600, height:1200},
    stretched: {src: '/assets/portrait.webp', alt: 'A mid-century abstract on a stretched canvas above café tables', caption: 'Stretched canvas · Landscape setting', width:1400, height:1050},
    panoramic: {src: '/assets/panorama.webp', alt: 'A misty mountain panorama in an espresso floating frame above a walnut sideboard', caption: 'Framed canvas · Panoramic setting', width:1400, height:700}
  };
  const buttons = [...document.querySelectorAll('[data-format]')];
  if (!image || !caption) return;
  buttons.forEach(button => button.addEventListener('click', () => {
    const scene = scenes[button.dataset.format];
    if (!scene) return;
    image.src = scene.src; image.alt = scene.alt;
    image.width = scene.width; image.height = scene.height;
    caption.textContent = scene.caption;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
})();
