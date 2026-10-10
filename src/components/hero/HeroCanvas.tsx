"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState, type RefObject } from "react";
import { loadMlp, type TrainedMlp } from "@/lib/mlp";
import { NetworkScene } from "./NetworkScene";

export default function HeroCanvas({
  progress,
  running,
  reducedMotion,
}: {
  progress: RefObject<number>;
  running: boolean;
  reducedMotion: boolean;
}) {
  const [model, setModel] = useState<TrainedMlp | null>(null);
  useEffect(() => {
    loadMlp().then(setModel, () => setModel(null));
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 45, near: 0.1, far: 100, position: [-11, 4.5, -9] }}
      frameloop={running && !reducedMotion ? "always" : "demand"}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#05070d")}
      aria-hidden="true"
    >
      {model ? <NetworkScene progress={progress} reducedMotion={reducedMotion} model={model} /> : null}
    </Canvas>
  );
}
