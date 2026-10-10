import type { Metadata } from "next";
import { CnnPlayground } from "@/components/ml/CnnPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { pct, readLog } from "@/lib/runlog";
import mlpMeta from "../../../../public/models/mlp/meta.json";
import meta from "../../../../public/models/cnn-mnist/meta.json";

const LOG = "training/cnn_mnist/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/cnn_mnist";

export const metadata: Metadata = {
  title: "Small CNN",
  description: `A ${meta.params.toLocaleString("en-US")}-parameter CNN on MNIST: ${pct(meta.results.test_acc)} test accuracy, running in your browser with onnxruntime-web.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const c = meta.config;
  const ratio = (mlpMeta.params / meta.params).toFixed(0);

  return (
    <article className="container">
      <ModelHeader
        family="Convolutional network"
        date="Oct 2026"
        title="Small CNN"
        lede={
          <p>
            The MLP on the front page treats every pixel as its own input, so a digit shifted two pixels is a new
            problem. A convolution slides the same small filter everywhere. This network has {ratio}× fewer
            parameters than the MLP and makes fewer mistakes.
          </p>
        }
        stats={[
          { label: "Test accuracy", value: pct(r.test_acc) },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Model file", value: `${Math.round(meta.onnx_bytes / 1024)} KB, ONNX` },
          { label: "Training time", value: `${Math.round(r.train_seconds)} s, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <CnnPlayground />
        <p className="prose" style={{ fontSize: 14 }}>
          The exported ONNX graph runs in onnxruntime-web on WebAssembly. Besides the probabilities it returns two
          intermediate activations, drawn above: the first layer responds to strokes and edges at every position,
          the fourth to larger parts of the digit.
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
            { metric: "Test accuracy of the exported ONNX file", value: pct(r.onnx_test_acc), source: "public/models/cnn-mnist/meta.json" },
            { metric: "MLP on the same test set, for comparison", value: pct(mlpMeta.results.test_acc), source: "training/mlp_numpy/log.csv" },
          ]}
        />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Architecture.</strong> Five 3×3 convolutions with batch norm and ReLU, one max pool after the
            second, then a 1×1 convolution to ten channels and a global average pool. The spatial size goes 28, 26,
            24, 12, 10, 8, 6. There is no fully connected layer: averaging each class map over the image is the
            classifier, which is where most of the parameter saving comes from.
          </p>
          <p>
            <strong>Training.</strong> SGD with Nesterov momentum {c.momentum}, batch {c.batch_size}, weight decay{" "}
            {c.weight_decay}, a one-cycle learning rate peaking at {c.max_lr} over {c.epochs} epochs. Each batch is
            rotated by up to ±{c.rotate_deg}° and shifted by up to {c.translate * 100}% of the image, on the GPU.
          </p>
          <p>
            <strong>Export.</strong> The model is exported to ONNX with the softmax and the two feature-map taps
            built into the graph, then the exported file itself is scored on all 10,000 test images, because that file
            is what runs here, not the PyTorch model.
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
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "Train, export and score the ONNX file", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
