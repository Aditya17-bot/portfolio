import type { Metadata } from "next";
import { LatentExplorer } from "@/components/ml/LatentExplorer";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { readLog } from "@/lib/runlog";
import meta from "../../../../public/models/vae-mnist/meta.json";

const LOG = "training/vae_mnist/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/vae_mnist";

export const metadata: Metadata = {
  title: "Variational autoencoder",
  description: "A VAE with a two-dimensional latent space on MNIST. Drag through the space and watch digits morph, in your browser.",
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const c = meta.config;
  const kb = (b: number) => `${Math.round(b / 1024)} KB`;

  return (
    <article className="container">
      <ModelHeader
        family="Generative"
        date="Oct 2026"
        title="Variational autoencoder"
        lede={
          <p>
            The classifiers before this one map an image to a label. This network maps an image to two numbers and
            back. Training forces those two numbers to form a smooth map, so every point on it decodes to something
            that looks like a digit, including points no training image landed on.
          </p>
        }
        stats={[
          { label: "Latent dimensions", value: String(c.latent) },
          { label: "Test ELBO", value: `${r.test_elbo.toFixed(1)} nats` },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Training time", value: `${Math.round(r.train_seconds)} s, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <LatentExplorer />
        <p className="prose" style={{ fontSize: 14 }}>
          Each dot is a test digit, placed by the encoder and coloured by its true label; the labels were never shown
          to the model. Drag between two clusters to see one digit turn into another. The decoded grid view decodes a
          {" "}12×12 lattice over the same area.
        </p>
      </Section>

      <Section title="Training run" id="run">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <TrainingChart
            title="Reconstruction loss, nats per image"
            rows={rows}
            series={[
              { key: "train_rec", label: "train", tone: "a" },
              { key: "test_rec", label: "test", tone: "b" },
            ]}
            format={(v) => v.toFixed(0)}
            dots={false}
          />
          <TrainingChart
            title="KL divergence, nats per image"
            rows={rows}
            series={[
              { key: "train_kl", label: "train", tone: "a" },
              { key: "test_kl", label: "test", tone: "b" },
            ]}
            format={(v) => v.toFixed(2)}
            dots={false}
          />
        </div>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Test reconstruction loss (Bernoulli), nats per image", value: r.test_rec.toFixed(2), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test KL to the unit Gaussian, nats per image", value: r.test_kl.toFixed(2), source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Test evidence lower bound (higher is better)", value: r.test_elbo.toFixed(2), source: `${LOG}, epoch ${last.epoch}` },
            {
              metric: "Largest difference, exported ONNX vs PyTorch, over 10,000 test images",
              value: Math.max(r.onnx_max_abs_diff.mu, r.onnx_max_abs_diff.image).toExponential(1),
              source: "public/models/vae-mnist/meta.json",
            },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The reconstruction term is evaluated at the mean of the encoder&apos;s distribution, so the ELBO here is the
          deterministic bound, not a sampled estimate.
        </p>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Encoder and decoder.</strong> The encoder is an MLP, 784 → {c.hidden[0]} → {c.hidden[1]}, that
            outputs a mean and a log-variance for each of the {c.latent} latent dimensions. The decoder mirrors it and
            outputs a probability for each pixel. The page runs both as ONNX files ({kb(meta.onnx_bytes.encoder)} and{" "}
            {kb(meta.onnx_bytes.decoder)}).
          </p>
          <p>
            <strong>The loss.</strong> Reconstruction alone would give an ordinary autoencoder, which can scatter
            digits anywhere and leave gaps that decode to noise. The KL term pulls every encoding towards a unit
            Gaussian, so the codes pack together and the space between them stays meaningful. During training the
            decoder sees a sample drawn around each mean (the reparameterisation trick), which is what makes the map
            smooth.
          </p>
          <p>
            <strong>Training.</strong> Adam, learning rate {c.lr} with cosine decay, batch {c.batch_size},{" "}
            {c.epochs} epochs.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: "MNIST, 60,000 train / 10,000 test" },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "Train, export, check the exported files", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
