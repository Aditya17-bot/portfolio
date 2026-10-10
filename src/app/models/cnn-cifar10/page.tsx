import type { Metadata } from "next";
import { CifarPlayground } from "@/components/ml/CifarPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { pct, readLog } from "@/lib/runlog";
import mnistMeta from "../../../../public/models/cnn-mnist/meta.json";
import meta from "../../../../public/models/cnn-cifar10/meta.json";

const LOG = "training/cnn_cifar10/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/cnn_cifar10";

export const metadata: Metadata = {
  title: "CNN on CIFAR-10",
  description: `A ${Math.round(meta.params / 1000)}k-parameter CNN on CIFAR-10 photos: ${pct(meta.results.test_acc)} test accuracy, with class activation maps, running in your browser.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const c = meta.config;

  return (
    <article className="container">
      <ModelHeader
        family="Convolutional network"
        date="Oct 2026"
        title="CNN on CIFAR-10"
        lede={
          <p>
            The MNIST network sees white strokes on black. Here the inputs are 32×32 colour photos of planes, cars,
            birds, cats and six other classes, at every angle and on any background. The same recipe of small
            convolutions, wider and deeper, and a heatmap of the part of the photo that decided the answer.
          </p>
        }
        stats={[
          { label: "Test accuracy", value: pct(r.test_acc) },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Model file", value: `${Math.round(meta.onnx_bytes / 1024)} KB, ONNX` },
          { label: "Training time", value: `${(r.train_seconds / 60).toFixed(1)} min, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <CifarPlayground
          model="/models/cnn-cifar10/model.onnx"
          samples="/models/cnn-cifar10/samples.bin"
          sampleLabels={meta.samples.labels}
          classes={meta.classes}
          camSize={8}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The test images were never seen in training. Uploaded photos are centre-cropped and shrunk to 32×32 first,
          so pick one where the object fills the frame; CIFAR-10 has no people, so a selfie gets one of the ten
          classes anyway.
        </p>
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
          />
          <TrainingChart
            title="Loss"
            rows={rows}
            series={[
              { key: "train_loss", label: "train", tone: "a" },
              { key: "test_loss", label: "test", tone: "b" },
            ]}
          />
        </div>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Test accuracy, 10,000 images", value: pct(r.test_acc), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test loss", value: r.test_loss.toFixed(4), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Train accuracy (augmented)", value: pct(r.train_acc), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test accuracy of the exported ONNX file", value: pct(r.onnx_test_acc), source: "public/models/cnn-cifar10/meta.json" },
            { metric: "Small CNN on MNIST, for scale", value: pct(mnistMeta.results.test_acc), source: "training/cnn_mnist/log.csv" },
          ]}
        />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Architecture.</strong> Three stages of two 3×3 convolutions with batch norm and ReLU, at 32, 64
            and 128 channels, with a max pool between stages, so the maps go 32, 16, 8. A global average pool and
            one linear layer make the classifier.
          </p>
          <p>
            <strong>Where it looked.</strong> Because the head is an average followed by a linear layer, the score
            for a class is the average over positions of a weighted sum of the last 128 maps. Drawing that weighted
            sum before averaging gives the class activation map (Zhou et al., 2016): an 8×8 grid that says how much
            each part of the image added to the score. It is computed inside the exported graph, with no gradients
            needed in the browser.
          </p>
          <p>
            <strong>Training.</strong> SGD with Nesterov momentum, batch {c.batch_size}, weight decay{" "}
            {c.weight_decay}, a one-cycle learning rate peaking at {c.max_lr} over {c.epochs} epochs, bf16 autocast.
            Augmentation is a random 32×32 crop from the image padded by 4 pixels, and a horizontal flip, done on
            the GPU.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: "CIFAR-10, 50,000 train / 10,000 test, binary release, MD5-checked by the script" },
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
