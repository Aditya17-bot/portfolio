import type { ReactNode } from "react";
import styles from "./Glyph.module.css";

// Small drawings for the work cards. Each one shows the idea of its model or project, drawn from a fixed seed so
// the server renders the same picture every time. Lines with the "pulse" class animate while the card is hovered.

const W = 320;
const H = 180;

function rng(seed: string) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

function Mlp() {
  const cols = [6, 5, 5, 3].map((n, c) => Array.from({ length: n }, (_, i) => [50 + c * 73, H / 2 + (i - (n - 1) / 2) * 26] as [number, number]));
  const r = rng("mlp");
  return (
    <>
      {cols.slice(1).flatMap((col, c) =>
        col.flatMap((b, j) =>
          cols[c].map((a, i) => <line key={`${c}-${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={r() > 0.82 ? styles.hot : styles.edge} />),
        ),
      )}
      <path d={path([cols[0][2], cols[1][1], cols[2][3], cols[3][1]])} className={styles.pulse} />
      {cols.flat().map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={6} className={styles.node} />
      ))}
    </>
  );
}

const SEVEN = ["0111110", "0000010", "0000100", "0001000", "0010000", "0010000", "0010000"];

function CnnMnist() {
  const r = rng("cnn");
  return (
    <>
      {SEVEN.flatMap((row, y) => [...row].map((v, x) => <rect key={`${x}-${y}`} x={34 + x * 13} y={44 + y * 13} width={12} height={12} className={v === "1" ? styles.ink : styles.paper} />))}
      <path d="M134,90 L168,90" className={styles.pulse} />
      {Array.from({ length: 8 }, (_, k) => (
        <g key={k} transform={`translate(${178 + (k % 4) * 34},${46 + Math.floor(k / 4) * 46})`}>
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={(i % 4) * 7} y={Math.floor(i / 4) * 7} width={6.4} height={6.4} className={styles.cell} style={{ opacity: 0.15 + r() * 0.85 }} />
          ))}
        </g>
      ))}
    </>
  );
}

function Cifar() {
  const r = rng("cifar");
  return (
    <>
      {Array.from({ length: 64 }, (_, i) => (
        <rect key={i} x={96 + (i % 8) * 16} y={26 + Math.floor(i / 8) * 16} width={15} height={15} className={styles.grey} style={{ opacity: 0.25 + r() * 0.6 }} />
      ))}
      <circle cx={176} cy={98} r={46} className={styles.heat} />
      <circle cx={170} cy={92} r={24} className={styles.heatCore} />
      <rect x={96} y={26} width={128} height={128} className={styles.frame} />
    </>
  );
}

function Resnet() {
  const plain = Array.from({ length: 12 }, (_, i) => [40 + i * 22, 140 - i * 2 - (i > 5 ? (i - 5) ** 2 * 1.6 : 0)] as [number, number]);
  const res = Array.from({ length: 12 }, (_, i) => [40 + i * 22, 112 - Math.sin(i / 2) * 4] as [number, number]);
  return (
    <>
      <line x1={36} x2={290} y1={150} y2={150} className={styles.axis} />
      <path d={path(plain)} className={styles.greyLine} />
      <path d={path(res)} className={styles.cyanLine} />
      <text x={288} y={plain[11][1] - 6} textAnchor="end" className={styles.label}>
        plain: worse with depth
      </text>
      <text x={288} y={res[11][1] + 20} textAnchor="end" className={styles.labelCyan}>
        residual
      </text>
      {res.filter((_, i) => i % 2 === 0).map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 6} q 11,-20 22,0`} className={styles.skip} />
      ))}
      <path d={path(res)} className={styles.pulse} />
    </>
  );
}

function Vae() {
  const r = rng("vae");
  const centers: [number, number][] = [[80, 60], [150, 50], [230, 70], [100, 125], [180, 120], [255, 135], [140, 90]];
  return (
    <>
      {centers.flatMap(([cx, cy], k) =>
        Array.from({ length: 22 }, (_, i) => {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * 20;
          return <circle key={`${k}-${i}`} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d * 0.8} r={2.4} className={k === 6 ? styles.dotCyan : styles.dotGrey} />;
        }),
      )}
      <path d="M140,90 L180,120" className={styles.pulse} />
      <circle cx={180} cy={120} r={8} className={styles.cursor} />
    </>
  );
}

// 3x5 digit shapes; the generator's samples are drawn as these with a little noise.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];

function Dcgan() {
  const r = rng("gan");
  const order = [3, 7, 0, 5, 9, 2, 6, 1, 8, 4, 2, 7];
  return (
    <>
      {order.map((d, k) => (
        <g key={k} transform={`translate(${36 + (k % 6) * 44},${30 + Math.floor(k / 6) * 64})`}>
          {[...DIGITS[d]].map((v, i) => {
            const on = v === "1" ? r() > 0.08 : r() > 0.94;
            return <rect key={i} x={(i % 3) * 9} y={Math.floor(i / 3) * 9} width={8.4} height={8.4} rx={1.5} className={on ? styles.ink : styles.paper} style={{ opacity: on ? 0.55 + r() * 0.45 : 0.6 }} />;
          })}
        </g>
      ))}
    </>
  );
}

function demand(t: number) {
  return 0.35 + 0.25 * Math.exp(-((t - 0.62) ** 2) / 0.02) + 0.18 * Math.exp(-((t - 0.9) ** 2) / 0.01) - 0.1 * Math.exp(-((t - 0.2) ** 2) / 0.02);
}

function Lstm() {
  const pts = Array.from({ length: 60 }, (_, i) => [24 + (i / 59) * 272, 150 - demand(i / 59) * 160] as [number, number]);
  const fc = pts.map(([x, y], i) => [x, y + Math.sin(i * 1.7) * 3 + 2] as [number, number]);
  const sun = Array.from({ length: 30 }, (_, i) => [90 + i * 5, 158 - Math.sin((i / 29) * Math.PI) * 34] as [number, number]);
  return (
    <>
      <path d={`${path(sun)}L235,158L90,158Z`} className={styles.sun} />
      <path d={path(pts)} className={styles.whiteLine} />
      <path d={path(fc)} className={styles.amberDash} />
      <path d={path(pts.slice(30, 45))} className={styles.pulse} />
    </>
  );
}

function Gpt() {
  const r = rng("gpt");
  const n = 11;
  return (
    <>
      {Array.from({ length: n }, (_, i) =>
        Array.from({ length: i + 1 }, (_, j) => {
          const v = j === i ? 0.7 : r() ** 3;
          return <rect key={`${i}-${j}`} x={90 + j * 13} y={20 + i * 13} width={12} height={12} className={styles.attn} style={{ opacity: 0.08 + v * 0.92 }} />;
        }),
      )}
      <path d={`M${90 + 4 * 13 + 6},${20 + 10 * 13 + 6} L${90 + 10 * 13 + 6},${20 + 10 * 13 + 6}`} className={styles.pulse} />
    </>
  );
}

function Vit() {
  const r = rng("vit");
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => {
        const v = r();
        return (
          <g key={i}>
            <rect x={60 + (i % 4) * 34} y={22 + Math.floor(i / 4) * 34} width={32} height={32} className={styles.grey} style={{ opacity: 0.25 + r() * 0.4 }} />
            <rect x={60 + (i % 4) * 34} y={22 + Math.floor(i / 4) * 34} width={32} height={32} className={styles.patchHot} style={{ opacity: [5, 6, 10].includes(i) ? 0.55 + v * 0.35 : v > 0.85 ? 0.25 : 0 }} />
          </g>
        );
      })}
      <circle cx={250} cy={90} r={10} className={styles.cursor} />
      {[5, 6, 10].map((i) => (
        <line key={`s${i}`} x1={250} y1={90} x2={76 + (i % 4) * 34} y2={38 + Math.floor(i / 4) * 34} className={styles.hot} />
      ))}
      {[5, 6, 10].map((i) => (
        <path key={i} d={`M250,90 L${76 + (i % 4) * 34},${38 + Math.floor(i / 4) * 34}`} className={styles.pulse} />
      ))}
    </>
  );
}

function BlindAssist() {
  return (
    <>
      <rect x={70} y={18} width={180} height={144} rx={6} className={styles.frame} />
      {[1, 2].map((k) => (
        <g key={k}>
          <line x1={70 + k * 60} x2={70 + k * 60} y1={18} y2={162} className={styles.gridLine} />
          <line x1={70} x2={250} y1={18 + k * 48} y2={18 + k * 48} className={styles.gridLine} />
        </g>
      ))}
      <rect x={128} y={52} width={66} height={96} rx={3} className={styles.boxHot} />
      <rect x={202} y={92} width={36} height={40} rx={3} className={styles.boxOk} />
      <path d="M268,78 q 10,12 0,24 M278,70 q 18,20 0,40" className={styles.pulse} />
    </>
  );
}

function Gene() {
  const r = rng("gene");
  // A folded chain: a smooth curve that turns back on itself, so far-apart residues end up side by side.
  const pts: [number, number][] = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * Math.PI * 2.2;
    return [160 + 105 * Math.sin(t * 1.1) * Math.cos(t * 0.35), 90 + 58 * Math.sin(t * 1.9 + 0.6)] as [number, number];
  });
  const a = 9;
  const b = 37;
  return (
    <>
      <path d={path(pts)} className={styles.edge} />
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={4} className={r() > 0.55 ? styles.dotHot : styles.dotCool} />
      ))}
      <line x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} className={styles.amberDash} />
      <line x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} className={styles.pulse} />
      <circle cx={pts[a][0]} cy={pts[a][1]} r={6.5} className={styles.node} />
      <circle cx={pts[b][0]} cy={pts[b][1]} r={6.5} className={styles.node} />
    </>
  );
}

function Cab() {
  const temp = Array.from({ length: 30 }, (_, i) => [24 + i * 5, 140 - Math.min(70, i * 2.4)] as [number, number]);
  return (
    <>
      <line x1={22} x2={175} y1={70} y2={70} className={styles.limit} />
      <path d={path(temp)} className={styles.whiteLine} />
      <path d="M169,70 L180,64" className={styles.amberDash} />
      {[56, 34, 16].map((rad, i) => (
        <circle key={rad} cx={248} cy={92} r={rad} className={i === 0 ? styles.ring : i === 1 ? styles.ringWarn : styles.ringCrit} />
      ))}
      <rect x={241} y={83} width={14} height={18} rx={2} className={styles.machine} />
      <circle cx={248} cy={56} r={5} className={styles.workerDot} />
      <circle cx={248} cy={92} r={56} className={styles.sweep} />
    </>
  );
}

function Voice() {
  const lanes: [number, number][][] = [[[0, 0.3]], [[0.3, 0.42]], [[0.42, 0.54]], [[0.54, 0.7], [0.7, 0.8], [0.8, 0.9]], [[0.75, 0.9], [0.9, 0.98]]];
  return (
    <>
      {lanes.map((segs, l) =>
        segs.map(([a, b], k) => (
          <rect key={`${l}-${k}`} x={30 + a * 260} y={24 + l * 28} width={(b - a) * 260 - 2} height={18} rx={3} className={[styles.barA, styles.barB, styles.barC, styles.barD, styles.barE][l]} />
        )),
      )}
      <line x1={30 + 0.75 * 260} x2={30 + 0.75 * 260} y1={18} y2={164} className={styles.pulse} />
    </>
  );
}

function Amazon() {
  const rec = (x: number, y: number) => (
    <g>
      <rect x={x} y={y} width={92} height={40} rx={5} className={styles.record} />
      <line x1={x + 10} x2={x + 70} y1={y + 14} y2={y + 14} className={styles.textLine} />
      <line x1={x + 10} x2={x + 52} y1={y + 27} y2={y + 27} className={styles.textLineDim} />
    </g>
  );
  return (
    <>
      {rec(30, 70)}
      {rec(196, 24)}
      {rec(196, 70)}
      {rec(196, 116)}
      <path d="M122,90 L196,44" className={styles.edge} />
      <path d="M122,90 L196,90" className={styles.pulse} />
      <path d="M122,90 L196,136" className={styles.decoy} />
    </>
  );
}

function Fraud() {
  // Share of fraud caught against share of transactions flagged (log scale), as on the fraud page.
  const x = (f: number) => 40 + f * 240;
  const y = (v: number) => 150 - v * 120;
  const rf = Array.from({ length: 40 }, (_, i) => [x(i / 39), y(1 - Math.exp(-(((i / 39) * 9) ** 2)))] as [number, number]);
  const iso = Array.from({ length: 40 }, (_, i) => [x(i / 39), y((i / 39) ** 2.2)] as [number, number]);
  return (
    <>
      <line x1={40} x2={280} y1={150} y2={150} className={styles.axis} />
      <line x1={40} x2={40} y1={30} y2={150} className={styles.axis} />
      <path d={`M${x(0)},${y(0)}L${x(1)},${y(1)}`} className={styles.edge} />
      <path d={path(iso)} className={styles.cyanLine} />
      <path d={path(rf)} className={styles.amberLine} />
      <line x1={x(0.32)} x2={x(0.32)} y1={30} y2={150} className={styles.gridLine} />
      <circle cx={x(0.32)} cy={rf[12][1]} r={5.5} className={styles.cursor} />
      <path d={path(rf.slice(2, 14))} className={styles.pulse} />
    </>
  );
}

const GLYPHS: Record<string, () => ReactNode> = {
  "mlp-numpy": Mlp,
  "cnn-mnist": CnnMnist,
  "cnn-cifar10": Cifar,
  "resnet-cifar10": Resnet,
  "vae-mnist": Vae,
  "dcgan-mnist": Dcgan,
  "lstm-load": Lstm,
  "mini-gpt": Gpt,
  "vit-cifar10": Vit,
  blindassist: BlindAssist,
  "gene-anomaly": Gene,
  caterpillar: Cab,
  "voice-assistant": Voice,
  "amazon-ml-challenge": Amazon,
  fraud: Fraud,
};

export function Glyph({ id }: { id: string }) {
  const Draw = GLYPHS[id];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.glyph} aria-hidden="true">
      <defs>
        <pattern id={`grid-${id}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16,0 L0,0 0,16" className={styles.bgGrid} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#grid-${id})`} />
      {Draw ? <Draw /> : null}
    </svg>
  );
}

export const hasGlyph = (id: string) => id in GLYPHS;
