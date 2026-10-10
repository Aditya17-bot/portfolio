import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { papers, patents, patentSearch } from "@/content/research";
import styles from "../content.module.css";

export const metadata: Metadata = {
  title: "Research",
  description: "A first-author conference paper on solar-aware electricity demand forecasting, and published Indian patent applications.",
};

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Papers & patents" title="Research">
        <p>
          A first-author paper on forecasting Delhi&apos;s electricity demand, and patent applications on assistive
          navigation and sensor fusion.
        </p>
      </PageIntro>

      <div className="container">
        <section className={styles.section} aria-labelledby="papers">
          <div className={styles.sectionHead}>
            <h2 id="papers">Papers</h2>
            <span className={styles.sectionNote}>{papers.length} presented</span>
          </div>
          {papers.map((p) => (
            <article key={p.title} className={styles.card} data-testid="paper">
              <div className={styles.headRow}>
                <p className={styles.meta}>
                  <span>{p.venueShort}</span>
                  <span>{p.date}</span>
                  <span>{p.role}</span>
                </p>
                <span className={styles.badge} data-tone="good">
                  {p.status}
                </span>
              </div>
              <h3 className={styles.title}>{p.title}</h3>
              <p className={styles.tagline}>
                {p.authors} · {p.venue}
              </p>
              <div className={styles.body}>
                {p.summary.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <dl className={styles.facts}>
                {p.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              {p.explore ? (
                <p className={styles.links}>
                  <Link href={p.explore.href}>{p.explore.label}</Link>
                </p>
              ) : null}
            </article>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="patents">
          <div className={styles.sectionHead}>
            <h2 id="patents">Patents</h2>
            <span className={styles.sectionNote}>{patents.length} published applications</span>
          </div>
          <div className={styles.grid}>
            {patents.map((p) => (
              <article key={p.number} className={styles.card} data-testid="patent">
                <div className={styles.headRow}>
                  <p className={styles.meta}>
                    <span>{p.office}</span>
                    <span>{p.year}</span>
                  </p>
                  <span className={styles.badge} data-tone="good">
                    {p.status}
                  </span>
                </div>
                <h3 className={styles.title}>{p.title}</h3>
                <p className={styles.meta}>
                  <span>Application No. {p.number}</span>
                </p>
              </article>
            ))}
          </div>
          <p className={styles.footnote}>
            Application numbers can be looked up on the{" "}
            <a href={patentSearch} target="_blank" rel="noreferrer">
              Indian Patent Office public search
            </a>
            . Further applications are in process and will be listed here once they are published.
          </p>
        </section>
      </div>
    </>
  );
}
