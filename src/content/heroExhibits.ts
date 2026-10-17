// The work shown inside the hero network: named neurons in the two hidden layers, and the
// libraries the output layer ships into. Numbers come from the same files as the index pages.
import { MODEL_HEADLINE, PROJECT_CARDS } from "./headlines";
import { models } from "./models";
import { pullRequests } from "./openSource";
import { featured, more } from "./projects";
import { papers, patents } from "./research";

export type Exhibit = { id: string; title: string; detail: string; href: string };

const SHORT_MODEL: Record<string, string> = {
  "mlp-numpy": "MLP in NumPy",
  "cnn-mnist": "Small CNN",
  "cnn-cifar10": "CIFAR-10 CNN",
  "resnet-cifar10": "ResNet-56",
  "vae-mnist": "VAE",
  "dcgan-mnist": "DCGAN",
  "lstm-load": "LSTM forecaster",
  "mini-gpt": "Mini-GPT",
  "vit-cifar10": "ViT-Tiny",
};

const SHORT_PROJECT: Record<string, string> = {
  blindassist: "BlindAssist",
  "amazon-ml-challenge": "Amazon ML Challenge",
  "voice-assistant": "Offline voice assistant",
  "gene-anomaly": "Protein impact explorer",
  caterpillar: "Smart operator cab",
  fraud: "Fraud detection",
};

// Shorter metric labels than the cards use: a tag inside the network has room for a few words.
const SHORT_LABEL: Record<string, string> = {
  "resnet-cifar10": "from skip connections",
  "dcgan-mnist": "of 3.32 bits spread",
  blindassist: "direction accuracy",
  "amazon-ml-challenge": "rank of 89,000+",
  "voice-assistant": "to the first word",
  "gene-anomaly": "Code for Life, VIT",
  caterpillar: "overheat warning",
  fraud: "PR-AUC, unseen months",
};

/** Hidden layer 1, 128 neurons: the model zoo. */
export const modelExhibits: Exhibit[] = models
  .filter((m) => m.status === "live" && MODEL_HEADLINE[m.slug])
  .map((m) => {
    const { value, label } = MODEL_HEADLINE[m.slug].metric;
    const detail = `${value} ${SHORT_LABEL[m.slug] ?? label}`;
    return { id: m.slug, title: SHORT_MODEL[m.slug] ?? m.title, detail, href: `/models/${m.slug}` };
  });

const published = patents.filter((p) => p.status === "Published").length;
const filed = patents.length - published;

/** Hidden layer 2, 64 neurons: projects, papers and patents. */
export const workExhibits: Exhibit[] = [
  ...[...featured, ...more]
    .filter((p) => PROJECT_CARDS[p.slug] && p.demo?.href.startsWith("/"))
    .map((p) => {
      const { value, label } = PROJECT_CARDS[p.slug].metric;
      const detail = `${value} ${SHORT_LABEL[p.slug] ?? label}`;
      return { id: p.slug, title: SHORT_PROJECT[p.slug] ?? p.title, detail, href: p.demo!.href };
    }),
  ...papers.map((p) => ({
    id: `paper-${p.venueShort}`,
    title: `${p.venueShort} paper`,
    detail: `${p.status}, ${p.role.toLowerCase()}`,
    href: "/research#papers",
  })),
  {
    id: "patents",
    title: "Patents",
    detail: `${published} published, ${filed} more filed`,
    href: "/research#patents",
  },
];

const LIBRARY: Record<string, string> = {
  "kornia/kornia": "Kornia",
  "huggingface/pytorch-image-models": "timm",
  "deepset-ai/haystack": "Haystack",
  "qdrant/fastembed": "fastembed",
  "dottxt-ai/outlines": "Outlines",
  "stanfordnlp/dspy": "DSPy",
  "unit8co/darts": "Darts",
};

/** Beyond the output layer: the libraries the fixes shipped into, merged first. */
export const libraryExhibits: Exhibit[] = (() => {
  const byRepo = new Map<string, { merged: number; open: number }>();
  for (const pr of pullRequests) {
    const r = byRepo.get(pr.repo) ?? { merged: 0, open: 0 };
    r[pr.state === "merged" ? "merged" : "open"]++;
    byRepo.set(pr.repo, r);
  }
  return [...byRepo.entries()]
    .sort((a, b) => b[1].merged - a[1].merged || b[1].open - a[1].open)
    .map(([repo, r]) => ({
      id: repo,
      title: LIBRARY[repo] ?? repo.split("/")[1],
      detail: [r.merged ? `${r.merged} merged` : "", r.open ? `${r.open} in review` : ""].filter(Boolean).join(", "),
      href: r.merged ? "/open-source#merged" : "/open-source#review",
    }));
})();
