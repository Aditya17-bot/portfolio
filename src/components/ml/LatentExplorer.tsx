"use client";

import { useEffect, useRef, useState } from "react";
import { latestRunner, loadSession, runSerial, tensor } from "@/lib/ort";
import { DrawPad } from "./DrawPad";
import styles from "./LatentExplorer.module.css";

const ENCODER = "/models/vae-mnist/encoder.onnx";
const DECODER = "/models/vae-mnist/decoder.onnx";
const LATENT = "/models/vae-mnist/latent.json";
const MAP = 360; // canvas pixels
const GRID = 12; // decoded tiles per side in the manifold view

// One colour per digit, readable on the dark map.
export const DIGIT_COLOURS = [
  "#5ce1e6", "#f5a524", "#ff5c8a", "#9b8cff", "#7ee081", "#ff8f5c", "#4da3ff", "#e6e15c", "#d77bff", "#c9d1e0",
];

type Latent = { points: [number, number, number][]; extent: [[number, number], [number, number]] };
type Z = [number, number];

async function decode(z: Z) {
  const s = await loadSession(DECODER);
  const res = await runSerial(s, { z: await tensor(new Float32Array(z), [1, 2]) });
  return res.image.data as Float32Array;
}

async function encode(x: Float32Array | null): Promise<Z | null> {
  if (!x) return null;
  const s = await loadSession(ENCODER);
  const res = await runSerial(s, { image: await tensor(x, [1, 1, 28, 28]) });
  const mu = res.mu.data as Float32Array;
  return [mu[0], mu[1]];
}

function paintDigit(canvas: HTMLCanvasElement | null, pixels: Float32Array, offset = 0, dx = 0, dy = 0) {
  const g = canvas?.getContext("2d");
  if (!g) return;
  const img = g.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const v = Math.round(pixels[offset + i] * 255);
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, dx, dy);
}

/**
 * The 2-D latent space of the VAE: 2,000 test digits placed where the encoder puts them, and a
 * cursor you drag to decode any point. Drawing a digit encodes it and moves the cursor there.
 */
export function LatentExplorer() {
  const [latent, setLatent] = useState<Latent | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [z, setZ] = useState<Z>([0, 0]);
  const [view, setView] = useState<"points" | "grid">("points");
  const map = useRef<HTMLCanvasElement>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const grid = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const runDecode = useRef<((z: Z) => void) | null>(null);
  const runEncode = useRef<((x: Float32Array | null) => void) | null>(null);

  useEffect(() => {
    runDecode.current = latestRunner(decode, (px) => paintDigit(out.current, px));
    runEncode.current = latestRunner(encode, (mu) => {
      if (mu) {
        setZ(mu);
        runDecode.current?.(mu);
      }
    });
    fetch(LATENT)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setLatent, () => setError(true));
    Promise.all([loadSession(DECODER), loadSession(ENCODER)]).then(
      () => {
        setReady(true);
        runDecode.current?.([0, 0]);
      },
      () => setError(true),
    );
  }, []);

  // Map coordinates: latent extent to canvas pixels, y up.
  const ext = latent?.extent ?? [[-3, 3], [-3, 3]];
  const toPx = (a: number, b: number): [number, number] => [
    ((a - ext[0][0]) / (ext[0][1] - ext[0][0])) * MAP,
    (1 - (b - ext[1][0]) / (ext[1][1] - ext[1][0])) * MAP,
  ];
  const fromPx = (px: number, py: number): Z => [
    ext[0][0] + (px / MAP) * (ext[0][1] - ext[0][0]),
    ext[1][0] + (1 - py / MAP) * (ext[1][1] - ext[1][0]),
  ];

  // Scatter of the test digits.
  useEffect(() => {
    const g = map.current?.getContext("2d");
    if (!g || !latent) return;
    g.fillStyle = "#05070d";
    g.fillRect(0, 0, MAP, MAP);
    for (const [a, b, label] of latent.points) {
      const [px, py] = toPx(a, b);
      g.fillStyle = DIGIT_COLOURS[label];
      g.globalAlpha = 0.75;
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latent]);

  // The manifold: decode a GRID x GRID lattice over the same extent in one batch.
  useEffect(() => {
    if (!ready || !latent || view !== "grid") return;
    let cancelled = false;
    (async () => {
      const zs = new Float32Array(GRID * GRID * 2);
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++) {
          const [a, b] = fromPx(((c + 0.5) / GRID) * MAP, ((r + 0.5) / GRID) * MAP);
          zs.set([a, b], (r * GRID + c) * 2);
        }
      const s = await loadSession(DECODER);
      const res = await runSerial(s, { z: await tensor(zs, [GRID * GRID, 2]) });
      if (cancelled) return;
      const px = res.image.data as Float32Array;
      for (let k = 0; k < GRID * GRID; k++) paintDigit(grid.current, px, k * 784, (k % GRID) * 28, Math.floor(k / GRID) * 28);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, latent, view]);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = Math.min(Math.max(((e.clientX - r.left) / r.width) * MAP, 0), MAP);
    const py = Math.min(Math.max(((e.clientY - r.top) / r.height) * MAP, 0), MAP);
    const next = fromPx(px, py);
    setZ(next);
    runDecode.current?.(next);
  }

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  const [cx, cy] = toPx(z[0], z[1]);

  return (
    <div className={styles.wrap} data-testid="vae-explorer" data-ready={(ready && !!latent) || undefined}>
      <div className={styles.mapCol}>
        <div className={styles.row}>
          <span className="eyebrow">Latent space</span>
          <span className={styles.tabs} role="group" aria-label="Map view">
            <button type="button" aria-pressed={view === "points"} onClick={() => setView("points")}>
              Test digits
            </button>
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              Decoded grid
            </button>
          </span>
        </div>
        <div
          className={styles.map}
          data-testid="vae-map"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => dragging.current && move(e)}
          onPointerUp={() => {
            dragging.current = false;
          }}
          role="application"
          aria-label="Drag to move through the latent space"
        >
          <canvas ref={map} width={MAP} height={MAP} hidden={view !== "points"} />
          <canvas ref={grid} width={GRID * 28} height={GRID * 28} hidden={view !== "grid"} className={styles.grid} />
          <span className={styles.cursor} style={{ left: `${(cx / MAP) * 100}%`, top: `${(cy / MAP) * 100}%` }} />
        </div>
        <ol className={styles.legend} aria-label="Colour per digit">
          {DIGIT_COLOURS.map((c, d) => (
            <li key={d} style={{ color: c }}>
              {d}
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.side}>
        <figure className={styles.decoded}>
          <canvas ref={out} width={28} height={28} data-testid="vae-output" />
          <figcaption>
            Decoded from z = ({z[0].toFixed(2)}, {z[1].toFixed(2)})
          </figcaption>
        </figure>
        <div className={styles.encode}>
          <p className="eyebrow">Or draw a digit</p>
          <DrawPad onInput={(x) => runEncode.current?.(x)} size={168} label="Draw a digit to encode it" />
          <p className={styles.note}>The encoder places your drawing on the map, and the decoder redraws it from those two numbers.</p>
        </div>
      </div>
    </div>
  );
}
