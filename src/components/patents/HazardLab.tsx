"use client";

import { useMemo, useState } from "react";
import {
  ACTUATION,
  arbitrate,
  CHANNELS,
  chi,
  COEF,
  CRIT,
  deviations,
  fixedAlarm,
  K_CRIT,
  K_WARN,
  LABEL,
  leak,
  UNIT,
  WARN,
  WORKED_STATS,
  type Channel,
  type Readings,
} from "@/lib/hazard";
import styles from "./HazardLab.module.css";

const RANGE: Record<Channel, [number, number, number]> = {
  gas: [40, 450, 1],
  temp: [20, 50, 0.1],
  flame: [0, 1, 0.01],
  hum: [20, 95, 1],
  light: [150, 450, 1],
};

const PRESETS: { label: string; what: string; r: Readings }[] = [
  { label: "Quiet lab", what: "Everything at its resting level.", r: { gas: 85, temp: 28.6, flame: 0, hum: 50, light: 312 } },
  {
    label: "Reaction starting",
    what: "The patent's worked example: every reading below its own alarm, yet gas, heat and a faint flame signal rising together.",
    r: { gas: 170, temp: 33, flame: 0.4, hum: 52, light: 305 },
  },
  { label: "Vapour near a burner", what: "Gas up with a flame present: the pair that precedes ignition.", r: { gas: 160, temp: 29.5, flame: 0.55, hum: 50, light: 330 } },
  { label: "Sun on the bench", what: "Brighter and a little warmer, nothing else: benign, and the index stays low.", r: { gas: 84, temp: 31.5, flame: 0, hum: 48, light: 420 } },
  { label: "Solvent spill", what: "One channel far off its baseline: the per-channel path catches it on its own.", r: { gas: 330, temp: 28.8, flame: 0, hum: 51, light: 308 } },
];

const SHORT: Record<Channel, string> = { gas: "Gas", temp: "Temp", flame: "Flame", hum: "Hum", light: "Light" };

const BAND_TEXT = { safe: "Safe", warning: "Warning", critical: "Critical" };

function Panel() {
  const [r, setR] = useState<Readings>(PRESETS[1].r);
  const [pairs, setPairs] = useState(true);
  const [note, setNote] = useState(PRESETS[1].what);
  const d = deviations(r, WORKED_STATS);
  const c = chi(d, pairs);
  const a = arbitrate(c.total, d, r);
  const act = ACTUATION[a.band];
  const fixed = fixedAlarm(r);
  const nOf = (ch: Channel) => (ch === "light" ? Math.max(d.obs, d.emis) : d[ch]);
  const maxPair = Math.max(0.0001, ...c.pairs.map((p) => p.v));

  return (
    <div className={styles.lab} data-testid="hazard-panel">
      <div className={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setR(p.r);
              setNote(p.what);
            }}
            data-testid="hz-preset"
          >
            {p.label}
          </button>
        ))}
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}

      <div className={styles.cols}>
        <div className={styles.sensors}>
          {CHANNELS.map((ch) => {
            const n = nOf(ch);
            const [min, max, step] = RANGE[ch];
            return (
              <label key={ch} className={styles.sensor}>
                <span className={styles.sHead}>
                  {LABEL[ch]}{" "}
                  <strong>
                    {r[ch].toFixed(step < 1 ? (ch === "flame" ? 2 : 1) : 0)} {UNIT[ch]}
                  </strong>
                  <small>
                    baseline {WORKED_STATS[ch].base} ± {WORKED_STATS[ch].sd}
                  </small>
                </span>
                <input type="range" min={min} max={max} step={step} value={r[ch]} onChange={(e) => setR({ ...r, [ch]: Number(e.target.value) })} data-testid={`hz-${ch}`} />
                <span className={styles.dev} title="Standardised deviation from the baseline">
                  <span className={styles.devTrack}>
                    <span style={{ width: `${Math.min(100, (n / 4) * 100)}%` }} data-level={n >= K_CRIT ? "crit" : n >= K_WARN ? "warn" : "ok"} />
                    <i style={{ left: `${(K_WARN / 4) * 100}%` }} />
                    <i style={{ left: `${(K_CRIT / 4) * 100}%` }} />
                  </span>
                  <span className={styles.devVal}>
                    {n.toFixed(2)}σ{ch === "light" ? (d.emis > 0 ? " up" : d.obs > 0 ? " down" : "") : ""}
                  </span>
                </span>
              </label>
            );
          })}
          <p className={styles.small}>Bars mark 2σ (warning) and 3.5σ (critical) for each channel on its own.</p>
        </div>

        <div className={styles.result}>
          <div className={styles.compare}>
            <div data-on={fixed || undefined} data-testid="hz-fixed">
              <small>A fixed-threshold alarm</small>
              <strong>{fixed ? "Alarm" : "Silent"}</strong>
            </div>
            <div data-band={a.band} data-testid="hz-band">
              <small>This invention</small>
              <strong>{BAND_TEXT[a.band]}</strong>
            </div>
          </div>

          <div className={styles.index}>
            <p className={styles.indexHead}>
              Composite index <strong data-testid="hz-chi">{c.total.toFixed(2)}</strong>
              <small>
                warning at {WARN.toFixed(1)}, critical at {CRIT.toFixed(1)}
              </small>
            </p>
            <span className={styles.stack}>
              <span className={styles.ind} style={{ width: `${Math.min(100, (c.indSum / 4) * 100)}%` }} />
              <span className={styles.pair} style={{ width: `${Math.min(100, (c.pairSum / 4) * 100)}%` }} />
              <i style={{ left: `${(WARN / 4) * 100}%` }} />
              <i style={{ left: `${(CRIT / 4) * 100}%` }} />
            </span>
            <p className={styles.split}>
              <span className={styles.kInd}>individual {c.indSum.toFixed(2)}</span>
              <span className={styles.kPair}>pairwise {c.pairSum.toFixed(2)}</span>
              <label>
                <input type="checkbox" checked={pairs} onChange={(e) => setPairs(e.target.checked)} data-testid="hz-pairs" /> Count pairs
              </label>
            </p>
          </div>

          <div className={styles.matrix} role="img" aria-label="Contribution of each sensor pair to the index">
            <span />
            {CHANNELS.map((ch) => (
              <span key={ch} className={styles.mh}>
                {SHORT[ch]}
              </span>
            ))}
            {CHANNELS.map((row, i) => (
              <Row key={row} row={row} i={i} pairs={c.pairs} max={maxPair} />
            ))}
          </div>
          <p className={styles.small}>
            Each cell is c × nᵢ × nⱼ for one pair: it only lights up when both sensors are up at once. Gas with heat
            (0.30) and gas with flame (0.25) are the strongest couplings.
          </p>

          <div className={styles.act} data-band={a.band}>
            <span>
              Fan <strong>{act.fan}%</strong>
            </span>
            <span>
              Vent <strong>{act.vent}°</strong>
            </span>
            <span>
              Buzzer <strong>{act.buzzer}</strong>
            </span>
            <span>
              Light <strong>{act.light}</strong>
            </span>
          </div>
          <p className={styles.small}>
            Paths: index {a.paths.index}, single channel {a.paths.channel}, absolute limits {a.paths.absolute}. The
            highest wins.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ row, i, pairs, max }: { row: Channel; i: number; pairs: ReturnType<typeof chi>["pairs"]; max: number }) {
  return (
    <>
      <span className={styles.mh}>{SHORT[row]}</span>
      {CHANNELS.map((col, j) => {
        if (j <= i) return <span key={col} className={styles.empty} />;
        const p = pairs.find((x) => (x.a === row && x.b === col) || (x.a === col && x.b === row));
        const k = COEF.find(([a, b]) => (a === row && b === col) || (a === col && b === row))?.[2] ?? 0;
        const v = p?.v ?? 0;
        return (
          <span key={col} className={styles.cell} style={{ background: `rgba(245, 165, 36, ${(0.08 + 0.85 * (v / max)).toFixed(3)})` }} title={`c = ${k}`}>
            {v >= 0.005 ? v.toFixed(2) : ""}
          </span>
        );
      })}
    </>
  );
}

function Protection() {
  const on = useMemo(() => leak(true), []);
  const off = useMemo(() => leak(false), []);
  const [protect, setProtect] = useState(true);
  const data = protect ? on : off;
  const W = 720;
  const H = 200;
  const pad = { l: 44, r: 28, t: 10, b: 24 };
  const tMax = data[data.length - 1].t;
  const x = (t: number) => pad.l + (t / tMax) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - 50) / 300) * (H - pad.t - pad.b);
  const line = (k: "gas" | "base") => data.map((d, i) => `${i ? "L" : "M"}${x(d.t).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
  const end = data[data.length - 1];
  const warnedFor = data.filter((d) => d.vent).length * 10;
  return (
    <div className={styles.lab} data-testid="hazard-protection">
      <div className={styles.presets}>
        <button type="button" aria-pressed={protect} onClick={() => setProtect(true)} data-testid="hz-protect-on">
          Registers protected
        </button>
        <button type="button" aria-pressed={!protect} onClick={() => setProtect(false)} data-testid="hz-protect-off">
          Plain adaptive baseline
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Gas reading and the adaptive baseline during a slow leak">
        {[100, 200, 300].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={pad.l - 6} y={y(v)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {v}
            </text>
          </g>
        ))}
        {data.map((d) => (d.vent ? <rect key={d.t} x={x(d.t)} y={pad.t} width={x(10) - x(0) + 0.5} height={H - pad.t - pad.b} className={styles.ventBand} /> : null))}
        <path d={line("gas")} className={styles.gasLine} />
        <path d={line("base")} className={styles.baseLine} />
        {[0, 10, 20, 30].map((m) => (
          <text key={m} x={x(m * 60)} y={H - 6} className={styles.tick} textAnchor="middle">
            {m} min
          </text>
        ))}
      </svg>
      <ul className={styles.legend}>
        <li data-k="gas">Gas reading, ppm (a leak starts at 8 min)</li>
        <li data-k="base">What the unit thinks normal is</li>
        <li data-k="vent">Ventilation running</li>
      </ul>
      <p className={styles.note} data-testid="hz-protect-result">
        {protect
          ? `The reference is frozen once the reading departs from it, so the leak stays visible: still ${end.n.toFixed(1)}σ above normal at 30 min, ventilating for ${Math.round(warnedFor / 60)} min.`
          : `Without protection the baseline learns the leak and the spread widens with it: by 30 min the same leak reads ${end.n.toFixed(1)}σ and the fan has stopped.`}
      </p>
    </div>
  );
}

export function HazardLab() {
  return (
    <div className={styles.wrap}>
      <h3 className={styles.h3}>1. Five sensors, each below its alarm</h3>
      <Panel />
      <h3 className={styles.h3}>2. Why the baseline has to be protected</h3>
      <Protection />
    </div>
  );
}
