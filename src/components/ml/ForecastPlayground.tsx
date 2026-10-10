"use client";

import { useEffect, useState } from "react";
import { loadSession, runSerial, tensor } from "@/lib/ort";
import styles from "./ForecastPlayground.module.css";

const MODEL = "/models/lstm-load/model.onnx";
const DAYS = "/models/lstm-load/days.bin";
const F = 8; // features per step
const DAY = 288; // 5-minute steps
const H = 12; // forecast horizon

type Result = { actual: number[]; lstm: number[]; yesterday: number[]; sun: number[]; ms: number };

const mape = (p: number[], t: number[]) => (100 * p.reduce((s, v, i) => s + Math.abs(v - t[i]) / t[i], 0)) / t.length;

async function forecastDay(all: Float32Array, day: number): Promise<Result> {
  const base = day * 2 * DAY * F; // each demo day stores the previous day and the day itself
  const at = (step: number, f: number) => all[base + step * F + f];
  // 24 hourly origins; each sees the 288 steps before it.
  const x = new Float32Array(24 * DAY * F);
  for (let k = 0; k < 24; k++) x.set(all.subarray(base + k * H * F, base + (k * H + DAY) * F), k * DAY * F);
  const session = await loadSession(MODEL);
  const t0 = performance.now();
  const res = await runSerial(session, { x: await tensor(x, [24, DAY, F]) });
  const ms = performance.now() - t0;
  const out = res.load.data as Float32Array;
  return {
    lstm: Array.from(out),
    actual: Array.from({ length: DAY }, (_, i) => at(DAY + i, 0)),
    yesterday: Array.from({ length: DAY }, (_, i) => at(i, 0)),
    sun: Array.from({ length: DAY }, (_, i) => at(DAY + i, 7)),
    ms,
  };
}

function path(values: number[], x: (i: number) => number, y: (v: number) => number) {
  return values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
}

/** Pick a day from the 2024 test year; the LSTM forecasts it hour by hour in the browser. */
export function ForecastPlayground({ dates }: { dates: string[] }) {
  const [all, setAll] = useState<Float32Array | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(Math.floor(dates.length / 2));
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch(DAYS)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => setAll(new Float32Array(b)), () => setError(true));
    loadSession(MODEL).then(() => setReady(true), () => setError(true));
  }, []);

  useEffect(() => {
    if (!all || !ready) return;
    let live = true;
    forecastDay(all, day).then((r) => live && setResult(r), () => setError(true));
    return () => {
      live = false;
    };
  }, [all, ready, day]);

  if (error) return <p className={styles.note}>The model failed to load. Reload the page to try again.</p>;

  const W = 900;
  const Hh = 300;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  let chart = null;
  if (result) {
    const vals = [...result.actual, ...result.lstm, ...result.yesterday];
    const lo = Math.floor(Math.min(...vals) / 500) * 500;
    const hi = Math.ceil(Math.max(...vals) / 500) * 500;
    const x = (i: number) => pad.l + (i / (DAY - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (Hh - pad.t - pad.b);
    const ticks = Array.from({ length: (hi - lo) / 500 + 1 }, (_, k) => lo + k * 500);
    const sunY = (s: number) => Hh - pad.b - s * (Hh - pad.t - pad.b) * 0.35;
    chart = (
      <svg viewBox={`0 0 ${W} ${Hh}`} className={styles.svg} role="img" aria-label={`Demand on ${dates[day]}: actual, LSTM forecast and the day before`}>
        <path
          d={`${path(result.sun, x, sunY)}L${x(DAY - 1)},${Hh - pad.b}L${x(0)},${Hh - pad.b}Z`}
          className={styles.sun}
        />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={pad.l - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {t.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={x(Math.min(h * 12, DAY - 1))} y={Hh - 8} className={styles.tick} textAnchor="middle">
            {String(h).padStart(2, "0")}:00
          </text>
        ))}
        <path d={path(result.yesterday, x, y)} className={styles.yesterday} />
        <path d={path(result.actual, x, y)} className={styles.actual} />
        <path d={path(result.lstm, x, y)} className={styles.lstm} data-testid="forecast-line" />
      </svg>
    );
  }

  return (
    <div className={styles.wrap} data-testid="forecast-playground" data-ready={(ready && !!all) || undefined}>
      <div className={styles.row}>
        <label className={styles.pick}>
          <span className="eyebrow">Day from the 2024 test year</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} data-testid="forecast-day">
            {dates.map((d, i) => (
              <option key={d} value={i}>
                {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
              </option>
            ))}
          </select>
        </label>
        <ul className={styles.legend}>
          <li data-k="actual">Actual</li>
          <li data-k="lstm">
            LSTM, an hour ahead{result ? ` · ${mape(result.lstm, result.actual).toFixed(2)}% MAPE` : ""}
          </li>
          <li data-k="yesterday">
            Same time yesterday{result ? ` · ${mape(result.yesterday, result.actual).toFixed(2)}%` : ""}
          </li>
          <li data-k="sun">Sun elevation (an input)</li>
        </ul>
      </div>
      <div className={styles.chart}>{chart ?? <p className={styles.note}>Loading…</p>}</div>
      <p className={styles.note} data-testid="forecast-meta">
        {result
          ? `24 forecasts of 12 steps each, ${result.ms.toFixed(0)} ms in your browser. Each one sees only the 24 hours before its hour.`
          : "Runs in your browser."}
      </p>
    </div>
  );
}
