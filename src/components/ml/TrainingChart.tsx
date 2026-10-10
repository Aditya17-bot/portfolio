import type { LogRow } from "@/lib/runlog";
import styles from "./TrainingChart.module.css";

export type Series = { key: string; label: string; tone: "a" | "b" | "c" | "d" };

/** A small line chart of a training log, drawn as plain SVG at build time. */
export function TrainingChart({
  rows,
  series,
  title,
  format = (v) => v.toFixed(3),
  caption,
  max,
  dots = true,
}: {
  rows: LogRow[];
  series: Series[];
  title: string;
  format?: (v: number) => string;
  caption?: string;
  /** Upper bound for the axis, e.g. 1 for accuracy. */
  max?: number;
  /** One marker per epoch; off for long or crowded runs. */
  dots?: boolean;
}) {
  const W = 560;
  const H = 220;
  const pad = { l: 52, r: 16, t: 14, b: 30 };
  const xs = rows.map((r) => r.epoch);
  const values = rows.flatMap((r) => series.map((s) => r[s.key])).filter(Number.isFinite);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || 1;
  lo -= span * 0.06;
  hi += span * 0.06;
  if (max !== undefined) hi = Math.min(hi, max);
  if (Math.min(...values) >= 0) lo = Math.max(lo, 0);
  const x = (e: number) => pad.l + ((e - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // Round tick values (1, 2, 2.5 or 5 times a power of ten), about four of them.
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / unit - 1e-9) * unit; v <= hi + 1e-9; v += unit) ticks.push(Number(v.toPrecision(12)));
  // At most about seven x labels, always including the first and last.
  const every = Math.ceil(xs.length / 7);
  const xTicks = [...new Set(xs.filter((_, i) => i % every === 0 || i === xs.length - 1))];
  // Drop the label before the last one when the two would collide.
  const n = xTicks.length;
  if (n > 2 && xTicks[n - 1] - xTicks[n - 2] < (xTicks[1] - xTicks[0]) / 2) xTicks.splice(n - 2, 1);

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
          (dots ? rows : []).map((r) => (
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
