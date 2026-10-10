"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { amClass, AM_BENIGN, AM_PATHOGENIC, distance, findProtein, hotspots, loadMissense, loadStructure, type Missense, type Protein, type Residue } from "@/lib/gene";
import styles from "./GeneExplorer.module.css";

const ProteinView = dynamic(() => import("./ProteinView"), { ssr: false });

const EXAMPLES = [
  { gene: "SOD1", why: "ALS" },
  { gene: "HBB", why: "sickle cell" },
  { gene: "TP53", why: "cancer" },
  { gene: "CFTR", why: "cystic fibrosis" },
];

const STAGES = ["UniProt: gene to protein", "AlphaFold: predicted structure", "AlphaMissense: every substitution scored"];

type Loaded = { protein: Protein; residues: Residue[]; am: Map<number, Missense> };

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const BLUE: [number, number, number] = [91, 141, 239];
const GREY: [number, number, number] = [150, 156, 170];
const RED: [number, number, number] = [255, 90, 78];

function amColor(s: number | undefined) {
  if (s === undefined) return "rgb(70,76,90)";
  return s < 0.5 ? mix(BLUE, GREY, s / 0.5) : mix(GREY, RED, (s - 0.5) / 0.5);
}

function plddtColor(p: number) {
  return p > 90 ? "#0053d6" : p > 70 ? "#65cbf3" : p > 50 ? "#ffdb13" : "#ff7d45";
}

const MAX_SELECTED = 6;

export function GeneExplorer() {
  const [query, setQuery] = useState("SOD1");
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<"am" | "plddt">("am");
  const [selected, setSelected] = useState<number[]>([]);
  const [variant, setVariant] = useState("");
  const [variantResult, setVariantResult] = useState("");

  const load = useCallback(async (gene: string) => {
    setError("");
    setSelected([]);
    setVariantResult("");
    try {
      setStage(0);
      const protein = await findProtein(gene.trim());
      setStage(1);
      const { residues, amUrl } = await loadStructure(protein.accession);
      setStage(2);
      const am = amUrl ? await loadMissense(amUrl) : new Map<number, Missense>();
      setData({ protein, residues, am });
      setStage(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
      setStage(-1);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load("SOD1"));
  }, [load]);

  const colors = useMemo(
    () => (data ? data.residues.map((r) => (mode === "am" ? amColor(data.am.get(r.pos)?.mean) : plddtColor(r.plddt))) : []),
    [data, mode],
  );
  const spots = useMemo(() => (data ? hotspots(data.residues, data.am).slice(0, 8) : []), [data]);
  const links = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) out.push([selected[i], selected[j]]);
    return out;
  }, [selected]);

  const toggle = (index: number) =>
    setSelected((s) => (s.includes(index) ? s.filter((x) => x !== index) : [...s, index].slice(-MAX_SELECTED)));

  function lookupVariant() {
    if (!data) return;
    const v = variant.trim().toUpperCase();
    const m = /^([A-Z])(\d+)([A-Z])$/.exec(v);
    if (!m) return setVariantResult("Write a substitution as original letter, position, new letter, for example A4V.");
    const pos = Number(m[2]);
    const idx = data.residues.findIndex((r) => r.pos === pos);
    if (idx < 0) return setVariantResult(`Position ${pos} is outside this protein (1 to ${data.residues.length}).`);
    if (data.residues[idx].aa !== m[1]) {
      // Older papers often number without the starting methionine, so A4V there is A5V here.
      const next = data.residues[idx + 1];
      const hint = next?.aa === m[1] ? ` If you mean the older numbering without the first methionine, try ${m[1]}${pos + 1}${m[3]}.` : "";
      return setVariantResult(`Position ${pos} is ${data.residues[idx].aa}, not ${m[1]}.${hint}`);
    }
    const s = data.am.get(pos)?.variants.get(v);
    if (s === undefined) return setVariantResult(`No AlphaMissense score for ${v}.`);
    setVariantResult(`${v}: ${s.toFixed(3)}, ${amClass(s)}.`);
    setSelected((sel) => (sel.includes(idx) ? sel : [...sel, idx].slice(-MAX_SELECTED)));
  }

  const res = data?.residues ?? [];
  const n = res.length;
  const ex = res.slice(1, 12).find((r) => r.aa !== "V");
  const example = ex ? `${ex.aa}${ex.pos}V` : "A5V";

  return (
    <div className={styles.wrap} data-testid="gene-explorer" data-ready={stage === 3 || undefined}>
      <form
        className={styles.search}
        onSubmit={(e) => {
          e.preventDefault();
          void load(query);
        }}
      >
        <label className={styles.field}>
          <span>Gene</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. SOD1" spellCheck={false} autoCapitalize="characters" data-testid="gene-input" />
        </label>
        <button type="submit" className={styles.go} data-testid="gene-go">
          Look up
        </button>
        <div className={styles.chips}>
          {EXAMPLES.map((e) => (
            <button
              key={e.gene}
              type="button"
              className={styles.chip}
              onClick={() => {
                setQuery(e.gene);
                void load(e.gene);
              }}
            >
              {e.gene} <small>{e.why}</small>
            </button>
          ))}
        </div>
      </form>

      <ol className={styles.stages} aria-label="Lookup progress">
        {STAGES.map((s, i) => (
          <li key={s} data-state={stage > i ? "done" : stage === i ? "now" : "todo"}>
            {s}
          </li>
        ))}
      </ol>
      {error ? (
        <p className={styles.error} role="alert" data-testid="gene-error">
          {error}
        </p>
      ) : null}

      <div className={styles.main}>
        <div className={styles.view}>
          {data ? (
            <ProteinView residues={res} colors={colors} selected={selected} links={links} onPick={toggle} />
          ) : (
            <p className={styles.placeholder}>Loading the structure…</p>
          )}
          <p className={styles.hint}>Drag to rotate, scroll to zoom, click a sphere to select a residue.</p>
        </div>

        <aside className={styles.panel}>
          {data ? (
            <>
              <p className={styles.protein} data-testid="gene-protein">
                <strong>{data.protein.gene}</strong>
                <span>{data.protein.name}</span>
                <small>
                  UniProt {data.protein.accession} · {n} residues
                </small>
              </p>
              <div className={styles.modes} role="radiogroup" aria-label="Colour by">
                <button type="button" role="radio" aria-checked={mode === "am"} onClick={() => setMode("am")}>
                  Predicted harm
                </button>
                <button type="button" role="radio" aria-checked={mode === "plddt"} onClick={() => setMode("plddt")}>
                  Model confidence
                </button>
              </div>
              {mode === "am" ? (
                <p className={styles.legend}>
                  <span className={styles.scale} /> Average AlphaMissense score of the 19 possible substitutions:
                  blue below {AM_BENIGN} (likely benign), red above {AM_PATHOGENIC} (likely pathogenic).
                </p>
              ) : (
                <p className={styles.legend}>
                  AlphaFold&apos;s pLDDT: dark blue above 90, light blue 70–90, yellow 50–70, orange below 50, where
                  the shape is a guess and distances mean little.
                </p>
              )}

              <form
                className={styles.variant}
                onSubmit={(e) => {
                  e.preventDefault();
                  lookupVariant();
                }}
              >
                <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={`Variant, e.g. ${example}`} data-testid="gene-variant" />
                <button type="submit">Score</button>
              </form>
              {variantResult ? (
                <p className={styles.note} data-testid="gene-variant-result">
                  {variantResult}
                </p>
              ) : null}

              {selected.length ? (
                <div className={styles.selected} data-testid="gene-selected">
                  {selected.map((i) => {
                    const r = res[i];
                    const m = data.am.get(r.pos);
                    return (
                      <p key={i}>
                        <button type="button" onClick={() => toggle(i)} aria-label={`Deselect ${r.aa}${r.pos}`}>
                          ×
                        </button>
                        <strong>
                          {r.aa}
                          {r.pos}
                        </strong>{" "}
                        {m ? `${m.mean.toFixed(2)} average, ${amClass(m.mean)}` : "no score"} · pLDDT {r.plddt.toFixed(0)}
                      </p>
                    );
                  })}
                  {links.length ? (
                    <table className={styles.pairs}>
                      <thead>
                        <tr>
                          <th>Pair</th>
                          <th>Apart in sequence</th>
                          <th>Apart in 3D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map(([a, b]) => (
                          <tr key={`${a}-${b}`}>
                            <td>
                              {res[a].aa}
                              {res[a].pos}–{res[b].aa}
                              {res[b].pos}
                            </td>
                            <td>{Math.abs(res[a].pos - res[b].pos)} residues</td>
                            <td data-testid="gene-dist">{distance(res[a], res[b]).toFixed(1)} Å</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className={styles.note}>Select a second residue to compare distances.</p>
                  )}
                </div>
              ) : (
                <p className={styles.note}>Select residues in 3D or on the strip below, or try a hotspot.</p>
              )}

              {spots.length ? (
                <div className={styles.spots}>
                  <p className={styles.spotsHead}>Hotspots: far apart in sequence, touching in 3D</p>
                  <ul data-testid="gene-hotspots">
                    {spots.map((p) => {
                      const a = res.indexOf(p.a);
                      const b = res.indexOf(p.b);
                      return (
                        <li key={`${p.a.pos}-${p.b.pos}`}>
                          <button type="button" onClick={() => setSelected([a, b])}>
                            {p.a.aa}
                            {p.a.pos} + {p.b.aa}
                            {p.b.pos}
                            <small>
                              {Math.abs(p.a.pos - p.b.pos)} apart, {p.d.toFixed(1)} Å
                            </small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      {data ? (
        <div className={styles.track} data-testid="gene-track">
          <svg viewBox={`0 0 ${n} 24`} preserveAspectRatio="none" className={styles.strip} role="img" aria-label="Predicted harm along the sequence">
            {res.map((r, i) => (
              <rect key={r.pos} x={i} y={0} width={1.02} height={24} fill={colors[i]} onClick={() => toggle(i)} />
            ))}
          </svg>
          <div className={styles.marks}>
            {selected.map((i) => (
              <span key={i} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                {res[i].pos}
              </span>
            ))}
          </div>
          <p className={styles.note}>
            The same protein laid out in one dimension, position 1 to {n}. Two residues can be hundreds apart here and
            touching in the folded protein, which a score track alone never shows.
          </p>
        </div>
      ) : null}
    </div>
  );
}
