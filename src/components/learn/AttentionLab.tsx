"use client";

import { useRef, useState } from "react";
import styles from "./Lab.module.css";

// Five earlier words and their key vectors in a toy 2-D space. Real models use hundreds of dimensions; two are
// enough to see the mechanism.
const KEYS = [
  { word: "cat", v: [0.9, 0.45] },
  { word: "mat", v: [0.75, -0.55] },
  { word: "sat", v: [-0.2, 0.95] },
  { word: "the", v: [-0.85, -0.2] },
  { word: "because", v: [-0.3, -0.9] },
];

export function AttentionLab() {
  const [q, setQ] = useState([0.8, 0.5]);
  const [sharp, setSharp] = useState(3);
  const box = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const scores = KEYS.map((k) => k.v[0] * q[0] + k.v[1] * q[1]);
  const ex = scores.map((s) => Math.exp(s * sharp));
  const sum = ex.reduce((a, b) => a + b, 0);
  const weights = ex.map((e) => e / sum);
  const best = weights.indexOf(Math.max(...weights));
  const S = 260;
  const c = S / 2;
  const R = 100;
  const to = (v: number[]) => [c + v[0] * R, c - v[1] * R];
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * S;
    const y = ((e.clientY - r.top) / r.height) * S;
    const v = [(x - c) / R, (c - y) / R];
    const len = Math.hypot(v[0], v[1]);
    setQ(len > 1.2 ? [(v[0] / len) * 1.2, (v[1] / len) * 1.2] : v);
  };
  const [qx, qy] = to(q);

  return (
    <div className={styles.lab} data-testid="lab-attention">
      <div className={styles.cols}>
        <svg
          ref={box}
          viewBox={`0 0 ${S} ${S}`}
          className={styles.plane}
          onPointerMove={move}
          onPointerUp={() => (drag.current = false)}
          onPointerLeave={() => (drag.current = false)}
          role="img"
          aria-label="Key vectors of five words and a draggable query vector"
        >
          <circle cx={c} cy={c} r={R} className={styles.ring} />
          <line x1={c - R - 10} x2={c + R + 10} y1={c} y2={c} className={styles.axisLine} />
          <line y1={c - R - 10} y2={c + R + 10} x1={c} x2={c} className={styles.axisLine} />
          {KEYS.map((k, i) => {
            const [x, y] = to(k.v);
            return (
              <g key={k.word}>
                <line x1={c} y1={c} x2={x} y2={y} className={styles.keyLine} strokeWidth={1 + weights[i] * 6} />
                <text x={x + (k.v[0] >= 0 ? 6 : -6)} y={y - 6} textAnchor={k.v[0] >= 0 ? "start" : "end"} className={i === best ? styles.wordHot : styles.word}>
                  {k.word}
                </text>
              </g>
            );
          })}
          <line x1={c} y1={c} x2={qx} y2={qy} className={styles.queryLine} />
          <circle
            cx={qx}
            cy={qy}
            r={11}
            className={styles.handle}
            onPointerDown={(e) => {
              drag.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
            data-testid="att-handle"
          />
          <text x={qx} y={qy + 26} textAnchor="middle" className={styles.wordHot}>
            query: “it”
          </text>
        </svg>
        <div className={styles.panel}>
          <p className={styles.small}>Score = query · key, then softmax</p>
          <ul className={styles.bars} data-testid="att-weights">
            {KEYS.map((k, i) => (
              <li key={k.word} data-best={i === best || undefined}>
                <span>{k.word}</span>
                <span className={styles.barTrack}>
                  <span style={{ width: `${weights[i] * 100}%` }} />
                </span>
                <span className={styles.num}>
                  {scores[i].toFixed(2)} → {(weights[i] * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
          <label className={styles.slider}>
            <span>
              Sharpness <strong>{sharp.toFixed(1)}</strong>
            </span>
            <input type="range" min={0.2} max={10} step={0.1} value={sharp} onChange={(e) => setSharp(Number(e.target.value))} data-testid="att-sharp" />
          </label>
        </div>
      </div>
      <p className={styles.note}>
        Drag the amber query. A key pointing the same way scores high; softmax turns the scores into weights that add
        up to 100%, and the word&apos;s new meaning is that weighted mix. Low sharpness spreads attention evenly;
        high sharpness picks one word.
      </p>
    </div>
  );
}
