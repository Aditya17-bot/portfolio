// Indian Patent Application 202641115711 (published): Protected Adaptive Pairwise Sensor Fusion System for
// Sub-Threshold Compound Hazard Detection and Automated Mitigation. Equations 1 to 4, the weights of the
// embodiment and the interaction coefficients of its commissioning table, as published.

export const CHANNELS = ["gas", "temp", "flame", "hum", "light"] as const;
export type Channel = (typeof CHANNELS)[number];

export const LABEL: Record<Channel, string> = { gas: "Gas", temp: "Temperature", flame: "Flame", hum: "Humidity", light: "Light" };
export const UNIT: Record<Channel, string> = { gas: "ppm", temp: "°C", flame: "duty", hum: "%RH", light: "lux" };

/** Individual weights (sum 1.00). The light channel's weight is carried by its obscuration deviation. */
export const WEIGHT: Record<Channel, number> = { gas: 0.35, temp: 0.25, flame: 0.25, hum: 0.07, light: 0.08 };

/** Pairwise interaction coefficients c_ij. Light pairs use obscuration, except flame and light, which uses emission. */
export const COEF: [Channel, Channel, number][] = [
  ["gas", "temp", 0.3],
  ["gas", "flame", 0.25],
  ["temp", "flame", 0.2],
  ["temp", "hum", 0.15],
  ["gas", "hum", 0.1],
  ["flame", "light", 0.08],
  ["gas", "light", 0.05],
  ["temp", "light", 0.05],
  ["flame", "hum", 0.05],
  ["hum", "light", 0.03],
];

export const WARN = 1.0;
export const CRIT = 3.0;
export const K_WARN = 2;
export const K_CRIT = 3.5;
/** Absolute backstops that trigger regardless of adaptation. */
export const ABS_LIMIT = { gas: 400, temp: 45, flame: 0.9 };
/** The fixed-threshold reference configuration the invention is compared against (warning values). */
export const FIXED = { gas: 200, temp: 35, hum: 75 };

export type Readings = Record<Channel, number>;
export type Stats = Record<Channel, { base: number; sd: number }>;

/** Baselines and dispersions of the published worked example. */
export const WORKED_STATS: Stats = {
  gas: { base: 82, sd: 49.8 },
  temp: { base: 28.4, sd: 3.5 },
  flame: { base: 0, sd: 0.7 },
  hum: { base: 50, sd: 10.1 },
  light: { base: 310, sd: 22 },
};

/** Equation 3, with the light channel split into obscuration and emission. */
export function deviations(r: Readings, s: Stats) {
  const n = (c: Channel) => Math.max(0, (r[c] - s[c].base) / s[c].sd);
  return {
    gas: n("gas"),
    temp: n("temp"),
    flame: n("flame"),
    hum: n("hum"),
    obs: Math.max(0, (s.light.base - r.light) / s.light.sd),
    emis: Math.max(0, (r.light - s.light.base) / s.light.sd),
  };
}

export type Dev = ReturnType<typeof deviations>;

const operand = (d: Dev, c: Channel, other: Channel) => (c === "light" ? (other === "flame" ? d.emis : d.obs) : d[c]);

/** Equation 4: individual terms plus pairwise products. */
export function chi(d: Dev, withPairs = true) {
  const individual = CHANNELS.map((c) => ({ c, v: WEIGHT[c] * (c === "light" ? d.obs : d[c]) }));
  const pairs = COEF.map(([a, b, k]) => ({ a, b, k, v: withPairs ? k * operand(d, a, b) * operand(d, b, a) : 0 }));
  const indSum = individual.reduce((s, x) => s + x.v, 0);
  const pairSum = pairs.reduce((s, x) => s + x.v, 0);
  return { individual, pairs, indSum, pairSum, total: indSum + pairSum };
}

export type Band = "safe" | "warning" | "critical";
const rank = { safe: 0, warning: 1, critical: 2 } as const;

/** The arbiter adopts the highest band any of the three paths calls for. */
export function arbitrate(index: number, d: Dev, r: Readings) {
  const fromIndex: Band = index >= CRIT ? "critical" : index >= WARN ? "warning" : "safe";
  const perChannel = Math.max(d.gas, d.temp, d.flame, d.hum, d.obs);
  const fromChannel: Band = perChannel >= K_CRIT ? "critical" : perChannel >= K_WARN ? "warning" : "safe";
  const fromAbs: Band = r.gas >= ABS_LIMIT.gas || r.temp >= ABS_LIMIT.temp || r.flame >= ABS_LIMIT.flame ? "critical" : "safe";
  const paths = { index: fromIndex, channel: fromChannel, absolute: fromAbs };
  const band = (Object.values(paths) as Band[]).reduce((a, b) => (rank[b] > rank[a] ? b : a), "safe");
  return { band, paths };
}

/** The fixed-threshold reference alarm: any raw reading past its own warning value. */
export function fixedAlarm(r: Readings) {
  return r.gas >= FIXED.gas || r.temp >= FIXED.temp || r.hum >= FIXED.hum || r.flame >= ABS_LIMIT.flame;
}

export const ACTUATION: Record<Band, { fan: number; vent: number; buzzer: string; light: string }> = {
  safe: { fan: 0, vent: 0, buzzer: "off", light: "green" },
  warning: { fan: 50, vent: 45, buzzer: "1 Hz pulses", light: "amber" },
  critical: { fan: 100, vent: 90, buzzer: "continuous", light: "red" },
};

// ---------------------------------------------------------------- why the registers are protected

/**
 * A slow gas leak replayed against the adaptive baseline (Equations 1 and 2): 10-second epochs, a = 0.05, a
 * 300-second dispersion window. With protection, the dispersion freezes once any deviation passes 1 and the
 * baseline freezes while ventilation runs; without it, both learn the leak and the deviation flattens.
 */
export function leak(protect: boolean, minutes = 30) {
  const epoch = 10;
  const a = 0.05;
  const out: { t: number; gas: number; base: number; sd: number; n: number; vent: boolean }[] = [];
  let base = 82;
  let sd = 14;
  const window: number[] = [];
  let vent = false;
  for (let t = 0; t <= minutes * 60; t += epoch) {
    const start = 8 * 60;
    // Sensor noise of a low-cost gas element, plus the leak.
    const gas = 82 + (t > start ? Math.min(220, ((t - start) / 600) * 220) : 0) + 14 * Math.sin(t / 37) + 9 * Math.sin(t / 13 + 1);
    const n = Math.max(0, (gas - base) / sd);
    vent = n >= K_WARN; // a single channel at 2σ is a warning: ventilation on
    const holdSd = protect && n > 1; // dispersion hold entry: any channel above 1σ
    const holdBase = protect && vent;
    window.push(gas);
    if (window.length > 300 / epoch) window.shift();
    if (!holdSd) {
      const m = window.reduce((s, x) => s + x, 0) / window.length;
      sd = Math.max(10, Math.sqrt(window.reduce((s, x) => s + (x - m) ** 2, 0) / window.length));
    }
    if (!holdBase) base = a * gas + (1 - a) * base;
    out.push({ t, gas, base, sd, n, vent });
  }
  return out;
}
