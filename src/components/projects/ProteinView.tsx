"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Residue } from "@/lib/gene";

function Controls({ radius }: { radius: number }) {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, radius * 2.6);
    camera.lookAt(0, 0, 0);
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.addEventListener("change", () => invalidate());
    invalidate();
    return () => c.dispose();
  }, [camera, gl, invalidate, radius]);
  return null;
}

function Backbone({ points, colors }: { points: THREE.Vector3[]; colors: THREE.Color[] }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3));
    return g;
  }, [points, colors]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial vertexColors transparent opacity={0.55} />
    </line>
  );
}

function Atoms({
  points,
  colors,
  selected,
  onPick,
}: {
  points: THREE.Vector3[];
  colors: THREE.Color[];
  selected: Set<number>;
  onPick: (index: number) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    points.forEach((p, i) => {
      o.position.copy(p);
      o.scale.setScalar(selected.has(i) ? 2.4 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, selected.has(i) ? new THREE.Color("#ffffff") : colors[i]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    invalidate();
  }, [points, colors, selected, invalidate]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, points.length]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onPick(e.instanceId);
      }}
    >
      <sphereGeometry args={[0.75, 12, 10]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  );
}

function Links({ pairs }: { pairs: [THREE.Vector3, THREE.Vector3][] }) {
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(pairs.flat()), [pairs]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <lineSegments>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#f5a524" />
    </lineSegments>
  );
}

/** Alpha-carbon trace of a predicted structure; each sphere is one residue. */
export default function ProteinView({
  residues,
  colors,
  selected,
  links,
  onPick,
}: {
  residues: Residue[];
  colors: string[];
  selected: number[];
  links: [number, number][];
  onPick: (index: number) => void;
}) {
  const { points, radius } = useMemo(() => {
    const n = residues.length;
    const c = residues.reduce((s, r) => s.add(new THREE.Vector3(r.x, r.y, r.z)), new THREE.Vector3()).divideScalar(n || 1);
    const pts = residues.map((r) => new THREE.Vector3(r.x, r.y, r.z).sub(c));
    const rg = Math.sqrt(pts.reduce((s, p) => s + p.lengthSq(), 0) / (n || 1));
    return { points: pts, radius: Math.max(12, rg * 1.6) };
  }, [residues]);
  const cols = useMemo(() => colors.map((c) => new THREE.Color(c)), [colors]);
  const sel = useMemo(() => new Set(selected), [selected]);
  const pairs = useMemo(() => links.map(([a, b]) => [points[a], points[b]] as [THREE.Vector3, THREE.Vector3]), [links, points]);

  return (
    <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 40, near: 0.5, far: 2000 }} gl={{ antialias: true }} onCreated={({ gl }) => gl.setClearColor("#05070d")}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[40, 60, 80]} intensity={1.6} />
      <Controls radius={radius} />
      <Backbone points={points} colors={cols} />
      <Atoms points={points} colors={cols} selected={sel} onPick={onPick} />
      {pairs.length ? <Links pairs={pairs} /> : null}
    </Canvas>
  );
}
