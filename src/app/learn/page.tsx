import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { WorkGrid, type WorkItem } from "@/components/work/WorkGrid";
import { explainers } from "@/content/learn";
import { modelBySlug } from "@/content/models";

export const metadata: Metadata = {
  title: "Learn",
  description: "Six ideas behind modern deep learning, each with a short animation and a lab you can play with.",
};

export default function Page() {
  const items: WorkItem[] = explainers.map((e, i) => ({
    id: e.slug,
    href: `/learn/${e.slug}`,
    title: e.title,
    kind: e.group,
    group: e.group,
    summary: e.question,
    metric: { value: `${e.seconds} s`, label: "animation, then a lab" },
    facts: [`used in ${modelBySlug(e.model.slug)?.title ?? e.model.label}`],
    status: "Interactive",
    step: i + 1,
    testId: "lesson",
  }));
  return (
    <>
      <PageIntro eyebrow="Explainers" title="Learn">
        <p>
          The ideas behind the models, one at a time. Each starts with a short animation, explains the idea in a few
          paragraphs and ends with a lab to play with. The Models pages show what each idea achieves once trained;
          these show why it works.
        </p>
      </PageIntro>
      <div className="container">
        <WorkGrid items={items} groups={["Training", "Vision", "Sequence", "Generative"]} label="explainers" />
      </div>
    </>
  );
}
