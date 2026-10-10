import Link from "next/link";
import { nav } from "@/content/site";
import styles from "./home.module.css";

export default function Home() {
  return (
    <>
      <section className={`container ${styles.hero}`} aria-labelledby="hero-title">
        <p className="eyebrow">Aditya Sridhar · Machine learning</p>
        <h1 id="hero-title" className={styles.title}>
          Models you can run,
          <br />
          not just read about.
        </h1>
        <p className={styles.lede}>
          I train neural networks from scratch and put them where you can push on them. Everything here runs in
          your browser, and every number names the run it came from.
        </p>
        <div className={styles.heroSlot} data-testid="hero-slot" aria-hidden="true" />
      </section>

      <section className="container" aria-labelledby="layers-title">
        <h2 id="layers-title" className="eyebrow">
          Layers
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
