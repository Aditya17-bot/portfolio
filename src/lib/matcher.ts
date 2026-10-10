// The Amazon ML Challenge entity matcher's text pipeline, ported for the browser from
// github.com/Aditya17-bot/amazon-ml-challenge-2026-entity-resolution: normalisation (src/prep.py), the pair
// features the LightGBM matcher reads (src/features.py, rapidfuzz scorers re-implemented) and the decoy
// signatures (src/group.py). No challenge data and no trained model are shipped; this shows what the model sees.

export type Country = "US" | "India" | "France";
export type Rec = { name: string; address: string };

const ABBR: Record<string, string> = {
  st: "street", str: "street", rd: "road", ave: "avenue", av: "avenue", blvd: "boulevard", dr: "drive", ln: "lane", ct: "court",
  cir: "circle", pl: "place", pkwy: "parkway", hwy: "highway", ter: "terrace", trl: "trail", sq: "square", mkt: "market",
  fl: "floor", flr: "floor", apt: "apartment", ste: "suite", bldg: "building", no: "number", nr: "near", opp: "opposite",
  n: "north", s: "south", e: "east", w: "west", ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  cdp: "", twp: "township", hno: "house", h: "house", nagr: "nagar", clny: "colony", sect: "sector", sec: "sector", chk: "chowk",
  bombay: "mumbai", calcutta: "kolkata", madras: "chennai", bangalore: "bengaluru", gurgaon: "gurugram", allahabad: "prayagraj",
  ahmadabad: "ahmedabad", pvt: "private", prvt: "private", ltd: "limited", lmtd: "limited", corp: "corporation", co: "company",
  inc: "incorporated", intl: "international", mfg: "manufacturing", svcs: "services", svc: "services", assoc: "associates",
  bros: "brothers", dept: "department", univ: "university", hosp: "hospital", ctr: "center", centre: "center", tech: "technologies",
  and: "", the: "", of: "",
};
const FR: Record<string, string> = {
  st: "saint", ste: "sainte", r: "rue", bd: "boulevard", bld: "boulevard", bvd: "boulevard", av: "avenue", ave: "avenue", rte: "route",
  ch: "chemin", chem: "chemin", pl: "place", imp: "impasse", all: "allee", sq: "square", qu: "quai", fbg: "faubourg", fg: "faubourg",
  crs: "cours", pass: "passage", res: "residence", resid: "residence", lot: "lotissement", ham: "hameau", bat: "batiment",
  bt: "batiment", esc: "escalier", apt: "appartement", zi: "zone industrielle", za: "zone artisanale", zac: "zone", ctre: "centre",
  center: "centre", cedex: "", bp: "", cs: "", cie: "compagnie", ets: "etablissements", etab: "etablissements", grd: "grand",
  gd: "grand", gde: "grande", pte: "petite", pt: "petit", mal: "marechal", gal: "general", gen: "general", pdt: "president",
  prof: "professeur", dr: "docteur", de: "", du: "", des: "", la: "", le: "", les: "", l: "", d: "", et: "", au: "", aux: "", en: "",
  sur: "", ndeg: "", numero: "",
};
const US_STATES: Record<string, string> = { ca: "california", ny: "new york", tx: "texas", wa: "washington", il: "illinois", fl: "florida", ma: "massachusetts", nj: "new jersey", pa: "pennsylvania", ga: "georgia", or: "oregon", az: "arizona" };
const IN_STATES: Record<string, string> = { mh: "maharashtra", up: "uttar pradesh", wb: "west bengal", ka: "karnataka", kl: "kerala", ap: "andhra pradesh", ts: "telangana", gj: "gujarat", rj: "rajasthan", dl: "delhi", hr: "haryana", pb: "punjab", tn: "tamil nadu" };
const NAME_ONLY: Record<string, string> = { sri: "", shri: "", shree: "", smt: "", www: "", com: "", dba: "", trading: "" };
const FR_LEGAL = ["sarl", "sasu", "sas", "eurl", "sci", "snc", "sa", "ei"];
export const LEGAL = ["private", "limited", "incorporated", "corporation", "company", "llc", "llp", "lp", "plc", "pllc", "sarl", "sas", "sasu", "eurl", "sa", "sci", "snc", "gmbh", "opc", "pc", "pa", "ltd", "pvt", "inc", "corp"];
const LEGAL_CANON: Record<string, string> = { inc: "inc", incorporated: "inc", corp: "corp", corporation: "corp", llc: "llc", llp: "llp", lp: "lp", pllc: "pllc", pc: "pc", co: "co", company: "co", ltd: "ltd", limited: "ltd", pvt: "pvt", private: "pvt", sarl: "sarl", sasu: "sasu", sas: "sas", eurl: "eurl", sci: "sci", snc: "snc", sa: "sa", ei: "ei" };
export const HN_SHIFTS = [3, 4, 5, 7, 9, 11, 13, 21];
const BIZ = ["trading", "exports", "holdings", "ventures", "group", "overseas", "agencies", "industries", "global", "media"];

const NATIVE_WORD = /[ऀ-෿‌‍]+/g;

/** prep.py to_ascii: learned native-script words first, then accents stripped (the app uses unidecode). */
export function toAscii(x: string, native: Record<string, string>) {
  const phrases = Object.keys(native).filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
  for (const p of phrases) x = x.split(p).join(` ${native[p]} `);
  x = x.replace(NATIVE_WORD, (w) => native[w] ?? w);
  return x.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function frName(x: string) {
  x = x.toLowerCase().replace(/['’]/g, " ");
  for (const w of FR_LEGAL) {
    const dotted = w.split("").map((c) => `${c}\\.?`).join("\\s?");
    x = x.replace(new RegExp(`\\b(?:${dotted})(?:\\b|$)`, "g"), ` ${w} `);
  }
  return x;
}

/** prep.py base_clean. */
export function baseClean(x: string) {
  return x
    .toLowerCase()
    .replace(/<null>|\bn\/a\b|\bnull\b/g, " ")
    .replace(/\bm\s*\/\s*s\b\.?|\bwww\.|\.(com|net|org|co\.in|in)\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenMap(x: string, m: Record<string, string>) {
  return x
    .split(" ")
    .map((t) => (t in m ? m[t] : t))
    .filter(Boolean)
    .join(" ");
}

export type Norm = { raw: Rec; ascii: Rec; clean: Rec; norm: Rec };

export function normalise(r: Rec, country: Country, native: Record<string, string>): Norm {
  const ascii = { name: toAscii(r.name, native), address: toAscii(r.address, native) };
  const base = country === "France" ? { ...ABBR, ...FR } : { ...ABBR };
  const states = country === "US" ? US_STATES : country === "India" ? IN_STATES : {};
  const clean = {
    name: baseClean(country === "France" ? frName(ascii.name) : ascii.name),
    address: baseClean(ascii.address.replace(/\b0+(\d)/g, "$1")),
  };
  return {
    raw: r,
    ascii,
    clean,
    norm: { name: tokenMap(clean.name, { ...base, ...NAME_ONLY }), address: tokenMap(clean.address, { ...base, ...states }) },
  };
}

// ---------------------------------------------------------------- rapidfuzz scorers

function lcs(a: string, b: string) {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** fuzz.ratio: normalised Indel similarity, 0..100. */
export function ratio(a: string, b: string) {
  if (!a.length && !b.length) return 100;
  return (100 * 2 * lcs(a, b)) / (a.length + b.length);
}

const tokens = (s: string) => s.split(" ").filter(Boolean);

export function tokenSortRatio(a: string, b: string) {
  return ratio(tokens(a).sort().join(" "), tokens(b).sort().join(" "));
}

/** fuzz.token_set_ratio. */
export function tokenSetRatio(a: string, b: string) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const da = [...ta].filter((t) => !tb.has(t)).sort();
  const db = [...tb].filter((t) => !ta.has(t)).sort();
  if (inter.length && (!da.length || !db.length)) return 100;
  const sect = inter.join(" ");
  const ca = [sect, da.join(" ")].filter(Boolean).join(" ");
  const cb = [sect, db.join(" ")].filter(Boolean).join(" ");
  return Math.max(ratio(sect, ca), ratio(sect, cb), ratio(ca, cb));
}

/** fuzz.partial_ratio: best alignment of the shorter string inside the longer one. */
export function partialRatio(a: string, b: string) {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (!s.length) return 0;
  let best = 0;
  for (let i = -s.length + 1; i < l.length; i++) {
    // Windows hanging off either end are shorter, as in rapidfuzz.
    const w = l.slice(Math.max(0, i), Math.min(l.length, i + s.length));
    best = Math.max(best, ratio(s, w));
    if (best === 100) break;
  }
  return best;
}

export function jaroWinkler(a: string, b: string) {
  if (a === b) return 1;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const ma = new Array(a.length).fill(false);
  const mb = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++)
      if (!mb[j] && a[i] === b[j]) {
        ma[i] = mb[j] = true;
        m++;
        break;
      }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++)
    if (ma[i]) {
      while (!mb[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < Math.min(4, a.length, b.length) && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

// ---------------------------------------------------------------- features and decoy signs

const LEGAL_RE = new RegExp(`\\b(${LEGAL.join("|")})\\b`, "g");
const core = (name: string) => name.replace(LEGAL_RE, " ").replace(/\s+/g, " ").trim();
const nums = (addr: string) => addr.match(/\b\d+\b/g) ?? [];
const zip = (addr: string) => nums(addr).filter((n) => n.length === 5 || n.length === 6).pop() ?? null;

function legalForms(rawName: string) {
  const words = baseClean(frName(rawName)).split(" ");
  return [...new Set(words.map((w) => LEGAL_CANON[w]).filter(Boolean))].sort();
}

export type Feature = { key: string; label: string; value: number | null; unit: "score" | "flag" | "count" | "diff"; hint: string };

export function features(q: Norm, s: Norm) {
  const cq = core(q.norm.name);
  const cs = core(s.norm.name);
  const tq = new Set(tokens(cq));
  const ts = new Set(tokens(cs));
  const hq = nums(q.norm.address)[0];
  const hs = nums(s.norm.address)[0];
  const zq = zip(q.norm.address);
  const zs = zip(s.norm.address);
  const f: Feature[] = [
    { key: "n_ratio", label: "Name, character similarity", value: ratio(q.norm.name, s.norm.name), unit: "score", hint: "edit-style similarity of the whole normalised names" },
    { key: "n_tsort", label: "Name, words in any order", value: tokenSortRatio(q.norm.name, s.norm.name), unit: "score", hint: "same words, shuffled, still score high" },
    { key: "n_tset", label: "Name, shared words", value: tokenSetRatio(q.norm.name, s.norm.name), unit: "score", hint: "100 when one name's words are all in the other" },
    { key: "c_ratio", label: "Core name, without legal form", value: ratio(cq, cs), unit: "score", hint: "Pvt Ltd, Inc, SARL removed, so the business name itself is compared" },
    { key: "c_jw", label: "Core name, Jaro-Winkler", value: 100 * jaroWinkler(cq, cs), unit: "score", hint: "rewards a shared beginning, tolerant of typos at the end" },
    { key: "n_partial", label: "Name, best partial overlap", value: partialRatio(q.norm.name, s.norm.name), unit: "score", hint: "one name contained in the other" },
    { key: "a_tset", label: "Address, shared words", value: tokenSetRatio(q.norm.address, s.norm.address), unit: "score", hint: "street, area and city words in common" },
    { key: "zip_eq", label: "Same postal code", value: zq && zs ? Number(zq === zs) : null, unit: "flag", hint: "5- or 6-digit code in both addresses" },
    { key: "hn_diff", label: "House number difference", value: hq && hs ? Math.abs(Number(hq) - Number(hs)) : null, unit: "diff", hint: "first number in each address" },
    { key: "w_extra", label: "Extra name words", value: [...tq].filter((t) => !ts.has(t)).length, unit: "count", hint: "words in this record's core name but not the reference's" },
    { key: "w_miss", label: "Missing name words", value: [...ts].filter((t) => !tq.has(t)).length, unit: "count", hint: "reference words this record lacks" },
  ];
  const lq = legalForms(q.raw.name);
  const ls = legalForms(s.raw.name);
  const legalDiff = lq.length > 0 && ls.length > 0 && lq.join() !== ls.join();
  const shift = hq && hs ? Number(hq) - Number(hs) : null;
  const added = [...tq].filter((t) => !ts.has(t));
  const decoys = [
    { key: "legal", on: legalDiff, label: "Different legal form", detail: legalDiff ? `${ls.join(", ")} became ${lq.join(", ")}` : "" },
    { key: "shift", on: shift !== null && HN_SHIFTS.includes(Math.abs(shift)), label: "House number moved by a decoy step", detail: shift !== null ? `${shift > 0 ? "+" : ""}${shift}` : "" },
    { key: "biz", on: added.some((w) => BIZ.includes(w)), label: "Business word added", detail: added.filter((w) => BIZ.includes(w)).join(", ") },
  ];
  return { features: f, decoys, legal: { q: lq, s: ls } };
}
