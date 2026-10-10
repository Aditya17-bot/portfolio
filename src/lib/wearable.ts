// Indian Patent Application 202641110070 (published): Wearable Navigation Apparatus with Inertially Adaptive
// Detection and Staged Announcement Scheduling. Equations 1 to 6 and the parameter values of the embodiment,
// as published.

export const LAMBDA = 0.25; // angular-rate weighting
export const SIGMA_BASE = 0.6;
export const SIGMA_MIN = 0.35;
export const ETA = 0.15;
export const M_MAX = 2.5;
export const W = { alpha: 0.4, beta: 0.25, gamma: 0.15, delta: 0.2 };
export const TAU = 0.3;
export const N_PERSIST = 2;
export const T_COOLDOWN = 3.0;
export const T_GAP = 1.5;
export const EPSILON = 0.1;

/** Equation 1: motion magnitude from linear acceleration (gravity removed) and angular rate. */
export function motionMagnitude(acc: [number, number, number], gyro: [number, number, number], g = 9.81) {
  const [ax, ay, az] = acc;
  return Math.hypot(ax, ay, az - g) + LAMBDA * Math.hypot(...gyro);
}

/** Equation 2: the detector's acceptance threshold drops while the wearer moves, never below the floor. */
export function adaptedThreshold(m: number) {
  return Math.max(SIGMA_MIN, SIGMA_BASE - ETA * Math.min(m, M_MAX));
}

export const PROX_RANK = { "very close": 1, close: 2 / 3, medium: 1 / 3, far: 0 } as const;
export type Prox = keyof typeof PROX_RANK;

/** Equation 4: 1 on the image's centre line, 0 at either edge. */
export const centrality = (x: number) => 1 - 2 * Math.abs(x - 0.5);

/** Equation 3. */
export function threat(p: number, c: number, s: number, m: number) {
  return W.alpha * p + W.beta * c + W.gamma * s + W.delta * m;
}

export type Motion = "standing" | "walking" | "turning";

/** Typical inertial readings for each wearer state (illustrative values, m/s² and rad/s). */
export const MOTION: Record<Motion, { acc: [number, number, number]; gyro: [number, number, number]; label: string }> = {
  standing: { acc: [0.05, 0.04, 9.83], gyro: [0.02, 0.01, 0.02], label: "Standing still" },
  walking: { acc: [1.1, 0.4, 10.9], gyro: [0.3, 0.2, 0.25], label: "Walking forward" },
  turning: { acc: [0.6, 0.9, 10.2], gyro: [0.4, 0.3, 2.2], label: "Turning on the spot" },
};

/** Convergence factor M(o): the wearer's motion resolved toward the object's bearing, quantised. */
export function convergence(motion: Motion, x: number) {
  if (motion === "standing") return 0.5;
  if (motion === "turning") return x > 0.5 ? 1 : 0; // turning right closes on objects to the right
  return centrality(x) > 0.5 ? 1 : 0.5; // walking forward closes on objects ahead
}

// ---------------------------------------------------------------- the four-stage scheduler

export type Params = { nPersist: number; cooldown: number; gap: number; epsilon: number };
export type Tick = { t: number; T: number; state: string; outcome: "persist" | "cooldown" | "gap" | "fire" | "escalated" | "below" };

/**
 * Run one ranked object through the engine. `frames` gives, per cycle, the threat value and the state tuple
 * (class, zone, proximity) of the top object. Stage 1 persistence, stage 2 per-state cooldown, stage 4 escalation
 * (overrides stage 2 only), stage 3 global gap (never bypassed).
 */
export function schedule(frames: { t: number; T: number; state: string }[], p: Params): Tick[] {
  const persist = new Map<string, number>();
  const last = new Map<string, { at: number; T: number }>();
  let lastAny = -Infinity;
  let prevState = "";
  return frames.map(({ t, T, state }) => {
    if (T < TAU) {
      prevState = "";
      return { t, T, state, outcome: "below" as const };
    }
    const n = state === prevState ? (persist.get(state) ?? 0) + 1 : 1;
    prevState = state;
    persist.set(state, n);
    if (n < p.nPersist) return { t, T, state, outcome: "persist" as const };
    const l = last.get(state);
    let escalated = false;
    if (l && t - l.at < p.cooldown) {
      if (T > l.T + p.epsilon) escalated = true;
      else return { t, T, state, outcome: "cooldown" as const };
    }
    if (t - lastAny < p.gap) return { t, T, state, outcome: "gap" as const };
    lastAny = t;
    last.set(state, { at: t, T });
    return { t, T, state, outcome: escalated ? ("escalated" as const) : ("fire" as const) };
  });
}
