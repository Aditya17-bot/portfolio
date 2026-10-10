"use client";

import { useEffect, useMemo, useState } from "react";
import { features, normalise, type Country, type Rec } from "@/lib/matcher";
import styles from "./AmazonMatcher.module.css";

type Pair = { label: string; country: Country; s1: Rec; q: Rec; truth: "same" | "decoy"; why: string };

// Made-up records in the style of the challenge data; none of them come from it.
const PAIRS: Pair[] = [
  {
    label: "Abbreviations",
    country: "India",
    s1: { name: "Sharma Brothers Private Limited", address: "12 MG Road, Pune, Maharashtra 411001" },
    q: { name: "M/s Sharma Bros. Pvt. Ltd.", address: "12, M.G. Rd, Pune, MH 411001" },
    truth: "same",
    why: "Every difference is a way of writing the same thing: Bros, Pvt, Ltd, Rd and MH all expand to one spelling.",
  },
  {
    label: "Another script",
    country: "India",
    s1: { name: "Global Infrastructure Private Limited", address: "Plot 7, Sector 5, Nagpur, Maharashtra 440001" },
    q: { name: "ग्लोबल इंफ्रास्ट्रक्चर प्राइवेट लिमिटेड", address: "Plot 7, Sector 5, Nagpur, महाराष्ट्र 440001" },
    truth: "same",
    why: "The name is written in Devanagari. A word map learned from the training matches turns it back into English before anything is compared.",
  },
  {
    label: "Decoy",
    country: "US",
    s1: { name: "Blue Oak Dental LLC", address: "140 Pine St, Portland, OR 97204" },
    q: { name: "Blue Oak Dental Inc", address: "143 Pine Street, Portland, OR 97204" },
    truth: "decoy",
    why: "Same name, same street, but another legal form and a house number three doors up: exactly how the challenge generated its traps.",
  },
  {
    label: "French address",
    country: "France",
    s1: { name: "Boulangerie Martin SARL", address: "14 Rue du Jura, 69007 Lyon" },
    q: { name: "BOULANGERIE MARTIN S.A.R.L.", address: "14 r. du Jura, Lyon 69007" },
    truth: "same",
    why: "France had no training data at all. French legal forms are kept as tokens and street words expanded with French rules (r. is rue, not road).",
  },
  {
    label: "Added word",
    country: "US",
    s1: { name: "Riverside Auto Repair", address: "88 Elm Ave, Austin, TX 78701" },
    q: { name: "Riverside Auto Repair Holdings", address: "88 Elm Avenue, Austin, TX 78701" },
    truth: "decoy",
    why: "A business word like Holdings or Exports added to the name was a decoy signature; noise added Services or Center instead.",
  },
];

const fmt = (v: number | null, unit: string) => (v === null ? "n/a" : unit === "score" ? v.toFixed(0) : unit === "flag" ? (v ? "yes" : "no") : String(v));

function Diff({ before, after }: { before: string; after: string }) {
  const b = new Set(before.split(" "));
  return (
    <>
      {after.split(" ").map((w, i) => (
        <span key={i} className={b.has(w) ? undefined : styles.changed}>
          {w}{" "}
        </span>
      ))}
    </>
  );
}

const STAGES = [
  { title: "10.3M records", detail: "Three sources, no shared IDs: for each of 1.73M reference businesses, find every record of the same business among 10M others." },
  { title: "Normalise", detail: "Transliterate native scripts with a learned word map, expand abbreviations and state codes per country, keep legal forms visible so decoys stay detectable." },
  { title: "Retrieve 125M pairs", detail: "TF-IDF top-k over three views (words, character 3-grams of the name, name-word by address-word) per country. 98.0% of true matches survive." },
  { title: "Prune to 11.6M", detail: "A small LightGBM on retrieval scores drops 90% of the pairs at a cost of 0.0005 F0.5." },
  { title: "Match", detail: "LightGBM over 39 features like the ones above, plus five fine-tuned cross-encoders reading both records as text, combined by a second LightGBM." },
  { title: "Group and decoy checks", detail: "Does a candidate resemble the records already matched to that business? Plus the decoy signatures: legal form swaps, house-number shifts, added business words." },
  { title: "Calibrate France", detail: "No French labels: the threshold is set so France gets the same matches per business as the US and India." },
];

/** Two records, the challenge's normalisation and pair features computed live, and the decoy signs. */
export function AmazonMatcher() {
  const [native, setNative] = useState<Record<string, string> | null>(null);
  const [pick, setPick] = useState(0);
  const [pair, setPair] = useState<Pair>(PAIRS[0]);
  const [guess, setGuess] = useState<"same" | "decoy" | null>(null);
  const [stage, setStage] = useState(4);

  useEffect(() => {
    fetch("/projects/amazon/native_map.json")
      .then((r) => r.json())
      .then(setNative, () => setNative({}));
  }, []);

  const result = useMemo(() => {
    if (!native) return null;
    const s1 = normalise(pair.s1, pair.country, native);
    const q = normalise(pair.q, pair.country, native);
    return { s1, q, ...features(q, s1) };
  }, [native, pair]);

  const edit = (who: "s1" | "q", field: keyof Rec, v: string) => {
    setPair((p) => ({ ...p, [who]: { ...p[who], [field]: v } }));
    setPick(-1);
    setGuess(null);
  };

  const core = result?.features.find((f) => f.key === "c_ratio")?.value ?? 0;
  const addr = result?.features.find((f) => f.key === "a_tset")?.value ?? 0;
  const signs = result?.decoys.filter((d) => d.on) ?? [];
  const reading = !result ? "" : signs.length && core >= 80 ? "decoy" : core >= 85 && addr >= 70 ? "same" : "different";

  return (
    <div className={styles.wrap} data-testid="amazon-matcher" data-ready={!!result || undefined}>
      <div className={styles.chips}>
        {PAIRS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={pick === i}
            onClick={() => {
              setPick(i);
              setPair(p);
              setGuess(null);
            }}
            data-testid="am-pair"
          >
            {p.label}
          </button>
        ))}
        <label className={styles.country}>
          Country
          <select value={pair.country} onChange={(e) => setPair((p) => ({ ...p, country: e.target.value as Country }))}>
            <option>US</option>
            <option>India</option>
            <option>France</option>
          </select>
        </label>
      </div>

      <div className={styles.records}>
        {(["s1", "q"] as const).map((who) => (
          <div key={who} className={styles.record}>
            <p className={styles.recLabel}>{who === "s1" ? "Reference business" : "Candidate record"}</p>
            <input value={pair[who].name} onChange={(e) => edit(who, "name", e.target.value)} aria-label={`${who === "s1" ? "Reference" : "Candidate"} name`} data-testid={`am-${who}-name`} />
            <input value={pair[who].address} onChange={(e) => edit(who, "address", e.target.value)} aria-label={`${who === "s1" ? "Reference" : "Candidate"} address`} className={styles.addr} />
          </div>
        ))}
      </div>

      {pick >= 0 && !guess ? (
        <div className={styles.quiz}>
          <span>Your call first:</span>
          <button type="button" onClick={() => setGuess("same")} data-testid="am-guess-same">
            Same business
          </button>
          <button type="button" onClick={() => setGuess("decoy")}>
            Different business
          </button>
        </div>
      ) : null}
      {pick >= 0 && guess ? (
        <p className={styles.answer} data-correct={guess === PAIRS[pick].truth || undefined} data-testid="am-answer">
          <strong>{guess === PAIRS[pick].truth ? "Right." : "Not quite."}</strong> {PAIRS[pick].truth === "same" ? "Same business." : "A decoy: a different business made to look the same."} {PAIRS[pick].why}
        </p>
      ) : null}

      {result ? (
        <div className={styles.grid}>
          <section className={styles.panel}>
            <h3>1. Normalise</h3>
            <table className={styles.norm}>
              <tbody>
                {(["s1", "q"] as const).map((who) => (
                  <tr key={who}>
                    <th>{who === "s1" ? "Reference" : "Candidate"}</th>
                    <td data-testid={`am-norm-${who}`}>
                      <Diff before={result[who].clean.name} after={result[who].norm.name} />
                      <small>
                        <Diff before={result[who].clean.address} after={result[who].norm.address} />
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>Highlighted words were rewritten: expanded abbreviations, state codes, transliterated script.</p>
          </section>

          <section className={styles.panel}>
            <h3>2. Compare</h3>
            <ul className={styles.features} data-testid="am-features">
              {result.features.map((f) => (
                <li key={f.key} title={f.hint}>
                  <span>{f.label}</span>
                  {f.unit === "score" && f.value !== null ? (
                    <span className={styles.meter}>
                      <span style={{ width: `${f.value}%` }} />
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className={styles.val}>{fmt(f.value, f.unit)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h3>3. Decoy signs</h3>
            <ul className={styles.decoys} data-testid="am-decoys">
              {result.decoys.map((d) => (
                <li key={d.key} data-on={d.on || undefined}>
                  <span className={styles.dot} />
                  {d.label}
                  {d.on && d.detail ? <small> ({d.detail})</small> : null}
                </li>
              ))}
            </ul>
            <p className={styles.reading} data-reading={reading} data-testid="am-reading">
              {reading === "decoy"
                ? "Same name, but carrying a decoy signature: the real pipeline learned to reject these."
                : reading === "same"
                  ? "Strong name and address agreement and no decoy sign: these signals point to the same business."
                  : "Weak agreement: these signals point to different businesses."}
            </p>
            <p className={styles.note}>
              A rule of thumb from these signals. The real decision came from LightGBM and cross-encoders trained on the
              challenge data, which this page does not ship.
            </p>
          </section>
        </div>
      ) : (
        <p className={styles.note}>Loading the word map…</p>
      )}

      <div className={styles.pipeline}>
        <p className={styles.recLabel}>The full pipeline: click a stage</p>
        <ol className={styles.funnel}>
          {STAGES.map((s, i) => (
            <li key={s.title}>
              <button type="button" aria-current={stage === i || undefined} onClick={() => setStage(i)} style={{ width: `${100 - i * 9}%` }}>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <p className={styles.stageDetail}>{STAGES[stage].detail}</p>
      </div>
    </div>
  );
}
