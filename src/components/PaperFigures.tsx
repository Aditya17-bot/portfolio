"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./PaperFigures.module.css";

type Day = { date: string; actual: number[]; forecast: number[]; sun: number[] };

/** One 2024 day: actual Delhi demand against the forecast made an hour earlier. */
export function DemandFigure({ days }: { days: Day[] }) {
  const [i, setI] = useState(0);
  const d = days[i];
  const W = 520;
  const H = 150;
  const n = d.actual.length;
  const all = [...d.actual, ...d.forecast];
  const lo = Math.min(...all) * 0.97;
  const hi = Math.max(...all) * 1.02;
  const x = (k: number) => (k / (n - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * (H - 10);
  const line = (v: number[]) => v.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p).toFixed(1)}`).join("");
  const sun = d.sun.map((s, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${(H - s * 40).toFixed(1)}`).join("") + `L${W},${H}L0,${H}Z`;
  const mape = (100 * d.forecast.reduce((s, f, k) => s + Math.abs(f - d.actual[k]) / d.actual[k], 0)) / n;
  return (
    <figure className={styles.figure} data-testid="paper-figure-demand">
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`Delhi demand on ${d.date}, actual and forecast`}>
        <path d={sun} className={styles.sun} />
        <path d={line(d.actual)} className={styles.actual} />
        <path d={line(d.forecast)} className={styles.forecast} />
      </svg>
      <figcaption className={styles.caption}>
        <span className={styles.days}>
          {days.map((x, k) => (
            <button key={x.date} type="button" aria-pressed={k === i} onClick={() => setI(k)}>
              {new Date(`${x.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
            </button>
          ))}
        </span>
        <span>
          <i className={styles.kActual} /> actual <i className={styles.kForecast} /> LightGBM, an hour ahead, {mape.toFixed(2)}% · public 2024 data, not the
          paper&apos;s · <Link href="/research/solar-forecasting">explore</Link>
        </span>
      </figcaption>
    </figure>
  );
}

const LAYERS = [
  { name: "Detect", silent: "A box seen in one frame only is ignored until it persists, so a flicker never becomes a warning." },
  { name: "Name", silent: "When neither model is confident about what it is, the warning still goes out, as “obstacle”, never a guessed noun." },
  { name: "Locate", silent: "Far objects and objects off to the side of the path stay silent; distance is only spoken when the estimate can be trusted." },
  { name: "Decide", silent: "One warning at a time: the same news is not repeated within a cooldown, and nothing talks over the last warning." },
  { name: "Voice", silent: "A command it cannot map to one of its fixed abilities gets a request to repeat, not an invented answer." },
];

/** Each layer of BlindAssist can decline to answer on its own terms. */
export function AbstentionFigure() {
  const [i, setI] = useState(1);
  return (
    <figure className={styles.figure} data-testid="paper-figure-abstention">
      <ol className={styles.layers}>
        {LAYERS.map((l, k) => (
          <li key={l.name}>
            <button type="button" aria-pressed={k === i} onClick={() => setI(k)}>
              {l.name}
            </button>
          </li>
        ))}
      </ol>
      <p className={styles.silent}>
        <strong>{LAYERS[i].name}, when it cannot be sure:</strong> {LAYERS[i].silent}
      </p>
      <figcaption className={styles.caption}>
        <span>
          Click a layer. Every layer that can be wrong can decline, each by its own rule rather than one shared
          confidence score · <Link href="/projects/blindassist">try BlindAssist</Link>
        </span>
      </figcaption>
    </figure>
  );
}
