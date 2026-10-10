// BlindAssist decision logic for the browser demo.
//
// A line-for-line port of position.py, decision.py (the one-shot functions,
// not GuidanceEngine) and detect_merge.py. The Python files are the source of
// truth; test_logic_parity.py checks this file against them on random scenes.
// Rounding goes through pyRound because Python's round() is half-to-even and
// Math.round is not, which would move a "12 o'clock" bearing to "1 o'clock".

// ---------------------------------------------------------------- position.py

export const OBSTACLE_CLASSES = new Set([
  "person", "chair", "couch", "bed", "dining table", "bench",
  "toilet", "sink", "refrigerator", "tv", "potted plant",
  "suitcase", "backpack", "door", "wardrobe", "laundry basket",
]);
export const FIND_CLASSES = new Set([
  "bottle", "cup", "laptop", "cell phone", "book", "toothbrush", "window",
]);
export const TARGET_CLASSES = new Set([...OBSTACLE_CLASSES, ...FIND_CLASSES]);

const H_ZONES = ["left", "center", "right"];
const V_ZONES = ["top", "middle", "bottom"];

const AREA_THRESHOLDS = {
  "person": [0.35, 0.15, 0.05],
  "chair": [0.30, 0.12, 0.04],
  "bench": [0.30, 0.12, 0.04],
  "couch": [0.45, 0.20, 0.08],
  "bed": [0.45, 0.20, 0.08],
  "dining table": [0.45, 0.20, 0.08],
  "refrigerator": [0.40, 0.20, 0.08],
  "toilet": [0.30, 0.12, 0.04],
  "sink": [0.25, 0.10, 0.03],
  "tv": [0.30, 0.12, 0.04],
  "suitcase": [0.25, 0.10, 0.03],
  "backpack": [0.20, 0.08, 0.025],
  "potted plant": [0.20, 0.08, 0.025],
  "door": [0.40, 0.20, 0.08],
  "wardrobe": [0.40, 0.20, 0.08],
  "window": [0.30, 0.12, 0.04],
  "laundry basket": [0.25, 0.10, 0.03],
  "bottle": [0.05, 0.015, 0.004],
  "cup": [0.03, 0.010, 0.003],
  "cell phone": [0.03, 0.010, 0.003],
  "book": [0.05, 0.020, 0.006],
  "laptop": [0.15, 0.060, 0.020],
  "toothbrush": [0.03, 0.010, 0.003],
};
const DEFAULT_THRESHOLDS = [0.35, 0.15, 0.05];

export const PROXIMITY_LEVELS = ["very close", "close", "medium", "far"];

const CAMERA_FOCAL_NORM = 0.85;
const REAL_HEIGHTS = {
  "person": 1.7, "chair": 0.9, "couch": 0.8, "dining table": 0.75,
  "bench": 0.85, "toilet": 0.7, "sink": 0.85, "refrigerator": 1.7,
  "tv": 0.6, "potted plant": 0.6, "suitcase": 0.7, "backpack": 0.5,
  "door": 2.0, "wardrobe": 2.0, "window": 1.2,
  "laundry basket": 0.85,
  "bottle": 0.25, "cup": 0.1,
  "laptop": 0.20, "book": 0.24, "cell phone": 0.14, "toothbrush": 0.19,
};

/** Python's round(): half-to-even on the exact binary value, so
 * round(7.65, 1) is 7.7 because the double 7.65 sits slightly above it. */
export function pyRound(x, digits = 0) {
  // toFixed(100) is the exact decimal expansion for the magnitudes used here
  const exact = Math.abs(x).toFixed(100);
  const point = exact.indexOf(".");
  const rest = exact.slice(point + 1 + digits);
  if (!/^50*$/.test(rest)) return Number(x.toFixed(digits));
  // exact tie: round toward the even last kept digit
  const kept = exact.slice(0, point + 1 + digits).replace(/\.$/, "");
  const lastDigit = Number(kept[kept.length - 1]);
  const truncated = Number(kept);
  const step = 10 ** -digits;
  const magnitude = lastDigit % 2 === 0 ? truncated : truncated + step;
  return Number((Math.sign(x) * magnitude).toFixed(digits));
}

export function distanceMeters(name, heightFrac, clipped = false) {
  const real = REAL_HEIGHTS[name];
  if (real === undefined || heightFrac <= 0 || clipped) return null;
  return pyRound((real * CAMERA_FOCAL_NORM) / heightFrac, 1);
}

function zone(value, zones) {
  if (value < 1 / 3) return zones[0];
  if (value < 2 / 3) return zones[1];
  return zones[2];
}

export function directionPhrase(hZone, vZone) {
  if (vZone === "middle") return hZone === "center" ? "center ahead" : hZone;
  if (hZone === "center") return `${vZone} center`;
  return `${vZone} ${hZone}`;
}

const CAMERA_FOV_DEG = 65.0;
const DEGREES_PER_HOUR = 30.0;

export function clockHour(centerX) {
  const bearing = (Math.min(Math.max(centerX, 0.0), 1.0) - 0.5) * CAMERA_FOV_DEG;
  const hour = pyRound(bearing / DEGREES_PER_HOUR);
  return hour === 0 ? 12 : hour > 0 ? hour : 12 + hour;
}

export function clockPhrase(centerX) {
  return `at ${clockHour(centerX)} o'clock`;
}

export function proximityBucket(name, area) {
  const [veryClose, close, medium] = AREA_THRESHOLDS[name] || DEFAULT_THRESHOLDS;
  if (area >= veryClose) return "very close";
  if (area >= close) return "close";
  if (area >= medium) return "medium";
  return "far";
}

/** One detection box in pixel coords -> the ObjectInfo the decisions use. */
export function analyzeBox(name, confidence, x1, y1, x2, y2, frameW, frameH,
                           trustedName = false) {
  const cx = (x1 + x2) / 2 / frameW;
  const cy = (y1 + y2) / 2 / frameH;
  const area = ((x2 - x1) * (y2 - y1)) / (frameW * frameH);
  const hZone = zone(cx, H_ZONES);
  const vZone = zone(cy, V_ZONES);
  // a box hugging the top or bottom edge is probably cut off, so its height
  // cannot be trusted for the distance estimate
  const clipped = y1 / frameH <= 0.02 || y2 / frameH >= 0.98;
  return {
    name, confidence, hZone, vZone,
    proximity: proximityBucket(name, area),
    area, centerX: cx, centerY: cy,
    phrase: directionPhrase(hZone, vZone),
    distanceM: distanceMeters(name, (y2 - y1) / frameH, clipped),
    trustedName,
  };
}

// ---------------------------------------------------------------- decision.py

const PROX_RANK = Object.fromEntries(
  [...PROXIMITY_LEVELS].reverse().map((level, rank) => [level, rank]));
const SIDE_WORD = { left: "on left", center: "ahead", right: "on right" };
const NAME_CONFIDENCE = 0.8;
const TRUSTED_NAME_CLASSES = new Set(["door"]);
const WALK_MIN_PROXIMITY = "close";

const cap = (text) => text[0].toUpperCase() + text.slice(1);

function distanceOrBucket(info) {
  const d = info.distanceM;
  if (d !== null && info.confidence >= NAME_CONFIDENCE
      && (info.proximity === "medium" || info.proximity === "far")) {
    const m = Math.max(1, pyRound(d));
    return `about ${m} meter` + (m !== 1 ? "s" : "");
  }
  return info.proximity;
}

function relevantObstacle(info) {
  if (!OBSTACLE_CLASSES.has(info.name)) return false;
  return PROX_RANK[info.proximity] >= PROX_RANK[WALK_MIN_PROXIMITY];
}

function walkPriority(info) {
  const centrality = 1 - 2 * Math.abs(info.centerX - 0.5);
  return [PROX_RANK[info.proximity], centrality, info.area];
}

function compareTuples(a, b) {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  return 0;
}

/** Python max(): the first item with the largest key wins ties. */
function maxBy(items, key) {
  let best = null;
  let bestKey = null;
  for (const item of items) {
    const k = key(item);
    if (best === null || compareTuples(k, bestKey) > 0) {
      best = item;
      bestKey = k;
    }
  }
  return best;
}

export function pickObstacle(infos) {
  const candidates = infos.filter(relevantObstacle);
  return candidates.length ? maxBy(candidates, walkPriority) : null;
}

function freerSide(chosen, infos) {
  let left = 0.0;
  let right = 0.0;
  for (const i of infos) {
    if (i === chosen || !OBSTACLE_CLASSES.has(i.name)) continue;
    if (i.centerX < 0.5) left += i.area;
    else right += i.area;
  }
  if (left !== right) return left < right ? "left" : "right";
  return chosen.centerX >= 0.5 ? "left" : "right";
}

export function nameIsTrustworthy(info) {
  return Boolean(info.trustedName || TRUSTED_NAME_CLASSES.has(info.name)
                 || info.confidence >= NAME_CONFIDENCE);
}

const spokenName = (info) => (nameIsTrustworthy(info) ? info.name : "obstacle");

export function walkMessage(info, allInfos = [], useClock = false) {
  const name = spokenName(info);
  const side = useClock ? clockPhrase(info.centerX) : SIDE_WORD[info.hZone];
  if (info.proximity === "very close") {
    let dodge;
    if (info.hZone === "center") dodge = freerSide(info, allInfos);
    else dodge = info.hZone === "left" ? "right" : "left";
    return cap(`${name} very close ${side}, move slightly ${dodge}`);
  }
  return cap(`${name} ${side}, ${info.proximity}`);
}

export function findTarget(infos, target) {
  const matches = infos.filter((i) => i.name === target);
  return matches.length ? maxBy(matches, (i) => [i.area]) : null;
}

export function findMessage(info, target, useClock = false) {
  if (info === null) return cap(`${target} not visible`);
  const where = useClock ? clockPhrase(info.centerX) : info.phrase;
  return cap(`${info.name} ${where}, ${distanceOrBucket(info)}`);
}

const ZONE_ORDER = { center: 0, left: 1, right: 2 };
const ZONE_WORD = { center: "ahead", left: "on your left", right: "on your right" };
const PLURALS = { person: "people" };

function plural(name) {
  if (name in PLURALS) return PLURALS[name];
  if (["s", "sh", "ch", "x"].some((end) => name.endsWith(end))) return name + "es";
  return name + "s";
}

const article = (name) => ("aeiou".includes(name[0]) ? "an" : "a");

export function summarizeScene(infos) {
  // (name, zone) -> [count, biggest area, any name trusted], in first-seen order
  const groups = new Map();
  for (const i of infos) {
    const key = `${i.name}\u0000${i.hZone}`;
    if (!groups.has(key)) groups.set(key, { name: i.name, zone: i.hZone, entry: [0, 0.0, false] });
    const { entry } = groups.get(key);
    entry[0] += 1;
    entry[1] = Math.max(entry[1], i.area);
    entry[2] = entry[2] || nameIsTrustworthy(i);
  }
  if (groups.size === 0) return "Nothing detected";
  // Array.prototype.sort is stable, like Python's sorted
  const ordered = [...groups.values()].sort((a, b) =>
    compareTuples([ZONE_ORDER[a.zone], -a.entry[1]], [ZONE_ORDER[b.zone], -b.entry[1]]));
  const parts = ordered.map(({ name, zone: z, entry: [count, , trusted] }) => {
    let what = count === 1 ? `${article(name)} ${name}` : `${count} ${plural(name)}`;
    if (!trusted) what = `possibly ${what}`;
    return `${what} ${ZONE_WORD[z]}`;
  });
  return cap(parts.join(", "));
}

// ------------------------------------------------------------ detect_merge.py

const IOU_SAME_CLASS = 0.45;
const IOU_CROSS_CLASS = 0.55;
const PROTECTED = new Set(["person"]);

export function iou(a, b) {
  const ix1 = Math.max(a.x1, b.x1);
  const iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2);
  const iy2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0.0, ix2 - ix1) * Math.max(0.0, iy2 - iy1);
  if (inter <= 0) return 0.0;
  const union = boxArea(a) + boxArea(b) - inter;
  return union > 0 ? inter / union : 0.0;
}

const boxArea = (d) => Math.max(0.0, d.x2 - d.x1) * Math.max(0.0, d.y2 - d.y1);

function score(det, floors, defaultFloor) {
  const floor = det.name in floors ? floors[det.name] : defaultFloor;
  let margin = (det.conf - floor) / Math.max(1e-6, 1.0 - floor);
  margin = Math.min(Math.max(margin, 0.0), 1.0);
  return ["yolo_name" in det ? 1 : 0, margin];
}

/** Same-object duplicates across the two models removed, best name kept. */
export function mergeDetections(dets, floors = {}, defaultFloor = 0.5) {
  if (dets.length < 2) return [...dets];
  // sorted(..., reverse=True) keeps equal keys in their original order
  const order = dets.map((_, i) => i).sort((i, j) =>
    -compareTuples(score(dets[i], floors, defaultFloor), score(dets[j], floors, defaultFloor)));
  const dropped = new Set();
  order.forEach((i, rank) => {
    if (dropped.has(i)) return;
    for (const j of order.slice(rank + 1)) {
      if (dropped.has(j) || PROTECTED.has(dets[j].name)) continue;
      const same = dets[i].name === dets[j].name;
      if (iou(dets[i], dets[j]) >= (same ? IOU_SAME_CLASS : IOU_CROSS_CLASS)) dropped.add(j);
    }
  });
  return dets.filter((_, k) => !dropped.has(k));
}
