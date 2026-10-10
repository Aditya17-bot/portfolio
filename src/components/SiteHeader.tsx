import Link from "next/link";
import { nav, site } from "@/content/site";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 20 20" width="20" height="20">
              <circle cx="4" cy="5" r="2" />
              <circle cx="4" cy="15" r="2" />
              <circle cx="16" cy="10" r="2.4" />
              <path d="M5.6 5.8 13.9 9.2M5.6 14.2 13.9 10.8" />
            </svg>
          </span>
          {site.name}
        </Link>
        <NavLinks items={nav} />
        <ThemeToggle />
      </div>
    </header>
  );
}
