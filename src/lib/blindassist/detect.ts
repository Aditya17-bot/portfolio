// BlindAssist in the browser: the phone app's two detectors (COCO YOLOv8n and the door / dustbin / stairs
// fine-tune) through onnxruntime-web, then logic.js, a parity-tested port of the app's position, decision and
// merge rules. Thresholds follow the app's inference server. Every intermediate step is returned so the page can
// show it.

import type { Tensor } from "onnxruntime-web";
import { loadSession, runSerial, tensor } from "@/lib/ort";
import * as L from "./logic.js";

export const COCO_NAMES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
  "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
  "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

const COCO_CONF = 0.6;
const CUSTOM_CONF = 0.4;
const CUSTOM_FLOOR: Record<string, number> = { door: 0.4, dustbin: 0.6 };
const NMS_IOU = 0.7; // ultralytics predict() default
const SIZE = 640;

export type ModelKey = "coco" | "specialist";

const MODELS: { key: ModelKey; url: string; names: string[]; conf: number; trusted: boolean }[] = [
  { key: "coco", url: "/projects/blindassist/yolov8n.onnx", names: COCO_NAMES, conf: COCO_CONF, trusted: false },
  {
    key: "specialist",
    url: "/projects/blindassist/door_dustbin_stairs.onnx",
    names: ["door", "dustbin", "stairs"],
    conf: CUSTOM_CONF,
    trusted: true,
  },
];

export type Det = {
  name: string;
  conf: number;
  px: [number, number, number, number];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  model: ModelKey;
  trusted_name?: boolean;
};

export type Info = ReturnType<typeof L.analyzeBox>;

export type Analysis = {
  w: number;
  h: number;
  raw: Det[];
  kept: Det[];
  dropped: Det[];
  infos: Info[];
  ms: number;
};

export function loadModels() {
  return Promise.all(MODELS.map((m) => loadSession(m.url)));
}

/** Letterbox like ultralytics: keep aspect, pad with grey 114, CHW floats in 0..1. */
function preprocess(source: CanvasImageSource, w: number, h: number) {
  const r = Math.min(SIZE / w, SIZE / h);
  const nw = Math.round(w * r);
  const nh = Math.round(h * r);
  const left = Math.round((SIZE - nw) / 2 - 0.1);
  const top = Math.round((SIZE - nh) / 2 - 0.1);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(source, left, top, nw, nh);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4] / 255;
    input[plane + i] = data[i * 4 + 1] / 255;
    input[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  return { input, r, left, top };
}

function nms(dets: Det[]) {
  dets.sort((a, b) => b.conf - a.conf);
  const kept: Det[] = [];
  for (const d of dets) if (!kept.some((k) => k.name === d.name && L.iou(k, d) > NMS_IOU)) kept.push(d);
  return kept;
}

function decode(output: Tensor, model: (typeof MODELS)[number], lb: { r: number; left: number; top: number }, w: number, h: number) {
  const [, channels, anchors] = output.dims as number[];
  const out = output.data as Float32Array;
  const raw: Det[] = [];
  for (let i = 0; i < anchors; i++) {
    let best = 0;
    let cls = -1;
    for (let c = 4; c < channels; c++) {
      const s = out[c * anchors + i];
      if (s > best) {
        best = s;
        cls = c - 4;
      }
    }
    if (cls < 0 || best < model.conf) continue;
    const name = model.names[cls];
    if (!L.TARGET_CLASSES.has(name) || best < (CUSTOM_FLOOR[name] ?? model.conf)) continue;
    const cx = out[i];
    const cy = out[anchors + i];
    const bw = out[2 * anchors + i];
    const bh = out[3 * anchors + i];
    const cX = (v: number) => Math.min(Math.max(v, 0), w);
    const cY = (v: number) => Math.min(Math.max(v, 0), h);
    // The app reads boxes with Python's int(), which truncates.
    const x1 = Math.trunc(cX((cx - bw / 2 - lb.left) / lb.r));
    const y1 = Math.trunc(cY((cy - bh / 2 - lb.top) / lb.r));
    const x2 = Math.trunc(cX((cx + bw / 2 - lb.left) / lb.r));
    const y2 = Math.trunc(cY((cy + bh / 2 - lb.top) / lb.r));
    const det: Det = { name, conf: best, px: [x1, y1, x2, y2], x1: x1 / w, y1: y1 / h, x2: x2 / w, y2: y2 / h, model: model.key };
    if (model.trusted) det.trusted_name = true;
    raw.push(det);
  }
  return nms(raw);
}

export async function analyse(source: CanvasImageSource, w: number, h: number): Promise<Analysis> {
  const sessions = await loadModels();
  const t0 = performance.now();
  const lb = preprocess(source, w, h);
  const x = await tensor(lb.input, [1, 3, SIZE, SIZE]);
  let raw: Det[] = [];
  for (let k = 0; k < MODELS.length; k++) {
    const s = sessions[k];
    const res = await runSerial(s, { [s.inputNames[0]]: x });
    raw = raw.concat(decode(res[s.outputNames[0]], MODELS[k], lb, w, h));
  }
  // Each model suppresses only its own duplicates; one object can come back under two names, so merge across
  // models: the more confident name wins, and the specialist's door beats COCO's guess at the same box.
  const kept: Det[] = L.mergeDetections(raw, CUSTOM_FLOOR, COCO_CONF);
  const dropped = raw.filter((d) => !kept.includes(d));
  const infos: Info[] = kept.map((d) => L.analyzeBox(d.name, d.conf, ...d.px, w, h, Boolean(d.trusted_name)));
  return { w, h, raw, kept, dropped, infos, ms: performance.now() - t0 };
}

export type Mode = "walk" | "find" | "describe";

/** Why each object was or was not chosen in walk mode, mirroring the app's decision rules. */
export function walkReasons(infos: Info[], chosen: Info | null) {
  return infos.map((i) => {
    if (i === chosen) return "announced: the nearest, most central obstacle in the path";
    if (!L.OBSTACLE_CLASSES.has(i.name)) return "silent: a find-only class, never an obstacle warning";
    if (i.proximity === "medium" || i.proximity === "far") return `silent: ${i.proximity}, not close enough to matter yet`;
    return "silent: outranked by a closer or more central obstacle";
  });
}

export function sentence(infos: Info[], mode: Mode, target: string) {
  if (mode === "walk") {
    const ob = L.pickObstacle(infos);
    return { text: ob ? L.walkMessage(ob, infos, true) : "Path looks clear", chosen: ob as Info | null };
  }
  if (mode === "find") {
    const hit = L.findTarget(infos, target) as Info | null;
    return { text: L.findMessage(hit, target, true), chosen: hit };
  }
  return { text: L.summarizeScene(infos), chosen: null };
}

export const TARGETS = [...L.TARGET_CLASSES].sort();
export { L };
