import type { ReactNode } from "react";
import styles from "./PageIntro.module.css";

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className={`container ${styles.intro}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {children ? <div className={styles.lede}>{children}</div> : null}
    </header>
  );
}
