"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FILLER_AFTER_MS, FILLERS, hasWebGPU, MODELS, splitSentences, SYSTEM_PROMPT, transformers, Vad } from "@/lib/voice";
import styles from "./VoiceDemo.module.css";

type Size = "small" | "large";
type Turn = { role: "user" | "assistant"; text: string; spoken?: number; interrupted?: boolean; filler?: string };
/** Milliseconds from the end of the user's turn. */
type Timing = { stt?: number; firstToken?: number; firstSentence?: number; firstAudio?: number; done?: number; filler?: number; streaming: boolean; voice: boolean };

const now = () => performance.now();
const noop = () => () => {};

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  if (onStart) u.onstart = onStart;
  if (onEnd) u.onend = onEnd;
  speechSynthesis.speak(u);
}

function Waterfall({ t }: { t: Timing }) {
  const end = Math.max(t.done ?? 0, t.firstAudio ?? 0, 1);
  const rows: { label: string; from: number; to?: number; tone: string; testId?: string }[] = [
    ...(t.voice ? [{ label: "Speech to text", from: 0, to: t.stt, tone: "a" }] : []),
    { label: "Model reads the question", from: t.stt ?? 0, to: t.firstToken, tone: "b" },
    { label: "First sentence written", from: t.firstToken ?? 0, to: t.firstSentence, tone: "b" },
    { label: "Whole reply written", from: t.firstToken ?? 0, to: t.done, tone: "c" },
  ];
  const pct = (v: number) => `${((v / end) * 100).toFixed(2)}%`;
  return (
    <div className={styles.waterfall} data-testid="voice-waterfall">
      {rows.map((r) => (
        <div key={r.label} className={styles.wrow}>
          <span className={styles.wlabel}>{r.label}</span>
          <span className={styles.track}>
            {r.to !== undefined ? <span className={styles.bar} data-tone={r.tone} style={{ left: pct(r.from), width: pct(Math.max(r.to - r.from, end * 0.004)) }} /> : null}
          </span>
          <span className={styles.wms}>{r.to !== undefined ? `${Math.round(r.to)} ms` : "…"}</span>
        </div>
      ))}
      <div className={styles.wrow}>
        <span className={styles.wlabel}>
          <strong>First word heard</strong>
        </span>
        <span className={styles.track}>
          {t.firstAudio !== undefined ? <span className={styles.marker} style={{ left: pct(t.firstAudio) }} /> : null}
          {t.filler !== undefined ? <span className={styles.fillerMark} style={{ left: pct(t.filler) }} title="Filler phrase" /> : null}
        </span>
        <span className={styles.wms} data-testid="voice-first-audio">
          {t.firstAudio !== undefined ? `${Math.round(t.firstAudio)} ms` : "…"}
        </span>
      </div>
      {t.done !== undefined && t.firstAudio !== undefined ? (
        <p className={styles.note}>
          {t.streaming
            ? `Speaking each sentence as soon as it is complete started the voice ${Math.max(0, Math.round(t.done - t.firstAudio))} ms before the reply was finished.`
            : "Streaming is off: nothing is spoken until the whole reply exists. Turn it back on and ask again to compare."}
          {t.filler !== undefined ? " The model was slow, so a filler phrase covered the gap, as the app does after 1.2 s." : ""}
        </p>
      ) : null}
    </div>
  );
}

export function VoiceDemo() {
  const [size, setSize] = useState<Size>("small");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [progress, setProgress] = useState<Record<string, { loaded: number; total: number }>>({});
  const [error, setError] = useState("");
  const [device, setDevice] = useState<"webgpu" | "wasm">("wasm");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState("");
  const [streaming, setStreaming] = useState(true);
  const models = useRef<{ stt: any; llm: any; tf: any } | null>(null);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode } | null>(null);
  const busy = useRef(false);
  const talking = useRef(false);
  const stopper = useRef<any>(null);
  const history = useRef<{ role: string; content: string }[]>([]);
  const streamingRef = useRef(streaming);
  const gpu = useSyncExternalStore(noop, hasWebGPU, () => false);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  async function load() {
    setState("loading");
    setError("");
    try {
      const tf = await transformers();
      const gpu = hasWebGPU();
      const dev = gpu ? "webgpu" : "wasm";
      setDevice(dev);
      const onProgress = (p: any) => {
        if (p.status === "progress" && p.file?.endsWith(".onnx"))
          setProgress((s) => ({ ...s, [p.file]: { loaded: p.loaded, total: p.total } }));
      };
      const stt = await tf.pipeline("automatic-speech-recognition", MODELS.stt, {
        dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
        device: "wasm",
        progress_callback: onProgress,
      });
      let llm;
      try {
        llm = await tf.pipeline("text-generation", MODELS[size].id, { dtype: gpu ? "q4f16" : "q8", device: dev, progress_callback: onProgress });
      } catch {
        // Some GPUs lack fp16 support: fall back to the CPU build.
        setDevice("wasm");
        llm = await tf.pipeline("text-generation", MODELS[size].id, { dtype: "q8", device: "wasm", progress_callback: onProgress });
      }
      models.current = { stt, llm, tf };
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The models failed to load.");
      setState("error");
    }
  }

  function interrupt() {
    if (!talking.current) return;
    speechSynthesis.cancel();
    stopper.current?.interrupt();
    talking.current = false;
    setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 && t.role === "assistant" ? { ...t, interrupted: true } : t)));
    setStatus("Interrupted. Listening…");
  }

  async function reply(question: string, t0: number, timing0: Timing) {
    const m = models.current!;
    const t: Timing = { ...timing0, streaming: streamingRef.current };
    const mark = (k: keyof Timing) => {
      if ((t as any)[k] === undefined) (t as any)[k] = now() - t0;
      setTiming({ ...t });
    };
    setTiming({ ...t });
    setTurns((ts) => [...ts, { role: "user", text: question }, { role: "assistant", text: "", spoken: 0 }]);
    setStatus("Thinking…");
    talking.current = true;
    let buffer = "";
    let full = "";
    let spoken = 0;
    let sentences = 0;
    const queue: string[] = [];
    const say = (s: string) => {
      sentences++;
      if (sentences === 1) mark("firstSentence");
      speak(
        s,
        () => {
          mark("firstAudio");
          setStatus("Speaking. Talk over it to interrupt.");
        },
        () => {
          spoken += s.length + 1;
          setTurns((ts) => ts.map((x, i) => (i === ts.length - 1 ? { ...x, spoken } : x)));
        },
      );
    };
    const filler = setTimeout(() => {
      if (sentences === 0 && talking.current) {
        const f = FILLERS[Math.floor(Math.random() * FILLERS.length)];
        mark("filler");
        speak(f, () => mark("firstAudio"));
        setTurns((ts) => ts.map((x, i) => (i === ts.length - 1 ? { ...x, filler: f } : x)));
      }
    }, FILLER_AFTER_MS);

    stopper.current = new m.tf.InterruptableStoppingCriteria();
    const streamer = new m.tf.TextStreamer(m.llm.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk: string) => {
        mark("firstToken");
        full += chunk;
        buffer += chunk;
        setTurns((ts) => ts.map((x, i) => (i === ts.length - 1 ? { ...x, text: full } : x)));
        const [done, rest] = splitSentences(buffer);
        buffer = rest;
        for (const s of done) (streamingRef.current ? say : (x: string) => queue.push(x))(s);
      },
    });
    const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history.current.slice(-10), { role: "user", content: question }];
    try {
      await m.llm(messages, { max_new_tokens: 96, do_sample: false, streamer, stopping_criteria: stopper.current });
    } finally {
      clearTimeout(filler);
    }
    mark("done");
    const tail = buffer.trim();
    if (talking.current) {
      if (streamingRef.current) {
        if (tail) say(tail);
      } else {
        for (const s of [...queue, ...(tail ? [tail] : [])]) say(s);
      }
    }
    history.current.push({ role: "user", content: question }, { role: "assistant", content: full.trim() });
    // Done once the queued speech has finished.
    const wait = setInterval(() => {
      if (!speechSynthesis.speaking) {
        clearInterval(wait);
        talking.current = false;
        setStatus(audio.current ? "Listening…" : "");
      }
    }, 200);
  }

  async function ask(text: string) {
    if (!models.current || busy.current || !text.trim()) return;
    busy.current = true;
    try {
      await reply(text.trim(), now(), { streaming: true, voice: false });
    } finally {
      busy.current = false;
    }
  }

  async function startMic() {
    if (!models.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("The microphone is unavailable. Type a question instead.");
      return;
    }
    const ctx = new AudioContext({ sampleRate: 16000 });
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(512, 1, 1);
    const pre: Float32Array[] = [];
    let utterance: Float32Array[] = [];
    let endedAt = 0;
    const vad = new Vad(
      () => {
        if (talking.current) interrupt();
        utterance = [...pre];
        setStatus("Hearing you…");
      },
      (speechMs) => {
        endedAt = now();
        const chunks = utterance;
        utterance = [];
        if (speechMs < 250 || busy.current) {
          setStatus("Listening…");
          return;
        }
        void (async () => {
          busy.current = true;
          setStatus("Transcribing…");
          try {
            const n = chunks.reduce((a, c) => a + c.length, 0);
            const pcm = new Float32Array(n);
            let off = 0;
            for (const c of chunks) {
              pcm.set(c, off);
              off += c.length;
            }
            const out = await models.current!.stt(pcm);
            const text = String(out.text ?? "").trim();
            const stt = now() - endedAt;
            if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) {
              setStatus("Didn't catch that. Listening…");
              return;
            }
            await reply(text, endedAt, { stt, streaming: true, voice: true });
          } finally {
            busy.current = false;
          }
        })();
      },
    );
    node.onaudioprocess = (e) => {
      const frame = new Float32Array(e.inputBuffer.getChannelData(0));
      let s = 0;
      for (const v of frame) s += v * v;
      const rms = Math.sqrt(s / frame.length);
      vad.strict = talking.current;
      const ratio = vad.push(rms, (frame.length / 16000) * 1000);
      pre.push(frame);
      if (pre.length > 10) pre.shift();
      if (vad.speaking) utterance.push(frame);
      setLevel(Math.min(1, ratio / 12));
    };
    src.connect(node);
    node.connect(ctx.destination);
    audio.current = { ctx, stream, node };
    setListening(true);
    setStatus("Listening… ask something.");
  }

  function stopMic() {
    const a = audio.current;
    if (!a) return;
    a.node.disconnect();
    a.stream.getTracks().forEach((t) => t.stop());
    void a.ctx.close();
    audio.current = null;
    setListening(false);
    setStatus("");
  }

  useEffect(() => () => stopMic(), []);

  const mb = MODELS[size].mb[gpu ? "webgpu" : "wasm"] + 40;
  const files = Object.values(progress);
  const loaded = files.reduce((a, f) => a + f.loaded, 0) / 1e6;

  return (
    <div className={styles.wrap} data-testid="voice-demo" data-state={state}>
      {state === "idle" || state === "error" ? (
        <div className={styles.start}>
          <div className={styles.sizes} role="radiogroup" aria-label="Language model">
            {(["small", "large"] as Size[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)}>
                <strong>{MODELS[s].label}</strong>
                <small>{s === "small" ? "faster, simpler answers" : "better answers, slower"}</small>
              </button>
            ))}
          </div>
          <button type="button" className={styles.primary} onClick={load} data-testid="voice-load">
            Download the models, about {mb} MB, once
          </button>
          <p className={styles.note}>
            Speech recognition (Whisper tiny) and a small language model ({MODELS[size].label}) run in this tab
            {gpu ? " on your GPU" : " on your CPU; a browser with WebGPU, like recent Chrome, is much faster"}.
            Nothing you say leaves your device. Use headphones so it doesn&apos;t hear itself.
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      ) : null}

      {state === "loading" ? (
        <div className={styles.start}>
          <p className={styles.note}>
            Downloading… {loaded.toFixed(0)} of about {mb} MB
          </p>
          <span className={styles.progress}>
            <span style={{ width: `${Math.min(100, (loaded / mb) * 100)}%` }} />
          </span>
        </div>
      ) : null}

      {state === "ready" ? (
        <>
          <div className={styles.controls}>
            <button type="button" className={styles.primary} aria-pressed={listening} onClick={() => (listening ? stopMic() : startMic())} data-testid="voice-mic">
              {listening ? "Stop listening" : "Talk to it"}
            </button>
            <span className={styles.meter} aria-hidden="true">
              <span style={{ width: `${(listening ? level : 0) * 100}%` }} />
            </span>
            <label className={styles.check}>
              <input type="checkbox" checked={streaming} onChange={(e) => setStreaming(e.target.checked)} /> Speak sentence by sentence
            </label>
            <span className={styles.device}>
              {MODELS[size].label} on {device === "webgpu" ? "GPU" : "CPU"}
            </span>
          </div>
          <form
            className={styles.typeRow}
            onSubmit={(e) => {
              e.preventDefault();
              const q = typed;
              setTyped("");
              void ask(q);
            }}
          >
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a question" data-testid="voice-input" />
            <button type="submit">Ask</button>
          </form>
          {status ? (
            <p className={styles.status} aria-live="polite">
              {status}
            </p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          <ol className={styles.chat} data-testid="voice-chat">
            {turns.map((t, i) => (
              <li key={i} data-role={t.role}>
                {t.filler ? <em className={styles.filler}>{t.filler} </em> : null}
                {t.role === "assistant" && t.spoken ? (
                  <>
                    <span className={styles.spoken}>{t.text.slice(0, t.spoken)}</span>
                    {t.text.slice(t.spoken)}
                  </>
                ) : (
                  t.text || "…"
                )}
                {t.interrupted ? <small className={styles.cut}> interrupted</small> : null}
              </li>
            ))}
          </ol>
          {timing ? <Waterfall t={timing} /> : null}
        </>
      ) : null}
    </div>
  );
}
