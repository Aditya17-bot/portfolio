"use client";

import { useRef, useState } from "react";
import styles from "./Lab.module.css";

const N = 12;
const FILTERS: Record<string, { k: number[][]; what: string }> = {
  "Horizontal edges": { k: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]], what: "Dark above, bright below scores high." },
  "Vertical edges": { k: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], what: "Dark on the left, bright on the right scores high." },
  Blur: { k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((r) => r.map((v) => v / 9)), what: "Averages each neighbourhood: detail fades." },
  Sharpen: { k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], what: "Boosts a pixel against its neighbours." },
};

const SEED: number[] = (() => {
  const g = new Array(N * N).fill(0);
  for (let c = 3; c <= 8; c++) g[2 * N + c] = 1;
  for (let r = 3; r <= 9; r++) g[r * N + Math.max(3, 8 - Math.floor((r - 2) * 0.8))] = 1;
  return g;
})();

export function ConvLab() {
  const [img, setImg] = useState<number[]>(SEED);
  const [name, setName] = useState("Horizontal edges");
  const [hover, setHover] = useState<[number, number] | null>(null);
  const painting = useRef<number | null>(null);
  const k = FILTERS[name].k;
  const M = N - 2;
  const out: number[] = [];
  for (let r = 0; r < M; r++)
    for (let c = 0; c < M; c++) {
      let s = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += img[(r + i) * N + c + j] * k[i][j];
      out.push(s);
    }
  const peak = Math.max(1e-6, ...out.map(Math.abs));
  const paint = (idx: number) => {
    if (painting.current === null) return;
    setImg((g) => g.map((v, i) => (i === idx ? painting.current! : v)));
  };
  const products = hover
    ? [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => ({ p: img[(hover[0] + i) * N + hover[1] + j], w: k[i][j] })))
    : null;

  return (
    <div className={styles.lab} data-testid="lab-conv" onPointerUp={() => (painting.current = null)} onPointerLeave={() => (painting.current = null)}>
      <div className={styles.chips}>
        {Object.keys(FILTERS).map((f) => (
          <button key={f} type="button" aria-pressed={name === f} onClick={() => setName(f)} data-testid="conv-filter">
            {f}
          </button>
        ))}
        <button type="button" onClick={() => setImg(new Array(N * N).fill(0))}>
          Clear
        </button>
      </div>
      <div className={styles.convRow}>
        <div>
          <p className={styles.small}>Image: click and drag to draw</p>
          <div className={styles.pixels} style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
            {img.map((v, i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              const inWindow = hover && r >= hover[0] && r < hover[0] + 3 && c >= hover[1] && c < hover[1] + 3;
              return (
                <span
                  key={i}
                  className={styles.px}
                  data-on={v > 0 || undefined}
                  data-window={inWindow || undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    painting.current = v > 0 ? 0 : 1;
                    paint(i);
                  }}
                  onPointerEnter={() => paint(i)}
                  data-testid="conv-px"
                />
              );
            })}
          </div>
        </div>
        <div className={styles.kernel}>
          <p className={styles.small}>Filter</p>
          <div className={styles.kgrid}>
            {k.flat().map((w, i) => (
              <span key={i} data-sign={w > 0 ? "pos" : w < 0 ? "neg" : "zero"}>
                {Number.isInteger(w) ? w : w.toFixed(2)}
              </span>
            ))}
          </div>
          <p className={styles.small}>{FILTERS[name].what}</p>
        </div>
        <div>
          <p className={styles.small}>Feature map: point at a cell</p>
          <div className={styles.pixels} style={{ gridTemplateColumns: `repeat(${M}, 1fr)` }} onPointerLeave={() => setHover(null)}>
            {out.map((v, i) => (
              <span
                key={i}
                className={styles.outPx}
                style={{ background: v >= 0 ? `rgba(92,225,230,${(Math.abs(v) / peak).toFixed(3)})` : `rgba(245,165,36,${(Math.abs(v) / peak).toFixed(3)})` }}
                onPointerEnter={() => setHover([Math.floor(i / M), i % M])}
                data-testid="conv-out"
                data-v={v.toFixed(3)}
              />
            ))}
          </div>
        </div>
      </div>
      <p className={styles.note} data-testid="conv-sum">
        {products && hover
          ? `This cell = ${products
              .filter((x) => x.p && x.w)
              .map((x) => `${x.p}×${Number.isInteger(x.w) ? x.w : x.w.toFixed(2)}`)
              .join(" + ") || "0"} = ${out[hover[0] * M + hover[1]].toFixed(2)}: the 9 pixels under the window times the filter, summed.`
          : "Cyan cells are where the filter's pattern is present, amber where its opposite is. The same 9 weights are used at every position, which is why a convolution needs so few parameters."}
      </p>
    </div>
  );
}
