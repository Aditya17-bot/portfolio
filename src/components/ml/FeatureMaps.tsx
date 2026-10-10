"use client";

import { useEffect, useRef } from "react";
import styles from "./FeatureMaps.module.css";

/** One small greyscale tile per channel of a [C, H, W] activation, each scaled to its own max. */
export function FeatureMaps({
  data,
  shape,
  title,
  note,
}: {
  data: Float32Array | null;
  shape: [number, number, number];
  title: string;
  note: string;
}) {
  const [c, h, w] = shape;
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    for (let k = 0; k < c; k++) {
      const g = refs.current[k]?.getContext("2d");
      if (!g) continue;
      const img = g.createImageData(w, h);
      let max = 0;
      if (data) for (let i = 0; i < h * w; i++) max = Math.max(max, data[k * h * w + i]);
      for (let i = 0; i < h * w; i++) {
        const v = data && max > 0 ? data[k * h * w + i] / max : 0;
        // Teal ramp on black, matching the network drawing.
        img.data.set([Math.round(92 * v), Math.round(225 * v), Math.round(230 * v), 255], i * 4);
      }
      g.putImageData(img, 0, 0);
    }
  }, [data, c, h, w]);

  return (
    <figure className={styles.figure}>
      <figcaption>
        <span className="eyebrow">{title}</span>
        <span className={styles.note}>{note}</span>
      </figcaption>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${c > 8 ? 8 : c}, minmax(0, 1fr))` }}>
        {Array.from({ length: c }, (_, k) => (
          <canvas
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            width={w}
            height={h}
            aria-label={`channel ${k + 1}`}
          />
        ))}
      </div>
    </figure>
  );
}
