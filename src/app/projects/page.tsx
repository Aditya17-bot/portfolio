import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
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

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Systems" title="Projects">
        <p>Systems built end to end. The numbers come from each project&apos;s own evaluation.</p>
      </PageIntro>
      <div className="container">
        <section className={styles.section} aria-labelledby="featured">
          <div className={styles.sectionHead}>
            <h2 id="featured">Featured</h2>
          </div>
          <div className={styles.stack}>
            {featured.map((p) => (
              <article key={p.slug} id={p.slug} className={styles.card} data-testid="project">
                <p className={styles.meta}>
                  <span>{p.year}</span>
                  {p.team ? <span>{p.team}</span> : null}
                </p>
                <h3 className={styles.title}>{p.title}</h3>
                <p className={styles.tagline}>{p.tagline}</p>
                {p.facts ? (
                  <dl className={styles.facts}>
                    {p.facts.map((f) => (
                      <div key={f.label}>
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <ul className={styles.points}>
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <Tags items={p.stack} />
                <Links p={p} />
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="more">
          <div className={styles.sectionHead}>
            <h2 id="more">More</h2>
            <span className={styles.sectionNote}>{more.length} repositories</span>
          </div>
          <div className={styles.grid}>
            {more.map((p) => (
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
