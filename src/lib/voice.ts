// Browser port of the offline voice assistant's pipeline (github.com/Aditya17-bot/voice_ai): the sentence
// splitter from brain.py, the filler phrases and timings from fallback.py, and a voice-activity detector with
// the same end-of-speech rule. Models come from transformers.js, loaded from a CDN at run time.

export const SYSTEM_PROMPT =
  "You are a friendly voice assistant. Your replies are spoken aloud, so: answer in 1-3 short conversational " +
  "sentences, no markdown, no lists, no emoji, spell out numbers and abbreviations naturally.";

export const FILLERS = [
  "Hmm, let me think about that.",
  "Good question. Give me a second.",
  "Okay, one moment.",
  "Let me work that out.",
  "Right, thinking about that now.",
];
export const FILLER_AFTER_MS = 1200;

const SENTENCE_END = /(.+?[.!?])(?:\s+|$)(?=\S|$)/g;
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|approx|e\.g|i\.e|U\.S|U\.K)\.$/i;

/** brain.py _split_sentences: complete sentences, and the remainder still being generated. */
export function splitSentences(buffer: string): [string[], string] {
  const sentences: string[] = [];
  let pending = "";
  let pos = 0;
  for (const m of buffer.matchAll(SENTENCE_END)) {
    const end = m.index! + m[0].length;
    if (end >= buffer.length) break;
    const candidate = (pending + m[1]).trim();
    pos = end;
    if (ABBREVIATION.test(candidate)) {
      pending += buffer.slice(m.index!, end);
      continue;
    }
    pending = "";
    if (candidate) sentences.push(candidate);
  }
  return [sentences, pending + buffer.slice(pos)];
}

export const MODELS = {
  stt: "onnx-community/whisper-tiny.en",
  small: { id: "HuggingFaceTB/SmolLM2-135M-Instruct", label: "SmolLM2 135M", mb: { webgpu: 118, wasm: 137 } },
  large: { id: "HuggingFaceTB/SmolLM2-360M-Instruct", label: "SmolLM2 360M", mb: { webgpu: 273, wasm: 365 } },
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
let tf: Promise<any> | null = null;
export function transformers(): Promise<any> {
  tf ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ TRANSFORMERS_URL);
  return tf;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator;

/**
 * Energy-based voice activity detection with the app's state machine: speech starts when the level rises well
 * above the running noise floor, and ends after 600 ms of trailing silence. (The app uses Silero VAD.)
 */
export class Vad {
  floor = 0.01;
  speaking = false;
  silentMs = 0;
  speechMs = 0;
  loudMs = 0;
  /** While the assistant talks: stricter, sustained 320 ms, because its own voice leaks into the mic. */
  strict = false;
  constructor(
    private onStart: () => void,
    private onEnd: (speechMs: number) => void,
    private endSilenceMs = 600,
  ) {}

  /** Feed one frame's RMS level and its duration. Returns the current level relative to the floor. */
  push(rms: number, ms: number) {
    const ratio = rms / Math.max(this.floor, 1e-4);
    const loud = this.strict ? ratio > 6 && rms > 0.03 : ratio > 3 && rms > 0.015;
    if (!this.speaking) {
      if (!loud) this.floor = this.floor * 0.95 + rms * 0.05;
      this.loudMs = loud ? this.loudMs + ms : 0;
      if (loud && this.loudMs >= (this.strict ? 320 : ms)) {
        this.speaking = true;
        this.silentMs = 0;
        this.speechMs = 0;
        this.onStart();
      }
    } else {
      this.speechMs += ms;
      this.silentMs = loud ? 0 : this.silentMs + ms;
      if (this.silentMs >= this.endSilenceMs) {
        this.speaking = false;
        this.onEnd(this.speechMs - this.silentMs);
      }
    }
    return ratio;
  }
}
