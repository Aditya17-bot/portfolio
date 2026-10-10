"use client";

import { useEffect, useRef, useState } from "react";
import { loadMlp, type TrainedMlp } from "@/lib/mlp";
import { argmax, forward } from "@/lib/network";
import { latestRunner, loadSession, tensor } from "@/lib/ort";
import { DrawPad } from "./DrawPad";
import { FeatureMaps } from "./FeatureMaps";
import { Predictions } from "./Predictions";
import styles from "./MlpPlayground.module.css";

const MODEL = "/models/cnn-mnist/model.onnx";

type Out = { probs: Float32Array; conv1: Float32Array; conv4: Float32Array; ms: number };

async function infer(x: Float32Array | null): Promise<Out | null> {
  if (!x) return null;
  const session = await loadSession(MODEL);
  const t0 = performance.now();
  const res = await session.run({ image: await tensor(x, [1, 1, 28, 28]) });
  return {
    probs: res.probs.data as Float32Array,
    conv1: res.conv1.data as Float32Array,
    conv4: res.conv4.data as Float32Array,
    ms: performance.now() - t0,
  };
}

/** Draw a digit; the CNN runs in the browser through onnxruntime-web, the MLP alongside it for comparison. */
export function CnnPlayground() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [input, setInput] = useState<Float32Array | null>(null);
  const [mlp, setMlp] = useState<TrainedMlp | null>(null);
  const sampleIdx = useRef(0);

  const run = useRef<((x: Float32Array | null) => void) | null>(null);

  useEffect(() => {
    run.current = latestRunner(infer, setOut);
    loadSession(MODEL).then(() => setReady(true), () => setError(true));
    loadMlp().then(setMlp, () => {});
  }, []);

  function apply(x: Float32Array | null) {
    setInput(x);
    run.current?.(x);
  }

  function sample() {
    if (!mlp) return;
    sampleIdx.current = (sampleIdx.current + 7) % mlp.samples.length;
    apply(mlp.samples[sampleIdx.current]);
  }

  const mlpPred = mlp && input ? argmax(forward(mlp.weights, input).at(-1)!) : null;

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  return (
    <div className={styles.cnn} data-testid="cnn-playground" data-ready={ready || undefined}>
      <div className={`${styles.wrap} ${styles.page}`}>
        <div className={styles.left}>
          <DrawPad onInput={apply} size={240} />
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={sample} disabled={!ready || !mlp}>
              Use an MNIST test digit
            </button>
          </div>
        </div>
        <div className={styles.left}>
          <Predictions probs={input ? (out?.probs ?? null) : null} />
          <p className={styles.note} data-testid="cnn-meta">
            {!ready
              ? "Loading the runtime…"
              : out && input
                ? `${out.ms.toFixed(1)} ms in your browser · the MLP from the front page reads ${mlpPred}`
                : "Runtime ready. Nothing leaves your browser."}
          </p>
        </div>
      </div>
      <div className={styles.maps}>
        <FeatureMaps
          data={input ? (out?.conv1 ?? null) : null}
          shape={[8, 26, 26]}
          title="Layer 1 · 8 filters"
          note="Edges and strokes at each position"
        />
        <FeatureMaps
          data={input ? (out?.conv4 ?? null) : null}
          shape={[16, 8, 8]}
          title="Layer 4 · 16 filters"
          note="Parts of digits, coarser and more abstract"
        />
      </div>
    </div>
  );
}
