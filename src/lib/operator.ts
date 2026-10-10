// The Smart Operator Assistant's safety engine, ported for the browser from the hackathon backend
// (caterpillar: backend/engine.py run_rules, overheat_eta, run_forecasts) and its simulator's engine model
// (simulator/sim.py). Thresholds are the backend's.

export const SEATBELT_GRACE_SEC = 5;
export const IDLE_ALERT_SEC = 45;
export const OVERHEAT_C = 110;
export const OVERHEAT_WARN_ETA_SEC = 180;
const PREDICTED_CLEAR_SEC = 15;

export type Machine = "excavator" | "loader" | "dozer";
export type Surface = "asphalt" | "gravel" | "sand" | "mud";
export type Severity = "warning" | "critical";

export type Controls = {
  engineOn: boolean;
  seatbelt: boolean;
  speedKmh: number;
  slopeDeg: number;
  obstacleCm: number;
  loadPct: number;
  coolingFault: boolean;
  machine: Machine;
  surface: Surface;
};

export type Alert = { kind: string; severity: Severity; message: string };
export type LogEntry = Alert & { at: number; cleared?: number };

type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] };
export type SpeedModel = { features: string[]; init: number; learning_rate: number; trees: Tree[]; metrics: { r2: number; mae_kmh: number; rows: number } };

/** Gradient-boosted trees exported from scikit-learn; Math.fround matches its float32 feature comparisons. */
export function advisedSpeed(m: SpeedModel, c: Pick<Controls, "machine" | "surface" | "slopeDeg" | "loadPct">, vibration = 0.4) {
  const x = m.features.map((f) => {
    if (f === "slope_deg") return c.slopeDeg;
    if (f === "load_pct") return c.loadPct;
    if (f === "vibration") return vibration;
    if (f.startsWith("machine_")) return f === `machine_${c.machine}` ? 1 : 0;
    return f === `surface_${c.surface}` ? 1 : 0;
  }).map(Math.fround);
  let s = m.init;
  for (const t of m.trees) {
    let n = 0;
    while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
    s += m.learning_rate * t.v[n];
  }
  return Math.max(0, s);
}

function gauss() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export type Sim = {
  t: number;
  temp: number;
  rpm: number;
  history: { ts: number; temp: number }[];
  beltOffSince: number | null;
  idleSince: number | null;
  predictedAt: number;
  alerts: Map<string, Alert>;
  log: LogEntry[];
  eta: number | null;
};

export function newSim(): Sim {
  return { t: 0, temp: 80, rpm: 1500, history: [], beltOffSince: null, idleSince: null, predictedAt: -1e9, alerts: new Map(), log: [], eta: null };
}

function linfit(xs: number[], ys: number[]): [number, number] | null {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const v = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (v === 0) return null;
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / v;
  return [my - b * mx, b];
}

/**
 * Seconds until engine temperature reaches 110 °C, or null. Engine temperature behaves like a first-order
 * system, dT/dt = k (T_eq - T): regressing the rate of change on temperature gives k and the level it settles at.
 * Settling below the limit means no warning; settling above it gives the time on the exponential; no
 * levelling-off at all, when hot and climbing fast, is extrapolated as a straight line.
 */
export function overheatEta(history: { ts: number; temp: number }[]) {
  const pts = history.slice(-40);
  if (pts.length < 15) return null;
  const t0 = pts[0].ts;
  const ts = pts.map((p) => p.ts - t0);
  const temps = pts.map((p) => p.temp);
  const sm = temps.map((_, i) => {
    const w = temps.slice(Math.max(0, i - 2), i + 3);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const rates: number[] = [];
  const levels: number[] = [];
  for (let i = 0; i < sm.length - 5; i++) {
    const dt = ts[i + 5] - ts[i];
    if (dt > 0) {
      rates.push((sm[i + 5] - sm[i]) / dt);
      levels.push((sm[i + 5] + sm[i]) / 2);
    }
  }
  const current = sm[sm.length - 1];
  const recent = linfit(ts.slice(-15), temps.slice(-15));
  if (!rates.length || !recent || current >= OVERHEAT_C) return null;
  const rateNow = recent[1];
  if (rateNow < 0.05) return null;
  const fit = linfit(levels, rates);
  if (fit && fit[1] < -0.01) {
    const [a, b] = fit;
    const k = -b;
    const tEq = -a / b;
    if (tEq <= OVERHEAT_C + 1) return null;
    return Math.log((tEq - current) / (tEq - OVERHEAT_C)) / k;
  }
  if (current < 98 || rateNow < 0.08) return null;
  return (OVERHEAT_C - current) / rateNow;
}

function level(s: Sim, kind: string, severity: Severity | null, message: string) {
  const cur = s.alerts.get(kind);
  if (severity === null) {
    if (cur) {
      s.alerts.delete(kind);
      const open = [...s.log].reverse().find((e) => e.kind === kind && e.cleared === undefined);
      if (open) open.cleared = s.t;
    }
    return;
  }
  if (cur && cur.severity === severity) {
    cur.message = message;
    return;
  }
  if (cur) level(s, kind, null, "");
  const a = { kind, severity, message };
  s.alerts.set(kind, a);
  s.log.push({ ...a, at: s.t });
}

/** One simulated second: the engine model, then the backend's rules and forecast. */
export function step(s: Sim, c: Controls, advised: number) {
  s.t += 1;
  const moving = c.speedKmh >= 0.5;
  const rpmTarget = !c.engineOn ? 0 : moving || c.loadPct > 5 ? 850 + 12 * c.loadPct : 850;
  s.rpm = Math.max(0, s.rpm + (rpmTarget - s.rpm) * 0.3 + (c.engineOn ? gauss() * 20 : 0));
  // simulator/sim.py: settle toward a load-dependent level, or climb steadily when cooling fails.
  const target = c.engineOn ? 82 + 8 * (s.rpm / 1750) + 0.1 * 50 : 45;
  if (c.engineOn && c.coolingFault) s.temp = Math.min(122, s.temp + 0.15) + gauss() * 0.1;
  else s.temp = s.temp + (target - s.temp) * 0.06 + gauss() * 0.2;
  s.history.push({ ts: s.t, temp: s.temp });
  if (s.history.length > 300) s.history.shift();

  if (c.engineOn && !c.seatbelt) {
    s.beltOffSince ??= s.t;
    const held = s.t - s.beltOffSince;
    level(s, "seatbelt", held >= SEATBELT_GRACE_SEC ? "critical" : null, `Seatbelt unfastened for ${held} s while the engine runs`);
  } else {
    s.beltOffSince = null;
    level(s, "seatbelt", null, "");
  }

  const d = c.obstacleCm;
  level(s, "proximity", c.engineOn && d < 50 ? "critical" : c.engineOn && d < 100 ? "warning" : null, `Obstacle ${d.toFixed(0)} cm from the machine`);
  level(s, "overheat", s.temp > 110 ? "critical" : s.temp > 100 ? "warning" : null, `Engine temperature ${s.temp.toFixed(0)} °C`);
  const slope = Math.abs(c.slopeDeg);
  level(s, "unsafe_tilt", slope > 25 ? "critical" : null, `Tilt ${slope.toFixed(0)}° exceeds the 25° limit`);

  const over = c.engineOn && c.speedKmh > 2 && c.speedKmh > advised * 1.25 + 1;
  level(s, "overspeed", over ? "warning" : null, `Speed ${c.speedKmh.toFixed(1)} km/h, advised ${advised.toFixed(1)} km/h for this terrain`);

  if (c.engineOn && !moving) {
    s.idleSince ??= s.t;
    const idle = s.t - s.idleSince;
    level(s, "idling", idle >= IDLE_ALERT_SEC ? "warning" : null, `Engine idling for ${idle} s. Consider shutting down`);
  } else {
    s.idleSince = null;
    level(s, "idling", null, "");
  }

  const eta = overheatEta(s.history);
  s.eta = eta;
  if (eta !== null && eta <= OVERHEAT_WARN_ETA_SEC && s.temp > 90) {
    s.predictedAt = s.t;
    level(s, "overheat_predicted", "warning", `Predicted to reach ${OVERHEAT_C} °C in about ${(eta / 60).toFixed(1)} min. Reduce load now`);
  } else if (s.t - s.predictedAt > PREDICTED_CLEAR_SEC || s.temp >= OVERHEAT_C) {
    level(s, "overheat_predicted", null, "");
  }
}
