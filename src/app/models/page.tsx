import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { WorkGrid, type WorkItem } from "@/components/work/WorkGrid";
import { models } from "@/content/models";
import cifar from "../../../public/models/cnn-cifar10/meta.json";
import cnn from "../../../public/models/cnn-mnist/meta.json";
import dcgan from "../../../public/models/dcgan-mnist/meta.json";
import lstm from "../../../public/models/lstm-load/meta.json";
import gpt from "../../../public/models/mini-gpt/meta.json";
import mlp from "../../../public/models/mlp/meta.json";
import plain56 from "../../../public/models/resnet-cifar10/plain-56.json";
import resnet56 from "../../../public/models/resnet-cifar10/resnet-56.json";
import vae from "../../../public/models/vae-mnist/meta.json";
import vit from "../../../public/models/vit-cifar10/meta.json";

export const metadata: Metadata = {
  title: "Models",
  description: "Nine neural networks trained from scratch, each one running in your browser, with the run behind every number.",
};

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const n = (v: number) => v.toLocaleString("en-US");

// The headline number of each model, read from its own run.
const HEADLINE: Record<string, { group: string; metric: WorkItem["metric"]; facts: string[] }> = {
  "mlp-numpy": { group: "Vision", metric: { value: pct(mlp.results.test_acc), label: "test accuracy" }, facts: ["MNIST", `${n(mlp.params)} parameters`, "NumPy only"] },
  "cnn-mnist": { group: "Vision", metric: { value: pct(cnn.results.test_acc), label: "test accuracy" }, facts: ["MNIST", `${n(cnn.params)} parameters`] },
  "cnn-cifar10": { group: "Vision", metric: { value: pct(cifar.results.test_acc), label: "test accuracy" }, facts: ["CIFAR-10", `${n(cifar.params)} parameters`] },
  "resnet-cifar10": {
    group: "Vision",
    metric: { value: `+${((resnet56.test_acc - plain56.test_acc) * 100).toFixed(1)} pts`, label: "from skip connections at 56 layers" },
    facts: ["CIFAR-10", `${pct(resnet56.test_acc)} vs ${pct(plain56.test_acc)}`],
  },
  "vae-mnist": { group: "Generative", metric: { value: vae.results.test_elbo.toFixed(1), label: "nats, test ELBO" }, facts: ["MNIST", `${n(vae.params)} parameters`, "2-D latent"] },
  "dcgan-mnist": {
    group: "Generative",
    metric: { value: `${dcgan.results.class_entropy_bits.toFixed(2)} bits`, label: "spread over 10 digits, of 3.32" },
    facts: ["MNIST", `${n(dcgan.params)} parameters`],
  },
  "lstm-load": { group: "Sequence", metric: { value: `${lstm.results.test_mape.toFixed(2)}%`, label: "error, an hour ahead" }, facts: ["Delhi 2024", `${n(lstm.params)} parameters`] },
  "mini-gpt": { group: "Sequence", metric: { value: gpt.results.val_bits_per_char.toFixed(2), label: "bits per character" }, facts: ["Shakespeare", `${n(gpt.params)} parameters`] },
  "vit-cifar10": { group: "Vision", metric: { value: pct(vit.results.test_acc), label: "test accuracy" }, facts: ["CIFAR-10", `${n(vit.params)} parameters`] },
};

export default function Page() {
  const items: WorkItem[] = models
    .filter((m) => m.status === "live" && HEADLINE[m.slug])
    .map((m, i) => ({
      id: m.slug,
      href: `/models/${m.slug}`,
      title: m.title,
      kind: m.family,
      summary: m.summary,
      status: "Runs in your browser",
      date: m.date,
      step: i + 1,
      ...HEADLINE[m.slug],
    }));
  return (
    <>
      <PageIntro eyebrow="Model zoo" title="Models">
        <p>
          A ladder of networks, each one introducing the problem the next exists to solve. Every one is trained from
          scratch and runs in your browser; each page shows the run behind its numbers and the command that
          reproduces it.
        </p>
      </PageIntro>
      <div className="container">
        <WorkGrid items={items} groups={["Vision", "Generative", "Sequence"]} label="models" />
      </div>
    </>
  );
}
