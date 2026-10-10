"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FILLER_AFTER_MS, FILLERS, splitSentences } from "@/lib/voice";
import styles from "./VoiceExplainer.module.css";

// Example questions and replies written for this page in the style the app's prompt asks for; the timing model
// below uses the app's measured stage times.
const TURNS = [
  {
    q: "How far away is the Moon?",
    a: "The Moon is about three hundred eighty four thousand kilometres away. Light covers that distance in just over a second. A car at highway speed would need around five months.",
  },
  {
    q: "Any tip for sleeping better?",
    a: "Try to go to bed and wake up at the same time every day, even on weekends. Keep your room cool and dark. And put the phone away for the last half hour.",
  },
  {
    q: "Why is the sky blue?",
    a: "Sunlight contains every colour, but air scatters blue light far more than red. That scattered blue reaches your eyes from every direction. At sunset the light crosses more air, so the reds win.",
  },
];

const SPEAK_MS = 1700; // the question itself
const VAD_MS = 600; // trailing silence before the turn is closed
const STT_MS = 600;
const SYNTH_MS = 250; // speech synthesis of one sentence before it can play
const MS_PER_CHAR = 55;

type Plan = {
  speechEnd: number;
  endpoint: number;
  sttEnd: number;
  sentences: { text: string; ready: number; start: number; end: number }[];
  filler: { text: string; start: number; end: number } | null;
  done: number;
  firstAudio: number;
  total: number;
};

function plan(answer: string, streaming: boolean, slow: boolean): Plan {
  // The final sentence is flushed when generation ends, as the app does.
  const [done0, rest] = splitSentences(answer);
  const parts = [...done0, ...(rest.trim() ? [rest.trim()] : [])];
  const speechEnd = SPEAK_MS;
  const endpoint = speechEnd + VAD_MS;
  const sttEnd = endpoint + STT_MS;
  const first = slow ? 2300 : 800;
  const next = slow ? 1100 : 420;
  const ready = parts.map((_, i) => sttEnd + first + i * next);
  const done = ready[ready.length - 1];
  const fillerOn = streaming && ready[0] - sttEnd > FILLER_AFTER_MS;
  const filler = fillerOn
    ? { text: FILLERS[0], start: sttEnd + FILLER_AFTER_MS, end: sttEnd + FILLER_AFTER_MS + FILLERS[0].length * MS_PER_CHAR }
    : null;
  let free = filler ? filler.end : 0;
  const sentences = parts.map((text, i) => {
    const can = (streaming ? ready[i] : done) + SYNTH_MS;
    const start = Math.max(can, free);
    const end = start + text.length * MS_PER_CHAR;
    free = end;
    return { text, ready: ready[i], start, end };
  });
  const firstAudio = Math.min(filler?.start ?? Infinity, sentences[0].start);
  return { speechEnd, endpoint, sttEnd, sentences, filler, done, firstAudio, total: sentences[sentences.length - 1].end + 300 };
}

const fmt = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

function Timeline({ p, t, cut }: { p: Plan; t: number; cut: number | null }) {
  const W = 760;
  const lane = 30;
  const top = 8;
  const left = 132;
  const x = (ms: number) => left + (ms / p.total) * (W - left - 10);
  const lanes = ["You", "End of speech", "Speech to text", "Language model", "Speaker"];
  const H = top + lanes.length * lane + 22;
  const stop = cut ?? Infinity;
  const bar = (i: number, a: number, b: number, tone: string, key: string, label?: string) => {
    if (a >= stop) return null;
    const bb = Math.min(b, stop);
    return (
      <g key={key}>
        <rect x={x(a)} y={top + i * lane + 6} width={Math.max(2, x(bb) - x(a))} height={lane - 12} rx={3} className={styles.bar} data-tone={tone} opacity={t >= a ? 1 : 0.25} />
        {label && x(bb) - x(a) > 60 ? (
          <text x={x(a) + 6} y={top + i * lane + lane / 2 + 1} className={styles.barText} dominantBaseline="middle">
            {label}
          </text>
        ) : null}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.timeline} role="img" aria-label="Stages of one spoken turn over time">
      {lanes.map((l, i) => (
        <text key={l} x={0} y={top + i * lane + lane / 2} className={styles.lane} dominantBaseline="middle">
          {l}
        </text>
      ))}
      {bar(0, 0, p.speechEnd, "you", "you", "question")}
      {bar(1, p.speechEnd, p.endpoint, "vad", "vad", "600 ms quiet")}
      {bar(2, p.endpoint, p.sttEnd, "stt", "stt", "transcribe")}
      {p.sentences.map((s, i) => bar(3, i ? p.sentences[i - 1].ready : p.sttEnd, s.ready, "llm", `l${i}`, `sentence ${i + 1}`))}
      {p.filler ? bar(4, p.filler.start, p.filler.end, "filler", "filler", "filler") : null}
      {p.sentences.map((s, i) => bar(4, s.start, s.end, "speak", `s${i}`, `says ${i + 1}`))}
      {p.firstAudio < stop ? <line x1={x(p.firstAudio)} x2={x(p.firstAudio)} y1={top} y2={top + lanes.length * lane} className={styles.first} /> : null}
      {cut !== null ? <line x1={x(cut)} x2={x(cut)} y1={top} y2={top + lanes.length * lane} className={styles.cutLine} /> : null}
      <line x1={x(Math.min(t, p.total))} x2={x(Math.min(t, p.total))} y1={top - 4} y2={top + lanes.length * lane + 2} className={styles.playhead} />
      {[0, 2, 4, 6, 8, 10, 12].filter((s) => s * 1000 <= p.total).map((s) => (
        <text key={s} x={x(s * 1000)} y={H - 4} className={styles.tick} textAnchor="middle">
          {s} s
        </text>
      ))}
    </svg>
  );
}

/** A replay of one spoken turn through the assistant's pipeline, with the app's timing rules. */
export function VoiceExplainer() {
  const [turn, setTurn] = useState(0);
  const [streaming, setStreaming] = useState(true);
  const [slow, setSlow] = useState(false);
  const [aloud, setAloud] = useState(false);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [cut, setCut] = useState<number | null>(null);
  const t0 = useRef(0);
  const spoken = useRef(new Set<string>());
  const p = useMemo(() => plan(TURNS[turn].a, streaming, slow), [turn, streaming, slow]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now() - t0.current;
      setT(now);
      if (aloud && typeof speechSynthesis !== "undefined" && cut === null) {
        const due = [...(p.filler ? [{ key: "f", text: p.filler.text, start: p.filler.start }] : []), ...p.sentences.map((s, i) => ({ key: `s${i}`, text: s.text, start: s.start }))];
        for (const d of due)
          if (now >= d.start && !spoken.current.has(d.key)) {
            spoken.current.add(d.key);
            speechSynthesis.speak(new SpeechSynthesisUtterance(d.text));
          }
      }
      if (now < p.total && cut === null) raf = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, p, aloud, cut]);

  function play() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    spoken.current = new Set();
    setCut(null);
    t0.current = performance.now();
    setT(0);
    setRunning(true);
  }

  function interrupt() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setCut(t);
    setRunning(false);
  }

  const shown = Math.min(t, cut ?? Infinity);
  const speaking = (p.filler && shown >= p.filler.start && shown < p.filler.end) || p.sentences.some((s) => shown >= s.start && shown < s.end);
  // Reply text appears as the model writes it: each sentence fills in between the previous one and its ready time.
  const written = p.sentences
    .map((s, i) => {
      const from = i ? p.sentences[i - 1].ready : p.sttEnd;
      const f = Math.max(0, Math.min(1, (shown - from) / (s.ready - from)));
      return s.text.slice(0, Math.round(f * s.text.length));
    })
    .join(" ");
  const saidUpTo = p.sentences.filter((s) => shown >= s.end).length;
  const status =
    cut !== null
      ? "You talked over it: playback and generation stopped, and it is listening again."
      : shown < p.speechEnd
        ? "You are asking…"
        : shown < p.endpoint
          ? "Waiting for 600 ms of silence to be sure you finished."
          : shown < p.sttEnd
            ? "Transcribing."
            : speaking
              ? "Speaking. Press “Talk over it” to interrupt."
              : shown < p.total - 300
                ? "Thinking."
                : "Done.";

  return (
    <div className={styles.wrap} data-testid="voice-explainer">
      <div className={styles.row}>
        <div className={styles.qs}>
          {TURNS.map((x, i) => (
            <button
              key={x.q}
              type="button"
              aria-pressed={turn === i}
              onClick={() => {
                setTurn(i);
                setRunning(false);
                setT(0);
                setCut(null);
              }}
            >
              {x.q}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.primary} onClick={play} data-testid="vx-play">
          {t > 0 && !running ? "Replay" : "Ask"}
        </button>
        <button type="button" className={styles.interrupt} onClick={interrupt} disabled={!running || !speaking} data-testid="vx-interrupt">
          Talk over it
        </button>
        <label className={styles.check}>
          <input type="checkbox" checked={streaming} onChange={(e) => setStreaming(e.target.checked)} data-testid="vx-streaming" /> Speak sentence by sentence
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} data-testid="vx-slow" /> Slow model
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={aloud} onChange={(e) => setAloud(e.target.checked)} /> Read aloud
        </label>
      </div>

      <div className={styles.chat}>
        <p className={styles.user} data-show={shown > 200 || undefined}>
          {TURNS[turn].q}
        </p>
        {shown >= p.sttEnd ? (
          <p className={styles.bot} data-testid="vx-reply">
            {p.filler && shown >= p.filler.start ? <em className={styles.filler}>{p.filler.text} </em> : null}
            <span className={styles.said}>
              {p.sentences
                .slice(0, saidUpTo)
                .map((s) => s.text)
                .join(" ")}
            </span>{" "}
            <span>{written.slice(p.sentences.slice(0, saidUpTo).map((s) => s.text).join(" ").length).trimStart()}</span>
            {cut !== null ? <small className={styles.cut}> interrupted</small> : null}
          </p>
        ) : null}
        <p className={styles.status} aria-live="polite">
          {t === 0 && !running ? "Pick a question and press Ask." : status}
        </p>
      </div>

      <Timeline p={p} t={shown} cut={cut} />
      <p className={styles.result} data-testid="vx-first">
        First word <strong>{fmt(p.firstAudio - p.speechEnd)}</strong> after you stopped talking
        {streaming
          ? `; the full reply is written at ${fmt(p.done - p.speechEnd)}, so streaming starts speaking ${fmt(p.done + SYNTH_MS - p.sentences[0].start)} sooner than waiting.`
          : ". Nothing is spoken until the whole reply exists; turn streaming back on to compare."}
        {p.filler ? " The model missed the 1.2 s budget, so a filler phrase covered the gap." : ""}
      </p>
    </div>
  );
}

/** Paste text and watch brain.py's splitter decide what can be spoken now. */
export function SplitterPlay() {
  const [text, setText] = useState("Dr. Rao said the dose is 3.5 mg. Take it twice a day. Call if you feel diz");
  const [done, rest] = splitSentences(text);
  return (
    <div className={styles.splitter} data-testid="vx-splitter">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} spellCheck={false} data-testid="vx-split-input" />
      <ol className={styles.parts}>
        {done.map((s, i) => (
          <li key={i} data-testid="vx-sentence">
            <span>{i + 1}</span> {s}
          </li>
        ))}
        {rest.trim() ? (
          <li className={styles.rest}>
            <span>…</span> {rest.trim()} <small>still being written, held back</small>
          </li>
        ) : null}
      </ol>
      <p className={styles.note}>
        A sentence is sent to speech only when the next one has started, so &ldquo;Dr.&rdquo; and &ldquo;3.5&rdquo;
        never cut a sentence short. Type more and watch the last piece move up.
      </p>
    </div>
  );
}
