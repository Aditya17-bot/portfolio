import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { WorkGrid, type WorkItem } from "@/components/work/WorkGrid";
import fraud from "../../../public/projects/fraud/curves.json";
import { featured, more, type Project } from "@/content/projects";
import styles from "../content.module.css";

export const metadata: Metadata = {
  title: "Projects",
  description: "BlindAssist, the Amazon ML Challenge entity resolver, an offline voice assistant and more, with measured results.",
};

function Links({ p }: { p: Project }) {
  return (
    <p className={styles.links}>
      {p.demo?.href.startsWith("/") ? (
        <Link href={p.demo.href}>{p.demo.label}</Link>
      ) : p.demo ? (
        <a href={p.demo.href} target="_blank" rel="noreferrer">
          {p.demo.label}
        </a>
      ) : null}
      {p.repo ? (
        <a href={p.repo} target="_blank" rel="noreferrer">
          Code
        </a>
      ) : null}
    </p>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <ul className={styles.tags} aria-label="Built with">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}

// Projects with an interactive page get an illustrated card; the headline numbers come from those pages.
const CARDS: Record<string, { group: string; metric: WorkItem["metric"]; facts: string[]; status: string }> = {
  blindassist: {
    group: "Vision",
    metric: { value: "100%", label: "direction accuracy, reviewed announcements" },
    facts: ["YOLOv8 × 2", "Android", "21 ms/frame on GPU"],
    status: "Runs in your browser",
  },
  "amazon-ml-challenge": {
    group: "Data & ML",
    metric: { value: "696", label: "rank of 89,000+" },
    facts: ["macro F0.5 0.9839", "10M+ records"],
    status: "Interactive walk-through",
  },
  "voice-assistant": {
    group: "Speech",
    metric: { value: "~1.3 s", label: "to the first spoken word" },
    facts: ["Whisper", "Llama 3.2 3B", "Piper", "offline"],
    status: "Interactive replay",
  },
  "gene-anomaly": {
    group: "Data & ML",
    metric: { value: "Best Project", label: "Code for Life, VIT" },
    facts: ["AlphaFold", "AlphaMissense", "UniProt"],
    status: "Live data",
  },
  caterpillar: {
    group: "Systems",
    metric: { value: "3 min", label: "overheat warning horizon" },
    facts: ["FastAPI", "React", "4 ML models"],
    status: "Interactive simulator",
  },
  fraud: {
    group: "Data & ML",
    metric: { value: fraud.models.random_forest.pr_auc.toFixed(3), label: "PR-AUC on unseen months" },
    facts: [`${(fraud.data.test_rows / 1000).toFixed(0)}k test transactions`, "random forest vs isolation forest"],
    status: "Interactive",
  },
};

export default function Page() {
  const all = [...featured, ...more];
  const items: WorkItem[] = all
    .filter((p) => CARDS[p.slug] && p.demo?.href.startsWith("/"))
    .map((p) => ({
      id: p.slug,
      href: p.demo!.href,
      title: p.title,
      kind: p.team ? `${p.year} · team project` : p.year,
      summary: p.tagline,
      repo: p.repo,
      testId: "project",
      ...CARDS[p.slug],
    }));
  const rest = all.filter((p) => !items.some((i) => i.id === p.slug));
  return (
    <>
      <PageIntro eyebrow="Systems" title="Projects">
        <p>
          Systems built end to end. Each card opens something to try: a demo, a simulator or a walk-through of how it
          decides. The numbers come from each project&apos;s own evaluation.
        </p>
      </PageIntro>
      <div className="container">
        <WorkGrid items={items} groups={["Vision", "Speech", "Data & ML", "Systems"]} label="projects" />
        <section className={styles.section} aria-labelledby="more">
          <div className={styles.sectionHead}>
            <h2 id="more">More repositories</h2>
            <span className={styles.sectionNote}>{rest.length} repositories</span>
          </div>
          <div className={styles.grid}>
            {rest.map((p) => (
              <article key={p.slug} id={p.slug} className={styles.compact} data-testid="project">
                <p className={styles.meta}>
                  <span>{p.year}</span>
                </p>
                <h3 className={styles.title}>{p.title}</h3>
                <p className={styles.tagline}>{p.tagline}</p>
                <Tags items={p.stack} />
                <Links p={p} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
