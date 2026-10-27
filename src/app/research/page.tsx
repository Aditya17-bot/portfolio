import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { AbstentionFigure, DemandFigure } from "@/components/PaperFigures";
import solar from "../../../public/projects/solar/explorer.json";
import { papers, patents, patentSearch } from "@/content/research";
import styles from "../content.module.css";

const published = patents.filter((p) => p.status === "Published");
const filed = patents.filter((p) => p.status === "Filed");
const presented = papers.filter((p) => p.status === "Presented");

// Three 2024 days from the public-data rerun: winter, summer, autumn.
const pickDays = [0, Math.floor(solar.days.dates.length / 2), solar.days.dates.length - 1].map((i) => ({
  date: solar.days.dates[i],
  actual: solar.days.actual[i],
  forecast: solar.days.pred.lgbm_solar[i],
  sun: solar.days.sun[i],
}));

export const metadata: Metadata = {
  title: "Research",
  description: `First-author conference papers on electricity demand forecasting and assistive perception, ${published.length} published Indian patent applications and ${filed.length} more filed.`,
};

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Papers & patents" title="Research">
        <p>
          First-author papers on forecasting Delhi&apos;s electricity demand and on assistive perception for blind
          users, and patent applications in assistive navigation, sensing and infrastructure monitoring.
        </p>
      </PageIntro>

      <div className="container">
        <section className={styles.section} aria-labelledby="papers">
          <div className={styles.sectionHead}>
            <h2 id="papers">Papers</h2>
            <span className={styles.sectionNote}>
              {presented.length} presented · {papers.length - presented.length} under revision
            </span>
          </div>
          <div className={styles.stack}>
            {papers.map((p) => (
              <article key={p.title} className={styles.card} data-testid="paper" data-status={p.status}>
                <div className={styles.headRow}>
                  <p className={styles.meta}>
                    <span>{p.venueShort}</span>
                    <span>{p.date}</span>
                    <span>{p.role}</span>
                  </p>
                  <span className={styles.badge} data-tone={p.status === "Presented" ? "good" : "warm"}>
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
                {p.venueShort === "SIPCOV-2026" ? <DemandFigure days={pickDays} /> : <AbstentionFigure />}
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
                {p.certificate ? (
                  <figure className={styles.certificate} data-testid="certificate">
                    <a href={p.certificate.pdf} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static preview, already sized */}
                      <img
                        src={p.certificate.image}
                        width={p.certificate.width}
                        height={p.certificate.height}
                        alt={`${p.certificate.label}, ${p.venueShort}, issued to ${p.authors}`}
                        loading="lazy"
                      />
                    </a>
                    <figcaption>
                      <span>{p.certificate.label}</span>
                      <span>
                        Issued to {p.authors} by the {p.venueShort} conference chairs.{" "}
                        <a href={p.certificate.pdf} target="_blank" rel="noopener">
                          Open the PDF
                        </a>
                      </span>
                    </figcaption>
                  </figure>
                ) : null}
                {p.explore ? (
                  <p className={styles.links}>
                    <Link href={p.explore.href}>{p.explore.label}</Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="patents">
          <div className={styles.sectionHead}>
            <h2 id="patents">Patents</h2>
            <span className={styles.sectionNote}>
              {published.length} published · {filed.length} filed
            </span>
          </div>
          <div className={styles.grid}>
            {published.map((p) => (
              <article key={p.title} className={styles.card} data-testid="patent" data-status="Published">
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
                {p.explain ? (
                  <p className={styles.links}>
                    <Link href={p.explain}>See how it works</Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <h3 className={styles.subhead} id="filed">
            Filed, awaiting publication
          </h3>
          <div className={styles.grid}>
            {filed.map((p) => (
              <article key={p.title} className={styles.compact} data-testid="patent" data-status="Filed">
                <div className={styles.headRow}>
                  <p className={styles.meta}>
                    <span>{p.office}</span>
                    <span>{p.year}</span>
                  </p>
                  <span className={styles.badge} data-tone="warm">
                    {p.status}
                  </span>
                </div>
                <p className={styles.tagline}>{p.title}</p>
              </article>
            ))}
          </div>
          <p className={styles.footnote}>
            Published application numbers can be looked up on the{" "}
            <a href={patentSearch} target="_blank" rel="noreferrer">
              Indian Patent Office public search
            </a>
            . Filed applications are listed by subject only; their titles and numbers are added once they are
            published.
          </p>
        </section>
      </div>
    </>
  );
}
