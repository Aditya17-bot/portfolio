import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { WorkGrid, type WorkItem } from "@/components/work/WorkGrid";
import { MODEL_HEADLINE as HEADLINE } from "@/content/headlines";
import { models } from "@/content/models";
export const metadata: Metadata = {
  title: "Models",
  description: "Nine neural networks trained from scratch, each one running in your browser, with the run behind every number.",
};

export default function Page() {
  const items: WorkItem[] = models
    .filter((m) => m.status === "live" && HEADLINE[m.slug])
    .map((m, i) => ({
      id: m.slug,
      href: `/models/${m.slug}`,
      title: m.title,
      kind: m.family,
      summary: m.summary,
      status: "Runs in your browser",
      date: m.date,
      step: i + 1,
      ...HEADLINE[m.slug],
    }));
  return (
    <>
      <PageIntro eyebrow="Model zoo" title="Models">
        <p>
          A ladder of networks, each one introducing the problem the next exists to solve. Every one is trained from
          scratch and runs in your browser; each page shows the run behind its numbers and the command that
          reproduces it.
        </p>
      </PageIntro>
      <div className="container">
        <WorkGrid items={items} groups={["Vision", "Generative", "Sequence"]} label="models" />
      </div>
    </>
  );
}
