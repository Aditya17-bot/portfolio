"use client";

import { useEffect, useRef, useState } from "react";
import type { Tensor } from "onnxruntime-web";
import { loadSession, runSerial } from "@/lib/ort";
import styles from "./GptPlayground.module.css";

const MODEL = "/models/mini-gpt/model.onnx";

async function int64(ids: number[]): Promise<Tensor> {
  const m = await import("onnxruntime-web/wasm");
  return new m.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
}

function sample(logits: Float32Array, offset: number, vocab: number, temperature: number) {
  let max = -Infinity;
  for (let i = 0; i < vocab; i++) max = Math.max(max, logits[offset + i]);
  const p = new Float64Array(vocab);
  let sum = 0;
  for (let i = 0; i < vocab; i++) sum += p[i] = Math.exp((logits[offset + i] - max) / temperature);
  let r = Math.random() * sum;
  for (let i = 0; i < vocab; i++) if ((r -= p[i]) <= 0) return i;
  return vocab - 1;
}

const clock = () => performance.now();

type Focus = { pos: number; start: number; weights: Float32Array; t: number };

/**
 * Generate Shakespeare-like text one character at a time in the browser, then click any character
 * to see which earlier characters each attention head looked at when it was predicted.
 */
export function GptPlayground({
  vocab,
  context,
  layers,
  heads,
  defaultPrompt,
}: {
  vocab: string;
  context: number;
  layers: number;
  heads: number;
  defaultPrompt: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [temperature, setTemperature] = useState(0.8);
  const [text, setText] = useState<string | null>(null);
  const [promptLen, setPromptLen] = useState(0);
  const [running, setRunning] = useState(false);
  const [msPerChar, setMsPerChar] = useState<number | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [layer, setLayer] = useState(layers - 1);
  const [head, setHead] = useState<number | "mean">("mean");
  const stop = useRef(false);

  useEffect(() => {
    loadSession(MODEL).then(() => setReady(true), () => setError(true));
  }, []);

  const stoi = new Map([...vocab].map((c, i) => [c, i]));
  const clean = [...prompt].filter((c) => stoi.has(c)).join("");

  async function generate() {
    if (!clean) return;
    const session = await loadSession(MODEL);
    stop.current = false;
    setRunning(true);
    setFocus(null);
    setPromptLen(clean.length);
    const ids = [...clean].map((c) => stoi.get(c)!);
    let out = clean;
    setText(out);
    const t0 = clock();
    let n = 0;
    try {
      for (; n < 300 && !stop.current; n++) {
        const window = ids.slice(-context);
        const res = await runSerial(session, { idx: await int64(window) }, ["logits"]);
        const logits = res.logits.data as Float32Array;
        const next = sample(logits, (window.length - 1) * vocab.length, vocab.length, temperature);
        ids.push(next);
        out += vocab[next];
        setText(out);
      }
    } finally {
      setMsPerChar(n ? (clock() - t0) / n : null);
      setRunning(false);
    }
  }

  /** Attention of the position that predicted character `pos` (the query is the one before it). */
  async function inspect(pos: number) {
    if (!text || running || pos < 1) return;
    const q = pos - 1;
    const start = Math.max(0, q + 1 - context);
    const ids = [...text.slice(start, q + 1)].map((c) => stoi.get(c)!);
    const session = await loadSession(MODEL);
    const res = await runSerial(session, { idx: await int64(ids) }, ["attn"]);
    setFocus({ pos, start, weights: res.attn.data as Float32Array, t: ids.length });
  }

  function weightAt(i: number) {
    if (!focus) return 0;
    const { t, weights } = focus;
    const k = i - focus.start;
    if (k < 0 || k >= t) return 0;
    // attn is [L, 1, H, T, T]; the query is the last row.
    const at = (h: number) => weights[((layer * heads + h) * t + (t - 1)) * t + k];
    if (head !== "mean") return at(head);
    let s = 0;
    for (let h = 0; h < heads; h++) s += at(h);
    return s / heads;
  }

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  let maxW = 0;
  if (focus && text) for (let i = focus.start; i < focus.pos; i++) maxW = Math.max(maxW, weightAt(i));

  return (
    <div className={styles.wrap} data-testid="gpt-playground" data-ready={ready || undefined}>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className="eyebrow">Prompt</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} spellCheck={false} data-testid="gpt-prompt" />
        </label>
        <label className={styles.slider}>
          <span className="eyebrow">Temperature {temperature.toFixed(1)}</span>
          <input type="range" min={0.2} max={1.5} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
        </label>
        <div className={styles.row}>
          {running ? (
            <button type="button" className={styles.btn} onClick={() => (stop.current = true)}>
              Stop
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={generate} disabled={!ready || !clean} data-testid="gpt-generate">
              {ready ? "Generate 300 characters" : "Loading the model…"}
            </button>
          )}
          {clean.length < prompt.length ? <span className={styles.note}>Characters outside the training text are skipped.</span> : null}
        </div>
      </div>

      <div className={styles.output}>
        <pre className={styles.text} data-testid="gpt-output" aria-live="off">
          {text
            ? [...text].map((c, i) => {
                const w = focus && i >= focus.start && i < focus.pos && maxW > 0 ? weightAt(i) / maxW : 0;
                return (
                  <span
                    key={i}
                    className={i < promptLen ? styles.promptChar : undefined}
                    data-focus={focus?.pos === i || undefined}
                    style={w > 0.02 ? { background: `rgba(245, 165, 36, ${(0.85 * w).toFixed(3)})` } : undefined}
                    onClick={() => inspect(i)}
                  >
                    {c}
                  </span>
                );
              })
            : <span className={styles.placeholder}>Generated text appears here. Afterwards, click any character to see what the model attended to when it chose it.</span>}
        </pre>
        <p className={styles.note} data-testid="gpt-meta">
          {running
            ? "Generating in your browser…"
            : msPerChar
              ? `${msPerChar.toFixed(0)} ms per character in your browser. Click a character to inspect attention.`
              : "Runs in your browser. Nothing is uploaded."}
        </p>
      </div>

      {focus ? (
        <div className={styles.attn} data-testid="gpt-attention">
          <p className={styles.note}>
            Predicting <code>{JSON.stringify(text![focus.pos])}</code>: highlighted characters are where the query
            looked, brighter is more weight.
          </p>
          <div className={styles.row}>
            <span className="eyebrow">Layer</span>
            {Array.from({ length: layers }, (_, l) => (
              <button key={l} type="button" className={styles.chip} aria-pressed={layer === l} onClick={() => setLayer(l)}>
                {l + 1}
              </button>
            ))}
            <span className="eyebrow">Head</span>
            <button type="button" className={styles.chip} aria-pressed={head === "mean"} onClick={() => setHead("mean")}>
              mean
            </button>
            {Array.from({ length: heads }, (_, h) => (
              <button key={h} type="button" className={styles.chip} aria-pressed={head === h} onClick={() => setHead(h)}>
                {h + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
