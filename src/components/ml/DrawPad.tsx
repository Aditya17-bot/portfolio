"use client";

import { useEffect, useRef, useState } from "react";
import { toMnist } from "@/lib/preprocess";
import styles from "./DrawPad.module.css";

const RES = 280;

/** A square pad for drawing one digit. Calls onInput with a 28x28 MNIST-style input, or null when cleared. */
export function DrawPad({
  onInput,
  size = 224,
  label = "Draw a digit",
}: {
  onInput: (x: Float32Array | null) => void;
  size?: number;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const lastEmit = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    clear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ctx() {
    return canvas.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  }

  function clear(emit = true) {
    const g = ctx();
    if (!g) return;
    g.fillStyle = "#000";
    g.fillRect(0, 0, RES, RES);
    setEmpty(true);
    if (emit) onInput(null);
  }

  function point(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * RES, y: ((e.clientY - r.top) / r.height) * RES };
  }

  function emit(force = false) {
    const now = performance.now();
    if (!force && now - lastEmit.current < 50) return;
    lastEmit.current = now;
    if (canvas.current) onInput(toMnist(canvas.current));
  }

  function stroke(to: { x: number; y: number }) {
    const g = ctx();
    if (!g) return;
    const from = last.current ?? to;
    g.strokeStyle = "#fff";
    g.lineWidth = 22;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    last.current = to;
  }

  return (
    <div className={styles.wrap} style={{ width: size, maxWidth: "100%" }}>
      <canvas
        ref={canvas}
        width={RES}
        height={RES}
        className={styles.pad}
        style={{ width: "100%", height: "auto" }}
        aria-label={`${label}. Drawing area; use the sample button for a keyboard alternative.`}
        role="img"
        data-testid="draw-pad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = null;
          setEmpty(false);
          stroke(point(e));
          emit();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          stroke(point(e));
          emit();
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          emit(true);
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      {empty ? (
        <span className={styles.placeholder} aria-hidden="true">
          {label}
        </span>
      ) : null}
      <button type="button" className={styles.clear} onClick={() => clear()} disabled={empty}>
        Clear
      </button>
    </div>
  );
}
