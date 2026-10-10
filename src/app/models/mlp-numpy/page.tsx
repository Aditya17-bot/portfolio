import { statSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { MlpPlayground } from "@/components/ml/MlpPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { pct, readLog } from "@/lib/runlog";
import meta from "../../../../public/models/mlp/meta.json";

const LOG = "training/mlp_numpy/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/mlp_numpy";

export const metadata: Metadata = {
  title: "MLP in NumPy",
  description: `A 784-128-64-10 MLP trained on MNIST with hand-written backpropagation: ${pct(meta.results.test_acc)} test accuracy, running in your browser.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const kb = Math.round(statSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public/models/mlp/weights.bin")).size / 1024);
  const c = meta.config;

  return (
    <article className="container">
      <ModelHeader
        family="Multilayer perceptron"
        date="Oct 2026"
        title="MLP in NumPy"
        lede={
          <p>
            The network drawn on the front page. Three weight matrices, ReLU, softmax, and a backward pass written out
            by hand with no autograd. Trained on MNIST on a laptop CPU; the weights below are the ones running in your
            browser.
          </p>
        }
        stats={[
          { label: "Test accuracy", value: pct(r.test_acc) },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Weights", value: `${kb} KB, int8` },
          { label: "Training time", value: `${Math.round(r.train_seconds)} s, CPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <MlpPlayground variant="page" />
        <p className="prose" style={{ fontSize: 14 }}>
          Inference is a plain JavaScript forward pass over the exported weights, no server and no ML runtime. Your
          drawing is cropped, scaled to fit 20×20 and centred by its centre of mass in a 28×28 frame, which is how the
          MNIST digits themselves were prepared.
        </p>
      </Section>

      <Section title="Training run" id="run">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <TrainingChart
            title="Accuracy"
            rows={rows}
            series={[
              { key: "train_acc", label: "train", tone: "a" },
              { key: "test_acc", label: "test", tone: "b" },
            ]}
            format={(v) => `${(v * 100).toFixed(1)}%`}
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
        <div className="prose">
          <p>
            Test accuracy sits above training accuracy for the whole run. That is not the model generalising better
            than it fits: training batches are randomly shifted by up to {c.max_shift} pixels, the test set is not, so
            the two numbers are measured on different distributions.
          </p>
        </div>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Test accuracy, 10,000 images", value: pct(r.test_acc), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test loss", value: r.test_loss.toFixed(4), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Train accuracy (augmented)", value: pct(r.train_acc), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test accuracy after int8 export", value: pct(r.int8_test_acc), source: "public/models/mlp/meta.json" },
            { metric: "Wall-clock training time", value: `${r.train_seconds} s`, source: `${LOG}, seconds column` },
          ]}
        />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Forward.</strong> Each layer computes <code>h = relu(W·x + b)</code>; the last one skips the ReLU
            and feeds a softmax. 784 inputs, hidden layers of 128 and 64, ten outputs: {meta.params.toLocaleString("en-US")}{" "}
            parameters, initialised with He scaling so activations keep their size through the ReLUs.
          </p>
          <p>
            <strong>Backward.</strong> Softmax and cross-entropy together have a clean gradient, <code>p − onehot(y)</code>.
            From there each layer hands back <code>dW = δᵀ·h</code>, <code>db = Σδ</code>, and passes{" "}
            <code>δ·W ⊙ [z &gt; 0]</code> to the layer before it. A unit test perturbs every parameter of a small
            network by ±10⁻⁶ and checks the analytic gradient against the finite difference.
          </p>
          <p>
            <strong>Training.</strong> SGD with momentum {c.momentum}, batch {c.batch_size}, learning rate {c.lr} on a
            cosine decay to zero over {c.epochs} epochs, weight decay {c.weight_decay} on the weights only, random
            shifts of up to {c.max_shift} pixels. Seed {c.seed}; rerunning the script reproduces the log exactly.
          </p>
          <p>
            <strong>Export.</strong> Weights are quantised to int8 with one scale per output neuron, which cuts the
            download to a quarter and costs {((r.test_acc - r.int8_test_acc) * 100).toFixed(2)} points of accuracy.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: "MNIST, 60,000 train / 10,000 test, downloaded and MD5-checked by the script" },
          ]}
          steps={[
            { label: "Check the backward pass", cmd: "cd training/mlp_numpy && python -m pytest test_gradcheck.py" },
            { label: "Train and export", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
