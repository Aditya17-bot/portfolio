import type { Metadata } from "next";
import { CifarPlayground } from "@/components/ml/CifarPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { pct, readLog } from "@/lib/runlog";
import cnnMeta from "../../../../public/models/cnn-cifar10/meta.json";
import resnet20 from "../../../../public/models/resnet-cifar10/resnet-20.json";
import resnet56 from "../../../../public/models/resnet-cifar10/resnet-56.json";
import meta from "../../../../public/models/vit-cifar10/meta.json";

const LOG = "training/vit_cifar10/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/vit_cifar10";

export const metadata: Metadata = {
  title: "ViT-Tiny",
  description: `A Vision Transformer trained from scratch on CIFAR-10: ${pct(meta.results.test_acc)} test accuracy, compared with the ResNets on the same data, with attention rollout in your browser.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const c = meta.config;
  const tokens = (32 / c.patch) ** 2;
  const behind = r.test_acc < resnet20.test_acc;
  const k = (n: number) => `${Math.round(n / 1000)}k`;

  return (
    <article className="container">
      <ModelHeader
        family="Vision transformer"
        date="Oct 2026"
        title="ViT-Tiny"
        lede={
          <p>
            A transformer that reads an image the way Mini-GPT reads text: cut into {tokens} patches of {c.patch}×
            {c.patch} pixels, each a token, with attention between all of them from the first layer on. No
            convolution after the patch embedding, so nothing tells it that neighbouring pixels belong together; it
            has to learn that from {(50000).toLocaleString("en-US")} images.
          </p>
        }
        stats={[
          { label: "Test accuracy", value: pct(r.test_acc) },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Model file", value: `${(meta.onnx_bytes / 1024 / 1024).toFixed(1)} MB, ONNX` },
          { label: "Training time", value: `${(r.train_seconds / 60).toFixed(1)} min, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <CifarPlayground
          model="/models/vit-cifar10/model.onnx"
          samples="/models/cnn-cifar10/samples.bin"
          sampleLabels={cnnMeta.samples.labels}
          classes={meta.classes}
          camSize={32 / c.patch}
          mapTitle="Attention rollout"
          testId="vit-playground"
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The heatmap is attention rollout (Abnar &amp; Zuidema, 2020): how much each patch reached the class token
          through all {c.depth} layers. It is the same for every class, unlike the activation maps on the{" "}
          <a href="/models/resnet-cifar10">ResNet</a> and <a href="/models/cnn-cifar10">CNN</a> pages, which use the
          same test images.
        </p>
      </Section>

      <Section title="Against the convolutional networks" id="compare">
        <ResultsTable
          rows={[
            { metric: `ViT-Tiny, ${k(meta.params)} params, ${c.epochs} epochs`, value: pct(r.test_acc), source: `${LOG}, epoch ${last.epoch}` },
            { metric: `ResNet-56, ${k(resnet56.params)} params, 50 epochs`, value: pct(resnet56.test_acc), source: resnet56.source },
            { metric: `ResNet-20, ${k(resnet20.params)} params, 50 epochs`, value: pct(resnet20.test_acc), source: resnet20.source },
            { metric: `CNN, ${k(cnnMeta.params)} params, ${cnnMeta.config.epochs} epochs`, value: pct(cnnMeta.results.test_acc), source: cnnMeta.source },
            { metric: "ViT-Tiny, exported ONNX file", value: pct(r.onnx_test_acc), source: "public/models/vit-cifar10/meta.json" },
          ]}
        />
        <div className="prose">
          <p>
            {behind ? (
              <>
                With {(meta.params / resnet20.params).toFixed(1)}× the parameters of ResNet-20, the transformer ends{" "}
                {((resnet20.test_acc - r.test_acc) * 100).toFixed(1)} points behind it. A convolution builds in two
                assumptions, that nearby pixels matter together and that a pattern means the same thing anywhere in
                the image. The transformer has to learn both from data, and 50,000 images of 32×32 are not much
                data for that. With large pretraining sets the picture reverses: that is the regime in which
                Dosovitskiy et al. (2021) showed ViTs overtaking ResNets.
              </>
            ) : (
              <>
                The transformer matches or beats ResNet-20 here even without the convolutional assumptions that
                nearby pixels matter together and that a pattern means the same thing anywhere in the image.
              </>
            )}
          </p>
          <p>
            Train accuracy at the end was {pct(r.train_acc)} against {pct(r.test_acc)} on the test set, with the same
            crop and flip augmentation as the ResNets.
          </p>
        </div>
      </Section>

      <Section title="Training run" id="run">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <TrainingChart
            title="Accuracy"
            rows={rows}
            series={[
              { key: "train_acc", label: "train (augmented)", tone: "a" },
              { key: "test_acc", label: "test", tone: "b" },
            ]}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            max={1}
            dots={false}
          />
          <TrainingChart
            title="Loss"
            rows={rows}
            series={[
              { key: "train_loss", label: "train", tone: "a" },
              { key: "test_loss", label: "test", tone: "b" },
            ]}
            dots={false}
          />
        </div>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Patches as tokens.</strong> A {c.patch}×{c.patch} convolution with stride {c.patch} turns the
            image into {tokens} vectors of width {c.width}. A learned class token is prepended and a learned
            position embedding added, since attention by itself does not know where a patch came from.
          </p>
          <p>
            <strong>Encoder.</strong> {c.depth} pre-norm transformer blocks, each multi-head self-attention with{" "}
            {c.heads} heads and an MLP of width {c.mlp}. The class token&apos;s final state, after layer norm, goes
            through one linear layer to the ten classes.
          </p>
          <p>
            <strong>Training.</strong> AdamW, weight decay {c.weight_decay}, a one-cycle learning rate peaking at{" "}
            {c.max_lr}, batch {c.batch_size}, {c.epochs} epochs, the same random crops and flips as the ResNet runs,
            bf16 autocast. No pretraining, no mixup or RandAugment.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: "CIFAR-10, 50,000 train / 10,000 test" },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "Train, export and score the ONNX file", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
