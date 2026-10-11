// The network drawn in the hero. Same architecture as the MNIST MLP in the model zoo,
// so the picture can later run the trained weights instead of random ones.

export const ARCH = [784, 128, 64, 10] as const;

export type Weights = {
  /** W[l] is row-major [out][in] for the layer l -> l+1. */
  W: Float32Array[];
  b: Float32Array[];
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** He-initialised weights: what the network looks like before any training. */
export function randomWeights(arch: readonly number[] = ARCH, seed = 7): Weights {
  const rand = mulberry32(seed);
  const W: Float32Array[] = [];
  const b: Float32Array[] = [];
  for (let l = 0; l < arch.length - 1; l++) {
    const nIn = arch[l];
    const nOut = arch[l + 1];
    const std = Math.sqrt(2 / nIn);
    const w = new Float32Array(nIn * nOut);
    for (let i = 0; i < w.length; i++) w[i] = gaussian(rand) * std;
    W.push(w);
    b.push(new Float32Array(nOut));
  }
  return { W, b };
}

/** Forward pass. Returns activations for every layer, input included. ReLU hidden, softmax output. */
export function forward(weights: Weights, input: Float32Array): Float32Array[] {
  const acts: Float32Array[] = [input];
  let x = input;
  const L = weights.W.length;
  for (let l = 0; l < L; l++) {
    const nIn = x.length;
    const nOut = weights.b[l].length;
    const w = weights.W[l];
    const out = new Float32Array(nOut);
    for (let o = 0; o < nOut; o++) {
      let s = weights.b[l][o];
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) s += w[row + i] * x[i];
      out[o] = l < L - 1 ? Math.max(0, s) : s;
    }
    if (l === L - 1) softmaxInPlace(out);
    acts.push(out);
    x = out;
  }
  return acts;
}

export function softmaxInPlace(v: Float32Array) {
  let max = -Infinity;
  for (const x of v) max = Math.max(max, x);
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    v[i] = Math.exp(v[i] - max);
    sum += v[i];
  }
  for (let i = 0; i < v.length; i++) v[i] /= sum;
  return v;
}

export function argmax(v: ArrayLike<number>) {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return best;
}

/** Scale a layer's activations to [0, 1] for display. */
export function normalise(v: Float32Array) {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const out = new Float32Array(v.length);
  if (max === 0) return out;
  for (let i = 0; i < v.length; i++) out[i] = Math.abs(v[i]) / max;
  return out;
}

export type LayerLayout = {
  size: number;
  /** xyz per neuron. */
  positions: Float32Array;
  z: number;
  /** Grid used to place the neurons; the output layer is one row. */
  cols: number;
  rows: number;
  spacing: number;
};

/** Depth of each layer: the network runs front to back along +z. */
export const LAYER_Z = [-6, -2, 2, 6];
const GRID: [number, number, number][] = [
  [28, 28, 0.12],
  [16, 8, 0.3],
  [8, 8, 0.34],
  [10, 1, 0.5],
];

export function layoutLayers(arch: readonly number[] = ARCH): LayerLayout[] {
  return arch.map((size, l) => {
    const [cols, rows, spacing] = GRID[l];
    const z = LAYER_Z[l];
    const positions = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      // Each layer is a grid in the XY plane, row 0 at the top. Column 0 sits at +x so the
      // grid reads left to right for a camera looking down +z, the way the signal travels.
      positions[i * 3] = ((cols - 1) / 2 - c) * spacing;
      positions[i * 3 + 1] = ((rows - 1) / 2 - r) * spacing;
      positions[i * 3 + 2] = z;
    }
    return { size, positions, z, cols, rows, spacing };
  });
}

export type Edge = { layer: number; src: number; dst: number; weight: number };

/**
 * Drawing all 110k connections would be noise. For each destination neuron keep the k
 * incoming connections that matter most to it. A connection matters by |weight| times how
 * active its source usually is: a large weight on a corner pixel that is always blank
 * carries nothing, so `importance` (mean source activation per layer) is factored in.
 */
export function selectEdges(
  weights: Weights,
  arch: readonly number[] = ARCH,
  k: number[] = [5, 4, 8],
  importance: (Float32Array | undefined)[] = [],
): Edge[] {
  const edges: Edge[] = [];
  for (let l = 0; l < arch.length - 1; l++) {
    const nIn = arch[l];
    const nOut = arch[l + 1];
    const w = weights.W[l];
    const imp = importance[l];
    const keep = Math.min(k[l] ?? 4, nIn);
    const score = new Float32Array(nIn);
    for (let o = 0; o < nOut; o++) {
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) score[i] = Math.abs(w[row + i]) * (imp ? imp[i] : 1);
      const idx = Array.from({ length: nIn }, (_, i) => i);
      idx.sort((a, b) => score[b] - score[a]);
      for (let j = 0; j < keep; j++) edges.push({ layer: l, src: idx[j], dst: o, weight: w[row + idx[j]] });
    }
  }
  return edges;
}

/** Mean activation of every layer over a set of inputs. */
export function meanActivations(weights: Weights, inputs: Float32Array[]): Float32Array[] {
  let sums: Float32Array[] | null = null;
  for (const x of inputs) {
    const acts = forward(weights, x);
    if (!sums) sums = acts.map((a) => new Float32Array(a.length));
    acts.forEach((a, l) => a.forEach((v, i) => (sums![l][i] += v)));
  }
  return (sums ?? []).map((s) => s.map((v) => v / inputs.length));
}

/**
 * Per-pixel contributions to every neuron of one layer (1 = first hidden, ARCH.length - 1 =
 * output logits). With ReLU hidden layers the network is exactly linear for a fixed input:
 * once it is known which neurons are on, each neuron's pre-activation is T·x + const. This
 * returns T(p)·x(p) for every pixel p, so a map shows which pixels pushed the neuron up
 * (positive) or held it down (negative) for this input.
 */
export function pixelContributions(weights: Weights, x: Float32Array, layer: number): Float32Array[] {
  const acts = forward(weights, x);
  const nPix = x.length;
  const lit: number[] = [];
  for (let p = 0; p < nPix; p++) if (x[p] > 0) lit.push(p);

  // T[j] holds neuron j's template, restricted to the lit pixels.
  let nIn = nPix;
  let T: Float32Array[] = [];
  for (let l = 0; l < layer; l++) {
    const nOut = weights.b[l].length;
    const w = weights.W[l];
    const next: Float32Array[] = [];
    for (let j = 0; j < nOut; j++) {
      const row = new Float32Array(lit.length);
      if (l === 0) {
        for (let i = 0; i < lit.length; i++) row[i] = w[j * nIn + lit[i]];
      } else {
        const prev = acts[l];
        for (let k = 0; k < nIn; k++) {
          if (prev[k] <= 0) continue;
          const wk = w[j * nIn + k];
          const tk = T[k];
          for (let i = 0; i < lit.length; i++) row[i] += wk * tk[i];
        }
      }
      next.push(row);
    }
    T = next;
    nIn = nOut;
  }

  return T.map((row) => {
    const out = new Float32Array(nPix);
    for (let i = 0; i < lit.length; i++) out[lit[i]] = row[i] * x[lit[i]];
    return out;
  });
}
