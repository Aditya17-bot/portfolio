import styles from "./SolarExplorer.module.css";

export type HourSeries = { key: string; label: string; tone: "signal" | "activation" | "muted" | "faint"; values: number[] };

/** Error by hour of day (24 values per series), with the average sun elevation shaded behind. */
export function HourErrorChart({ series, sun, caption }: { series: HourSeries[]; sun: number[]; caption: string }) {
  const W = 900;
  const H = 300;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const hi = Math.ceil(Math.max(...series.flatMap((s) => s.values)) * 2) / 2;
  const x = (h: number) => pad.l + (h / 23) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / hi) * (H - pad.t - pad.b);
  const sunY = (s: number) => H - pad.b - s * (H - pad.t - pad.b) * 0.35;
  const ticks = Array.from({ length: Math.round(hi / 0.5) + 1 }, (_, k) => k * 0.5);
  const line = (v: number[], f: (n: number) => number) => v.map((n, h) => `${h ? "L" : "M"}${x(h).toFixed(1)},${f(n).toFixed(1)}`).join("");
  return (
    <figure className={styles.wrap} style={{ margin: 0 }} data-testid="hour-chart">
      <div className={styles.chart}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="60-minute-ahead error by hour of day">
          <path d={`${line(sun, sunY)}L${x(23)},${H - pad.b}L${x(0)},${H - pad.b}Z`} className={styles.sun} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={pad.l - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
                {t.toFixed(1)}%
              </text>
            </g>
          ))}
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={x(h)} y={H - 8} className={styles.tick} textAnchor="middle">
              {String(h).padStart(2, "0")}:00
            </text>
          ))}
          {series.map((s) => (
            <path key={s.key} d={line(s.values, y)} className={styles.line} data-tone={s.tone} />
          ))}
        </svg>
      </div>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.key} data-k={s.tone}>
            {s.label}
          </li>
        ))}
        <li data-k="sun">Average sun elevation</li>
      </ul>
      <figcaption className={styles.note} style={{ margin: 0 }}>
        {caption}
      </figcaption>
    </figure>
  );
}
