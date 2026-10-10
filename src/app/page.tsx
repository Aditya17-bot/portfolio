import Link from "next/link";
import { nav } from "@/content/site";
import { NetworkHero } from "@/components/hero/NetworkHero";
import styles from "./home.module.css";

export default function Home() {
  return (
    <>
      <NetworkHero />

      <section className={`container ${styles.indexSection}`} aria-labelledby="layers-title">
        <h2 id="layers-title" className="eyebrow">
          Index
        </h2>
        <ol className={styles.layers}>
          {nav.map((item, i) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.layer}>
                <span className={styles.index}>L{i + 1}</span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.blurb}>{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
