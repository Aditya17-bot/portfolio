"use client";

import { useEffect, useRef, useState } from "react";
import { loadSession, runSerial, tensor } from "@/lib/ort";
import styles from "./GanPlayground.module.css";

const MODEL = "/models/dcgan-mnist/generator.onnx";
const GRID = 8;
const STEPS = 9;

/** Deterministic standard normals for a seed (mulberry32 + Box-Muller), so a seed always draws the same digits. */
function normals(seed: number, n: number) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const r = Math.sqrt(-2 * Math.log(1 - rand()));
    const th = 2 * Math.PI * rand();
    out[i] = r * Math.cos(th);
    if (i + 1 < n) out[i + 1] = r * Math.sin(th);
  }
  return out;
}

async function generate(z: Float32Array, n: number, dim: number) {
  const session = await loadSession(MODEL);
  const res = await runSerial(session, { z: await tensor(z, [n, dim]) });
  return res.image.data as Float32Array;
}

function paint(canvas: HTMLCanvasElement | null, px: Float32Array, cols: number) {
  const g = canvas?.getContext("2d");
  if (!g) return;
  const n = px.length / 784;
  const img = g.createImageData(cols * 28, Math.ceil(n / cols) * 28);
  for (let k = 0; k < n; k++) {
    const ox = (k % cols) * 28;
    const oy = Math.floor(k / cols) * 28;
    for (let i = 0; i < 784; i++) {
      const v = Math.round(px[k * 784 + i] * 255);
      const o = ((oy + Math.floor(i / 28)) * cols * 28 + ox + (i % 28)) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** A grid of generated digits for a seed, and a walk in a straight line between two latent points. */
export function GanPlayground({ zDim }: { zDim: number }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [seed, setSeed] = useState(1);
  const [pair, setPair] = useState(1);
  const grid = useRef<HTMLCanvasElement>(null);
  const walk = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadSession(MODEL).then(() => setReady(true), () => setError(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    generate(normals(seed, GRID * GRID * zDim), GRID * GRID, zDim).then((px) => paint(grid.current, px, GRID), () => setError(true));
  }, [ready, seed, zDim]);

  useEffect(() => {
    if (!ready) return;
    const a = normals(1000 + pair * 2, zDim);
    const b = normals(1001 + pair * 2, zDim);
    const z = new Float32Array(STEPS * zDim);
    for (let s = 0; s < STEPS; s++) {
      const t = s / (STEPS - 1);
      for (let i = 0; i < zDim; i++) z[s * zDim + i] = (1 - t) * a[i] + t * b[i];
    }
    generate(z, STEPS, zDim).then((px) => paint(walk.current, px, STEPS), () => setError(true));
  }, [ready, pair, zDim]);

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  return (
    <div className={styles.wrap} data-testid="gan-playground" data-ready={ready || undefined}>
      <div className={styles.block}>
        <div className={styles.row}>
          <span className="eyebrow">64 samples · seed {seed}</span>
          <button type="button" className={styles.btn} onClick={() => setSeed((s) => s + 1)} disabled={!ready} data-testid="gan-new">
            New samples
          </button>
        </div>
        <canvas ref={grid} width={GRID * 28} height={GRID * 28} className={styles.grid} data-testid="gan-grid" />
      </div>
      <div className={styles.block}>
        <div className={styles.row}>
          <span className="eyebrow">A straight line between two random points</span>
          <button type="button" className={styles.btn} onClick={() => setPair((p) => p + 1)} disabled={!ready}>
            New pair
          </button>
        </div>
        <canvas ref={walk} width={STEPS * 28} height={28} className={styles.walk} data-testid="gan-walk" />
        <p className={styles.note}>
          Every image is drawn from {zDim} random numbers by the generator, in your browser. Nothing here was in the
          training set.
        </p>
      </div>
    </div>
  );
}
