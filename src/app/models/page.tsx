import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { models } from "@/content/models";
import styles from "./models.module.css";

export const metadata: Metadata = { title: "Models" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Model zoo" title="Models">
        <p>
          Every model here is trained from scratch, and every one runs in your browser. Each page shows the run behind
          its numbers and the command that reproduces it.
        </p>
      </PageIntro>
      <div className="container">
        <ol className={styles.list}>
          {models.map((m, i) => {
            const body = (
              <>
                <span className={styles.step}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.main}>
                  <span className={styles.meta}>
                    {m.family} · {m.dataset}
                  </span>
                  <span className={styles.title}>{m.title}</span>
                  <span className={styles.summary}>{m.summary}</span>
                </span>
                <span className={styles.status} data-status={m.status}>
                  {m.status === "live" ? "Live" : "Planned"}
                </span>
              </>
            );
            return (
              <li key={m.slug}>
                {m.status === "live" ? (
                  <Link href={`/models/${m.slug}`} className={styles.item}>
                    {body}
                  </Link>
                ) : (
                  <div className={styles.item} aria-disabled="true">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
