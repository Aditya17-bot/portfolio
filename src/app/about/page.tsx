import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { site } from "@/content/site";
import styles from "../content.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "Aditya Sridhar: Computer Science at VIT Vellore, machine learning engineer. Education, awards, skills and contact.",
};

const awards = [
  { what: "Amazon ML Challenge 2026", detail: "Top 4% nationally, rank 696 of 89,000+ participants", href: "/projects#amazon-ml-challenge" },
  { what: "Code for Life: Hackathon for Everyday Solutions, VIT", detail: "Winner, Best Project Award, Feb 2026", href: "/projects#gene-anomaly" },
  { what: "Google Cloud Certified: Generative AI Leader", detail: "Jul 2026" },
  { what: "Extensive & Reimagined AI (ERA-V3)", detail: "Certificate of participation, 2024–25" },
];

const skills = [
  { group: "Languages", items: ["Python", "Java", "SQL", "TypeScript"] },
  {
    group: "ML / DL",
    items: ["PyTorch", "transformers", "YOLOv8", "scikit-learn", "LightGBM", "self-supervised learning", "LLM agents", "forecasting"],
  },
  {
    group: "Engineering",
    items: ["FastAPI", "Flask", "Streamlit", "Docker", "ONNX / TFLite export", "AWS (EC2, S3, IAM)", "Git", "Linux", "pytest"],
  },
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Profile" title="About">
        <p>
          I study Computer Science at VIT Vellore and build machine learning systems that have to work outside a
          notebook: offline on a phone, in a browser, or inside a library other people depend on.
        </p>
      </PageIntro>
      <div className="container">
        <section className={styles.section} aria-labelledby="now">
          <div className={styles.body}>
            <p>
              Most of my work is computer vision and applied ML. I built BlindAssist, an offline navigation aid that
              decides what is worth saying to a visually impaired user, and ranked in the top 4% of the Amazon ML
              Challenge with an entity-resolution pipeline over ten million records. I presented a first-author paper
              on electricity demand forecasting at SIPCOV-2026, and I have published patent applications.
            </p>
            <p>
              I also fix bugs upstream, in kornia, timm and Haystack. The models on this site are trained from
              scratch, and every number on them cites the run that produced it.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="education">
          <div className={styles.sectionHead}>
            <h2 id="education">Education</h2>
          </div>
          <div className={styles.compact}>
            <p className={styles.meta}>
              <span>2023 – 2027</span>
              <span>Vellore, India</span>
            </p>
            <h3 className={styles.title}>Vellore Institute of Technology</h3>
            <p className={styles.tagline}>B.Tech, Computer Science and Engineering</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="awards">
          <div className={styles.sectionHead}>
            <h2 id="awards">Awards and certifications</h2>
          </div>
          <div className={styles.grid}>
            {awards.map((a) => (
              <div key={a.what} className={styles.compact}>
                <h3 className={styles.title}>
                  {a.href ? (
                    <Link href={a.href} className={styles.titleLink}>
                      {a.what}
                    </Link>
                  ) : (
                    a.what
                  )}
                </h3>
                <p className={styles.tagline}>{a.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="skills">
          <div className={styles.sectionHead}>
            <h2 id="skills">Skills</h2>
          </div>
          <dl className={styles.skills}>
            {skills.map((s) => (
              <div key={s.group}>
                <dt>{s.group}</dt>
                <dd>
                  <ul className={styles.tags}>
                    {s.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="contact">
          <div className={styles.sectionHead}>
            <h2 id="contact">Contact</h2>
          </div>
          <p className={styles.links} data-testid="contact">
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <a href={site.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={site.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href="/Aditya_Sridhar_Resume.pdf" data-testid="resume">
              Resume (PDF)
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
