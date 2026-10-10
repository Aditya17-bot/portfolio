// Browser-only: rasterise a digit into a 28x28 MNIST-style input (white on black, values 0..1).

const SIZE = 28;
const SCALE = 4;

export function rasteriseDigit(digit: number, seed = 0): Float32Array {
  const big = document.createElement("canvas");
  big.width = big.height = SIZE * SCALE;
  const g = big.getContext("2d");
  const out = new Float32Array(SIZE * SIZE);
  if (!g) return out;

  // A little rotation and offset per seed, so the loop does not show the same glyph every time.
  const rot = (((seed * 37) % 11) - 5) * 0.035;
  const dx = (((seed * 13) % 5) - 2) * SCALE * 0.5;
  g.fillStyle = "#000";
  g.fillRect(0, 0, big.width, big.height);
  g.translate(big.width / 2 + dx, big.height / 2);
  g.rotate(rot);
  g.fillStyle = "#fff";
  g.font = `bold ${20 * SCALE}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(digit), 0, SCALE * 1.5);

  const small = document.createElement("canvas");
  small.width = small.height = SIZE;
  const s = small.getContext("2d");
  if (!s) return out;
  s.imageSmoothingEnabled = true;
  s.imageSmoothingQuality = "high";
  s.drawImage(big, 0, 0, SIZE, SIZE);
  const px = s.getImageData(0, 0, SIZE, SIZE).data;
  for (let i = 0; i < SIZE * SIZE; i++) out[i] = px[i * 4] / 255;
  return out;
}
