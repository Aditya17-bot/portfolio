import type { Metadata } from "next";
import Link from "next/link";
import { ModelHeader, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { BlindAssistDemo } from "@/components/projects/BlindAssistDemo";

const REPO = "https://github.com/Aditya17-bot/object_detection_blind";
const EVAL = `${REPO}/blob/main/EVALUATION.md`;

export const metadata: Metadata = {
  title: "BlindAssist",
  description:
    "An offline camera assistant for blind and low-vision users. Run its two detectors and decision rules on your own camera or photos, and step through how a frame becomes one spoken sentence.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#blindassist", label: "Projects" }}
        kind="Project"
        family="BlindAssist"
        date="2026"
        title="BlindAssist: a camera that says what matters"
        lede={
          <p>
            For a blind user, a wrong warning costs more than silence and ten warnings hide the one that matters.
            BlindAssist runs fully offline on a phone: two detectors find what is in the room, and a decision layer
            picks the single sentence worth saying. Below, the same models and the same rules run in your browser.
          </p>
        }
        stats={[
          { label: "Direction accuracy, reviewed announcements", value: "100%" },
          { label: "Both models, RTX 3050", value: "21 ms/frame" },
          { label: "CPU only, same laptop", value: "5.8 FPS" },
          { label: "Phantom announcements, 7 clips", value: "0" },
        ]}
      />

      <Section title="Try it" id="try">
        <BlindAssistDemo />
        <p className="prose" style={{ fontSize: 14 }}>
          Pick a photo, upload your own or turn on your camera, then click through the steps under the picture to
          see each stage on that frame. Switch to Find to locate one object, or Describe for the whole scene. The
          decision rules are a line-for-line port of the app&apos;s Python, checked against it on random scenes.
        </p>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Direction (left / ahead / right, top / bottom) correct, reviewed announcement keyframes, 7 clips", value: "100%", source: "EVALUATION.md §2" },
            { metric: "Proximity bucket plausible, same keyframes", value: "100%", source: "EVALUATION.md §2" },
            { metric: "Announcements from one-frame misdetections", value: "0", source: "EVALUATION.md §2" },
            { metric: "Both models per frame, RTX 3050 / CPU only", value: "21 ms / 172 ms", source: "README, EVALUATION.md §2" },
            { metric: "From first sighting to speech", value: "≈0.35–0.5 s", source: "EVALUATION.md §2" },
            { metric: "Bedroom walkthrough: announcements over 471 frames", value: "8", source: "EVALUATION.md §2" },
          ]}
        />
        <div className="prose" style={{ fontSize: 14 }}>
          <p>
            <strong>The weak point is names, not warnings.</strong> COCO has no dustbin or wardrobe, so it said
            &ldquo;toilet&rdquo; and &ldquo;refrigerator&rdquo;; the warning was still right every time, but a wrong
            noun costs trust. That is why the door and dustbin specialist exists, and why an unsure name is spoken as
            &ldquo;obstacle&rdquo;. The full evaluation, failures included, is in{" "}
            <a href={EVAL} target="_blank" rel="noreferrer">
              EVALUATION.md
            </a>
            .
          </p>
        </div>
      </Section>

      <Section title="What the phone app adds" id="app">
        <div className="prose">
          <p>
            <strong>Timing.</strong> On a live camera, an object must persist for two frames before it is announced,
            the same sentence is not repeated within a few seconds, and an obstacle that gets closer overrides the
            cooldown at once. Speech runs on its own thread, so the camera never waits for it.
          </p>
          <p>
            <strong>Voice control in two tiers.</strong> A closed keyword grammar routes commands like &ldquo;find
            bottle&rdquo; in about 5 µs with nothing downloaded; a small local language model handles paraphrases a
            grammar cannot hear, choosing among fixed capabilities rather than writing the guidance itself.
          </p>
          <p>
            <strong>Related.</strong> The design is the subject of a{" "}
            <Link href="/research#papers">paper under revision at ICMLDE</Link>, and the wearable version is a{" "}
            <Link href="/research#patents">published patent application</Link>.
          </p>
        </div>
      </Section>

      <Section title="Code" id="code">
        <p className="prose">
          The Android app, the Python pipeline, the evaluation harness and the browser port are on{" "}
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          . Team project.
        </p>
      </Section>
    </article>
  );
}
