import type { Metadata } from "next";
import { CifarPlayground } from "@/components/ml/CifarPlayground";
import { GradientChart } from "@/components/ml/GradientChart";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart, type Series } from "@/components/ml/TrainingChart";
import { pct, readLog, type LogRow } from "@/lib/runlog";
import cnnMeta from "../../../../public/models/cnn-cifar10/meta.json";
import plain20 from "../../../../public/models/resnet-cifar10/plain-20.json";
import plain56 from "../../../../public/models/resnet-cifar10/plain-56.json";
import resnet20 from "../../../../public/models/resnet-cifar10/resnet-20.json";
import resnet56 from "../../../../public/models/resnet-cifar10/resnet-56.json";
import meta from "../../../../public/models/resnet-cifar10/meta.json";
import gradients from "../../../../training/resnet_cifar10/gradients.json";

const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/resnet_cifar10";
const RUNS = [resnet56, resnet20, plain20, plain56];
const SERIES: Series[] = [
  { key: "resnet-56", label: "ResNet-56", tone: "b" },
  { key: "resnet-20", label: "ResNet-20", tone: "a" },
  { key: "plain-20", label: "plain-20", tone: "d" },
  { key: "plain-56", label: "plain-56", tone: "c" },
];

export const metadata: Metadata = {
  title: "ResNet on CIFAR-10",
  description: `Plain and residual networks at 20 and 56 layers, trained with the same recipe: why skip connections make depth trainable. ResNet-56 reaches ${pct(resnet56.test_acc)} and runs in your browser.`,
};

/** One row per epoch with a column per run, for a chart that overlays the runs. */
function merge(key: string): LogRow[] {
  const logs = Object.fromEntries(SERIES.map((s) => [s.key, readLog(`training/resnet_cifar10/${s.key}.csv`)]));
  return logs["resnet-56"].map((row, i) => ({
    epoch: row.epoch,
    ...Object.fromEntries(SERIES.map((s) => [s.key, logs[s.key][i][key]])),
  }));
}

const ratio = (g: number[]) => (g[0] / g[g.length - 1]).toFixed(0);
const spread = (g: number[]) => (Math.max(...g) / Math.min(...g)).toFixed(0);

export default function Page() {
  const err = (r: { test_acc: number }) => pct(1 - r.test_acc);
  const deeperPlainWorse = plain56.train_loss > plain20.train_loss;

  return (
    <article className="container">
      <ModelHeader
        family="Residual network"
        date="Oct 2026"
        title="ResNet on CIFAR-10"
        lede={
          <p>
            Stacking more layers should never hurt: the extra layers could just learn to pass their input through.
            In practice a deep plain network trains worse than a shallow one. The residual network fixes that with
            one change, an identity shortcut around every pair of layers. This page reruns the experiment from He et
            al. (2016) at 20 and 56 layers.
          </p>
        }
        stats={[
          { label: "ResNet-56 test accuracy", value: pct(resnet56.test_acc) },
          { label: "Plain-56 test accuracy", value: pct(plain56.test_acc) },
          { label: "Parameters, each 56-layer net", value: resnet56.params.toLocaleString("en-US") },
          { label: "Model file", value: `${(meta.onnx_bytes / 1024 / 1024).toFixed(1)} MB, ONNX` },
        ]}
      />

      <Section title="Try it" id="try">
        <CifarPlayground
          model="/models/resnet-cifar10/resnet-56.onnx"
          samples="/models/cnn-cifar10/samples.bin"
          sampleLabels={cnnMeta.samples.labels}
          classes={meta.classes}
          camSize={8}
          testId="resnet-playground"
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The same test images as the <a href="/models/cnn-cifar10">CNN page</a>, so the two can be compared. The
          heatmap is the class activation map of the last stage, which works here because a ResNet also ends in a
          global average pool and one linear layer.
        </p>
      </Section>

      <Section title="The experiment" id="experiment">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <TrainingChart title="Training loss" rows={merge("train_loss")} series={SERIES} dots={false} />
          <TrainingChart
            title="Test accuracy"
            rows={merge("test_acc")}
            series={SERIES}
            dots={false}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            max={1}
          />
        </div>
        <ResultsTable
          rows={RUNS.map((r) => ({
            metric: `${r.residual ? "ResNet" : "Plain"}-${r.depth}, ${r.params.toLocaleString("en-US")} params`,
            value: `${pct(r.test_acc)} test · ${err(r)} error · train loss ${r.train_loss.toFixed(3)}`,
            source: `${r.source}, epoch ${meta.config.epochs}`,
          }))}
        />
        <div className="prose">
          <p>
            {deeperPlainWorse ? (
              <>
                The plain 56-layer network ends with a higher <em>training</em> loss than the plain 20-layer one (
                {plain56.train_loss.toFixed(3)} against {plain20.train_loss.toFixed(3)}). That is not overfitting,
                which would show the opposite; the deeper network is harder to optimise.{" "}
              </>
            ) : (
              <>
                In this run the plain 56-layer network reached a training loss of {plain56.train_loss.toFixed(3)},
                against {plain20.train_loss.toFixed(3)} for plain-20, so the degradation effect was weaker here than
                in the paper.{" "}
              </>
            )}
            With shortcuts the order flips: ResNet-56 beats ResNet-20, {pct(resnet56.test_acc)} against{" "}
            {pct(resnet20.test_acc)}, with the same number of parameters as plain-56.
          </p>
        </div>
      </Section>

      <Section title="Why: the gradient, layer by layer" id="gradients">
        <GradientChart
          title="Gradient norm per conv layer, first epoch"
          data={gradients}
          series={SERIES}
          caption="Mean over the first 50 training steps of each run, log scale. Layer 1 is the first convolution after the input."
        />
        <div className="prose">
          <p>
            In the plain 56-layer network the gradient grows on its way back to the input: the first convolution
            receives a gradient {ratio(gradients["plain-56"])}× the size of the last one&apos;s, and the norms span a
            factor of {spread(gradients["plain-56"])} across the 55 layers. In ResNet-56 the first-to-last ratio is{" "}
            {ratio(gradients["resnet-56"])}× and the spread {spread(gradients["resnet-56"])}.
          </p>
          <p>
            Backpropagation multiplies the signal by one Jacobian per layer. In a deep plain stack with batch norm
            those products tend to grow with depth (Yang et al., 2019), so a single learning rate is too large for
            the early layers and too small for the late ones, and optimisation stalls at a higher loss. A residual
            block computes x + F(x), whose Jacobian is I + F′(x): the gradient at the output reaches every earlier
            block directly, plus correction terms, which is why the residual curves stay much flatter.
          </p>
        </div>
      </Section>

      <Section title="Setup" id="how">
        <div className="prose">
          <p>
            <strong>Architecture.</strong> As in section 4.2 of the paper: a 3×3 convolution, then three stages of n
            residual blocks at 16, 32 and 64 channels, each block two 3×3 convolutions with batch norm. Depth is 6n +
            2, so n = 3 gives 20 layers and n = 9 gives 56. When a stage halves the resolution, the shortcut
            subsamples and pads the new channels with zeros (option A), so a plain network and its ResNet have exactly
            the same parameters.
          </p>
          <p>
            <strong>Training.</strong> All four runs share one recipe and seed: SGD with Nesterov momentum, batch{" "}
            {meta.config.batch_size}, weight decay {meta.config.weight_decay}, a one-cycle learning rate peaking at{" "}
            {meta.config.max_lr} over {meta.config.epochs} epochs (the paper used 164 with step decay), random crops
            and flips, bf16 autocast.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "ONNX test accuracy", value: `${pct(meta.onnx_test_acc)} on all 10,000 test images` },
            { label: "Time", value: `${Math.round(RUNS.reduce((t, r) => t + r.train_seconds, 0) / 60)} min for all four runs` },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "All four runs, export ResNet-56", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
