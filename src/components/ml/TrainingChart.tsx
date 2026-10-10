import type { LogRow } from "@/lib/runlog";
import styles from "./TrainingChart.module.css";

type Series = { key: string; label: string; tone: "a" | "b" };

/** A small line chart of a training log, drawn as plain SVG at build time. */
export function TrainingChart({
  rows,
  series,
  title,
  format = (v) => v.toFixed(3),
  caption,
}: {
  rows: LogRow[];
  series: Series[];
  title: string;
  format?: (v: number) => string;
  caption?: string;
}) {
  const W = 560;
  const H = 220;
  const pad = { l: 52, r: 16, t: 14, b: 30 };
  const xs = rows.map((r) => r.epoch);
  const values = rows.flatMap((r) => series.map((s) => r[s.key]));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || 1;
  lo -= span * 0.06;
  hi += span * 0.06;
  const x = (e: number) => pad.l + ((e - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  const xTicks = [...new Set([xs[0], ...xs.filter((e) => e % 5 === 0), xs[xs.length - 1]])];

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.head}>
        <span className="eyebrow">{title}</span>
        <span className={styles.legend}>
          {series.map((s) => (
            <span key={s.key} data-tone={s.tone}>
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${title} per epoch`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={pad.l - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((e) => (
          <text key={e} x={x(e)} y={H - 10} className={styles.tick} textAnchor="middle">
            {e}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.key}
            data-tone={s.tone}
            className={styles.line}
            points={rows.map((r) => `${x(r.epoch).toFixed(1)},${y(r[s.key]).toFixed(1)}`).join(" ")}
          />
        ))}
        {series.map((s) =>
          rows.map((r) => (
            <circle key={`${s.key}${r.epoch}`} data-tone={s.tone} className={styles.dot} cx={x(r.epoch)} cy={y(r[s.key])} r={2.2}>
              <title>{`epoch ${r.epoch} · ${s.label} ${format(r[s.key])}`}</title>
            </circle>
          )),
        )}
      </svg>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </figure>
  );
}
