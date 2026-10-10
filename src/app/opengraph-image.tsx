import { ImageResponse } from "next/og";
import { models } from "@/content/models";

export const alt = "Aditya Sridhar: machine learning models trained from scratch and runnable in the browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A small drawn network: three layers of nodes joined by faint edges, the site's hero in miniature.
const layers = [4, 6, 6, 3];

export default function Image() {
  const live = models.filter((m) => m.status === "live").length;
  const W = 460;
  const H = 400;
  const nodes = layers.map((n, l) =>
    Array.from({ length: n }, (_, i) => ({ x: 30 + (l * (W - 60)) / (layers.length - 1), y: H / 2 + (i - (n - 1) / 2) * 62 })),
  );
  const edges = nodes.slice(1).flatMap((layer, l) => layer.flatMap((b) => nodes[l].map((a) => ({ a, b }))));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#05070d", color: "#e6eaf2", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, color: "#5ce1e6", letterSpacing: 2 }}>ADITYASRIDHAR.VERCEL.APP</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>Aditya Sridhar</div>
            <div style={{ fontSize: 34, color: "#9aa3b5", marginTop: 20, lineHeight: 1.3, maxWidth: 560 }}>
              {`${live} neural networks trained from scratch, running in your browser.`}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#f5a524" }}>Research · Patents · Open source</div>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ alignSelf: "center" }}>
          {edges.map(({ a, b }, i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i % 7 === 0 ? "#f5a524" : "#5ce1e6"} strokeOpacity={i % 7 === 0 ? 0.7 : 0.18} strokeWidth={2} />
          ))}
          {nodes.flat().map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={11} fill="#05070d" stroke="#5ce1e6" strokeWidth={3} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
