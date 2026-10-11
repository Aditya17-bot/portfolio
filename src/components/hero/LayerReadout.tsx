"use client";

import { useEffect, useRef, useState } from "react";
import { heroPass } from "@/lib/heroPass";
import { loadMlp, type TrainedMlp } from "@/lib/mlp";
import { ARCH, forward, pixelContributions } from "@/lib/network";
import styles from "./LayerReadout.module.css";

// Same grids as the layers in the 3D drawing, so a tile sits where its neuron does.
const GRID: Record<number, [number, number]> = { 1: [16, 8], 2: [8, 8], 3: [10, 1] };
const PX = 28;
const GAP = 2;

const BG: [number, number, number] = [13, 19, 34];
const POS: [number, number, number] = [92, 225, 230];
const NEG: [number, number, number] = [255, 92, 138];
const SIGNAL = "#f5a524";

const CAPTION: Record<number, string> = {
  1: "What each of the 128 neurons learned to look for, from its 784 weights. Cyan pixels excite it, pink ones inhibit it. Tiles light up when their neuron fires for the digit passing through.",
  2: "The same digit as each of the 64 neurons reads it. Cyan pixels pushed the neuron to fire, pink ones held it back; dim tiles were switched off.",
  3: "Which pixels voted for each answer, and the probability it got.",
};

type Readout = {
  /** One 28x28 RGBA tile per neuron, packed side by side. */
  atlas: HTMLCanvasElement;
  /** Activation per neuron, scaled to 0..1 across the layer (probabilities for the output). */
  act: Float32Array;
  on: boolean[];
  pred: number;
};

function paintTiles(maps: ArrayLike<number>[], atlas: HTMLCanvasElement) {
  const n = maps.length;
  atlas.width = n * PX;
  atlas.height = PX;
  const g = atlas.getContext("2d")!;
  const img = g.createImageData(n * PX, PX);
  maps.forEach((m, t) => {
    let max = 0;
    for (let p = 0; p < PX * PX; p++) max = Math.max(max, Math.abs(m[p]));
    for (let p = 0; p < PX * PX; p++) {
      const v = max ? m[p] / max : 0;
      const c = v >= 0 ? POS : NEG;
      const a = Math.pow(Math.abs(v), 0.7);
      const o = ((p / PX) | 0) * n * PX * 4 + (t * PX + (p % PX)) * 4;
      img.data[o] = BG[0] + (c[0] - BG[0]) * a;
      img.data[o + 1] = BG[1] + (c[1] - BG[1]) * a;
      img.data[o + 2] = BG[2] + (c[2] - BG[2]) * a;
      img.data[o + 3] = 255;
    }
  });
  g.putImageData(img, 0, 0);
}

function build(model: TrainedMlp, layer: number, x: Float32Array, atlas: HTMLCanvasElement): Readout {
  const acts = forward(model.weights, x);
  const a = acts[layer];
  const out = layer === ARCH.length - 1;
  let max = 0;
  for (const v of a) max = Math.max(max, v);
  const act = out ? Float32Array.from(a) : a.map((v) => (max ? v / max : 0));
  let pred = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[pred]) pred = i;

  if (layer === 1) {
    // The first hidden layer's own weights: a fixed picture of what each neuron looks for.
    const maps = Array.from({ length: a.length }, (_, j) => model.weights.W[0].subarray(j * 784, (j + 1) * 784));
    paintTiles(maps, atlas);
  } else {
    paintTiles(pixelContributions(model.weights, x, layer), atlas);
  }
  return { atlas, act, on: Array.from(a, (v) => v > 0), pred };
}

/**
 * A flat x-ray of one layer of the hero network: one tile per neuron, laid out like the 3D
 * layer, lit in step with the forward pass the scene is playing. Pointing at a tile marks
 * that neuron in the 3D drawing.
 */
export function LayerReadout({ layer }: { layer: 1 | 2 | 3 }) {
  const [cols, rows] = GRID[layer];
  const n = ARCH[layer];
  const out = layer === ARCH.length - 1;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<TrainedMlp | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [status, setStatus] = useState<{ act: number[]; on: boolean[]; pred: number } | null>(null);
  const hoverRef = useRef<number | null>(null);
  const readout = useRef<Readout | null>(null);

  useEffect(() => {
    loadMlp().then(setModel, () => setModel(null));
  }, []);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!model || !el || !box) return;
    const atlas = document.createElement("canvas");
    let version = -1;
    let input: Float32Array | null = null;
    let drawnKey = "";
    let raf = 0;
    let visible = false;

    const frame = () => {
      raf = 0;
      if (!visible) return;
      // Without the 3D scene (no WebGL) there is no pass to follow: show the first test digit, lit.
      const live = heroPass.input !== null;
      const x = heroPass.input ?? model.samples[0];
      if (x !== input || (live && heroPass.version !== version)) {
        input = x;
        version = heroPass.version;
        readout.current = build(model, layer, x, atlas);
        drawThumb(x);
        const r = readout.current;
        setStatus({ act: Array.from(r.act), on: r.on, pred: r.pred });
        drawnKey = "";
      }
      const lit = live ? heroPass.lit[layer] : 1;
      const key = `${version}:${lit.toFixed(2)}:${hoverRef.current}:${el.clientWidth}`;
      if (key !== drawnKey) {
        drawnKey = key;
        draw(lit);
      }
      raf = requestAnimationFrame(frame);
    };

    function drawThumb(x: Float32Array) {
      const c = thumb.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      const img = g.createImageData(PX, PX);
      for (let p = 0; p < PX * PX; p++) {
        const v = x[p];
        img.data.set([BG[0] + (POS[0] - BG[0]) * v, BG[1] + (POS[1] - BG[1]) * v, BG[2] + (POS[2] - BG[2]) * v, 255], p * 4);
      }
      g.putImageData(img, 0, 0);
    }

    function draw(lit: number) {
      const r = readout.current;
      const g = el!.getContext("2d");
      if (!r || !g) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = el!.clientWidth;
      const tile = (w - GAP * (cols - 1)) / cols;
      const h = tile * rows + GAP * (rows - 1);
      if (el!.width !== Math.round(w * dpr) || el!.height !== Math.round(h * dpr)) {
        el!.width = Math.round(w * dpr);
        el!.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.imageSmoothingEnabled = false;
      const focus = hoverRef.current;
      for (let i = 0; i < n; i++) {
        const cx = (i % cols) * (tile + GAP);
        const cy = Math.floor(i / cols) * (tile + GAP);
        const a = r.act[i];
        const glow = r.on[i] ? (out ? (i === r.pred ? 1 : Math.sqrt(a)) : a) * lit : 0;
        g.fillStyle = `rgb(${BG.join(",")})`;
        g.fillRect(cx, cy, tile, tile);
        g.globalAlpha = 0.42 + 0.58 * Math.min(1, glow * 1.4);
        g.drawImage(r.atlas, i * PX, 0, PX, PX, cx, cy, tile, tile);
        g.globalAlpha = 1;
        const lineW = out ? 2 : 1;
        if (out && i === r.pred && lit > 0.5) {
          g.strokeStyle = SIGNAL;
          g.lineWidth = lineW;
          g.strokeRect(cx + lineW / 2, cy + lineW / 2, tile - lineW, tile - lineW);
        } else if (glow > 0.35) {
          g.strokeStyle = `rgba(92,225,230,${Math.min(0.9, glow)})`;
          g.lineWidth = 1;
          g.strokeRect(cx + 0.5, cy + 0.5, tile - 1, tile - 1);
        }
        if (i === focus) {
          g.strokeStyle = "#fff";
          g.lineWidth = 2;
          g.strokeRect(cx - 1, cy - 1, tile + 2, tile + 2);
        }
      }
    }

    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(box);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [model, layer, cols, rows, n, out]);

  // Keep the scene's marker in step with the tile under the pointer.
  useEffect(() => {
    heroPass.focus = hover === null ? null : { layer, index: hover };
    heroPass.invalidate();
  }, [hover, layer]);

  useEffect(
    () => () => {
      if (heroPass.focus?.layer === layer) heroPass.focus = null;
    },
    [layer],
  );

  function tileAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const tile = (rect.width - GAP * (cols - 1)) / cols;
    const c = Math.floor((e.clientX - rect.left) / (tile + GAP));
    const r = Math.floor((e.clientY - rect.top) / (tile + GAP));
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    return r * cols + c;
  }

  function onKey(e: React.KeyboardEvent) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    if (e.key === "Escape") return setHover(null);
    if (!(e.key in step)) return;
    e.preventDefault();
    setHover((h) => (h === null ? 0 : Math.min(n - 1, Math.max(0, h + step[e.key]))));
  }

  const label = out ? `Digit ${hover}` : `Neuron ${hover !== null ? hover + 1 : ""} of ${n}`;
  let detail = CAPTION[layer];
  if (hover !== null && status) {
    if (out) detail = `${label}: ${(status.act[hover] * 100).toFixed(1)}%. Cyan pixels argued for it, pink ones against.`;
    else if (!status.on[hover]) detail = `${label} is silent for this digit: ReLU set it to zero. It is marked in the network.`;
    else detail = `${label} fired at ${Math.round(status.act[hover] * 100)}% of the layer's strongest. It is marked in the network.`;
  }

  return (
    <figure ref={wrap} className={styles.readout} data-layer={layer} data-testid={`readout-${layer}`}>
      <canvas
        ref={canvas}
        className={styles.grid}
        style={{ aspectRatio: `${cols} / ${rows}` }}
        tabIndex={0}
        role="img"
        aria-label={`${n} tiles, one per neuron in this layer. Use the arrow keys to step through them.`}
        onPointerMove={(e) => setHover(tileAt(e))}
        onPointerDown={(e) => setHover(tileAt(e))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      />
      {out ? (
        <ol className={styles.classes} aria-label="Probability per digit">
          {Array.from({ length: n }, (_, d) => {
            const p = status?.act[d] ?? 0;
            return (
              <li key={d} data-top={status?.pred === d || undefined}>
                <span>{d}</span>
                <span className={styles.bar}>
                  <span style={{ transform: `scaleY(${p})` }} />
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <figcaption className={styles.caption}>
        {layer === 1 ? (
          <canvas ref={thumb} width={PX} height={PX} className={styles.thumb} aria-hidden="true" />
        ) : null}
        <span aria-live="polite">{detail}</span>
      </figcaption>
    </figure>
  );
}
