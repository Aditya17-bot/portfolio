"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyse, L, loadModels, sentence, TARGETS, walkReasons, type Analysis, type Det, type Info, type Mode } from "@/lib/blindassist/detect";
import styles from "./BlindAssistDemo.module.css";

const EXAMPLES = [
  { src: "/projects/blindassist/examples/wardrobe_close.jpg", label: "Wardrobe, close", mode: "walk" as Mode },
  { src: "/projects/blindassist/examples/classroom_desks.jpg", label: "Find the bottle", mode: "find" as Mode, target: "bottle" },
  { src: "/projects/blindassist/examples/classroom_door.jpg", label: "Classroom door", mode: "walk" as Mode },
  { src: "/projects/blindassist/examples/hostel_doors.jpg", label: "Hostel corridor", mode: "describe" as Mode },
];

const STEPS = [
  { key: "frame", title: "Camera frame", body: "One frame from a chest-height camera. Everything below runs on it in your browser; nothing is uploaded." },
  { key: "coco", title: "General detector", body: "YOLOv8n trained on COCO's 80 classes finds people, chairs, beds, bottles. It has never seen a door or a dustbin, so it guesses the nearest thing it knows." },
  { key: "specialist", title: "Door specialist", body: "A second YOLOv8n, fine-tuned on doors, dustbins and stairs, the indoor obstacles COCO lacks. It runs on the same frame." },
  { key: "merge", title: "Merge", body: "Both models can report one object under two names. Overlapping boxes are merged and the more trustworthy name is kept; dashed boxes are the ones dropped. People are never merged away." },
  { key: "where", title: "Where is it", body: "Each box becomes a clock bearing (12 o'clock is straight ahead) and a proximity bucket from how much of the frame it fills, with per-class thresholds: a bottle filling 5% is close, a bed is not." },
  { key: "decide", title: "Decide", body: "Walk mode warns about one thing: the nearest, most central obstacle that is close. Far objects and find-only classes stay silent, so the one warning that matters is not lost in a stream of words." },
  { key: "speak", title: "Speak", body: "The sentence the phone would say. A name the models are unsure of becomes 'obstacle'; when something is very close the sentence adds which way to step." },
] as const;

const PROX_COLOR: Record<string, string> = { "very close": "#ff5a4e", close: "#f5a524", medium: "#3ddc84", far: "#3ddc84" };
const MODEL_COLOR = { coco: "#5ce1e6", specialist: "#f5a524" };

type Source = { el: HTMLImageElement | HTMLVideoElement; w: number; h: number; live: boolean };

function drawBox(ctx: CanvasRenderingContext2D, d: Det, color: string, label: string, unit: number, opts: { dashed?: boolean; dim?: boolean; bold?: boolean } = {}) {
  const [x1, y1, x2, y2] = d.px;
  ctx.save();
  ctx.globalAlpha = opts.dim ? 0.35 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, unit / (opts.bold ? 110 : 220));
  if (opts.dashed) ctx.setLineDash([unit / 50, unit / 70]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.setLineDash([]);
  const font = Math.max(12, Math.round(unit / 32));
  ctx.font = `600 ${font}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width + 10;
  const ty = Math.max(y1, font + 8);
  ctx.fillStyle = color;
  ctx.fillRect(x1, ty - font - 8, tw, font + 8);
  ctx.fillStyle = "#05070d";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, x1 + 5, ty - 3);
  ctx.restore();
}

function draw(canvas: HTMLCanvasElement, src: Source, a: Analysis | null, step: number, chosen: Info | null) {
  canvas.width = src.w;
  canvas.height = src.h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(src.el, 0, 0, src.w, src.h);
  if (!a) return;
  const unit = Math.min(src.w, src.h);
  const key = STEPS[step].key;
  if (key === "coco" || key === "specialist") {
    for (const d of a.raw.filter((r) => r.model === key)) drawBox(ctx, d, MODEL_COLOR[key], `${d.name} ${d.conf.toFixed(2)}`, unit);
  } else if (key === "merge") {
    for (const d of a.dropped) drawBox(ctx, d, "#ff5a4e", `dropped: ${d.name}`, unit, { dashed: true });
    for (const d of a.kept) drawBox(ctx, d, MODEL_COLOR[d.model], `${d.name} ${d.conf.toFixed(2)}`, unit);
  } else if (key !== "frame") {
    ctx.save();
    ctx.strokeStyle = "rgba(230,234,242,.6)";
    ctx.lineWidth = Math.max(1, unit / 500);
    ctx.setLineDash([unit / 80, unit / 80]);
    ctx.beginPath();
    for (const i of [1, 2]) {
      ctx.moveTo((src.w * i) / 3, 0);
      ctx.lineTo((src.w * i) / 3, src.h);
      ctx.moveTo(0, (src.h * i) / 3);
      ctx.lineTo(src.w, (src.h * i) / 3);
    }
    ctx.stroke();
    ctx.restore();
    a.kept.forEach((d, k) => {
      const info = a.infos[k];
      const decided = key === "decide" || key === "speak";
      drawBox(ctx, d, PROX_COLOR[info.proximity], `${info.name} · ${L.clockHour(info.centerX)} o'clock · ${info.proximity}`, unit, {
        dim: decided && chosen !== null && info !== chosen,
        bold: decided && info === chosen,
      });
    });
  }
}

export function BlindAssistDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const live = useRef(false);
  const lastSpoken = useRef({ text: "", at: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [src, setSrc] = useState<Source | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [step, setStep] = useState(STEPS.length - 1);
  const [mode, setMode] = useState<Mode>("walk");
  const [target, setTarget] = useState("bottle");
  const [voice, setVoice] = useState(false);
  const [camera, setCamera] = useState(false);
  const [picked, setPicked] = useState(0);

  const result = analysis ? sentence(analysis.infos, mode, target) : null;

  const speak = useCallback(
    (text: string, force: boolean) => {
      if (!voice || typeof speechSynthesis === "undefined") return;
      const now = performance.now();
      // Live video repeats a sentence only after a pause, like the app's cooldown.
      if (!force && text === lastSpoken.current.text && now - lastSpoken.current.at < 4000) return;
      if (!force && speechSynthesis.speaking) return;
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      lastSpoken.current = { text, at: now };
    },
    [voice],
  );

  useEffect(() => {
    loadModels().then(
      () => setReady(true),
      () => setError("The models failed to load. Reload the page to try again."),
    );
  }, []);

  const openImage = useCallback((url: string) => {
    live.current = false;
    const img = new Image();
    img.onload = () => setSrc({ el: img, w: img.naturalWidth, h: img.naturalHeight, live: false });
    img.onerror = () => setError("That image could not be opened.");
    img.src = url;
  }, []);

  useEffect(() => {
    openImage(EXAMPLES[0].src);
  }, [openImage]);

  // Analyse stills once per new image.
  useEffect(() => {
    if (!ready || !src || src.live) return;
    let on = true;
    analyse(src.el, src.w, src.h).then(
      (a) => on && setAnalysis(a),
      () => on && setError("Detection failed on this image."),
    );
    return () => {
      on = false;
    };
  }, [ready, src]);

  // Redraw whenever the picture, the step or the decision changes.
  useEffect(() => {
    if (canvas.current && src) draw(canvas.current, src, analysis, step, result?.chosen ?? null);
  }, [src, analysis, step, result?.chosen]);

  useEffect(() => {
    if (result && !src?.live) speak(result.text, true);
    // Speak once per new still or mode change, not on every redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.text]);

  async function startCamera() {
    const v = video.current;
    if (!v) return;
    try {
      v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 960 } }, audio: false });
    } catch {
      setError("The camera is unavailable. Try one of the photos or upload your own.");
      return;
    }
    await v.play();
    live.current = true;
    setCamera(true);
    setError("");
    const s: Source = { el: v, w: v.videoWidth, h: v.videoHeight, live: true };
    setSrc(s);
    const loop = async () => {
      if (!live.current) return;
      const a = await analyse(v, v.videoWidth, v.videoHeight);
      if (!live.current) return;
      setAnalysis(a);
      requestAnimationFrame(loop);
    };
    void loop();
  }

  function stopCamera() {
    live.current = false;
    setCamera(false);
    const v = video.current;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }

  useEffect(() => () => stopCamera(), []);

  // Live speech follows the camera loop.
  useEffect(() => {
    if (camera && result) speak(result.text, false);
  }, [camera, result, speak]);

  const reasons = analysis && mode === "walk" ? walkReasons(analysis.infos, result?.chosen ?? null) : null;
  const s = STEPS[step];

  return (
    <div className={styles.wrap} data-testid="blindassist-demo" data-ready={(ready && !!analysis) || undefined}>
      <div className={styles.inputs}>
        <div className={styles.thumbs} role="group" aria-label="Example photos">
          {EXAMPLES.map((e, i) => (
            <button
              key={e.src}
              type="button"
              className={styles.thumb}
              aria-pressed={!camera && picked === i}
              onClick={() => {
                stopCamera();
                setPicked(i);
                setMode(e.mode);
                if ("target" in e && e.target) setTarget(e.target);
                setAnalysis(null);
                openImage(e.src);
              }}
              data-testid="ba-example"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.src} alt="" width={72} height={54} />
              <span>{e.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <label className={styles.button}>
            Upload a photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                stopCamera();
                setPicked(-1);
                setAnalysis(null);
                openImage(URL.createObjectURL(f));
              }}
              data-testid="ba-upload"
            />
          </label>
          <button type="button" className={styles.button} aria-pressed={camera} onClick={() => (camera ? stopCamera() : startCamera())} data-testid="ba-camera">
            {camera ? "Stop camera" : "Use your camera"}
          </button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.stage}>
          <canvas ref={canvas} className={styles.canvas} aria-label={result ? `Detections. The app would say: ${result.text}` : "Loading the models"} data-testid="ba-canvas" />
          <video ref={video} playsInline muted className={styles.video} />
          {!ready || !analysis ? <p className={styles.loading}>{error || (ready ? "Detecting…" : "Loading two detectors, 24 MB, once…")}</p> : null}
        </div>

        <aside className={styles.panel}>
          <div className={styles.modes} role="radiogroup" aria-label="Mode">
            {(["walk", "find", "describe"] as Mode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={styles.mode} onClick={() => setMode(m)} data-testid={`ba-mode-${m}`}>
                {m === "walk" ? "Walk" : m === "find" ? "Find" : "Describe"}
              </button>
            ))}
          </div>
          {mode === "find" ? (
            <label className={styles.target}>
              Look for
              <select value={target} onChange={(e) => setTarget(e.target.value)} data-testid="ba-target">
                {TARGETS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          ) : null}
          <p className={styles.say} aria-live="polite" data-testid="ba-say">
            {result ? `“${result.text}”` : "…"}
          </p>
          <div className={styles.sayRow}>
            <label className={styles.check}>
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Read aloud
            </label>
            {result ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  if (typeof speechSynthesis === "undefined") return;
                  speechSynthesis.cancel();
                  speechSynthesis.speak(new SpeechSynthesisUtterance(result.text));
                }}
              >
                Play
              </button>
            ) : null}
            {analysis ? <span className={styles.ms}>{Math.round(analysis.ms)} ms in your browser</span> : null}
          </div>

          {analysis && analysis.infos.length ? (
            <ul className={styles.objects} data-testid="ba-objects">
              {analysis.infos.map((info, k) => (
                <li key={k} data-chosen={info === result?.chosen || undefined}>
                  <span className={styles.dot} style={{ background: PROX_COLOR[info.proximity] }} />
                  <span className={styles.what}>
                    {info.name}
                    <small>
                      {L.clockPhrase(info.centerX)}, {info.proximity}
                      {info.distanceM !== null ? `, ~${info.distanceM} m` : ""}
                    </small>
                    {reasons ? <small className={styles.reason}>{reasons[k]}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : analysis ? (
            <p className={styles.note}>No obstacle or findable object in view.</p>
          ) : null}
        </aside>
      </div>

      <div className={styles.steps}>
        <ol className={styles.rail} aria-label="Pipeline steps">
          {STEPS.map((st, i) => (
            <li key={st.key}>
              <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)} data-testid={`ba-step-${st.key}`}>
                <span className={styles.num}>{i + 1}</span>
                {st.title}
              </button>
            </li>
          ))}
        </ol>
        <div className={styles.explain} data-testid="ba-explain">
          <p>
            <strong>{s.title}.</strong> {s.body}
          </p>
          {analysis && s.key === "coco" ? <p className={styles.note}>{analysis.raw.filter((d) => d.model === "coco").length} boxes from the general detector.</p> : null}
          {analysis && s.key === "specialist" ? <p className={styles.note}>{analysis.raw.filter((d) => d.model === "specialist").length} boxes from the specialist.</p> : null}
          {analysis && s.key === "merge" ? (
            <p className={styles.note}>
              {analysis.raw.length} boxes in, {analysis.kept.length} kept
              {analysis.dropped.length ? `, ${analysis.dropped.map((d) => d.name).join(", ")} dropped as duplicates` : ", nothing to merge"}.
            </p>
          ) : null}
          <div className={styles.stepNav}>
            <button type="button" className={styles.link} disabled={step === 0} onClick={() => setStep((v) => v - 1)}>
              Previous step
            </button>
            <button type="button" className={styles.link} disabled={step === STEPS.length - 1} onClick={() => setStep((v) => v + 1)} data-testid="ba-next">
              Next step
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
