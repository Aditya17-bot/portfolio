import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { modelBySlug } from "@/content/models";
import styles from "../content.module.css";

export const metadata: Metadata = {
  title: "Learn",
  description: "A reading path through deep learning, one idea per model, each with a network you can run next to it.",
};

// Each lesson is the "How it works" part of a model page; the model is the worked example.
const lessons = [
  {
    slug: "mlp-numpy",
    anchor: "how",
    idea: "Neurons, layers and backpropagation",
    question: "How does a network turn pixels into a guess, and how does a wrong guess change its weights?",
  },
  {
    slug: "cnn-mnist",
    anchor: "how",
    idea: "Convolutions",
    question: "Why does sliding one small filter over the image beat a weight for every pixel, with 14× fewer parameters?",
  },
  {
    slug: "cnn-cifar10",
    anchor: "how",
    idea: "Where the model looked",
    question: "How can a classifier point at the part of a photo that decided its answer, without any gradients?",
  },
  {
    slug: "resnet-cifar10",
    anchor: "gradients",
    idea: "Depth and skip connections",
    question: "Why does a deeper plain network train worse, and what does one identity shortcut change?",
  },
  {
    slug: "vae-mnist",
    anchor: "how",
    idea: "Learning a space instead of a label",
    question: "What does a model need so that every point between two digits decodes to something sensible?",
  },
  {
    slug: "mini-gpt",
    anchor: "how",
    idea: "Attention",
    question: "How does a transformer decide which earlier characters matter for the next one?",
  },
];

export default function Page() {
  const live = lessons.filter((l) => modelBySlug(l.slug)?.status === "live");
  return (
    <>
      <PageIntro eyebrow="Explainers" title="Learn">
        <p>
          A path through deep learning, one idea at a time. Each idea is explained on the page of the model that
          needs it, next to a version of that model you can run.
        </p>
      </PageIntro>
      <div className="container">
        <section className={styles.section} aria-labelledby="path">
          <div className={styles.sectionHead}>
            <h2 id="path">The path</h2>
            <span className={styles.sectionNote}>{live.length} ideas so far</span>
          </div>
          <ol className={styles.stack} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {live.map((l, i) => {
              const m = modelBySlug(l.slug)!;
              return (
                <li key={l.slug} className={styles.compact} data-testid="lesson">
                  <p className={styles.meta}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>{m.title}</span>
                  </p>
                  <h3 className={styles.title}>
                    <Link href={`/models/${l.slug}#${l.anchor}`} className={styles.titleLink}>
                      {l.idea}
                    </Link>
                  </h3>
                  <p className={styles.tagline}>{l.question}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
