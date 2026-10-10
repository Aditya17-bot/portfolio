"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { rasteriseDigit } from "@/lib/digits";
import {
  ARCH,
  argmax,
  forward,
  layoutLayers,
  meanActivations,
  normalise,
  randomWeights,
  selectEdges,
  type Weights,
} from "@/lib/network";
import { CAMERA_STOPS } from "./stops";

// Colours of the drawing. The hero is always on a dark field, whatever the page theme.
const C_IDLE = new THREE.Color("#1a2638");
const C_ACT = new THREE.Color("#5ce1e6");
const C_SIGNAL = new THREE.Color("#f5a524");
const C_POS = new THREE.Color("#5ce1e6");
const C_NEG = new THREE.Color("#ff5c8a");

// One forward pass every CYCLE seconds.
const CYCLE = 3.6;
const T_INPUT = 0.5;
const T_HOP = 0.6;
const T_FADE_OUT = 3.2;

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

function discTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.42, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.font = "600 40px ui-monospace, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Props = {
  /** Scroll position in stops: 0 = overview, 1 = input layer, ... */
  progress: RefObject<number>;
  reducedMotion: boolean;
  weights?: Weights;
};

export function NetworkScene({ progress, reducedMotion, weights: given }: Props) {
  const { camera, size } = useThree();

  const net = useMemo(() => {
    const weights = given ?? randomWeights();
    const layout = layoutLayers(ARCH);
    const samples = Array.from({ length: 10 }, (_, d) => rasteriseDigit(d, d));
    const mean = meanActivations(weights, samples);
    const edges = selectEdges(weights, ARCH, [4, 3, 6], mean);
    const passes = samples.map((x) => {
      const acts = forward(weights, x);
      return { acts: acts.map(normalise), probs: acts[acts.length - 1], pred: argmax(acts[acts.length - 1]) };
    });
    let maxW = 0;
    for (const e of edges) maxW = Math.max(maxW, Math.abs(e.weight));
    return { layout, edges, passes, maxW };
  }, [given]);

  const disc = useMemo(() => discTexture(), []);
  const labels = useMemo(() => Array.from({ length: 10 }, (_, d) => labelTexture(String(d))), []);

  // --- Geometry -----------------------------------------------------------------------
  const inputMesh = useRef<THREE.InstancedMesh>(null);
  const layerPoints = useRef<(THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>> | null)[]>([]);
  const edgeLines = useRef<THREE.LineSegments>(null);
  const pulses = useRef<THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>>(null);
  const labelSprites = useRef<(THREE.Sprite | null)[]>([]);

  const { pointGeoms, edgeGeom, pulseGeom } = useMemo(() => {
    const pointGeoms = net.layout.slice(1).map((ly) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(ly.positions, 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ly.size * 3), 3));
      return g;
    });
    const n = net.edges.length;
    const ePos = new Float32Array(n * 6);
    net.edges.forEach((e, k) => {
      const a = net.layout[e.layer].positions;
      const b = net.layout[e.layer + 1].positions;
      ePos.set(a.subarray(e.src * 3, e.src * 3 + 3), k * 6);
      ePos.set(b.subarray(e.dst * 3, e.dst * 3 + 3), k * 6 + 3);
    });
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
    edgeGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const pulseGeom = new THREE.BufferGeometry();
    pulseGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pulseGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return { pointGeoms, edgeGeom, pulseGeom };
  }, [net]);

  // Place the input pixels once.
  useEffect(() => {
    const mesh = inputMesh.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const p = net.layout[0].positions;
    for (let i = 0; i < net.layout[0].size; i++) {
      m.makeTranslation(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, C_IDLE);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [net]);

  useEffect(
    () => () => {
      pointGeoms.forEach((g) => g.dispose());
      edgeGeom.dispose();
      pulseGeom.dispose();
      disc.dispose();
      labels.forEach((t) => t.dispose());
    },
    [pointGeoms, edgeGeom, pulseGeom, disc, labels],
  );

  // --- Camera -------------------------------------------------------------------------
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const tmpPos = useRef(new THREE.Vector3());
  const tmpLook = useRef(new THREE.Vector3());
  const tmpColor = useRef(new THREE.Color());
  const started = useRef(false);

  const portrait = size.width / size.height < 1;

  // Frame the subject clear of the copy by offsetting the projection, not the camera:
  // right of centre beside the copy on wide screens, above it on portrait ones.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const { width: w, height: h } = size;
    if (portrait) cam.setViewOffset(w, h, 0, h * 0.2, w, h);
    else cam.setViewOffset(w, h, -w * 0.19, 0, w, h);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
    };
  }, [camera, size, portrait]);

  /** Camera position and target for a stop. Portrait screens are narrow, so step back. */
  function stopAt(i: number) {
    const s = CAMERA_STOPS[Math.max(0, Math.min(CAMERA_STOPS.length - 1, i))];
    const pos = new THREE.Vector3(...s.pos);
    const look = new THREE.Vector3(...s.look);
    if (portrait) pos.sub(look).multiplyScalar(2).add(look);
    return { pos, look };
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = reducedMotion ? 0 : (progress.current ?? 0);
    const i = Math.floor(p);
    const f = smooth(0, 1, p - i);
    const a = stopAt(i);
    const b = stopAt(i + 1);
    tmpPos.current.copy(a.pos).lerp(b.pos, f);
    tmpLook.current.copy(a.look).lerp(b.look, f);
    if (!reducedMotion) {
      // A slow drift and a little pointer parallax keep the overview alive.
      const drift = 1 - Math.min(1, p);
      tmpPos.current.x += Math.sin(t * 0.15) * 0.8 * drift + state.pointer.x * 0.35;
      tmpPos.current.y += Math.cos(t * 0.12) * 0.3 * drift + state.pointer.y * 0.2;
    }
    const k = !started.current || reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
    started.current = true;
    camera.position.lerp(tmpPos.current, k);
    lookAt.current.lerp(tmpLook.current, k);
    camera.lookAt(lookAt.current);

    // --- Forward pass animation ---------------------------------------------------------
    const cycle = reducedMotion ? 0 : Math.floor(t / CYCLE);
    const tc = reducedMotion ? 2.8 : t % CYCLE;
    const pass = net.passes[cycle % net.passes.length];
    const fadeOut = 1 - smooth(T_FADE_OUT, CYCLE, tc);
    const lit = [smooth(0, T_INPUT, tc), 0, 0, 0].map((v, l) =>
      l === 0 ? v * fadeOut : smooth(T_INPUT + T_HOP * l - 0.1, T_INPUT + T_HOP * l + 0.15, tc) * fadeOut,
    );
    const col = tmpColor.current;

    const mesh = inputMesh.current;
    if (mesh) {
      const a0 = pass.acts[0];
      for (let n = 0; n < a0.length; n++) {
        col.copy(C_IDLE).lerp(C_ACT, a0[n] * lit[0]);
        mesh.setColorAt(n, col);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    for (let l = 1; l < ARCH.length; l++) {
      const pts = layerPoints.current[l - 1];
      if (!pts) continue;
      const attr = pts.geometry.getAttribute("color") as THREE.BufferAttribute;
      const act = pass.acts[l];
      const isOut = l === ARCH.length - 1;
      for (let n = 0; n < act.length; n++) {
        let v = act[n] * lit[l];
        if (isOut) v = n === pass.pred ? lit[l] : v * 0.35;
        col.copy(C_IDLE).multiplyScalar(2.2).lerp(isOut && n === pass.pred ? C_SIGNAL : C_ACT, v);
        attr.setXYZ(n, col.r, col.g, col.b);
      }
      attr.needsUpdate = true;
    }

    labelSprites.current.forEach((s, d) => {
      if (!s) return;
      const on = d === pass.pred ? lit[3] : 0;
      (s.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * on;
      (s.material as THREE.SpriteMaterial).color.copy(on > 0.5 ? C_SIGNAL : C_ACT);
    });

    const lines = edgeLines.current;
    const dots = pulses.current;
    if (lines && dots) {
      const eCol = lines.geometry.getAttribute("color") as THREE.BufferAttribute;
      const ePos = lines.geometry.getAttribute("position") as THREE.BufferAttribute;
      const dPos = dots.geometry.getAttribute("position") as THREE.BufferAttribute;
      const dCol = dots.geometry.getAttribute("color") as THREE.BufferAttribute;
      net.edges.forEach((e, k2) => {
        const start = T_INPUT + T_HOP * e.layer - 0.1;
        const phase = Math.min(1, Math.max(0, (tc - start) / T_HOP));
        const src = pass.acts[e.layer][e.src];
        const mag = Math.abs(e.weight) / net.maxW;
        const travelling = phase > 0 && phase < 1 ? Math.sin(Math.PI * phase) : 0;
        const after = phase >= 1 ? 0.35 : 0;
        const glow = (0.015 + mag * 0.035 + src * (travelling * 0.45 + after * 0.5) * mag) * fadeOut;
        const base = e.weight >= 0 ? C_POS : C_NEG;
        eCol.setXYZ(k2 * 2, base.r * glow, base.g * glow, base.b * glow);
        eCol.setXYZ(k2 * 2 + 1, base.r * glow, base.g * glow, base.b * glow);

        const x = ePos.getX(k2 * 2) + (ePos.getX(k2 * 2 + 1) - ePos.getX(k2 * 2)) * phase;
        const y = ePos.getY(k2 * 2) + (ePos.getY(k2 * 2 + 1) - ePos.getY(k2 * 2)) * phase;
        const z = ePos.getZ(k2 * 2) + (ePos.getZ(k2 * 2 + 1) - ePos.getZ(k2 * 2)) * phase;
        dPos.setXYZ(k2, x, y, z);
        const s = travelling * src * (0.4 + mag) * fadeOut;
        dCol.setXYZ(k2, C_SIGNAL.r * s, C_SIGNAL.g * s, C_SIGNAL.b * s);
      });
      eCol.needsUpdate = true;
      dPos.needsUpdate = true;
      dCol.needsUpdate = true;
    }
  });

  const outLayout = net.layout[ARCH.length - 1];

  return (
    <>
      <instancedMesh ref={inputMesh} args={[undefined, undefined, net.layout[0].size]} frustumCulled={false}>
        <planeGeometry args={[0.105, 0.105]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      {pointGeoms.map((g, j) => (
        <points
          key={j}
          ref={(el) => {
            layerPoints.current[j] = el;
          }}
          geometry={g}
          frustumCulled={false}
        >
          <pointsMaterial
            map={disc}
            size={[0.42, 0.46, 0.62][j]}
            vertexColors
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      ))}

      <lineSegments ref={edgeLines} geometry={edgeGeom} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>

      <points ref={pulses} geometry={pulseGeom} frustumCulled={false}>
        <pointsMaterial
          map={disc}
          size={0.22}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {labels.map((tex, d) => (
        <sprite
          key={d}
          ref={(el) => {
            labelSprites.current[d] = el;
          }}
          position={[outLayout.positions[d * 3], outLayout.positions[d * 3 + 1] - 0.42, outLayout.positions[d * 3 + 2]]}
          scale={[0.3, 0.3, 1]}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}
