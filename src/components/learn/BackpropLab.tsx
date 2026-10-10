"use client";

import { useState } from "react";
import styles from "./Lab.module.css";

type Net = { w1: number[][]; b1: number[]; w2: number[]; b2: number };

const START: Net = { w1: [[0.6, -0.4], [0.3, 0.8]], b1: [0.1, -0.1], w2: [0.5, -0.7], b2: 0.05 };
const sig = (z: number) => 1 / (1 + Math.exp(-z));

/** Forward and backward pass of a 2-2-1 network with sigmoid units and squared error. */
function pass(n: Net, x: number[], y: number) {
  const z1 = n.w1.map((row, j) => row[0] * x[0] + row[1] * x[1] + n.b1[j]);
  const h = z1.map(sig);
  const out = sig(n.w2[0] * h[0] + n.w2[1] * h[1] + n.b2);
  const loss = (out - y) ** 2;
  const dOut = 2 * (out - y) * out * (1 - out);
  const gw2 = h.map((hj) => dOut * hj);
  const dh = n.w2.map((w, j) => dOut * w * h[j] * (1 - h[j]));
  const gw1 = dh.map((d) => [d * x[0], d * x[1]]);
  return { h, out, loss, grads: { w1: gw1, b1: dh, w2: gw2, b2: dOut } };
}

export function BackpropLab() {
  const [net, setNet] = useState<Net>(START);
  const [x, setX] = useState([0.8, 0.3]);
  const [y, setY] = useState(1);
  const [lr, setLr] = useState(1.5);
  const [history, setHistory] = useState<number[]>([]);
  const [showGrads, setShowGrads] = useState(true);
  const p = pass(net, x, y);

  function step(times = 1) {
    let n = net;
    const h: number[] = [];
    for (let k = 0; k < times; k++) {
      const r = pass(n, x, y);
      h.push(r.loss);
      n = {
        w1: n.w1.map((row, j) => row.map((w, i) => w - lr * r.grads.w1[j][i])),
        b1: n.b1.map((b, j) => b - lr * r.grads.b1[j]),
        w2: n.w2.map((w, j) => w - lr * r.grads.w2[j]),
        b2: n.b2 - lr * r.grads.b2,
      };
    }
    setNet(n);
    setHistory((hs) => [...hs, ...h].slice(-60));
  }

  const W = 520;
  const H = 260;
  const inPos = [[70, 80], [70, 180]];
  const hidPos = [[260, 80], [260, 180]];
  const outPos = [450, 130];
  const maxG = Math.max(1e-6, ...p.grads.w1.flat().map(Math.abs), ...p.grads.w2.map(Math.abs));
  const edge = (a: number[], b: number[], w: number, g: number, key: string) => (
    <g key={key}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={w >= 0 ? "var(--activation)" : "#9b8cff"} strokeWidth={1 + Math.min(6, Math.abs(w) * 4)} strokeOpacity={0.55} />
      {showGrads ? <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--signal)" strokeWidth={1 + 7 * (Math.abs(g) / maxG)} strokeOpacity={0.85} strokeDasharray="6 5" /> : null}
      <text x={a[0] + (b[0] - a[0]) * 0.28} y={a[1] + (b[1] - a[1]) * 0.28 - 7} className={styles.edgeText}>
        {w.toFixed(2)}
      </text>
    </g>
  );
  const node = (pos: number[], v: number, key: string, labelText: string) => (
    <g key={key}>
      <circle cx={pos[0]} cy={pos[1]} r={24} className={styles.node} style={{ fillOpacity: 0.15 + 0.75 * Math.min(1, Math.abs(v)) }} />
      <text x={pos[0]} y={pos[1] + 4} textAnchor="middle" className={styles.nodeText}>
        {v.toFixed(2)}
      </text>
      <text x={pos[0]} y={pos[1] + 42} textAnchor="middle" className={styles.small}>
        {labelText}
      </text>
    </g>
  );
  const lMax = Math.max(0.01, ...history, p.loss);

  return (
    <div className={styles.lab} data-testid="lab-backprop">
      <div className={styles.cols}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="A 2-2-1 network with its weights and gradients">
          {inPos.flatMap((a, i) => hidPos.map((b, j) => edge(a, b, net.w1[j][i], p.grads.w1[j][i], `a${i}${j}`)))}
          {hidPos.map((a, j) => edge(a, outPos, net.w2[j], p.grads.w2[j], `b${j}`))}
          {inPos.map((pos, i) => node(pos, x[i], `x${i}`, `input ${i + 1}`))}
          {hidPos.map((pos, j) => node(pos, p.h[j], `h${j}`, "hidden"))}
          {node(outPos, p.out, "o", `output, target ${y.toFixed(1)}`)}
        </svg>
        <div className={styles.panel}>
          <p className={styles.big} data-testid="bp-loss">
            loss <strong>{p.loss.toFixed(4)}</strong>
          </p>
          <svg viewBox="0 0 200 60" className={styles.spark} aria-label="Loss over the steps taken">
            <path d={history.map((v, i) => `${i ? "L" : "M"}${(i / 59) * 200},${58 - (v / lMax) * 54}`).join("")} className={styles.sparkLine} />
          </svg>
          <div className={styles.buttons}>
            <button type="button" onClick={() => step(1)} data-testid="bp-step">
              One step
            </button>
            <button type="button" onClick={() => step(20)} data-testid="bp-step20">
              20 steps
            </button>
            <button
              type="button"
              onClick={() => {
                setNet(START);
                setHistory([]);
              }}
            >
              Reset
            </button>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={showGrads} onChange={(e) => setShowGrads(e.target.checked)} /> Show gradients (dashed amber: how much each weight is to blame)
          </label>
          <label className={styles.slider}>
            <span>
              Learning rate <strong>{lr.toFixed(1)}</strong>
            </span>
            <input type="range" min={0.1} max={8} step={0.1} value={lr} onChange={(e) => setLr(Number(e.target.value))} />
          </label>
          <label className={styles.slider}>
            <span>
              Target <strong>{y.toFixed(1)}</strong>
            </span>
            <input type="range" min={0} max={1} step={0.1} value={y} onChange={(e) => setY(Number(e.target.value))} />
          </label>
          <label className={styles.slider}>
            <span>
              Input 1 <strong>{x[0].toFixed(1)}</strong>
            </span>
            <input type="range" min={0} max={1} step={0.1} value={x[0]} onChange={(e) => setX([Number(e.target.value), x[1]])} />
          </label>
        </div>
      </div>
      <p className={styles.note}>
        Line thickness is a weight&apos;s size; cyan is positive, violet negative. Each step moves every weight against
        its gradient. Push the learning rate to 8 and watch the loss start to jump instead of fall.
      </p>
    </div>
  );
}
