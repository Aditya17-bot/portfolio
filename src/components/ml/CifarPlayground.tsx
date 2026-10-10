"use client";

import { useEffect, useRef, useState } from "react";
import { latestRunner, loadSession, tensor } from "@/lib/ort";
import { Predictions } from "./Predictions";
import styles from "./CifarPlayground.module.css";

const PIXELS = 3 * 32 * 32;
const SHOWN = 12;

type Out = { probs: Float32Array; cam: Float32Array; ms: number };
type Input = { x: Float32Array; rgba: Uint8ClampedArray; label: number | null };

async function loadSamples(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** uint8 CHW sample to model input (float CHW in [0, 1]) and display pixels (RGBA, HWC). */
function fromChw(chw: Uint8Array): Pick<Input, "x" | "rgba"> {
  const x = new Float32Array(PIXELS);
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < 1024; i++) {
    for (let c = 0; c < 3; c++) {
      x[c * 1024 + i] = chw[c * 1024 + i] / 255;
      rgba[i * 4 + c] = chw[c * 1024 + i];
    }
    rgba[i * 4 + 3] = 255;
  }
  return { x, rgba };
}

/** Centre-crop a photo to a square and shrink it to 32x32, the size the model was trained on. */
async function fromFile(file: File): Promise<Pick<Input, "x" | "rgba">> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 32, 32);
  bmp.close();
  const rgba = g.getImageData(0, 0, 32, 32).data;
  const x = new Float32Array(PIXELS);
  for (let i = 0; i < 1024; i++) for (let c = 0; c < 3; c++) x[c * 1024 + i] = rgba[i * 4 + c] / 255;
  return { x, rgba };
}

function draw(canvas: HTMLCanvasElement | null, rgba: Uint8ClampedArray) {
  const g = canvas?.getContext("2d");
  if (!g) return;
  const img = g.createImageData(32, 32);
  img.data.set(rgba);
  g.putImageData(img, 0, 0);
}

/**
 * Pick a CIFAR-10 test image or upload a photo. The model runs in the browser and returns class
 * probabilities and a class activation map, drawn over the image for the predicted class.
 */
export function CifarPlayground({
  model,
  samples: samplesUrl,
  sampleLabels,
  classes,
  camSize,
  testId = "cifar-playground",
}: {
  model: string;
  samples: string;
  sampleLabels: number[];
  classes: string[];
  camSize: number;
  testId?: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [samples, setSamples] = useState<Uint8Array | null>(null);
  const [offset, setOffset] = useState(0);
  const [input, setInput] = useState<Input | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const [showCam, setShowCam] = useState(true);
  const run = useRef<((x: Float32Array) => void) | null>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const heat = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    async function infer(x: Float32Array): Promise<Out> {
      const session = await loadSession(model);
      const t0 = performance.now();
      const res = await session.run({ image: await tensor(x, [1, 3, 32, 32]) });
      return { probs: res.probs.data as Float32Array, cam: res.cam.data as Float32Array, ms: performance.now() - t0 };
    }
    run.current = latestRunner(infer, setOut);
    loadSession(model).then(() => setReady(true), () => setError(true));
    loadSamples(samplesUrl).then(setSamples, () => setError(true));
  }, [model, samplesUrl]);

  // Thumbnails for the current page of samples.
  useEffect(() => {
    if (!samples) return;
    for (let k = 0; k < SHOWN; k++) {
      const i = (offset + k) % sampleLabels.length;
      draw(thumbs.current[k], fromChw(samples.subarray(i * PIXELS, (i + 1) * PIXELS)).rgba);
    }
  }, [samples, offset, sampleLabels.length]);

  useEffect(() => {
    if (input) draw(view.current, input.rgba);
  }, [input]);

  // Class activation map of the predicted class: min-max scaled, upsampled bilinearly, amber ramp.
  useEffect(() => {
    const g = heat.current?.getContext("2d");
    if (!g || !heat.current) return;
    g.clearRect(0, 0, heat.current.width, heat.current.height);
    if (!out || !input) return;
    let top = 0;
    for (let c = 1; c < out.probs.length; c++) if (out.probs[c] > out.probs[top]) top = c;
    const n = camSize * camSize;
    const map = out.cam.subarray(top * n, (top + 1) * n);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of map) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const small = document.createElement("canvas");
    small.width = small.height = camSize;
    const sg = small.getContext("2d")!;
    const img = sg.createImageData(camSize, camSize);
    for (let i = 0; i < n; i++) {
      const v = hi > lo ? (map[i] - lo) / (hi - lo) : 0;
      img.data.set([255, Math.round(120 + 110 * v), Math.round(40 * (1 - v)), Math.round(210 * v * v)], i * 4);
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, heat.current.width, heat.current.height);
  }, [out, input, camSize]);

  function apply(next: Input) {
    setInput(next);
    setOut(null);
    run.current?.(next.x);
  }

  function pick(k: number) {
    if (!samples) return;
    const i = (offset + k) % sampleLabels.length;
    apply({ ...fromChw(samples.subarray(i * PIXELS, (i + 1) * PIXELS)), label: sampleLabels[i] });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      apply({ ...(await fromFile(file)), label: null });
    } catch {
      setError(true);
    }
  }

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  const top = out ? out.probs.indexOf(Math.max(...out.probs)) : -1;

  return (
    <div className={styles.wrap} data-testid={testId} data-ready={(ready && !!samples) || undefined}>
      <div className={styles.pickers}>
        <p className="eyebrow">CIFAR-10 test images</p>
        <div className={styles.thumbs}>
          {Array.from({ length: SHOWN }, (_, k) => (
            <button
              key={k}
              type="button"
              className={styles.thumb}
              onClick={() => pick(k)}
              disabled={!ready || !samples}
              aria-label={`Test image: ${classes[sampleLabels[(offset + k) % sampleLabels.length]]}`}
              data-testid="cifar-sample"
            >
              <canvas
                ref={(el) => {
                  thumbs.current[k] = el;
                }}
                width={32}
                height={32}
              />
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => setOffset((o) => (o + SHOWN) % sampleLabels.length)}>
            More images
          </button>
          <label className={styles.btn}>
            Upload a photo
            <input
              type="file"
              accept="image/*"
              className={styles.file}
              onChange={(e) => upload(e.target.files?.[0])}
              disabled={!ready}
              data-testid="cifar-upload"
            />
          </label>
        </div>
      </div>

      <div className={styles.result}>
        <figure className={styles.stage}>
          <div className={styles.frame} data-empty={!input || undefined}>
            <canvas ref={view} width={32} height={32} className={styles.image} />
            <canvas ref={heat} width={128} height={128} className={styles.heat} hidden={!showCam} />
            {!input ? <span className={styles.placeholder}>Pick an image</span> : null}
          </div>
          <figcaption className={styles.caption}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={showCam} onChange={(e) => setShowCam(e.target.checked)} />
              Where it looked{out ? `, for “${classes[top]}”` : ""}
            </label>
            {input?.label != null ? (
              <span data-testid="cifar-truth">
                Label: {classes[input.label]}
                {out ? (top === input.label ? " · correct" : " · wrong") : ""}
              </span>
            ) : input ? (
              <span>Your photo, shrunk to 32×32</span>
            ) : null}
          </figcaption>
        </figure>
        <div className={styles.side}>
          <Predictions probs={input && out ? out.probs : null} labels={classes} waiting={ready ? "Waiting for an image" : "Loading the model…"} />
          <p className={styles.note} data-testid="cifar-meta">
            {out ? `${out.ms.toFixed(1)} ms in your browser. Nothing is uploaded.` : "Runs in your browser. Nothing is uploaded."}
          </p>
        </div>
      </div>
    </div>
  );
}
