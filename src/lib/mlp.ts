import type { Weights } from "./network";

export type MlpMeta = {
  arch: number[];
  params: number;
  results: Record<string, number>;
  layers: { in: number; out: number; w_offset: number; b_offset: number; scale: number[] }[];
  samples: { count: number; labels: number[]; test_indices: number[] };
};

export type TrainedMlp = { weights: Weights; samples: Float32Array[]; labels: number[] };

const BASE = "/models/mlp";
let cache: Promise<TrainedMlp> | null = null;

/** Fetch the trained MLP once per page: int8 weights dequantised to float32, plus real MNIST test digits. */
export function loadMlp(): Promise<TrainedMlp> {
  cache ??= (async () => {
    const [meta, wbuf, sbuf] = await Promise.all([
      fetch(`${BASE}/meta.json`).then((r) => r.json() as Promise<MlpMeta>),
      fetch(`${BASE}/weights.bin`).then((r) => r.arrayBuffer()),
      fetch(`${BASE}/samples.bin`).then((r) => r.arrayBuffer()),
    ]);
    const W: Float32Array[] = [];
    const b: Float32Array[] = [];
    for (const l of meta.layers) {
      const q = new Int8Array(wbuf, l.w_offset, l.in * l.out);
      const w = new Float32Array(q.length);
      for (let o = 0; o < l.out; o++) {
        const s = l.scale[o];
        for (let i = 0; i < l.in; i++) w[o * l.in + i] = q[o * l.in + i] * s;
      }
      W.push(w);
      b.push(new Float32Array(wbuf.slice(l.b_offset, l.b_offset + l.out * 4)));
    }
    const px = new Uint8Array(sbuf);
    const samples = Array.from({ length: meta.samples.count }, (_, k) => {
      const x = new Float32Array(784);
      for (let i = 0; i < 784; i++) x[i] = px[k * 784 + i] / 255;
      return x;
    });
    return { weights: { W, b }, samples, labels: meta.samples.labels };
  })();
  cache.catch(() => (cache = null));
  return cache;
}
