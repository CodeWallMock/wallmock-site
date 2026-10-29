// Worker for /tools/crop-to-print-size/: turns the cropped full-resolution bitmap into a PNG or JPEG file off the main
// thread, so a large export does not freeze the page. It receives the pixels from the page and posts the file back;
// it loads nothing and sends nothing anywhere.
self.onmessage = async (e) => {
  const { bitmap, type, quality } = e.data ?? {};
  try {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const x = c.getContext("2d");
    if (!x) throw new Error("no 2d context");
    if (type === "image/jpeg") { x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); } // JPEG has no transparency
    x.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await c.convertToBlob({ type, quality });
    self.postMessage({ blob });
  } catch (err) {
    self.postMessage({ error: String(err?.message ?? err) });
  }
};
