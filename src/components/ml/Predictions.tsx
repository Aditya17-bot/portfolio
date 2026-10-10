import styles from "./Predictions.module.css";

/** Ten probability bars, the top class highlighted. */
export function Predictions({ probs, compact = false }: { probs: ArrayLike<number> | null; compact?: boolean }) {
  const list = probs ? Array.from(probs) : null;
  const top = list ? list.indexOf(Math.max(...list)) : -1;
  return (
    <div className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap} data-testid="predictions">
      <p className={styles.verdict} aria-live="polite">
        {list ? (
          <>
            Reads <strong data-testid="prediction">{top}</strong>{" "}
            <span className={styles.conf}>{(list[top] * 100).toFixed(1)}%</span>
          </>
        ) : (
          <span className={styles.conf}>Waiting for a digit</span>
        )}
      </p>
      <ol className={styles.bars} aria-label="Probability per digit">
        {Array.from({ length: 10 }, (_, d) => {
          const p = list ? list[d] : 0;
          return (
            <li key={d} data-top={d === top || undefined}>
              <span className={styles.digit}>{d}</span>
              <span className={styles.track}>
                <span className={styles.fill} style={{ transform: `scaleX(${p})` }} />
              </span>
              <span className={styles.pct}>{list ? `${(p * 100).toFixed(1)}%` : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
