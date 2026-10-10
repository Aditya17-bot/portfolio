"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { advisedSpeed, newSim, OVERHEAT_C, step, type Controls, type Machine, type Sim, type SpeedModel, type Surface } from "@/lib/operator";
import styles from "./OperatorCab.module.css";

const INITIAL: Controls = {
  engineOn: true,
  seatbelt: true,
  speedKmh: 6,
  slopeDeg: 4,
  obstacleCm: 350,
  loadPct: 40,
  coolingFault: false,
  machine: "excavator",
  surface: "gravel",
};

const SCENARIOS: { label: string; what: string; set: Partial<Controls> }[] = [
  { label: "Unbuckle", what: "Seatbelt off with the engine running: critical after a 5 s grace period.", set: { seatbelt: false } },
  { label: "Worker walks up", what: "Something within 1 m is a warning, within 50 cm critical.", set: { obstacleCm: 70 } },
  { label: "Blocked radiator", what: "Temperature climbs steadily. Watch the forecast warn minutes before 110 °C.", set: { coolingFault: true, loadPct: 80 } },
  { label: "Steep slope", what: "Past 25° of tilt the machine can roll.", set: { slopeDeg: 28 } },
  { label: "Fast on mud", what: "The speed model advises slower on mud and downhill; 25% over is a warning.", set: { surface: "mud", slopeDeg: -12, speedKmh: 14 } },
  { label: "Leave it idling", what: "Engine on, not moving: a reminder after 45 s.", set: { speedKmh: 0, loadPct: 0 } },
];

const KIND: Record<string, string> = {
  seatbelt: "Seatbelt",
  proximity: "Proximity",
  overheat: "Engine temperature",
  overheat_predicted: "Overheat forecast",
  unsafe_tilt: "Tilt",
  overspeed: "Speed",
  idling: "Idling",
};

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function Slider({ label, value, min, max, stepBy = 1, unit, onChange, testId }: { label: string; value: number; min: number; max: number; stepBy?: number; unit: string; onChange: (v: number) => void; testId?: string }) {
  return (
    <label className={styles.slider}>
      <span>
        {label} <strong>{value.toFixed(stepBy < 1 ? 1 : 0)} {unit}</strong>
      </span>
      <input type="range" min={min} max={max} step={stepBy} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} />
    </label>
  );
}

function Toggle({ label, on, onChange, testId }: { label: string; on: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.toggle} onClick={() => onChange(!on)} data-testid={testId}>
      <span className={styles.knob} />
      {label}
    </button>
  );
}

function TempChart({ sim }: { sim: Sim }) {
  const W = 520;
  const H = 180;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  const span = 120;
  const pts = sim.history.slice(-span);
  const t1 = sim.t;
  const t0 = t1 - span;
  const x = (t: number) => pad.l + ((t - t0) / (span + 60)) * (W - pad.l - pad.r);
  const lo = 40;
  const hi = 125;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.temp).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Engine temperature over the last two minutes, with the overheat forecast">
      {[60, 80, 100, OVERHEAT_C].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === OVERHEAT_C ? styles.limit : styles.gridline} />
          <text x={pad.l - 6} y={y(v)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
            {v}
          </text>
        </g>
      ))}
      <line x1={x(t1)} x2={x(t1)} y1={pad.t} y2={H - pad.b} className={styles.gridline} />
      <text x={x(t1)} y={H - 6} className={styles.tick} textAnchor="middle">
        now
      </text>
      <path d={d} className={styles.temp} />
      {last && sim.eta !== null ? (
        <>
          {/* Straight-line view of the forecast over the next minute: reaches 110 °C at the ETA. */}
          <path
            d={`M${x(t1)},${y(last.temp)}L${x(t1 + Math.min(sim.eta, 60))},${y(sim.eta <= 60 ? OVERHEAT_C : last.temp + ((OVERHEAT_C - last.temp) * 60) / sim.eta)}`}
            className={styles.forecast}
          />
          <text x={x(t1) + 6} y={y(OVERHEAT_C) - 6} className={styles.forecastLabel}>
            110 °C in ~{(sim.eta / 60).toFixed(1)} min
          </text>
        </>
      ) : null}
    </svg>
  );
}

function Radar({ cm, engineOn }: { cm: number; engineOn: boolean }) {
  const R = 80;
  const scale = R / 400;
  const r = Math.min(cm, 400) * scale;
  const tone = !engineOn ? "off" : cm < 50 ? "critical" : cm < 100 ? "warning" : "ok";
  return (
    <svg viewBox="-100 -100 200 200" className={styles.radar} role="img" aria-label={`Nearest obstacle ${cm} cm away`}>
      <circle r={100 * scale * 4} className={styles.ring} />
      <circle r={100 * scale} className={styles.ringWarn} />
      <circle r={50 * scale} className={styles.ringCrit} />
      <rect x={-8} y={-12} width={16} height={24} rx={2} className={styles.machine} />
      <circle cx={0} cy={-r - 12} r={6} className={styles.worker} data-tone={tone} />
      <text x={0} y={92} className={styles.tick} textAnchor="middle">
        rings at 50 cm, 1 m, 4 m
      </text>
    </svg>
  );
}

/** Loads the speed model, then the cab. */
export function OperatorDemo() {
  const [model, setModel] = useState<SpeedModel | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/projects/operator/speed_model.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setModel, () => setFailed(true));
  }, []);
  if (failed) return <p className={styles.note}>The speed model failed to load. Reload the page to try again.</p>;
  return model ? <OperatorCab model={model} /> : <p className={styles.note}>Starting the engine…</p>;
}

/** A simulated cab: move the controls, and the hackathon backend's safety rules react in real time. */
function OperatorCab({ model }: { model: SpeedModel }) {
  const [c, setC] = useState<Controls>(INITIAL);
  const [fast, setFast] = useState(true);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<Sim>(() => newSim());
  const [note, setNote] = useState("");
  const sim = useRef<Sim>(newSim());
  const controls = useRef(c);
  const advised = useMemo(() => advisedSpeed(model, c), [model, c]);
  const advisedRef = useRef(advised);

  useEffect(() => {
    controls.current = c;
    advisedRef.current = advised;
  }, [c, advised]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const cur = sim.current;
      step(cur, controls.current, advisedRef.current);
      // Render from a snapshot, not the ref.
      setView({ ...cur, history: [...cur.history], alerts: new Map(cur.alerts), log: cur.log.map((e) => ({ ...e })) });
    }, fast ? 250 : 1000);
    return () => clearInterval(id);
  }, [fast, paused]);

  const set = (patch: Partial<Controls>) => setC((v) => ({ ...v, ...patch }));
  const s = view;
  const alerts = [...s.alerts.values()];
  const status = alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "warning" : "ok";

  return (
    <div className={styles.wrap} data-testid="operator-cab">
      <div className={styles.scenarios}>
        <span className={styles.scLabel}>Try a situation</span>
        {SCENARIOS.map((sc) => (
          <button
            key={sc.label}
            type="button"
            className={styles.scenario}
            onClick={() => {
              set({ ...INITIAL, machine: c.machine, ...sc.set });
              setNote(sc.what);
            }}
            data-testid="op-scenario"
          >
            {sc.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            sim.current = newSim();
            setView(newSim());
            setC(INITIAL);
            setNote("");
          }}
        >
          Reset
        </button>
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}

      <div className={styles.grid}>
        <section className={styles.controls} aria-label="Machine controls">
          <div className={styles.row}>
            <label className={styles.select}>
              Machine
              <select value={c.machine} onChange={(e) => set({ machine: e.target.value as Machine })}>
                <option value="excavator">Excavator</option>
                <option value="loader">Loader</option>
                <option value="dozer">Dozer</option>
              </select>
            </label>
            <label className={styles.select}>
              Surface
              <select value={c.surface} onChange={(e) => set({ surface: e.target.value as Surface })} data-testid="op-surface">
                <option value="asphalt">Asphalt</option>
                <option value="gravel">Gravel</option>
                <option value="sand">Sand</option>
                <option value="mud">Mud</option>
              </select>
            </label>
          </div>
          <div className={styles.toggles}>
            <Toggle label="Engine" on={c.engineOn} onChange={(v) => set({ engineOn: v })} testId="op-engine" />
            <Toggle label="Seatbelt" on={c.seatbelt} onChange={(v) => set({ seatbelt: v })} testId="op-seatbelt" />
            <Toggle label="Cooling fault" on={c.coolingFault} onChange={(v) => set({ coolingFault: v })} testId="op-cooling" />
          </div>
          <Slider label="Speed" value={c.speedKmh} min={0} max={40} stepBy={0.5} unit="km/h" onChange={(v) => set({ speedKmh: v })} testId="op-speed" />
          <Slider label="Slope" value={c.slopeDeg} min={-35} max={35} unit="°" onChange={(v) => set({ slopeDeg: v })} testId="op-slope" />
          <Slider label="Nearest obstacle" value={c.obstacleCm} min={20} max={400} unit="cm" onChange={(v) => set({ obstacleCm: v })} testId="op-obstacle" />
          <Slider label="Load" value={c.loadPct} min={0} max={100} unit="%" onChange={(v) => set({ loadPct: v })} />
          <p className={styles.advised} data-testid="op-advised">
            Advised speed for this terrain: <strong>{advised.toFixed(1)} km/h</strong>
            <small>from the speed model; above {(advised * 1.25 + 1).toFixed(1)} km/h is a warning</small>
          </p>
        </section>

        <section className={styles.display} data-status={status} aria-label="Cab display" data-testid="op-display">
          <div className={styles.statusRow}>
            <p className={styles.status} data-testid="op-status">
              {status === "ok" ? "All clear" : status === "warning" ? "Warning" : "Critical"}
            </p>
            <p className={styles.clock}>
              {clock(s.t)} {fast ? "· 4× speed" : ""}
            </p>
          </div>
          <ul className={styles.alerts} aria-live="polite" data-testid="op-alerts">
            {alerts.length ? (
              alerts.map((a) => (
                <li key={a.kind} data-severity={a.severity} data-kind={a.kind}>
                  <strong>{KIND[a.kind] ?? a.kind}</strong> {a.message}
                </li>
              ))
            ) : (
              <li className={styles.quiet}>No active alerts.</li>
            )}
          </ul>
          <div className={styles.instruments}>
            <TempChart sim={s} />
            <Radar cm={c.obstacleCm} engineOn={c.engineOn} />
          </div>
          <div className={styles.readouts}>
            <span>
              Engine <strong data-testid="op-temp">{s.temp.toFixed(0)} °C</strong>
            </span>
            <span>
              <strong>{s.rpm.toFixed(0)}</strong> rpm
            </span>
            <span>
              Tilt <strong>{Math.abs(c.slopeDeg)}°</strong>
            </span>
            <button type="button" className={styles.link} onClick={() => setFast((v) => !v)}>
              {fast ? "Real time" : "4× speed"}
            </button>
            <button type="button" className={styles.link} onClick={() => setPaused((v) => !v)}>
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        </section>
      </div>

      <details className={styles.log}>
        <summary>Incident log ({s.log.length})</summary>
        <ol data-testid="op-log">
          {[...s.log].reverse().slice(0, 30).map((e, i) => (
            <li key={i} data-severity={e.severity}>
              <span>{clock(e.at)}</span> <strong>{KIND[e.kind] ?? e.kind}</strong> {e.message}
              {e.cleared !== undefined ? <small> · cleared at {clock(e.cleared)}</small> : null}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
