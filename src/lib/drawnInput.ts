// A visitor's drawing, shared between the pad (DOM) and the hero network (canvas).

type State = { input: Float32Array | null; at: number };

let state: State = { input: null, at: 0 };
const listeners = new Set<() => void>();

export const drawnInput = {
  get: () => state,
  set(input: Float32Array | null) {
    state = { input, at: performance.now() };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
