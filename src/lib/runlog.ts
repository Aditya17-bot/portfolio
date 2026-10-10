import { readFileSync } from "node:fs";
import path from "node:path";

export type LogRow = Record<string, number>;

/** Read a training log CSV committed in the repo. Server-only; runs at build time. */
export function readLog(relPath: string): LogRow[] {
  const text = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), relPath), "utf8").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, Number(cells[i])]));
  });
}

export const pct = (x: number, digits = 2) => `${(x * 100).toFixed(digits)}%`;
