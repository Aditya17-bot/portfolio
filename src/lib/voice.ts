// Pieces of the offline voice assistant (github.com/Aditya17-bot/voice_ai) used by its explainer: the sentence
// splitter from brain.py, the filler and canned phrases and the filler timing from fallback.py, and the stage
// timings measured in ARCHITECTURE.md.

/** Measured on an RTX 3050 laptop with Llama 3.2 3B (ARCHITECTURE.md), in milliseconds. */
export const TIMING = {
  vadTrail: 600,
  stt: 600,
  firstSentence: [570, 1160] as const,
  ttsFirst: [100, 540] as const,
  firstAudioMean: 1340,
};

export const SYSTEM_PROMPT =
  "You are a friendly voice assistant. Your replies are spoken aloud, so: answer in 1-3 short conversational " +
  "sentences, no markdown, no lists, no emoji, spell out numbers and abbreviations naturally.";

export const FILLERS = [
  "Hmm, let me think about that.",
  "Good question. Give me a second.",
  "Okay, one moment.",
  "Let me work that out.",
  "Right, thinking about that now.",
];
export const FILLER_AFTER_MS = 1200;

export const CANNED = [
  "You know, I lost my train of thought there. Could you say that again?",
  "Sorry, my mind wandered for a moment. Ask me once more?",
  "I didn't quite gather my thoughts on that one. Mind repeating it?",
];

const SENTENCE_END = /(.+?[.!?])(?:\s+|$)(?=\S|$)/g;
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|approx|e\.g|i\.e|U\.S|U\.K)\.$/i;

/** brain.py _split_sentences: complete sentences, and the remainder still being generated. */
export function splitSentences(buffer: string): [string[], string] {
  const sentences: string[] = [];
  let pending = "";
  let pos = 0;
  for (const m of buffer.matchAll(SENTENCE_END)) {
    const end = m.index! + m[0].length;
    if (end >= buffer.length) break;
    const candidate = (pending + m[1]).trim();
    pos = end;
    if (ABBREVIATION.test(candidate)) {
      pending += buffer.slice(m.index!, end);
      continue;
    }
    pending = "";
    if (candidate) sentences.push(candidate);
  }
  return [sentences, pending + buffer.slice(pos)];
}
