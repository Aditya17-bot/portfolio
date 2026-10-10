"use client";

import { useMemo, useRef, useState } from "react";
import {
  adaptedThreshold,
  centrality,
  convergence,
  EPSILON,
  MOTION,
  motionMagnitude,
  N_PERSIST,
  PROX_RANK,
  schedule,
  SIGMA_BASE,
  T_COOLDOWN,
  T_GAP,
  TAU,
  threat,
  W,
  type Motion,
  type Prox,
} from "@/lib/wearable";
import styles from "./WearableLab.module.css";

type Obj = { id: string; name: string; x: number; area: number; conf: number; findable?: boolean };

// Per-class "very close" area thresholds from the published embodiment (person 35%, bottle 5%); the rest follow the
// app's table.
const VERY_CLOSE: Record<string, [number, number, number]> = {
  person: [0.35, 0.15, 0.05],
  chair: [0.3, 0.12, 0.04],
  door: [0.4, 0.2, 0.08],
  bottle: [0.05, 0.015, 0.004],
};

function prox(name: string, area: number): Prox {
  const [vc, c, m] = VERY_CLOSE[name];
  return area >= vc ? "very close" : area >= c ? "close" : area >= m ? "medium" : "far";
}

const START: Obj[] = [
  { id: "chair", name: "chair", x: 0.52, area: 0.13, conf: 0.72 },
  { id: "person", name: "person", x: 0.2, area: 0.1, conf: 0.9 },
  { id: "bottle", name: "bottle", x: 0.62, area: 0.03, conf: 0.66, findable: true },
  { id: "door", name: "door", x: 0.85, area: 0.22, conf: 0.48 },
];

function RankLab() {
  const [objs, setObjs] = useState(START);
  const [motion, setMotion] = useState<Motion>("standing");
  const [sel, setSel] = useState("chair");
  const box = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);

  const m = MOTION[motion];
  const mTotal = motionMagnitude(m.acc, m.gyro);
  const sigma = adaptedThreshold(mTotal);
  const rows = objs.map((o) => {
    const detected = o.conf >= sigma;
    const p = prox(o.name, o.area);
    const P = PROX_RANK[p];
    const C = centrality(o.x);
    const S = o.area;
    const M = convergence(motion, o.x);
    const T = threat(P, C, S, M);
    return { o, detected, p, P, C, S, M, T, gated: !!o.findable, eligible: detected && !o.findable && T >= TAU };
  });
  const winner = rows.filter((r) => r.eligible).sort((a, b) => b.T - a.T)[0];

  const W_ = 400;
  const H_ = 300;
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    setObjs((os) => os.map((o) => (o.id === drag.current ? { ...o, x } : o)));
  };
  const s = objs.find((o) => o.id === sel)!;

  return (
    <div className={styles.lab} data-testid="wearable-rank">
      <div className={styles.labMain}>
        <div className={styles.viewCol}>
          <svg
            ref={box}
            viewBox={`0 0 ${W_} ${H_}`}
            className={styles.view}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
            role="img"
            aria-label="Chest camera view; drag objects sideways"
          >
            <line x1={W_ / 2} x2={W_ / 2} y1={0} y2={H_} className={styles.axis} />
            <text x={W_ / 2 + 4} y={14} className={styles.axisLabel}>
              forward axis
            </text>
            {rows.map((r) => {
              const side = Math.sqrt(r.o.area) * W_ * 0.9;
              const w = side * 0.8;
              const h = side * 1.1;
              const cx = r.o.x * W_;
              const y = H_ - 20 - h;
              const tone = !r.detected ? "missed" : r.gated ? "gated" : r === winner ? "winner" : r.eligible ? "eligible" : "silent";
              return (
                <g
                  key={r.o.id}
                  data-tone={tone}
                  className={styles.obj}
                  onPointerDown={(e) => {
                    drag.current = r.o.id;
                    setSel(r.o.id);
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                >
                  <rect x={cx - w / 2} y={y} width={w} height={h} rx={4} />
                  <text x={cx} y={y - 6} textAnchor="middle">
                    {r.o.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className={styles.hint}>Drag an object sideways; pick one to change its size.</p>
          <div className={styles.controls}>
            <label>
              <span>Selected</span>
              <select value={sel} onChange={(e) => setSel(e.target.value)}>
                {objs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.grow}>
              <span>
                Share of the frame <strong>{(s.area * 100).toFixed(1)}%</strong>
              </span>
              <input
                type="range"
                min={0.002}
                max={0.45}
                step={0.002}
                value={s.area}
                onChange={(e) => setObjs((os) => os.map((o) => (o.id === sel ? { ...o, area: Number(e.target.value) } : o)))}
                data-testid="wl-area"
              />
            </label>
          </div>
          <div className={styles.motion} role="radiogroup" aria-label="Wearer motion">
            {(Object.keys(MOTION) as Motion[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={motion === k} onClick={() => setMotion(k)} data-testid={`wl-motion-${k}`}>
                {MOTION[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.side}>
          <p className={styles.eq}>
            Motion <strong>{mTotal.toFixed(2)}</strong> → detector threshold{" "}
            <strong data-testid="wl-sigma">{sigma.toFixed(2)}</strong>
            <small>
              Eq. 1–2: σ = max(0.35, {SIGMA_BASE} − 0.15 · min(M, 2.5)). A moving camera blurs the image, so confidence
              drops; the threshold drops with it instead of losing the obstacle.
            </small>
          </p>
          <table className={styles.terms} data-testid="wl-table">
            <thead>
              <tr>
                <th>Object</th>
                <th title="Proximity rank">P</th>
                <th title="Forward-axis centrality">C</th>
                <th title="Share of frame">S</th>
                <th title="Wearer-motion convergence">M</th>
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.o.id} data-winner={r === winner || undefined} data-testid={`wl-row-${r.o.id}`}>
                  <td>
                    {r.o.name}
                    <small>
                      {!r.detected
                        ? `not detected: confidence ${r.o.conf} < ${sigma.toFixed(2)}`
                        : r.gated
                          ? "findable class: never an obstacle warning"
                          : r === winner
                            ? "announced"
                            : r.T < TAU
                              ? `below τ ${TAU}`
                              : "outranked"}
                    </small>
                  </td>
                  {r.detected && !r.gated ? (
                    <>
                      <td>{r.P.toFixed(2)}</td>
                      <td>{r.C.toFixed(2)}</td>
                      <td>{r.S.toFixed(2)}</td>
                      <td>{r.M.toFixed(1)}</td>
                      <td className={styles.t}>{r.T.toFixed(2)}</td>
                    </>
                  ) : (
                    <td colSpan={5} className={styles.na}>
                      –
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.formula}>
            T = {W.alpha}·P + {W.beta}·C + {W.gamma}·S + {W.delta}·M; an object needs T ≥ {TAU} to be spoken about, and only the
            highest is.
          </p>
        </div>
      </div>
    </div>
  );
}

// An obstacle ahead getting closer while the wearer stands, then starts walking at 6 s; a person flickers for one
// cycle at 3 s.
function scenario(step: number) {
  const frames: { t: number; T: number; state: string }[] = [];
  for (let t = 0; t <= 12 + 1e-9; t += step) {
    const area = 0.03 + 0.022 * t;
    const p = prox("chair", area);
    const walking = t >= 6;
    const T = threat(PROX_RANK[p], 0.92, area, walking ? 1 : 0.5);
    const flicker = Math.abs(t - 3) < step / 2;
    frames.push(
      flicker
        ? { t, T: threat(PROX_RANK["close"], 0.95, 0.14, 0.5) + 0.2, state: "person|center|close" }
        : { t, T, state: `chair|center|${p}` },
    );
  }
  return frames;
}

const OUTCOME: Record<string, string> = {
  below: "below τ: silent",
  persist: "seen once: wait for a second cycle",
  cooldown: "same news within the cooldown",
  gap: "another warning just played",
  fire: "announced",
  escalated: "announced early: the threat rose by more than ε",
};

function playTones(hz: number, every: number) {
  const ctx = new AudioContext();
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + (i * every) / 1000);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + (i * every) / 1000 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (i * every) / 1000 + 0.09);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + (i * every) / 1000);
    o.stop(ctx.currentTime + (i * every) / 1000 + 0.1);
  }
  setTimeout(() => void ctx.close(), 4 * every + 300);
}

function ScheduleLab() {
  const [p, setP] = useState({ nPersist: N_PERSIST, cooldown: T_COOLDOWN, gap: T_GAP, epsilon: EPSILON });
  const step = 0.25;
  const ticks = useMemo(() => schedule(scenario(step), p), [p]);
  const fires = ticks.filter((t) => t.outcome === "fire" || t.outcome === "escalated");
  const W_ = 720;
  const H_ = 150;
  const x = (t: number) => 20 + (t / 12) * (W_ - 40);
  const y = (T: number) => H_ - 24 - T * (H_ - 50);
  const [hover, setHover] = useState<number | null>(null);
  const h = hover !== null ? ticks[hover] : null;

  return (
    <div className={styles.lab} data-testid="wearable-schedule">
      <svg viewBox={`0 0 ${W_} ${H_}`} className={styles.timeline} role="img" aria-label="Threat value of the top object over 12 seconds and what the scheduler did each cycle">
        <line x1={20} x2={W_ - 20} y1={y(TAU)} y2={y(TAU)} className={styles.tau} />
        <text x={W_ - 20} y={y(TAU) - 4} textAnchor="end" className={styles.axisLabel}>
          eligibility {TAU.toFixed(2)}
        </text>
        <line x1={x(6)} x2={x(6)} y1={10} y2={H_ - 24} className={styles.event} />
        <text x={x(6) + 4} y={20} className={styles.axisLabel}>
          starts walking
        </text>
        {ticks.map((t, i) => (
          <circle key={i} cx={x(t.t)} cy={y(t.T)} r={t.outcome === "fire" || t.outcome === "escalated" ? 6 : 3.5} className={styles.tick} data-outcome={t.outcome} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} />
        ))}
        {[0, 3, 6, 9, 12].map((t) => (
          <text key={t} x={x(t)} y={H_ - 6} textAnchor="middle" className={styles.axisLabel}>
            {t} s
          </text>
        ))}
      </svg>
      <p className={styles.tickInfo} data-testid="wl-tick">
        {h ? (
          <>
            <strong>{h.t.toFixed(2)} s</strong> {h.state.split("|")[0]}, {h.state.split("|")[2]}, T = {h.T.toFixed(2)}: {OUTCOME[h.outcome]}
          </>
        ) : (
          `Point at a dot. ${fires.length} warnings in 12 s from ${ticks.length} cycles; everything else was held back by one of the four stages.`
        )}
      </p>
      <ul className={styles.legend}>
        {Object.entries(OUTCOME).map(([k, v]) => (
          <li key={k} data-outcome={k}>
            {v}
          </li>
        ))}
      </ul>
      <div className={styles.params}>
        <label>
          <span>
            Persistence <strong>{p.nPersist} cycles</strong>
          </span>
          <input type="range" min={1} max={4} step={1} value={p.nPersist} onChange={(e) => setP({ ...p, nPersist: Number(e.target.value) })} data-testid="wl-persist" />
        </label>
        <label>
          <span>
            Per-state cooldown <strong>{p.cooldown.toFixed(1)} s</strong>
          </span>
          <input type="range" min={0} max={6} step={0.5} value={p.cooldown} onChange={(e) => setP({ ...p, cooldown: Number(e.target.value) })} />
        </label>
        <label>
          <span>
            Global gap <strong>{p.gap.toFixed(1)} s</strong>
          </span>
          <input type="range" min={0} max={4} step={0.25} value={p.gap} onChange={(e) => setP({ ...p, gap: Number(e.target.value) })} data-testid="wl-gap" />
        </label>
        <label>
          <span>
            Escalation ε <strong>{p.epsilon.toFixed(2)}</strong>
          </span>
          <input type="range" min={0.02} max={0.4} step={0.02} value={p.epsilon} onChange={(e) => setP({ ...p, epsilon: Number(e.target.value) })} />
        </label>
      </div>
      <p className={styles.formula}>
        The asymmetry is the point: escalation can skip the per-state cooldown (repeating news the wearer already has)
        but never the global gap, which keeps one output channel from piling up stale warnings. Set the gap to 0 and
        count how many warnings stack up.
      </p>
      <div className={styles.tones}>
        <span>Hear the proximity tone:</span>
        <button type="button" onClick={() => playTones(494, 700)}>
          Medium: 494 Hz every 700 ms
        </button>
        <button type="button" onClick={() => playTones(880, 160)}>
          Very close: 880 Hz every 160 ms
        </button>
      </div>
    </div>
  );
}

export function WearableLab() {
  return (
    <div className={styles.wrap}>
      <h3 className={styles.h3}>1. Which obstacle gets the one warning</h3>
      <RankLab />
      <h3 className={styles.h3}>2. When the warning is allowed out</h3>
      <ScheduleLab />
    </div>
  );
}
