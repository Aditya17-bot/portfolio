import type { Metadata } from "next";
import { ModelHeader, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { AmazonMatcher } from "@/components/projects/AmazonMatcher";

const REPO = "https://github.com/Aditya17-bot/amazon-ml-challenge-2026-entity-resolution";

export const metadata: Metadata = {
  title: "Amazon ML Challenge: entity resolution",
  description:
    "Rank 696 of 89,000+ in the Amazon ML Challenge 2026: match 10 million business records to their real-world business. Try the normalisation, similarity features and decoy checks on records you type.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#amazon-ml-challenge", label: "Projects" }}
        kind="Project"
        badge="interactive"
        family="Amazon ML Challenge 2026"
        date="2026"
        title="Is this the same business?"
        lede={
          <p>
            Three sources describe millions of businesses with no shared IDs: names abbreviated, transliterated or
            reordered, addresses partial. Some records are traps, a real business copied with one detail changed.
            The task was to find every record of each business while being penalised more for false matches than
            for missed ones. Below, the pipeline&apos;s first stages run on records you can edit.
          </p>
        }
        stats={[
          { label: "Public leaderboard rank, of 89,000+", value: "696" },
          { label: "Score, macro F0.5", value: "0.9839" },
          { label: "Records to match", value: "10M+" },
          { label: "Countries, one with no training data", value: "3" },
        ]}
      />

      <Section title="Try it" id="try">
        <AmazonMatcher />
        <p className="prose" style={{ fontSize: 14 }}>
          Pick an example, decide for yourself, then look at what the pipeline sees. Edit any field: change a house
          number by three, or Inc to LLC, and watch the decoy signs light up. The records are made up; no challenge
          data is on this page.
        </p>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Public leaderboard: rank / overall score (macro F0.5)", value: "696 / 0.983926", source: "README, leaderboard" },
            { metric: "Retrieval: true matches among the candidate pairs (train)", value: "98.0%", source: "README" },
            { metric: "Pruner: candidate pairs kept on test", value: "125M → 11.6M", source: "README" },
            { metric: "Cost of pruning, F0.5", value: "0.0005", source: "README" },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Team project. Details, including what did not work, are in the{" "}
          <a href={REPO} target="_blank" rel="noreferrer">
            repository
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
