"use client";

import { useState } from "react";
import styles from "./Lab.module.css";

export type Run = { name: string; depth: number; residual: boolean; trainLoss: number[]; testAcc: number[]; grads: number[] };

/** Pick depth and shortcut; the curves and per-layer gradients are the real training runs of the ResNet page. */
export function ResidualLab({ runs }: { runs: Run[] }) {
  const [depth, setDepth] = useState(56);
  const [residual, setResidual] = useState(false);
  const run = runs.find((r) => r.depth === depth && r.residual === residual)!;
  const W = 420;
  const H = 220;
  const epochs = run.testAcc.length;
  const lossMax = Math.max(...runs.flatMap((r) => r.trainLoss));
  const x = (e: number) => 34 + (e / (epochs - 1)) * (W - 50);
  const y = (l: number) => 20 + (1 - l / lossMax) * (H - 54);
  const g = run.grads.map((v) => v / Math.min(...run.grads));
  const gMax = Math.max(...runs.flatMap((r) => r.grads.map((v) => v / Math.min(...r.grads))));
  const BW = 420;
  const BH = 220;
  const bw = (BW - 40) / g.length;
  const plain56 = runs.find((r) => r.depth === 56 && !r.residual)!;
  const plainSpread = Math.max(...plain56.grads) / Math.min(...plain56.grads);

  return (
    <div className={styles.lab} data-testid="lab-residual">
      <div className={styles.chips}>
        {[20, 56].map((d) => (
          <button key={d} type="button" aria-pressed={depth === d} onClick={() => setDepth(d)} data-testid={`res-depth-${d}`}>
            {d} layers
          </button>
        ))}
        <button type="button" aria-pressed={residual} onClick={() => setResidual((v) => !v)} data-testid="res-toggle">
          {residual ? "Skip connections on" : "Skip connections off"}
        </button>
      </div>
      <div className={styles.cols}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Training loss per epoch for the four runs">
          <text x={W / 2} y={12} textAnchor="middle" className={styles.small}>
            training loss per epoch
          </text>
          {runs.map((r) => (
            <path
              key={r.name}
              d={r.trainLoss.map((l, e) => `${e ? "L" : "M"}${x(e).toFixed(1)},${y(l).toFixed(1)}`).join("")}
              className={r === run ? styles.fitLine : styles.ghost}
            />
          ))}
          <line x1={34} x2={W - 16} y1={H - 30} y2={H - 30} className={styles.axisLine} />
          <text x={W - 16} y={H - 12} textAnchor="end" className={styles.small}>
            {epochs} epochs
          </text>
        </svg>
        <svg viewBox={`0 0 ${BW} ${BH}`} className={styles.svg} role="img" aria-label="Gradient size reaching each layer">
          <text x={BW / 2} y={12} textAnchor="middle" className={styles.small}>
            training signal reaching each layer (smallest = 1)
          </text>
          {g.map((v, i) => {
            const h = (Math.log1p(v) / Math.log1p(gMax)) * (BH - 60);
            return <rect key={i} x={20 + i * bw} y={BH - 30 - h} width={bw * 0.8} height={h} className={residual ? styles.barRes : styles.barPlain} />;
          })}
          <text x={20} y={BH - 12} className={styles.small}>
            input side
          </text>
          <text x={BW - 20} y={BH - 12} textAnchor="end" className={styles.small}>
            output side
          </text>
        </svg>
      </div>
      <p className={styles.big} data-testid="res-result">
        {run.name}: test accuracy <strong>{(run.testAcc[run.testAcc.length - 1] * 100).toFixed(2)}%</strong>, final training loss{" "}
        <strong>{run.trainLoss[run.trainLoss.length - 1].toFixed(3)}</strong>, layer-to-layer spread <strong>{Math.max(...g).toFixed(0)}×</strong>
      </p>
      <p className={styles.note}>
        Start at 56 layers without skip connections, then switch them on. The deeper plain network cannot even fit
        its training data as well as the 20-layer one, and its gradients differ {plainSpread.toFixed(0)}-fold between layers; with
        shortcuts, the same 56 layers train best of all.
      </p>
    </div>
  );
}
