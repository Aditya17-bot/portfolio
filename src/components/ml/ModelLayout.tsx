import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ModelLayout.module.css";

export function ModelHeader({
  family,
  date,
  title,
  lede,
  stats,
  crumb = { href: "/models", label: "Models" },
  kind = "Model",
  badge = "runs in your browser",
}: {
  family: string;
  date: string;
  title: string;
  lede: ReactNode;
  stats: { label: string; value: string }[];
  crumb?: { href: string; label: string };
  kind?: string;
  badge?: string;
}) {
  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link href={crumb.href}>{crumb.label}</Link> <span aria-hidden="true">/</span> {family}
      </nav>
      <p className="eyebrow">
        {kind} · {date} · <span className={styles.live}>{badge}</span>
      </p>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.lede}>{lede}</div>
      <dl className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.h2}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ResultsTable({ rows }: { rows: { metric: string; value: string; source: string }[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Value</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric}>
              <td>{r.metric}</td>
              <td className={styles.num}>{r.value}</td>
              <td className={styles.src}>{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reproduce({
  code,
  steps,
  facts,
}: {
  code: string;
  steps: { label: string; cmd: string }[];
  facts: { label: string; value: string }[];
}) {
  return (
    <div className={styles.repro}>
      <dl className={styles.facts}>
        {facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
        <div>
          <dt>Code</dt>
          <dd>
            <a className="link" href={code} target="_blank" rel="noreferrer">
              {code.replace("https://github.com/", "")}
            </a>
          </dd>
        </div>
      </dl>
      {steps.map((s) => (
        <div key={s.label} className={styles.step}>
          <p className={styles.stepLabel}>{s.label}</p>
          <pre className={styles.pre}>
            <code>{s.cmd}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
