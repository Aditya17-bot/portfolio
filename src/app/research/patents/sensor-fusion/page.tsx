import type { Metadata } from "next";
import { ModelHeader, Section } from "@/components/ml/ModelLayout";
import { HazardLab } from "@/components/patents/HazardLab";
import { patentSearch } from "@/content/research";

export const metadata: Metadata = {
  title: "Sensor fusion patent",
  description:
    "Indian Patent Application 202641115711, explained by playing with it: five lab sensors each below their alarm, and the pairwise index that catches the hazard they describe together.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/research#patents", label: "Research" }}
        kind="Patent"
        badge="published application"
        family="Pairwise sensor fusion"
        date="2026"
        title="Hazards that no single sensor sees"
        lede={
          <p>
            A reaction starting in a fume hood raises solvent vapour and bench temperature together, each to well
            below its own alarm. Fixed thresholds stay silent until one of them crosses. This application fuses
            five cheap, different sensors through pairwise products, so two sensors that are both somewhat up count
            for more than either alone, and protects the self-learning baseline so the hazard cannot teach the system
            that it is normal. Both labs below use the published weights, coefficients and thresholds.
          </p>
        }
        stats={[
          { label: "Indian Patent Application No.", value: "202641115711" },
          { label: "Status", value: "Published, 2026" },
          { label: "Sensors fused", value: "Gas · heat · flame · humidity · light" },
          { label: "Decision cycle", value: "500 ms" },
        ]}
      />

      <Section title="Try it" id="try">
        <HazardLab />
      </Section>

      <Section title="What is claimed, in plain words" id="claims">
        <div className="prose">
          <p>
            <strong>Put every sensor on one scale.</strong> Each reading is compared with its own learned normal and
            divided by its own usual spread, so gas in ppm and temperature in °C become comparable numbers of standard
            deviations. Only that makes multiplying them meaningful.
          </p>
          <p>
            <strong>Add the pairs.</strong> The index adds each sensor&apos;s weighted deviation to a weighted product
            for every pair. A product is large only when both are up, the signature of a compound hazard. The
            coefficients are set by a fixed commissioning procedure from staged and benign events, not by judgement.
          </p>
          <p>
            <strong>Protect what was learned.</strong> The spread is frozen the moment any sensor departs from normal,
            and the baseline is frozen while ventilation runs, so neither the hazard nor the response to it is learned
            as the new normal.
          </p>
          <p>
            <strong>Three paths, highest wins.</strong> The fused index, each sensor on its own, and hard absolute limits
            run in parallel; the strongest call drives the fan, vent, buzzer and light.
          </p>
          <p>
            The application can be looked up by its number on the{" "}
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
