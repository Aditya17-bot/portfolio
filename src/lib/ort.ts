// onnxruntime-web, loaded on demand. The WASM binary is self-hosted under /ort/.

import type { InferenceSession, Tensor } from "onnxruntime-web";

type Ort = typeof import("onnxruntime-web/wasm");

let ortP: Promise<Ort> | null = null;
const sessions = new Map<string, Promise<InferenceSession>>();

function ort() {
  ortP ??= import("onnxruntime-web/wasm").then((m) => {
    m.env.wasm.wasmPaths = "/ort/";
    // Threads need cross-origin isolation; one thread is plenty for these models.
    m.env.wasm.numThreads = 1;
    return m;
  });
  return ortP;
}

export function loadSession(url: string) {
  let s = sessions.get(url);
  if (!s) {
    s = ort().then((m) => m.InferenceSession.create(url, { executionProviders: ["wasm"] }));
    s.catch(() => sessions.delete(url));
    sessions.set(url, s);
  }
  return s;
}

export async function tensor(data: Float32Array, dims: number[]): Promise<Tensor> {
  const m = await ort();
  return new m.Tensor("float32", data, dims);
}

/**
 * A session can only run one inference at a time. This runner keeps at most one call in
 * flight and one queued; inputs that arrive while busy replace the queued one, so a fast
 * stream of drawing updates always ends on the latest input.
 */
export function latestRunner<I, O>(run: (input: I) => Promise<O>, onResult: (out: O) => void) {
  let busy = false;
  let next: { input: I } | null = null;
  async function pump() {
    while (next) {
      const { input } = next;
      next = null;
      busy = true;
      try {
        onResult(await run(input));
      } finally {
        busy = false;
      }
    }
  }
  return (input: I) => {
    next = { input };
    if (!busy) void pump();
  };
}
