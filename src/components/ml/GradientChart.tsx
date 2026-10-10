import type { Series } from "./TrainingChart";
import styles from "./TrainingChart.module.css";

/** Gradient norm per conv layer, input side on the left, on a log axis. Plain SVG at build time. */
export function GradientChart({
  data,
  series,
  title,
  caption,
}: {
  data: Record<string, number[]>;
  series: Series[];
  title: string;
  caption?: string;
}) {
  const W = 900;
  const H = 320;
  const pad = { l: 52, r: 16, t: 14, b: 34 };
  const layers = Math.max(...series.map((s) => data[s.key].length));
  const logs = series.flatMap((s) => data[s.key].map(Math.log10));
  const lo = Math.floor(Math.min(...logs));
  const hi = Math.ceil(Math.max(...logs));
  const x = (i: number) => pad.l + (i / (layers - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (Math.log10(v) - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const decades = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const xTicks = [1, ...Array.from({ length: Math.floor(layers / 10) }, (_, k) => (k + 1) * 10), layers].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

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
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${title}, per layer`}>
        {decades.map((d) => (
          <g key={d}>
            <line x1={pad.l} x2={W - pad.r} y1={y(10 ** d)} y2={y(10 ** d)} className={styles.grid} />
            <text x={pad.l - 8} y={y(10 ** d)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {`1e${d}`}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t - 1)} y={H - 16} className={styles.tick} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} className={styles.tick} textAnchor="middle">
          conv layer, input → output
        </text>
        {series.map((s) => (
          <polyline
            key={s.key}
            data-tone={s.tone}
            className={styles.line}
            points={data[s.key].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
          />
        ))}
      </svg>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </figure>
  );
}
