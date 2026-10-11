"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { drawnInput } from "@/lib/drawnInput";
import { heroPass, LIBRARY_LAYER, type HeroFocus } from "@/lib/heroPass";
import { textFrame } from "@/lib/pixelFont";
import type { TrainedMlp } from "@/lib/mlp";
import {
  ARCH,
  argmax,
  forward,
  layoutLayers,
  meanActivations,
  normalise,
  selectEdges,
  type LayerLayout,
  type Weights,
} from "@/lib/network";
import { EXHIBIT_GROUPS } from "./HeroExhibits";
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
// After the output lights, the signal leaves for the libraries beyond it.
const T_SHIP = T_INPUT + T_HOP * 3;
const T_SHIP_HOP = 0.45;

// While the camera faces the input layer, the input is an introduction, one frame per pass.
const INTRO: string[][] = [
  ["HELLO,", "I'M", "ADITYA"],
  ["CSE AT", "VIT", "CLASS", "OF '27"],
  ["I TRAIN", "MODELS", "FROM", "SCRATCH"],
  ["YOUR", "TURN:", "DRAW", "A DIGIT"],
];
const INTRO_STOP = 1;

// The libraries sit in a row past the output layer, raised and shifted so they read beside the copy.
const LIB_Z = 9.4;
const LIB_SPACING = 0.95;
const LIB_X = -1.6;
const LIB_Y = 0.9;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** One neuron per exhibit, spread over the layer: a 3-wide grid of cells, the usually most active neuron in each. */
function pickNeurons(layout: LayerLayout, mean: Float32Array, count: number) {
  const gx = 3;
  const gy = Math.ceil(count / gx);
  const out: number[] = [];
  for (let cy = 0; cy < gy; cy++)
    for (let cx = 0; cx < gx && out.length < count; cx++) {
      let best = -1;
      for (let i = 0; i < layout.size; i++) {
        const c = i % layout.cols;
        const r = Math.floor(i / layout.cols);
        if (Math.floor((c * gx) / layout.cols) !== cx || Math.floor((r * gy) / layout.rows) !== cy) continue;
        if (best < 0 || mean[i] > mean[best]) best = i;
      }
      out.push(best);
    }
  return out;
}

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

function ringTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  g.stroke();
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
  model: TrainedMlp;
};

type Pass = { x: Float32Array; acts: Float32Array[]; pred: number };

function runPass(weights: Weights, x: Float32Array): Pass {
  const acts = forward(weights, x);
  return { x, acts: acts.map(normalise), pred: argmax(acts[acts.length - 1]) };
}

type Box = { l: number; t: number; r: number; b: number };
type Spot = { tx: number; ty: number; angle: number; length: number; start: number; key: string };

const HEADER = 64;
// Tag positions to try, in order: "push:step:side". Beside the neuron first, then stepped up or
// down, then pushed further out; right side before left.
const CANDIDATES = [0, 70, 140].flatMap((push) =>
  [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5].flatMap((step) => [1, -1].map((side) => `${push}:${step}:${side}`)),
);
const overlaps = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/**
 * Where each label's tag goes, in screen space. Tags sit beside their neuron, right side
 * first, and step up or down (then further out) to clear the copy cards, the header and each
 * other; a label that cannot be placed is hidden. Returns one spot per item, or null.
 */
function placeTags(
  items: { x: number; y: number; w: number; h: number; prev?: string }[],
  width: number,
  height: number,
  cards: DOMRect[],
  ring: number,
): (Spot | null)[] {
  const taken: Box[] = [{ l: 0, t: 0, r: width, b: HEADER }];
  for (const c of cards) taken.push({ l: c.left - 12, t: c.top - 12, r: c.right + 12, b: c.bottom + 12 });
  const free = (bx: Box) =>
    bx.l >= 8 && bx.r <= width - 8 && bx.t >= HEADER && bx.b <= height - 8 && !taken.some((t) => overlaps(t, bx));
  const order = items.map((_, i) => i).sort((a, b) => items[a].y - items[b].y);
  const out: (Spot | null)[] = items.map(() => null);
  const gap = ring + 14;
  for (const i of order) {
    const { x, y, w, h } = items[i];
    if (x < -1e3) continue;
    const ringBox = { l: x - ring, t: y - ring, r: x + ring, b: y + ring };
    if (cards.some((c) => overlaps(ringBox, { l: c.left, t: c.top, r: c.right, b: c.bottom }))) continue;
    const boxFor = (key: string) => {
      const [push, step, side] = key.split(":").map(Number);
      const l = side > 0 ? x + gap + push : x - gap - push - w;
      const t = y - h / 2 + step * (h * 0.6 + 4);
      return { l, t, r: l + w, b: t + h };
    };
    // Keep last frame's spot while it is still free, so tags do not hop as the camera settles.
    const keys = items[i].prev ? [items[i].prev!, ...CANDIDATES] : CANDIDATES;
    let chosen: Box | null = null;
    let chosenKey = "";
    for (const key of keys) {
      const bx = boxFor(key);
      if (free(bx)) {
        chosen = bx;
        chosenKey = key;
        break;
      }
    }
    if (!chosen) continue;
    taken.push({ l: chosen.l - 4, t: chosen.t - 3, r: chosen.r + 4, b: chosen.b + 3 }, ringBox);
    // The leader runs from the ring's edge to the middle of the tag's near side.
    const ax = (chosen.l > x ? chosen.l : chosen.r) - x;
    const ay = (chosen.t + chosen.b) / 2 - y;
    const dist = Math.hypot(ax, ay);
    out[i] = {
      tx: chosen.l - x,
      ty: chosen.t - y,
      angle: Math.atan2(ay, ax),
      start: ring + 1,
      length: Math.max(0, dist - ring - 1),
      key: chosenKey,
    };
  }
  return out;
}

// A drawing stays on the network this long after the last stroke.
const DRAWN_HOLD = 12;

export function NetworkScene({ progress, reducedMotion, model }: Props) {
  const { camera, size, invalidate } = useThree();

  const net = useMemo(() => {
    const { weights, samples } = model;
    const layout = layoutLayers(ARCH);
    const mean = meanActivations(weights, samples);
    const edges = selectEdges(weights, ARCH, [4, 3, 6], mean);
    const passes = samples.map((x) => runPass(weights, x));
    let maxW = 0;
    for (const e of edges) maxW = Math.max(maxW, Math.abs(e.weight));
    const intro = INTRO.map((lines) => runPass(weights, textFrame(lines)));

    const anchors = new Map<string, HeroFocus>();
    let nLib = 0;
    for (const g of EXHIBIT_GROUPS) {
      if (g.layer === LIBRARY_LAYER) {
        nLib = g.items.length;
        g.items.forEach((ex, i) => anchors.set(ex.id, { layer: g.layer, index: i }));
      } else {
        const picked = pickNeurons(layout[g.layer], mean[g.layer], g.items.length);
        g.items.forEach((ex, i) => anchors.set(ex.id, { layer: g.layer, index: picked[i] }));
      }
    }
    const libPositions = new Float32Array(nLib * 3);
    for (let j = 0; j < nLib; j++) libPositions.set([LIB_X + ((nLib - 1) / 2 - j) * LIB_SPACING, LIB_Y, LIB_Z], j * 3);
    return { weights, layout, edges, passes, maxW, intro, anchors, nLib, libPositions };
  }, [model]);

  // The visitor's drawing, when there is one: its pass and when it started showing.
  const drawn = useRef<{ pass: Pass; start: number; last: number } | null>(null);
  const clockRef = useRef(0);
  useEffect(
    () =>
      drawnInput.subscribe(() => {
        const { input } = drawnInput.get();
        if (!input) {
          drawn.current = null;
          invalidate();
          return;
        }
        const t = clockRef.current;
        drawn.current = { pass: runPass(net.weights, input), start: drawn.current?.start ?? t, last: t };
        invalidate();
      }),
    [net, invalidate],
  );

  const disc = useMemo(() => discTexture(), []);
  const ring = useMemo(() => ringTexture(), []);
  const labels = useMemo(() => Array.from({ length: 10 }, (_, d) => labelTexture(String(d))), []);

  // --- Geometry -----------------------------------------------------------------------
  const inputMesh = useRef<THREE.InstancedMesh>(null);
  const layerPoints = useRef<(THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>> | null)[]>([]);
  const edgeLines = useRef<THREE.LineSegments>(null);
  const pulses = useRef<THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>>(null);
  const labelSprites = useRef<(THREE.Sprite | null)[]>([]);
  const marker = useRef<THREE.Sprite>(null);
  const libPoints = useRef<THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>>(null);
  const shipLines = useRef<THREE.LineSegments>(null);
  const shipPulses = useRef<THREE.Points<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>>(null);
  // Which intro frame is showing, or -1 for MNIST digits; decided once per pass.
  const cycleRef = useRef(-1);
  const introRef = useRef(-1);
  const tagSizes = useRef(new WeakMap<HTMLElement, { w: number; h: number }>());
  const proj = useRef(new THREE.Vector3());
  const parallax = useRef(new THREE.Vector2());
  const lastSpot = useRef(new WeakMap<HTMLElement, string>());
  const written = useRef(new WeakMap<HTMLElement, string>());
  const labelsShown = useRef(false);

  useEffect(() => {
    heroPass.anchors = net.anchors;
  }, [net]);

  // The readouts beside the copy ask for a frame when the visitor points at a neuron.
  useEffect(() => {
    heroPass.invalidate = invalidate;
    return () => {
      heroPass.invalidate = () => {};
      heroPass.input = null;
      heroPass.labels.forEach((el) => {
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      });
    };
  }, [invalidate]);

  const { pointGeoms, edgeGeom, pulseGeom, shipGeom, libGeom, shipPulseGeom } = useMemo(() => {
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
    // Every output neuron is wired to every library; the pulse leaves from the predicted one.
    const outPos = net.layout[ARCH.length - 1].positions;
    const nOut = ARCH[ARCH.length - 1];
    const sPos = new Float32Array(nOut * net.nLib * 6);
    for (let o = 0; o < nOut; o++)
      for (let j = 0; j < net.nLib; j++) {
        const k = o * net.nLib + j;
        sPos.set(outPos.subarray(o * 3, o * 3 + 3), k * 6);
        sPos.set(net.libPositions.subarray(j * 3, j * 3 + 3), k * 6 + 3);
      }
    const shipGeom = new THREE.BufferGeometry();
    shipGeom.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    shipGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sPos.length), 3));
    const libGeom = new THREE.BufferGeometry();
    libGeom.setAttribute("position", new THREE.BufferAttribute(net.libPositions, 3));
    libGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(net.nLib * 3), 3));
    const shipPulseGeom = new THREE.BufferGeometry();
    shipPulseGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(net.nLib * 3), 3));
    shipPulseGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(net.nLib * 3), 3));
    return { pointGeoms, edgeGeom, pulseGeom, shipGeom, libGeom, shipPulseGeom };
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
      shipGeom.dispose();
      libGeom.dispose();
      shipPulseGeom.dispose();
      disc.dispose();
      ring.dispose();
      labels.forEach((t) => t.dispose());
    },
    [pointGeoms, edgeGeom, pulseGeom, shipGeom, libGeom, shipPulseGeom, disc, ring, labels],
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

  /** Place every label over its neuron, clear of the copy cards and of each other. */
  function layoutLabels(fades: number[], pass: Pass, lit: number[], shipLit: number) {
    const cards = heroPass.cards.filter((r) => r.bottom > 0 && r.top < size.height);
    const v = proj.current;
    EXHIBIT_GROUPS.forEach((g, gi) => {
      const fade = fades[gi];
      const items: { el: HTMLElement; x: number; y: number; fire: number; w: number; h: number; prev?: string }[] = [];
      for (const ex of g.items) {
        const el = heroPass.labels.get(ex.id);
        const anchor = net.anchors.get(ex.id);
        if (!el || !anchor) continue;
        let x = -1e4;
        let y = -1e4;
        if (fade >= 0.02) {
          const pos = g.layer === LIBRARY_LAYER ? net.libPositions : net.layout[g.layer].positions;
          v.set(pos[anchor.index * 3], pos[anchor.index * 3 + 1], pos[anchor.index * 3 + 2]).project(camera);
          if (v.z < 1) {
            x = ((v.x + 1) / 2) * size.width;
            y = ((1 - v.y) / 2) * size.height;
          }
        }
        let dims = tagSizes.current.get(el);
        if (!dims && fade >= 0.02) {
          const tag = el.querySelector<HTMLElement>("span:last-child");
          if (tag) {
            el.style.visibility = "visible";
            dims = { w: tag.offsetWidth, h: tag.offsetHeight };
            if (dims.w) tagSizes.current.set(el, dims);
          }
        }
        const fire = g.layer === LIBRARY_LAYER ? shipLit : pass.acts[g.layer][anchor.index] * lit[g.layer];
        items.push({ el, x, y, fire, w: dims?.w ?? 160, h: dims?.h ?? 38, prev: lastSpot.current.get(el) });
      }
      const placed = placeTags(items, size.width, size.height, cards, g.layer === LIBRARY_LAYER ? 14 : 10);
      items.forEach((it, k) => {
        const spot = placed[k];
        if (!spot) {
          if (it.el.style.visibility !== "hidden") {
            it.el.style.visibility = "hidden";
            it.el.style.opacity = "0";
            written.current.delete(it.el);
          }
          return;
        }
        lastSpot.current.set(it.el, spot.key);
        // Skip the style writes when nothing visible changed since the last frame.
        const sig = `${it.x.toFixed(1)},${it.y.toFixed(1)},${spot.key},${fade.toFixed(3)},${it.fire.toFixed(2)}`;
        if (written.current.get(it.el) === sig) return;
        written.current.set(it.el, sig);
        const st = it.el.style;
        st.visibility = "visible";
        st.opacity = fade.toFixed(3);
        st.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
        st.setProperty("--tx", `${spot.tx.toFixed(1)}px`);
        st.setProperty("--ty", `${spot.ty.toFixed(1)}px`);
        st.setProperty("--la", `${spot.angle.toFixed(3)}rad`);
        st.setProperty("--ll", `${spot.length.toFixed(1)}px`);
        st.setProperty("--lr", `${spot.start.toFixed(1)}px`);
        st.setProperty("--fire", it.fire.toFixed(2));
      });
    });
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
      // Hold the parallax while the visitor points at a label or tile, so it stays put under the cursor.
      if (!heroPass.focus) parallax.current.set(state.pointer.x, state.pointer.y);
      tmpPos.current.x += Math.sin(t * 0.15) * 0.8 * drift + parallax.current.x * 0.35;
      tmpPos.current.y += Math.cos(t * 0.12) * 0.3 * drift + parallax.current.y * 0.2;
    }
    const k = !started.current || reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
    started.current = true;
    camera.position.lerp(tmpPos.current, k);
    lookAt.current.lerp(tmpLook.current, k);
    camera.lookAt(lookAt.current);

    // --- Forward pass animation ---------------------------------------------------------
    clockRef.current = t;
    if (drawn.current && t - drawn.current.last > DRAWN_HOLD) drawn.current = null;
    const user = drawn.current;
    let pass: Pass;
    let tc: number;
    let fadeOut: number;
    if (user) {
      // The visitor's own digit: play the pass once, then hold it lit while they draw.
      pass = user.pass;
      tc = Math.min(t - user.start, T_FADE_OUT - 0.4);
      fadeOut = 1;
    } else {
      const cycle = reducedMotion ? 0 : Math.floor(t / CYCLE);
      if (cycle !== cycleRef.current) {
        cycleRef.current = cycle;
        const atIntro = !reducedMotion && Math.abs(p - INTRO_STOP) < 0.5;
        introRef.current = atIntro ? introRef.current + 1 : -1;
      }
      pass =
        introRef.current >= 0
          ? net.intro[introRef.current % net.intro.length]
          : net.passes[cycle % net.passes.length];
      tc = reducedMotion ? 2.8 : t % CYCLE;
      fadeOut = 1 - smooth(T_FADE_OUT, CYCLE, tc);
    }
    const lit = [smooth(0, T_INPUT, tc), 0, 0, 0].map((v, l) =>
      l === 0 ? v * fadeOut : smooth(T_INPUT + T_HOP * l - 0.1, T_INPUT + T_HOP * l + 0.15, tc) * fadeOut,
    );
    const col = tmpColor.current;
    // The libraries light once the pulse from the predicted output reaches them.
    const shipPhase = clamp01((tc - T_SHIP) / T_SHIP_HOP);
    const shipLit = smooth(T_SHIP + T_SHIP_HOP - 0.1, T_SHIP + T_SHIP_HOP, tc) * fadeOut;

    // Share the pass with the flat readouts, so they show the same digit lit at the same moment.
    if (heroPass.input !== pass.x) {
      heroPass.input = pass.x;
      heroPass.version++;
    }
    lit.forEach((v, l) => (heroPass.lit[l] = v));
    const focus = heroPass.focus;
    const mark = marker.current;
    if (mark) {
      mark.visible = !!focus;
      if (focus) {
        const p = focus.layer === LIBRARY_LAYER ? net.libPositions : net.layout[focus.layer].positions;
        mark.position.set(p[focus.index * 3], p[focus.index * 3 + 1], p[focus.index * 3 + 2]);
        const s = [0, 0.62, 0.68, 0.9, 1.1][focus.layer] * (1 + (reducedMotion ? 0 : 0.08 * Math.sin(t * 5)));
        mark.scale.set(s, s, 1);
      }
    }

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
        let glow = (0.015 + mag * 0.035 + src * (travelling * 0.45 + after * 0.5) * mag) * fadeOut;
        let base = e.weight >= 0 ? C_POS : C_NEG;
        // Connections into and out of the neuron the visitor is pointing at.
        if (
          focus &&
          ((e.layer + 1 === focus.layer && e.dst === focus.index) || (e.layer === focus.layer && e.src === focus.index))
        ) {
          glow = 0.35 + mag * 0.5;
          base = C_SIGNAL;
        }
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

    // --- Beyond the output: the libraries ------------------------------------------------
    const libs = libPoints.current;
    const ship = shipLines.current;
    const shipDots = shipPulses.current;
    if (libs && ship && shipDots) {
      const lCol = libs.geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let j = 0; j < net.nLib; j++) {
        col.copy(C_IDLE).multiplyScalar(2.6).lerp(C_ACT, shipLit);
        lCol.setXYZ(j, col.r, col.g, col.b);
      }
      lCol.needsUpdate = true;

      const sCol = ship.geometry.getAttribute("color") as THREE.BufferAttribute;
      const nOut = ARCH[ARCH.length - 1];
      const travelling = shipPhase > 0 && shipPhase < 1 ? Math.sin(Math.PI * shipPhase) : 0;
      for (let o = 0; o < nOut; o++)
        for (let j = 0; j < net.nLib; j++) {
          const k = o * net.nLib + j;
          let glow = 0.012;
          let base = C_ACT;
          if (o === pass.pred) glow += (travelling * 0.4 + (shipPhase >= 1 ? 0.22 : 0)) * fadeOut * lit[3];
          if (focus?.layer === LIBRARY_LAYER && focus.index === j) {
            glow = o === pass.pred ? 0.6 : 0.12;
            base = C_SIGNAL;
          }
          sCol.setXYZ(k * 2, base.r * glow, base.g * glow, base.b * glow);
          sCol.setXYZ(k * 2 + 1, base.r * glow, base.g * glow, base.b * glow);
        }
      sCol.needsUpdate = true;

      const pPos = shipDots.geometry.getAttribute("position") as THREE.BufferAttribute;
      const pCol = shipDots.geometry.getAttribute("color") as THREE.BufferAttribute;
      const from = net.layout[ARCH.length - 1].positions;
      for (let j = 0; j < net.nLib; j++) {
        const o = pass.pred * 3;
        const to = j * 3;
        pPos.setXYZ(
          j,
          from[o] + (net.libPositions[to] - from[o]) * shipPhase,
          from[o + 1] + (net.libPositions[to + 1] - from[o + 1]) * shipPhase,
          from[o + 2] + (net.libPositions[to + 2] - from[o + 2]) * shipPhase,
        );
        const v = travelling * fadeOut;
        pCol.setXYZ(j, C_SIGNAL.r * v, C_SIGNAL.g * v, C_SIGNAL.b * v);
      }
      pPos.needsUpdate = true;
      pCol.needsUpdate = true;
    }

    // --- Labels over the network ----------------------------------------------------------
    // Labels: nothing to do while the camera is away from every labelled layer.
    const fades = EXHIBIT_GROUPS.map((g) => (reducedMotion ? 0 : clamp01(1 - Math.abs(p - g.stop) * 2.2)));
    const anyLabels = fades.some((f) => f >= 0.02);
    if (anyLabels || labelsShown.current) layoutLabels(fades, pass, lit, shipLit);
    labelsShown.current = anyLabels;
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

      <lineSegments ref={shipLines} geometry={shipGeom} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>

      <points ref={libPoints} geometry={libGeom} frustumCulled={false}>
        <pointsMaterial
          map={disc}
          size={0.85}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <points ref={shipPulses} geometry={shipPulseGeom} frustumCulled={false}>
        <pointsMaterial
          map={disc}
          size={0.3}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <sprite ref={marker} visible={false} renderOrder={2}>
        <spriteMaterial map={ring} color={C_SIGNAL} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>

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
