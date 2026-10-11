"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChapterLinks, chapters } from "./chapters";
import { HeroExhibits } from "./HeroExhibits";
import { heroPass } from "@/lib/heroPass";
import styles from "./NetworkHero.module.css";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(motionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function NetworkHero() {
  const section = useRef<HTMLElement>(null);
  const chapterEls = useRef<(HTMLElement | null)[]>([]);
  const progress = useRef(0);
  const [running, setRunning] = useState(true);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => true,
  );

  // Scroll position, measured in chapters: 2.5 means halfway between chapter 2 and 3.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      const centres = chapterEls.current.map((el) => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let p = 0;
      if (mid <= centres[0]) p = 0;
      else if (mid >= centres[centres.length - 1]) p = centres.length - 1;
      else {
        for (let i = 0; i < centres.length - 1; i++) {
          if (mid >= centres[i] && mid <= centres[i + 1]) {
            p = i + (mid - centres[i]) / (centres[i + 1] - centres[i]);
            break;
          }
        }
      }
      progress.current = p;
      heroPass.cards = chapterEls.current.flatMap((el) => {
        const card = el?.firstElementChild;
        return card ? [card.getBoundingClientRect()] : [];
      });
      const active = Math.round(p);
      chapterEls.current.forEach((el, i) => el?.toggleAttribute("data-active", i === active));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Stop rendering once the hero is off screen.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={section} className={styles.hero} aria-label="Introduction" data-testid="hero">
      <div className={styles.stage}>
        {webgl ? (
          <HeroCanvas progress={progress} running={running} reducedMotion={reducedMotion} />
        ) : (
          <div className={styles.fallback} data-testid="hero-fallback" />
        )}
        <div className={styles.scrim} aria-hidden="true" />
        {webgl && !reducedMotion ? <HeroExhibits /> : null}
      </div>

      <div className={styles.chapters}>
        {chapters.map((c, i) => (
          <article
            key={c.id}
            ref={(el) => {
              chapterEls.current[i] = el;
            }}
            className={styles.chapter}
            data-chapter={c.id}
          >
            <div className={styles.card}>
              <p className={styles.layer}>{c.layer}</p>
              {i === 0 ? <h1 className={styles.title}>{c.title}</h1> : <h2 className={styles.heading}>{c.title}</h2>}
              <div className={styles.body}>{c.body}</div>
              {c.extra}
              {c.links ? <ChapterLinks links={c.links} /> : null}
              {i === 0 ? (
                <p className={styles.hint} aria-hidden="true">
                  scroll ↓
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
