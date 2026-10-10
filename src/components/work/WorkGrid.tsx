"use client";

import Link from "next/link";
import { useState } from "react";
import { Glyph } from "./Glyph";
import styles from "./WorkGrid.module.css";

export type WorkItem = {
  id: string;
  href: string;
  title: string;
  kind: string;
  /** Filter group. */
  group: string;
  summary: string;
  metric: { value: string; label: string };
  facts: string[];
  status: string;
  date?: string;
  step?: number;
  repo?: string;
  testId?: string;
};

/** Filterable grid of illustrated cards. The title link covers the whole card; a code link sits above it. */
export function WorkGrid({ items, groups, label }: { items: WorkItem[]; groups: string[]; label: string }) {
  const [group, setGroup] = useState("All");
  const shown = group === "All" ? items : items.filter((i) => i.group === group);
  const count = (g: string) => (g === "All" ? items.length : items.filter((i) => i.group === g).length);

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.filters} role="group" aria-label={`Filter ${label}`}>
          {["All", ...groups].map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} data-testid="work-filter">
              {g}
              <span>{count(g)}</span>
            </button>
          ))}
        </div>
        <p className={styles.count} aria-live="polite">
          {shown.length} {label}
        </p>
      </div>
      <ul className={styles.grid}>
        {shown.map((it) => (
          <li key={it.id} id={it.id} className={`work-card ${styles.card}`} data-testid={it.testId ?? "work-card"}>
            <div className={styles.thumb}>
              <Glyph id={it.id} />
              {it.step ? <span className={styles.step}>{String(it.step).padStart(2, "0")}</span> : null}
            </div>
            <div className={styles.body}>
              <p className={styles.kind}>{it.kind}</p>
              <h3 className={styles.title}>
                <Link href={it.href} className={styles.cover}>
                  {it.title}
                </Link>
              </h3>
              <p className={styles.summary}>{it.summary}</p>
              <div className={styles.foot}>
                <p className={styles.metric}>
                  <strong>{it.metric.value}</strong>
                  <span>{it.metric.label}</span>
                </p>
                <p className={styles.facts}>{it.facts.join(" · ")}</p>
                <p className={styles.status}>
                  <span className={styles.dot} />
                  {it.status}
                  {it.date ? <span className={styles.date}>{it.date}</span> : null}
                  {it.repo ? (
                    <a href={it.repo} target="_blank" rel="noreferrer" className={styles.code}>
                      Code
                    </a>
                  ) : null}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
