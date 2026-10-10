import type { Metadata } from "next";
import Link from "next/link";
import { ModelHeader, Section } from "@/components/ml/ModelLayout";
import { WearableLab } from "@/components/patents/WearableLab";
import { patentSearch } from "@/content/research";

export const metadata: Metadata = {
  title: "Wearable navigation patent",
  description:
    "Indian Patent Application 202641110070, explained by playing with it: how a chest-worn camera picks the one obstacle worth a warning, and when that warning is allowed out.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/research#patents", label: "Research" }}
        kind="Patent"
        badge="published application"
        family="Wearable navigation apparatus"
        date="2026"
        title="One warning, at the right moment"
        lede={
          <p>
            A chest-worn camera sees many things; a blind wearer can act on one. This application claims the path
            between detection and the bone-conduction speaker, the vibration motors and the tones: a single threat value
            that decides which object gets the warning, a detector that lowers its bar while the wearer moves, and a
            four-stage scheduler that decides when. Both labs below use the equations and constants as published.
          </p>
        }
        stats={[
          { label: "Indian Patent Application No.", value: "202641110070" },
          { label: "Status", value: "Published, 2026" },
          { label: "Output channels", value: "Speech · tones · vibration" },
          { label: "Decisions per frame", value: "One object, or silence" },
        ]}
      />

      <Section title="Try it" id="try">
        <WearableLab />
      </Section>

      <Section title="What is claimed, in plain words" id="claims">
        <div className="prose">
          <p>
            <strong>One measurement, used twice.</strong> The inertial sensor beside the camera measures how much the
            wearer is moving. That number lowers the detector&apos;s confidence threshold, because a blurred frame
            yields weaker detections of the same obstacle, and it also feeds the threat value, because walking toward
            an object makes it more urgent than standing still.
          </p>
          <p>
            <strong>Everything reduced to one ordinal value.</strong> Proximity (calibrated per class, so a bottle and
            a person are &ldquo;very close&rdquo; at different sizes), centrality, apparent size and the wearer&apos;s
            motion combine into a single number. Only the highest ranks, and only if it clears a threshold; a frame of
            distant, peripheral objects produces silence.
          </p>
          <p>
            <strong>A gate on the label, not the value.</strong> Small objects like a cup can fill the frame when held
            close without being in the way, so findable classes never trigger an obstacle warning, whatever their score.
          </p>
          <p>
            <strong>Two intervals with different jobs.</strong> A per-object cooldown stops repeating what the wearer
            already knows, and may be skipped when the threat has grown; a global gap protects the shared output channel
            and is never skipped.
          </p>
          <p>
            The software side of this was built and evaluated in{" "}
            <Link href="/projects/blindassist">BlindAssist</Link>. The application can be looked up by its number on the{" "}
            <a href={patentSearch} target="_blank" rel="noreferrer">
              Indian Patent Office public search
            </a>
            . Team invention.
          </p>
        </div>
      </Section>
    </article>
  );
}
