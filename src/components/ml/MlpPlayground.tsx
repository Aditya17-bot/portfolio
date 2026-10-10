"use client";

import { useEffect, useRef, useState } from "react";
import { drawnInput } from "@/lib/drawnInput";
import { loadMlp, type TrainedMlp } from "@/lib/mlp";
import { forward } from "@/lib/network";
import { DrawPad } from "./DrawPad";
import { Predictions } from "./Predictions";
import styles from "./MlpPlayground.module.css";

/**
 * Draw a digit, run the trained NumPy MLP on it in the browser. In the hero it also
 * feeds the drawing to the 3D network so the visitor watches their own input propagate.
 */
export function MlpPlayground({ variant = "page", linkHero = false }: { variant?: "page" | "hero"; linkHero?: boolean }) {
  const [model, setModel] = useState<TrainedMlp | null>(null);
  const [error, setError] = useState(false);
  const [input, setInput] = useState<Float32Array | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const sampleIdx = useRef(0);

  useEffect(() => {
    loadMlp().then(setModel, () => setError(true));
  }, []);

  const probs = model && input ? forward(model.weights, input).at(-1)! : null;

  function apply(x: Float32Array | null) {
    setInput(x);
    if (linkHero) drawnInput.set(x);
  }

  // What the network actually sees: the 28x28 input after preprocessing.
  useEffect(() => {
    const c = preview.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const img = g.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const v = input ? Math.round(input[i] * 255) : 0;
      img.data.set([v, v, v, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
  }, [input]);

  function sample() {
    if (!model) return;
    sampleIdx.current = (sampleIdx.current + 7) % model.samples.length;
    apply(model.samples[sampleIdx.current]);
  }

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  return (
    <div className={`${styles.wrap} ${styles[variant]}`} data-testid="mlp-playground">
      <div className={styles.left}>
        <DrawPad onInput={apply} size={variant === "hero" ? 168 : 240} />
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={sample} disabled={!model}>
            {variant === "hero" ? "MNIST sample" : "Use an MNIST test digit"}
          </button>
          {variant === "page" ? (
            <figure className={styles.seen}>
              <canvas ref={preview} width={28} height={28} aria-label="The 28 by 28 input the network sees" />
              <figcaption>28×28 input</figcaption>
            </figure>
          ) : null}
        </div>
      </div>
      <Predictions probs={probs} compact={variant === "hero"} />
    </div>
  );
}
