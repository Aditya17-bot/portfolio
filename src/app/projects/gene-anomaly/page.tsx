import type { Metadata } from "next";
import { ModelHeader, Section } from "@/components/ml/ModelLayout";
import { GeneExplorer } from "@/components/projects/GeneExplorer";

const REPO = "https://github.com/Aditya17-bot/Gene-Anomaly-detection";

export const metadata: Metadata = {
  title: "Protein impact explorer",
  description:
    "Type a gene, get its AlphaFold structure coloured by AlphaMissense's predicted harm, and find mutation hotspots that are far apart in sequence but touching in 3D. Winner, Best Project at Code for Life, VIT.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#gene-anomaly", label: "Projects" }}
        kind="Project"
        badge="live data"
        family="Protein impact explorer"
        date="Feb 2026"
        title="Where a mutation lands in 3D"
        lede={
          <p>
            A pathogenicity score says how harmful one amino-acid change is likely to be. It does not say that two
            changes hundreds of positions apart in the sequence may sit side by side once the protein folds. This
            explorer, which won Best Project at Code for Life (VIT, Feb 2026), puts the scores on the structure so
            those clusters become visible.
          </p>
        }
        stats={[
          { label: "Award", value: "Best Project" },
          { label: "Sources", value: "UniProt · AlphaFold · AlphaMissense" },
          { label: "Runs", value: "In your browser, live" },
          { label: "Proteins covered", value: "Any reviewed human gene" },
        ]}
      />

      <Section title="Try it" id="try">
        <GeneExplorer />
      </Section>

      <Section title="How to read it" id="read">
        <div className="prose">
          <p>
            <strong>Each sphere is one amino acid,</strong> placed where AlphaFold predicts it sits in the folded
            protein. Coloured by predicted harm, red regions are where almost any substitution is likely pathogenic:
            usually the buried core and the active site, where the protein cannot tolerate change.
          </p>
          <p>
            <strong>Switch to model confidence</strong> before trusting a distance. Orange regions are disordered or
            uncertain; AlphaFold is guessing their shape, so hotspots only use residues with pLDDT of 70 or more.
          </p>
          <p>
            <strong>Hotspots</strong> are pairs of strongly harmful positions (average score 0.8 or more) at least 25
            residues apart in the sequence but within 8 Å in 3D, close enough to touch. Variants at such pairs can
            damage the same structural region, which a one-dimensional score track hides.
          </p>
          <p>
            <strong>Score a specific variant</strong> by typing it as original amino acid, position and new amino acid.
            Positions follow UniProt, which counts the first methionine; older papers often do not, so SOD1&apos;s
            well-known ALS mutation A4V is A5V here.
          </p>
        </div>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            The gene symbol goes to the UniProt REST API for the reviewed human protein. Its accession fetches the
            AlphaFold DB model, read for the alpha-carbon of each residue and its pLDDT, and the AlphaMissense table
            of all 19 possible substitutions at every position. The page computes the per-residue averages, the
            distances and the hotspot search itself. Nothing is precomputed, so every reviewed human protein in
            AlphaFold DB works.
          </p>
          <p>
            The hackathon version was a Streamlit app with the Mol* viewer; this is a browser rebuild of the same
            idea. AlphaFold and AlphaMissense predictions are for research and teaching, not clinical use.
          </p>
          <p>
            Team project ·{" "}
            <a href={REPO} target="_blank" rel="noreferrer">
              original code on GitHub
            </a>{" "}
            · Data:{" "}
            <a href="https://www.uniprot.org" target="_blank" rel="noreferrer">
              UniProt
            </a>
            ,{" "}
            <a href="https://alphafold.ebi.ac.uk" target="_blank" rel="noreferrer">
              AlphaFold DB
            </a>{" "}
            (EMBL-EBI and Google DeepMind), AlphaMissense (Cheng et al., Science 2023).
          </p>
        </div>
      </Section>
    </article>
  );
}
