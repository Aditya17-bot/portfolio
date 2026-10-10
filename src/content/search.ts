import { models } from "./models";
import { pullRequests } from "./openSource";
import { featured, more } from "./projects";
import { papers, patents } from "./research";
import { nav, site } from "./site";

export type Action = "theme" | "copy-email";

export type SearchItem = {
  id: string;
  group: "Pages" | "Models" | "Projects" | "Research" | "Open source" | "Actions";
  title: string;
  hint: string;
  /** A path on this site, an external URL, or nothing for an action. */
  href?: string;
  action?: Action;
  keywords?: string;
};

/** Everything the command palette can jump to, built from the same content the pages render. */
export function searchIndex(): SearchItem[] {
  const items: SearchItem[] = [
    { id: "page-home", group: "Pages", title: "Home", hint: "The network in the hero", href: "/" },
    ...nav.map((n) => ({ id: `page-${n.href}`, group: "Pages" as const, title: n.label, hint: n.blurb, href: n.href })),
    ...models
      .filter((m) => m.status === "live")
      .map((m) => ({
        id: `model-${m.slug}`,
        group: "Models" as const,
        title: m.title,
        hint: `${m.family} · ${m.dataset}`,
        href: `/models/${m.slug}`,
        keywords: m.summary,
      })),
    { id: "demo-blindassist", group: "Projects", title: "BlindAssist demo", hint: "Both detectors and the decision rules on your camera or photos", href: "/projects/blindassist", keywords: "blind assist yolo camera webcam obstacle door" },
    { id: "demo-gene", group: "Projects", title: "Protein impact explorer", hint: "A gene's AlphaFold structure coloured by AlphaMissense, live", href: "/projects/gene-anomaly", keywords: "gene protein alphafold alphamissense mutation 3d hackathon" },
    { id: "demo-operator", group: "Projects", title: "Operator cab simulator", hint: "Safety rules, overheat forecast and speed advisor on a machine you drive", href: "/projects/caterpillar", keywords: "excavator caterpillar safety seatbelt overheat machine operator" },
    { id: "demo-voice", group: "Projects", title: "Voice assistant demo", hint: "One spoken turn replayed stage by stage: streaming, fillers, barge-in", href: "/projects/voice-assistant", keywords: "voice speech whisper llm tts streaming barge-in offline" },
    { id: "demo-amazon", group: "Projects", title: "Entity matcher walk-through", hint: "Normalisation, similarity features and decoy checks on records you type", href: "/projects/amazon-ml-challenge", keywords: "amazon entity resolution matching records decoy business" },
    { id: "study-fraud", group: "Projects", title: "Fraud alert budget", hint: "Random forest vs isolation forest, interactive", href: "/projects/fraud", keywords: "fraud detection card transactions sparkov threshold precision recall" },
    ...[...featured, ...more].map((p) => ({
      id: `project-${p.slug}`,
      group: "Projects" as const,
      title: p.title,
      hint: p.tagline,
      href: `/projects#${p.slug}`,
      keywords: p.stack.join(" "),
    })),
    { id: "patent-lab-wearable", group: "Research", title: "Wearable navigation patent, explained", hint: "Threat ranking and announcement scheduling you can play with", href: "/research/patents/wearable-navigation", keywords: "patent wearable blind navigation threat scheduler" },
    { id: "patent-lab-fusion", group: "Research", title: "Sensor fusion patent, explained", hint: "Pairwise index for hazards no single sensor sees", href: "/research/patents/sensor-fusion", keywords: "patent sensor fusion gas hazard laboratory safety" },
    { id: "study-solar", group: "Research", title: "Solar-aware forecasting", hint: "The paper's idea rerun on public Delhi data, interactive", href: "/research/solar-forecasting", keywords: "lightgbm lstm load demand delhi sun duck curve" },
    ...papers.map((p, i) => ({ id: `paper-${i}`, group: "Research" as const, title: p.title, hint: `${p.venueShort} · ${p.status}`, href: "/research#papers" })),
    ...patents.map((p, i) => ({
      id: `patent-${i}`,
      group: "Research" as const,
      title: p.title,
      hint: p.number ? `Patent application ${p.number} · ${p.status}` : `Patent application · ${p.status}`,
      href: p.number ? "/research#patents" : "/research#filed",
      keywords: "patent",
    })),
    ...pullRequests.map((pr) => ({
      id: `pr-${pr.repo}-${pr.number}`,
      group: "Open source" as const,
      title: pr.title,
      hint: `${pr.repo} #${pr.number} · ${pr.state}`,
      href: `https://github.com/${pr.repo}/pull/${pr.number}`,
      keywords: `${pr.repoBlurb} pull request`,
    })),
    { id: "action-theme", group: "Actions", title: "Switch light / dark theme", hint: "Theme", action: "theme", keywords: "dark light mode colour color" },
    { id: "action-email", group: "Actions", title: "Copy email address", hint: site.email, action: "copy-email", keywords: "contact mail" },
    { id: "action-resume", group: "Actions", title: "Open resume (PDF)", hint: "Resume", href: "/Aditya_Sridhar_Resume.pdf", keywords: "cv resume pdf" },
    { id: "action-github", group: "Actions", title: "GitHub profile", hint: "github.com/Aditya17-bot", href: site.github, keywords: "code repositories" },
    { id: "action-linkedin", group: "Actions", title: "LinkedIn profile", hint: "LinkedIn", href: site.linkedin, keywords: "contact" },
  ];
  return items;
}
