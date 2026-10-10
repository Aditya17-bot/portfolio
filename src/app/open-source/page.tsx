import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { checked, pullRequests, type PullRequest } from "@/content/openSource";
import styles from "../content.module.css";

export const metadata: Metadata = {
  title: "Open source",
  description: "Merged fixes in kornia, timm and Haystack: the bug, the fix and the test for each.",
};

function Pr({ pr }: { pr: PullRequest }) {
  const url = `https://github.com/${pr.repo}/pull/${pr.number}`;
  return (
    <article className={pr.state === "merged" ? styles.card : styles.compact} data-testid="pr" data-state={pr.state}>
      <div className={styles.headRow}>
        <p className={styles.meta}>
          <span>{pr.repo}</span>
          <span>{pr.stars} stars</span>
          <span>{pr.date}</span>
        </p>
        <span className={styles.badge} data-tone={pr.state === "merged" ? "good" : "warm"}>
          {pr.state === "merged" ? "Merged" : "In review"}
        </span>
      </div>
      <h3 className={styles.title}>
        <a href={url} target="_blank" rel="noreferrer" className={styles.titleLink}>
          {pr.title} <span className={styles.sectionNote}>#{pr.number}</span>
        </a>
      </h3>
      <dl className={styles.labelled}>
        <dt>Bug</dt>
        <dd>{pr.bug}</dd>
        <dt>Fix</dt>
        <dd>{pr.fix}</dd>
        <dt>Test</dt>
        <dd>{pr.test}</dd>
      </dl>
    </article>
  );
}

export default function Page() {
  const merged = pullRequests.filter((p) => p.state === "merged");
  const open = pullRequests.filter((p) => p.state === "open");
  return (
    <>
      <PageIntro eyebrow="Upstream" title="Open source">
        <p>
          Fixes in the libraries I use: {merged.length} merged so far in kornia, timm and Haystack. Each one starts
          from a reproduction and ships with a test that fails without the fix.
        </p>
      </PageIntro>
      <div className="container">
        <section className={styles.section} aria-labelledby="merged">
          <div className={styles.sectionHead}>
            <h2 id="merged">Merged</h2>
            <span className={styles.sectionNote}>{merged.length} pull requests</span>
          </div>
          <div className={styles.stack}>
            {merged.map((pr) => (
              <Pr key={`${pr.repo}${pr.number}`} pr={pr} />
            ))}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="review">
          <div className={styles.sectionHead}>
            <h2 id="review">In review</h2>
            <span className={styles.sectionNote}>status checked {checked}</span>
          </div>
          <div className={styles.grid}>
            {open.map((pr) => (
              <Pr key={`${pr.repo}${pr.number}`} pr={pr} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
