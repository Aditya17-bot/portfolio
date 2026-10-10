export type Project = {
  slug: string;
  title: string;
  tagline: string;
  year: string;
  stack: string[];
  points: string[];
  repo?: string;
  demo?: { label: string; href: string };
  team?: string;
  facts?: { label: string; value: string }[];
};

const gh = (name: string) => `https://github.com/Aditya17-bot/${name}`;

// Every number here is copied from the project's own README or evaluation file.
export const featured: Project[] = [
  {
    slug: "blindassist",
    title: "BlindAssist",
    tagline: "An offline camera that tells a visually impaired user what is in the way, and stays quiet otherwise.",
    year: "2026",
    stack: ["PyTorch", "YOLOv8", "OpenCV", "Flask", "Vosk", "offline TTS", "Android"],
    points: [
      "Fully offline pipeline from camera to speech: detection, spatial reasoning, a decision layer, then speech. No cloud, no keys.",
      "A 3×3 spatial grid with proximity buckets and a path-relevance layer: obstacles off the path stay silent, escalating threats override cooldowns.",
      "A COCO YOLOv8s detector paired with a custom YOLOv8n door and dustbin specialist (mAP50 ≈ 0.95), merged per frame by a specialist-wins IoU rule that corrects COCO mislabels.",
      "Two-tier voice control: a closed keyword grammar that routes in about 5 µs, and a local LLM router for paraphrases a grammar cannot hear.",
    ],
    facts: [
      { label: "Direction accuracy", value: "100% of reviewed announcements" },
      { label: "Inference", value: "21 ms/frame GPU · 5.8 FPS CPU" },
      { label: "Announcement latency", value: "~0.4 s" },
      { label: "Unit tests", value: "61" },
    ],
    repo: gh("object_detection_blind"),
    demo: { label: "Try it and see how it decides", href: "/projects/blindassist" },
    team: "Team project",
  },
  {
    slug: "amazon-ml-challenge",
    title: "Amazon ML Challenge 2026: entity resolution",
    tagline: "Match 10 million business records from three sources to their real-world entity, including a country with no training data.",
    year: "2026",
    stack: ["LightGBM", "TF-IDF", "cross-encoders", "rapidfuzz", "Kaggle GPUs"],
    points: [
      "Per-country TF-IDF retrieval over three views with 0.980 union recall, then a LightGBM pruner that cut 125M test candidates to 11.6M pairs for 0.0005 F0.5.",
      "A 39-feature LightGBM matcher combined with five fine-tuned MiniLM cross-encoders by a second LightGBM model.",
      "A group-consistency check and features for the decoy generator's fingerprints: house-number shifts, legal-form changes, word swaps.",
      "France had no labels: a threshold calibrated to match the US and India match rate, plus decoy rules, each verified on the leaderboard one at a time.",
    ],
    facts: [
      { label: "Rank", value: "696 of 89,000+ (top 4%)" },
      { label: "Public score", value: "0.983926 macro F0.5" },
      { label: "Held-out F0.5", value: "0.9855 (US/India)" },
    ],
    repo: gh("amazon-ml-challenge-2026-entity-resolution"),
    team: "Team project",
  },
  {
    slug: "voice-assistant",
    title: "Offline voice assistant",
    tagline: "Speech in, speech out, with nothing leaving the laptop.",
    year: "2026",
    stack: ["Silero VAD", "faster-whisper", "Ollama · Llama 3.2 3B", "Piper TTS"],
    points: [
      "VAD, speech recognition, a local LLM and speech synthesis in one loop on CPU, in about 4 GB of RAM.",
      "Streams the answer into synthesis sentence by sentence, so the first word arrives in about 1.5 s instead of after the whole reply.",
      "Barge-in: speak over it and it stops and listens. Filler phrases and fallback replies mean a raw error never reaches the speaker.",
    ],
    facts: [{ label: "Time to first word", value: "~1.5 s on CPU" }],
    repo: gh("voice_ai"),
  },
  {
    slug: "gene-anomaly",
    title: "Rare-disease protein impact explorer",
    tagline: "Winner, Best Project Award at Code for Life (VIT, Feb 2026).",
    year: "2026",
    stack: ["Python", "Streamlit", "AlphaFold DB", "AlphaMissense", "UniProt", "Mol*"],
    points: [
      "Maps a gene symbol to its protein through UniProt, fetches the AlphaFold structure and paints AlphaMissense pathogenicity onto it in 3D.",
      "Spatial proximity analysis: finds clusters of variants that are close in 3D even when they are far apart in sequence.",
    ],
    repo: gh("Gene-Anomaly-detection"),
    team: "Team project",
  },
];

export const more: Project[] = [
  {
    slug: "jewel",
    title: "Aurelia Antlers",
    tagline: "A jewellery catalogue of turnable digital twins, and try-on through your own camera using 468 face landmarks. Runs entirely in the browser.",
    year: "2026",
    stack: ["MediaPipe", "JavaScript", "Cloudflare Workers"],
    points: [],
    repo: gh("jewel"),
    demo: { label: "Live", href: "https://aurelia-antlers.jwelery-ecommerce.workers.dev" },
  },
  {
    slug: "caterpillar",
    title: "Smart operator assistant",
    tagline: "Live safety monitoring for excavator operators: four scikit-learn models, alert rules, and in-browser drowsiness and person detection.",
    year: "2026",
    stack: ["FastAPI", "React", "scikit-learn", "MediaPipe", "WebSockets"],
    points: [],
    repo: gh("caterpillar"),
  },
  {
    slug: "fraud",
    title: "Credit card fraud detection",
    tagline: "A supervised random forest for known patterns and an isolation forest for rare ones, with thresholds tuned for false positives on heavily imbalanced data.",
    year: "2025",
    stack: ["scikit-learn", "Jupyter"],
    points: [],
    repo: gh("Fraud_detection"),
    demo: { label: "Try the alert budget", href: "/projects/fraud" },
  },
  {
    slug: "finance-ai",
    title: "Finance AI platform",
    tagline: "Fraud, credit-risk and spending-profile models behind one FastAPI service, with a local-LLM agent interface on top.",
    year: "2026",
    stack: ["FastAPI", "Streamlit", "scikit-learn", "Ollama"],
    points: [],
    repo: gh("finance-ai-platform"),
  },
  {
    slug: "youtube",
    title: "Shorts automation engine",
    tagline: "One pipeline, several channels: topic, script, voice, visuals, captions, assembly and a human review step before anything is published.",
    year: "2026",
    stack: ["Python", "ffmpeg", "LLM"],
    points: [],
    repo: gh("youtube_automation"),
  },
  {
    slug: "trading",
    title: "Nifty 50 breakout scanner",
    tagline: "Watches previous-day high and low breakouts with pullbacks and sends Telegram alerts with entry, stop and position size.",
    year: "2026",
    stack: ["Python", "yfinance", "Streamlit", "Telegram"],
    points: [],
    repo: gh("telegram_trading_bot"),
  },
  {
    slug: "budget",
    title: "SMS budget tracker",
    tagline: "Parses bank SMS into transactions, categorises them and tracks budgets.",
    year: "2026",
    stack: ["Streamlit", "SQLite", "Plotly"],
    points: [],
    repo: gh("budgeting_app"),
  },
  {
    slug: "first-cnn",
    title: "MNIST under 5k parameters",
    tagline: "4,994 parameters, 99.45% test accuracy, with CI tests that enforce the architecture rules. The predecessor of the small CNN in the model zoo.",
    year: "2024",
    stack: ["PyTorch", "GitHub Actions"],
    points: [],
    repo: gh("convolution_neural_network"),
  },
  {
    slug: "first-nn",
    title: "First neural network",
    tagline: "Forward and backward propagation from first principles. Where it started; the NumPy MLP in the zoo is its rewrite.",
    year: "2024",
    stack: ["Python"],
    points: [],
    repo: gh("neural_network"),
  },
];
