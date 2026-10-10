"use client";

import { useEffect, useState } from "react";
import styles from "./SolarExplorer.module.css";

const DATA = "/projects/solar/explorer.json";
const DAY = 288;

type Days = { dates: string[]; actual: number[][]; sun: number[][]; pred: Record<string, number[][]> };
export type Line = { key: string; label: string; tone: "signal" | "activation" | "muted" | "faint" };

const mape = (p: number[], t: number[]) => (100 * p.reduce((s, v, i) => s + Math.abs(v - t[i]) / t[i], 0)) / t.length;

function path(values: number[], x: (i: number) => number, y: (v: number) => number) {
  return values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
}

/**
 * Pick a 2024 day and the models to compare; every line is a 60-minute-ahead forecast made at each 5-minute
 * step of that day (precomputed by training/solar_forecast/train.py).
 */
export function SolarExplorer({ lines, start }: { lines: Line[]; start: number }) {
  const [days, setDays] = useState<Days | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(start);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(lines.map((l, i) => [l.key, i < 2])));

  useEffect(() => {
    fetch(DATA)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setDays(d.days), () => setError(true));
  }, []);

  if (error) return <p className={styles.note}>The forecasts failed to load. Reload the page to try again.</p>;

  const W = 900;
  const Hh = 320;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  let chart = null;
  let scores: Record<string, number> = {};
  if (days) {
    const actual = days.actual[day];
    const shown = lines.filter((l) => on[l.key]);
    scores = Object.fromEntries(lines.map((l) => [l.key, mape(days.pred[l.key][day], actual)]));
    const vals = [...actual, ...shown.flatMap((l) => days.pred[l.key][day])];
    const lo = Math.floor(Math.min(...vals) / 500) * 500;
    const hi = Math.ceil(Math.max(...vals) / 500) * 500;
    const x = (i: number) => pad.l + (i / (DAY - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (Hh - pad.t - pad.b);
    const sunY = (s: number) => Hh - pad.b - s * (Hh - pad.t - pad.b) * 0.35;
    const ticks = Array.from({ length: (hi - lo) / 500 + 1 }, (_, k) => lo + k * 500);
    chart = (
      <svg viewBox={`0 0 ${W} ${Hh}`} className={styles.svg} role="img" aria-label={`Demand on ${days.dates[day]}, actual and 60-minute-ahead forecasts`}>
        <path d={`${path(days.sun[day], x, sunY)}L${x(DAY - 1)},${Hh - pad.b}L${x(0)},${Hh - pad.b}Z`} className={styles.sun} />
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
        <path d={path(actual, x, y)} className={styles.actual} />
        {shown.map((l) => (
          <path key={l.key} d={path(days.pred[l.key][day], x, y)} className={styles.line} data-tone={l.tone} data-testid={`solar-line-${l.key}`} />
        ))}
      </svg>
    );
  }

  return (
    <div className={styles.wrap} data-testid="solar-explorer" data-ready={!!days || undefined}>
      <div className={styles.row}>
        <label className={styles.pick}>
          <span className="eyebrow">Day from the 2024 test year</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} data-testid="solar-day" disabled={!days}>
            {(days?.dates ?? []).map((d, i) => (
              <option key={d} value={i}>
                {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={styles.toggles}>
          <legend className="eyebrow">Forecasts, 60 minutes ahead · day MAPE</legend>
          {lines.map((l) => (
            <label key={l.key} className={styles.toggle} data-tone={l.tone}>
              <input
                type="checkbox"
                checked={on[l.key]}
                onChange={(e) => setOn((s) => ({ ...s, [l.key]: e.target.checked }))}
                data-testid={`solar-toggle-${l.key}`}
              />
              <span>{l.label}</span>
              <span className={styles.score} data-testid={`solar-score-${l.key}`}>
                {days ? `${scores[l.key].toFixed(2)}%` : "…"}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className={styles.chart}>{chart ?? <p className={styles.note}>Loading…</p>}</div>
      <ul className={styles.legend}>
        <li data-k="actual">Actual demand</li>
        <li data-k="sun">Sun elevation over Delhi, computed from date and time</li>
      </ul>
    </div>
  );
}
