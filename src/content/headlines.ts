// Headline numbers for the model and project cards, read from each run's own files.
// Shared by the index pages and the labels inside the hero network.
import type { WorkItem } from "@/components/work/WorkGrid";
import fraud from "../../public/projects/fraud/curves.json";
import cifar from "../../public/models/cnn-cifar10/meta.json";
import cnn from "../../public/models/cnn-mnist/meta.json";
import dcgan from "../../public/models/dcgan-mnist/meta.json";
import lstm from "../../public/models/lstm-load/meta.json";
import gpt from "../../public/models/mini-gpt/meta.json";
import mlp from "../../public/models/mlp/meta.json";
import plain56 from "../../public/models/resnet-cifar10/plain-56.json";
import resnet56 from "../../public/models/resnet-cifar10/resnet-56.json";
import vae from "../../public/models/vae-mnist/meta.json";
import vit from "../../public/models/vit-cifar10/meta.json";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const n = (v: number) => v.toLocaleString("en-US");

// The headline number of each model, read from its own run.
export const MODEL_HEADLINE: Record<string, { group: string; metric: WorkItem["metric"]; facts: string[] }> = {
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

// Projects with an interactive page get an illustrated card; the headline numbers come from those pages.
export const PROJECT_CARDS: Record<string, { group: string; metric: WorkItem["metric"]; facts: string[]; status: string }> = {
  blindassist: {
    group: "Vision",
    metric: { value: "100%", label: "direction accuracy, reviewed announcements" },
    facts: ["YOLOv8 × 2", "Android", "21 ms/frame on GPU"],
    status: "Runs in your browser",
  },
  "amazon-ml-challenge": {
    group: "Data & ML",
    metric: { value: "696", label: "rank of 89,000+" },
    facts: ["macro F0.5 0.9839", "10M+ records"],
    status: "Interactive walk-through",
  },
  "voice-assistant": {
    group: "Speech",
    metric: { value: "~1.3 s", label: "to the first spoken word" },
    facts: ["Whisper", "Llama 3.2 3B", "Piper", "offline"],
    status: "Interactive replay",
  },
  "gene-anomaly": {
    group: "Data & ML",
    metric: { value: "Best Project", label: "Code for Life, VIT" },
    facts: ["AlphaFold", "AlphaMissense", "UniProt"],
    status: "Live data",
  },
  caterpillar: {
    group: "Systems",
    metric: { value: "3 min", label: "overheat warning horizon" },
    facts: ["FastAPI", "React", "4 ML models"],
    status: "Interactive simulator",
  },
  fraud: {
    group: "Data & ML",
    metric: { value: fraud.models.random_forest.pr_auc.toFixed(3), label: "PR-AUC on unseen months" },
    facts: [`${(fraud.data.test_rows / 1000).toFixed(0)}k test transactions`, "random forest vs isolation forest"],
    status: "Interactive",
  },
};

