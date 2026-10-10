"use client";

import { Canvas } from "@react-three/fiber";
import type { RefObject } from "react";
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
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 45, near: 0.1, far: 100, position: [-11, 4.5, -9] }}
      frameloop={running && !reducedMotion ? "always" : "demand"}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#05070d")}
      aria-hidden="true"
    >
      <NetworkScene progress={progress} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
