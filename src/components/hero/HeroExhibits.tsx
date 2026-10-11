"use client";

import Link from "next/link";
import { heroPass } from "@/lib/heroPass";
import { libraryExhibits, modelExhibits, workExhibits, type Exhibit } from "@/content/heroExhibits";
import styles from "./HeroExhibits.module.css";

/** Every label shown inside the network, grouped by the layer it lives in. */
export const EXHIBIT_GROUPS: { layer: number; stop: number; items: Exhibit[] }[] = [
  { layer: 1, stop: 2, items: modelExhibits },
  { layer: 2, stop: 3, items: workExhibits },
  { layer: 4, stop: 4, items: libraryExhibits },
];

function point(id: string | null) {
  heroPass.focus = id ? (heroPass.anchors.get(id) ?? null) : null;
  heroPass.invalidate();
}

/**
 * Labels pinned to neurons of the 3D network. They start hidden; the scene places each one
 * over its neuron every frame, sets where its tag sits (--tx, --ty) and the leader line to it
 * (--la, --ll), and shows it while the camera is at that layer.
 */
export function HeroExhibits() {
  return (
    <div className={styles.layer} data-testid="hero-exhibits">
      {EXHIBIT_GROUPS.flatMap((g) =>
        g.items.map((ex) => (
          <Link
            key={ex.id}
            href={ex.href}
            className={styles.exhibit}
            data-layer={g.layer}
            data-exhibit={ex.id}
            ref={(el) => {
              if (el) heroPass.labels.set(ex.id, el);
              else heroPass.labels.delete(ex.id);
            }}
            onPointerEnter={() => point(ex.id)}
            onPointerLeave={() => point(null)}
            onFocus={() => point(ex.id)}
            onBlur={() => point(null)}
          >
            <span className={styles.ring} aria-hidden="true" />
            <span className={styles.leader} aria-hidden="true" />
            <span className={styles.tag}>
              <strong>{ex.title}</strong>
              <span>{ex.detail}</span>
            </span>
          </Link>
        )),
      )}
    </div>
  );
}
