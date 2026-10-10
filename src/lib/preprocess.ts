// Turn a freehand drawing into an MNIST-style input the way the dataset itself was made:
// fit the ink's bounding box into 20x20 keeping its aspect ratio, then place it in a 28x28
// frame so its centre of mass sits at the centre. Without this, a digit drawn small or off
// to one side looks nothing like the training data.

export function toMnist(source: HTMLCanvasElement): Float32Array | null {
  const w = source.width;
  const h = source.height;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, w, h).data;

  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const scale = 20 / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale));
  const th = Math.max(1, Math.round(bh * scale));

  const fit = document.createElement("canvas");
  fit.width = tw;
  fit.height = th;
  const f = fit.getContext("2d", { willReadFrequently: true })!;
  f.imageSmoothingEnabled = true;
  f.imageSmoothingQuality = "high";
  f.drawImage(source, x0, y0, bw, bh, 0, 0, tw, th);
  const fd = f.getImageData(0, 0, tw, th).data;

  let mass = 0, cx = 0, cy = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const v = fd[(y * tw + x) * 4];
      mass += v;
      cx += v * x;
      cy += v * y;
    }
  }
  cx /= mass || 1;
  cy /= mass || 1;
  const ox = Math.round(14 - cx);
  const oy = Math.round(14 - cy);

  const out = new Float32Array(784);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const tx = x + ox;
      const ty = y + oy;
      if (tx < 0 || ty < 0 || tx >= 28 || ty >= 28) continue;
      out[ty * 28 + tx] = fd[(y * tw + x) * 4] / 255;
    }
  }
  return out;
}
