import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/content/site";
import { MlpPlayground } from "@/components/ml/MlpPlayground";
import { LayerReadout } from "./LayerReadout";
import meta from "../../../public/models/mlp/meta.json";

const acc = (meta.results.test_acc * 100).toFixed(2);

export type Chapter = {
  id: string;
  layer: string;
  title: ReactNode;
  body: ReactNode;
  extra?: ReactNode;
  links?: { href: string; label: string; external?: boolean }[];
};

// One chapter per camera stop, in the order the signal travels.
export const chapters: Chapter[] = [
  {
    id: "start",
    layer: "Aditya Sridhar · Machine learning",
    title: (
      <>
        Models you can run,
        <br />
        not just read about.
      </>
    ),
    body: (
      <p>
        I train neural networks from scratch and put them where you can push on them. The one behind this text is
        real: trained on MNIST, running in your browser now. Scroll to follow a forward pass, or draw it a digit.
      </p>
    ),
  },
  {
    id: "input",
    layer: "Layer 1 · input · 784 pixels",
    title: "Where it starts",
    body: (
      <p>
        Computer Science and Engineering at VIT Vellore, graduating 2027. Every network starts with a grid of
        numbers: 784 pixels. Right now this one is reading about me. Draw a digit below and it reads yours instead.
      </p>
    ),
    extra: <MlpPlayground variant="hero" linkHero />,
    links: [{ href: "/about", label: "About me" }],
  },
  {
    id: "models",
    layer: "Layer 2 · hidden · 128 neurons",
    title: "A model zoo, all trained here",
    body: (
      <p>
        From an MLP written in NumPy to CNNs, ResNets and a small GPT. Each one is trained from scratch, every number
        names the run it came from, and each one runs in your browser.
      </p>
    ),
    extra: <LayerReadout layer={1} />,
    links: [{ href: "/models", label: "Open the zoo" }],
  },
  {
    id: "work",
    layer: "Layer 3 · hidden · 64 neurons",
    title: "Projects, papers, patents",
    body: (
      <p>
        An offline navigation aid for visually impaired users, a first-author paper at SIPCOV-2026 and a second
        under revision, two published patent applications and seven more filed.
      </p>
    ),
    extra: <LayerReadout layer={2} />,
    links: [
      { href: "/projects", label: "Projects" },
      { href: "/research", label: "Research" },
    ],
  },
  {
    id: "open-source",
    layer: "Layer 4 · output · 10 classes",
    title: "Fixes that shipped",
    body: (
      <p>
        Merged pull requests in Kornia, Hugging Face timm and deepset Haystack: the bug, the cause, the fix and the
        test that keeps it fixed.
      </p>
    ),
    extra: <LayerReadout layer={3} />,
    links: [{ href: "/open-source", label: "Contributions" }],
  },
  {
    id: "contact",
    layer: "Prediction",
    title: "That was one forward pass.",
    body: (
      <p>
        784 → 128 → 64 → 10, trained in NumPy with backpropagation written by hand: {acc}% on the 10,000 MNIST test
        digits. The strongest connections are drawn. If you want to talk about the work, write to me.
      </p>
    ),
    links: [
      { href: "/models/mlp-numpy", label: "How it was trained" },
      { href: `mailto:${site.email}`, label: "Email", external: true },
      { href: site.github, label: "GitHub", external: true },
      { href: site.linkedin, label: "LinkedIn", external: true },
    ],
  },
];

export function ChapterLinks({ links }: { links: NonNullable<Chapter["links"]> }) {
  return (
    <p data-links="">
      {links.map((l) =>
        l.external ? (
          <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {l.label} ↗
          </a>
        ) : (
          <Link key={l.href} href={l.href}>
            {l.label} →
          </Link>
        ),
      )}
    </p>
  );
}
