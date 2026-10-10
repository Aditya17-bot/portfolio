"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FraudExplorer.module.css";

/** One row per alert budget: [alerts, frauds caught, fraud dollars caught, score at the cut]. */
type Row = [number, number, number, number];
type Model = { key: string; label: string; tone: "a" | "b"; curve: Row[] };

const pct = (v: number, d = 1) => `${(100 * v).toFixed(d)}%`;
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const int = (v: number) => Math.round(v).toLocaleString("en-US");

/** Total cost at each budget: fraud that got through plus the cost of reviewing every alert. */
function cheapest(curve: Row[], fraudDollars: number, review: number) {
  let best = 0;
  let bestCost = Infinity;
  curve.forEach(([alerts, , caught], i) => {
    const cost = fraudDollars - caught + alerts * review;
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  });
  return { index: best, cost: bestCost };
}

/**
 * Pick how many transactions the bank can afford to review; see what each model catches at that budget.
 * Every number is counted on the test period (precomputed in training/fraud_sparkov/train.py).
 */
export function FraudExplorer({
  models,
  total,
  frauds,
  fraudDollars,
  start,
}: {
  models: Model[];
  total: number;
  frauds: number;
  fraudDollars: number;
  start: number;
}) {
  const n = models[0].curve.length;
  const [i, setI] = useState(start);
  const [review, setReview] = useState(10);
  const root = useRef<HTMLDivElement>(null);
  // Marks the controls as live once React has attached its handlers.
  useEffect(() => root.current?.setAttribute("data-ready", "true"), []);

  const W = 900;
  const H = 320;
  const pad = { l: 56, r: 16, t: 14, b: 40 };
  const rate = (r: Row) => r[0] / total;
  const lo = Math.log10(rate(models[0].curve[0]));
  const x = (v: number) => pad.l + ((Math.log10(v) - lo) / (0 - lo)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const xTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1].filter((t) => Math.log10(t) >= lo - 1e-9);
  const line = (m: Model) =>
    m.curve.map((r, k) => `${k ? "L" : "M"}${x(rate(r)).toFixed(1)},${y(r[1] / frauds).toFixed(1)}`).join("");
  const at = models[0].curve[i];
  const cheap = models.map((m) => cheapest(m.curve, fraudDollars, review));

  return (
    <div ref={root} className={styles.wrap} data-testid="fraud-explorer">
      <label className={styles.slider}>
        <span className="eyebrow">Alert budget: how many transactions get reviewed</span>
        <input
          type="range"
          min={0}
          max={n - 1}
          value={i}
          onChange={(e) => setI(Number(e.target.value))}
          aria-valuetext={`${pct(rate(at), 2)} of transactions`}
          data-testid="fraud-budget"
        />
        <span className={styles.budget} data-testid="fraud-budget-label">
          Flag the riskiest <strong>{pct(rate(at), rate(at) < 0.01 ? 2 : 1)}</strong> of {int(total)} transactions, about{" "}
          {int(at[0])} alerts
        </span>
      </label>

      <div className={styles.cards}>
        {models.map((m) => {
          const [alerts, caught, dollars] = m.curve[i];
          const falseAlarms = alerts - caught;
          return (
            <div key={m.key} className={styles.card} data-tone={m.tone} data-testid="fraud-model">
              <p className={styles.cardTitle}>{m.label}</p>
              <dl className={styles.stats}>
                <div>
                  <dt>Fraud caught</dt>
                  <dd data-testid="fraud-recall">
                    {pct(caught / frauds)} <small>{int(caught)} of {int(frauds)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Alerts that are fraud</dt>
                  <dd>{pct(caught / alerts)}</dd>
                </div>
                <div>
                  <dt>False alarms</dt>
                  <dd>{int(falseAlarms)}</dd>
                </div>
                <div>
                  <dt>Fraud dollars flagged</dt>
                  <dd>
                    {pct(dollars / fraudDollars)} <small>{money(dollars)}</small>
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className={styles.chart}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Share of fraud caught against share of transactions flagged, for both models">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={pad.l - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
                {pct(t, 0)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - pad.b + 18} className={styles.tick} textAnchor="middle">
              {t < 0.01 ? `${100 * t}%` : pct(t, 0)}
            </text>
          ))}
          <text x={(pad.l + W - pad.r) / 2} y={H - 4} className={styles.tick} textAnchor="middle">
            transactions flagged (log scale)
          </text>
          <path
            d={`M${x(rate(models[0].curve[0]))},${y(rate(models[0].curve[0]))}L${x(1)},${y(1)}`}
            className={styles.chance}
          />
          {models.map((m) => (
            <path key={m.key} d={line(m)} className={styles.line} data-tone={m.tone} />
          ))}
          <line x1={x(rate(at))} x2={x(rate(at))} y1={pad.t} y2={H - pad.b} className={styles.cursor} />
          {models.map((m) => (
            <circle key={m.key} cx={x(rate(m.curve[i]))} cy={y(m.curve[i][1] / frauds)} r={5} className={styles.dot} data-tone={m.tone} />
          ))}
        </svg>
        <ul className={styles.legend}>
          {models.map((m) => (
            <li key={m.key} data-tone={m.tone}>
              {m.label}
            </li>
          ))}
          <li data-tone="chance">Flagging at random</li>
        </ul>
      </div>

      <div className={styles.cost}>
        <label className={styles.costInput}>
          <span className="eyebrow">Cost to review one alert</span>
          <span>
            $
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={review}
              onChange={(e) => setReview(Math.max(0, Number(e.target.value) || 0))}
              data-testid="fraud-review"
            />
          </span>
        </label>
        <p className={styles.note} data-testid="fraud-cheapest">
          Counting missed fraud dollars plus {money(review)} per alert, the cheapest budget for the random forest is{" "}
          {pct(rate(models[0].curve[cheap[0].index]), 2)} of transactions ({money(cheap[0].cost)} in total, against{" "}
          {money(fraudDollars)} with no review at all).{" "}
          <button type="button" className={styles.jump} onClick={() => setI(cheap[0].index)}>
            Go there
          </button>
        </p>
      </div>
    </div>
  );
}
