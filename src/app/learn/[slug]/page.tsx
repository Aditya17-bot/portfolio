import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttentionLab } from "@/components/learn/AttentionLab";
import { BackpropLab } from "@/components/learn/BackpropLab";
import { ConvLab } from "@/components/learn/ConvLab";
import { OverfitLab } from "@/components/learn/OverfitLab";
import { ResidualLab, type Run } from "@/components/learn/ResidualLab";
import { LatentExplorer } from "@/components/ml/LatentExplorer";
import { ModelHeader, Section } from "@/components/ml/ModelLayout";
import { explainerBySlug, explainers } from "@/content/learn";
import { readLog } from "@/lib/runlog";
import gradients from "../../../../training/resnet_cifar10/gradients.json";
import styles from "./learn.module.css";

export function generateStaticParams() {
  return explainers.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const e = explainerBySlug((await params).slug);
  return e ? { title: `${e.title}, explained`, description: e.question } : {};
}

function residualRuns(): Run[] {
  return (["plain-20", "plain-56", "resnet-20", "resnet-56"] as const).map((name) => {
    const rows = readLog(`training/resnet_cifar10/${name}.csv`);
    return {
      name,
      depth: Number(name.split("-")[1]),
      residual: name.startsWith("resnet"),
      trainLoss: rows.map((r) => r.train_loss),
      testAcc: rows.map((r) => r.test_acc),
      grads: gradients[name],
    };
  });
}

export default async function Page({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const e = explainerBySlug(slug);
  if (!e) notFound();
  const i = explainers.indexOf(e);
  const next = explainers[i + 1];
  const lab =
    slug === "backprop" ? <BackpropLab /> :
    slug === "convolution" ? <ConvLab /> :
    slug === "residual" ? <ResidualLab runs={residualRuns()} /> :
    slug === "attention" ? <AttentionLab /> :
    slug === "latent" ? <LatentExplorer /> :
    <OverfitLab />;

  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/learn", label: "Learn" }}
        kind={`Explainer ${i + 1} of ${explainers.length}`}
        badge="interactive"
        family={e.title}
        date={e.group}
        title={e.title}
        lede={<p>{e.question}</p>}
        stats={[]}
      />

      <Section title="Watch" id="watch">
        <video className={styles.video} src={`/learn/${slug}.mp4`} poster={`/learn/${slug}.jpg`} controls autoPlay muted loop playsInline preload="metadata" data-testid="learn-video" />
      </Section>

      <Section title="The idea" id="idea">
        <div className="prose">
          {e.idea.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>

      <Section title="Try it" id="try">
        {lab}
      </Section>

      <Section title="See it trained" id="trained">
        <div className={styles.links}>
          <Link href={`/models/${e.model.slug}`} className={styles.card}>
            <span>Trained for real</span>
            <strong>Open {e.model.label} →</strong>
          </Link>
          {next ? (
            <Link href={`/learn/${next.slug}`} className={styles.card} data-testid="learn-next">
              <span>Next idea</span>
              <strong>{next.title} →</strong>
            </Link>
          ) : (
            <Link href="/learn" className={styles.card}>
              <span>That was the last one</span>
              <strong>Back to all explainers →</strong>
            </Link>
          )}
        </div>
      </Section>
    </article>
  );
}
