"use client";

import { useMemo, useState } from "react";
import styles from "./Lab.module.css";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const truth = (x: number) => Math.sin(2 * Math.PI * x);

function sample(n: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const x = r();
    const u = 1 - r();
    const noise = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()) * 0.22;
    return [x, truth(x) + noise] as [number, number];
  });
}

/** Least-squares polynomial on x mapped to [-1, 1], with a whisper of ridge for numerical stability. */
function fit(pts: [number, number][], degree: number) {
  const d = degree + 1;
  const A = Array.from({ length: d }, () => new Array(d + 1).fill(0));
  for (const [x, y] of pts) {
    const t = 2 * x - 1;
    const pw = Array.from({ length: d }, (_, i) => t ** i);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) A[i][j] += pw[i] * pw[j];
      A[i][d] += pw[i] * y;
    }
  }
  for (let i = 0; i < d; i++) A[i][i] += 1e-9;
  for (let i = 0; i < d; i++) {
    let p = i;
    for (let r = i + 1; r < d; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < d; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= d; c++) A[r][c] -= f * A[i][c];
    }
  }
  const coef = A.map((row, i) => row[d] / row[i]);
  return (x: number) => coef.reduce((s, cc, i) => s + cc * (2 * x - 1) ** i, 0);
}

const rmse = (f: (x: number) => number, pts: [number, number][]) => Math.sqrt(pts.reduce((s, [x, y]) => s + (f(x) - y) ** 2, 0) / pts.length);

export function OverfitLab() {
  const [degree, setDegree] = useState(3);
  const [n, setN] = useState(12);
  const train = useMemo(() => sample(n, 7), [n]);
  const test = useMemo(() => sample(200, 99), []);
  const curves = useMemo(
    () =>
      Array.from({ length: 13 }, (_, d) => {
        const f = fit(train, d);
        return { train: rmse(f, train), test: rmse(f, test) };
      }),
    [train, test],
  );
  const f = useMemo(() => fit(train, degree), [train, degree]);
  const W = 420;
  const H = 240;
  const x = (v: number) => 20 + v * (W - 40);
  const y = (v: number) => H / 2 - v * (H / 2 - 20);
  const line = (g: (v: number) => number) =>
    Array.from({ length: 200 }, (_, i) => i / 199)
      .map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${Math.max(-40, Math.min(H + 40, y(g(v)))).toFixed(1)}`)
      .join("");
  const EW = 300;
  const EH = 240;
  const emax = 1.2;
  const ex = (d: number) => 30 + (d / 12) * (EW - 50);
  const ey = (e: number) => EH - 30 - (Math.min(e, emax) / emax) * (EH - 50);
  const best = curves.reduce((b, c, i) => (c.test < curves[b].test ? i : b), 0);

  return (
    <div className={styles.lab} data-testid="lab-overfit">
      <div className={styles.cols}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Noisy training points and the fitted polynomial">
          <path d={line(truth)} className={styles.truth} />
          <path d={line(f)} className={styles.fitLine} />
          {train.map(([px, py], i) => (
            <circle key={i} cx={x(px)} cy={y(py)} r={4.5} className={styles.pt} />
          ))}
        </svg>
        <svg viewBox={`0 0 ${EW} ${EH}`} className={styles.svg} role="img" aria-label="Training and test error by polynomial degree">
          <line x1={30} x2={EW - 20} y1={EH - 30} y2={EH - 30} className={styles.axisLine} />
          <path d={curves.map((c, d) => `${d ? "L" : "M"}${ex(d)},${ey(c.train)}`).join("")} className={styles.trainErr} />
          <path d={curves.map((c, d) => `${d ? "L" : "M"}${ex(d)},${ey(c.test)}`).join("")} className={styles.testErr} />
          <line x1={ex(degree)} x2={ex(degree)} y1={10} y2={EH - 30} className={styles.cursorLine} />
          <circle cx={ex(best)} cy={ey(curves[best].test)} r={5} className={styles.bestDot} />
          {[0, 3, 6, 9, 12].map((d) => (
            <text key={d} x={ex(d)} y={EH - 12} textAnchor="middle" className={styles.small}>
              {d}
            </text>
          ))}
          <text x={EW / 2} y={18} textAnchor="middle" className={styles.small}>
            error by polynomial degree
          </text>
        </svg>
      </div>
      <div className={styles.row2}>
        <label className={styles.slider}>
          <span>
            Polynomial degree <strong data-testid="of-degree">{degree}</strong>
          </span>
          <input type="range" min={0} max={12} step={1} value={degree} onChange={(e) => setDegree(Number(e.target.value))} data-testid="of-slider" />
        </label>
        <label className={styles.slider}>
          <span>
            Training points <strong>{n}</strong>
          </span>
          <input type="range" min={6} max={60} step={2} value={n} onChange={(e) => setN(Number(e.target.value))} data-testid="of-n" />
        </label>
        <p className={styles.big}>
          train <strong className={styles.kTrain}>{curves[degree].train.toFixed(3)}</strong> · unseen <strong className={styles.kTest} data-testid="of-test">{curves[degree].test.toFixed(3)}</strong>
        </p>
      </div>
      <p className={styles.note}>
        Grey is the true curve, cyan the fit, dots the noisy training data. Raise the degree: training error keeps
        falling, but past degree {best} the error on unseen data rises as the curve bends to chase noise. Now add
        more training points and watch the same high degree behave.
      </p>
    </div>
  );
}
