import type { Metadata } from "next";
import { GanPlayground } from "@/components/ml/GanPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { pct, readLog } from "@/lib/runlog";
import meta from "../../../../public/models/dcgan-mnist/meta.json";

const LOG = "training/dcgan_mnist/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/dcgan_mnist";

export const metadata: Metadata = {
  title: "DCGAN",
  description: "A generator and a discriminator trained against each other on MNIST. New digits drawn in your browser, judged by the zoo's own CNN.",
};

export default function Page() {
  const rows = readLog(LOG);
  const r = meta.results;
  const c = meta.config;
  const n = r.class_counts.reduce((a: number, b: number) => a + b, 0);
  const minShare = Math.min(...r.class_counts) / n;
  const maxShare = Math.max(...r.class_counts) / n;

  return (
    <article className="container">
      <ModelHeader
        family="Generative"
        date="Oct 2026"
        title="DCGAN"
        lede={
          <p>
            The VAE learns to reconstruct its inputs. A GAN never sees a reconstruction loss: a generator turns
            random numbers into images, a discriminator tries to tell them from real digits, and each is trained to
            beat the other. When it works, the generator ends up drawing digits that were never in the data.
          </p>
        }
        stats={[
          { label: "Generator parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Latent size", value: String(c.z) },
          { label: "Model file", value: `${Math.round(meta.onnx_bytes / 1024)} KB, ONNX` },
          { label: "Training time", value: `${(r.train_seconds / 60).toFixed(1)} min, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <GanPlayground zDim={c.z} />
      </Section>

      <Section title="Judging a GAN" id="results">
        <div className="prose">
          <p>
            A GAN has no test loss. Instead, {n.toLocaleString("en-US")} samples from the exported generator were
            shown to the <a href="/models/cnn-mnist">small CNN</a> from this zoo, which never saw a generated image.
          </p>
        </div>
        <ResultsTable
          rows={[
            {
              metric: "Share of samples per digit, as read by the CNN (10% each would be perfectly even)",
              value: `${pct(minShare, 1)} to ${pct(maxShare, 1)}`,
              source: "public/models/dcgan-mnist/meta.json",
            },
            {
              metric: "Entropy of that distribution (log2 10 = 3.32 bits is the maximum)",
              value: `${r.class_entropy_bits.toFixed(2)} bits`,
              source: "public/models/dcgan-mnist/meta.json",
            },
            {
              metric: "CNN's mean confidence on generated digits",
              value: pct(r.mean_confidence_generated, 1),
              source: "public/models/dcgan-mnist/meta.json",
            },
            {
              metric: "CNN's mean confidence on real test digits",
              value: pct(r.mean_confidence_real, 1),
              source: "public/models/dcgan-mnist/meta.json",
            },
            {
              metric: "Fréchet distance in the CNN's features: real vs generated",
              value: r.frechet_cnn_generated.toFixed(3),
              source: "public/models/dcgan-mnist/meta.json",
            },
            {
              metric: "Same distance between two halves of the real test set (the floor)",
              value: r.frechet_cnn_real_halves.toFixed(3),
              source: "public/models/dcgan-mnist/meta.json",
            },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The Fréchet distance is the idea behind FID, computed on the CNN&apos;s 16 pooled feature channels instead of
          Inception&apos;s 2,048, so it is only comparable within this page, not with published FID numbers.
        </p>
      </Section>

      <Section title="Training run" id="run">
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <TrainingChart
            title="Losses"
            rows={rows}
            series={[
              { key: "loss_d", label: "discriminator", tone: "a" },
              { key: "loss_g", label: "generator", tone: "b" },
            ]}
            dots={false}
          />
          <TrainingChart
            title="Discriminator output, mean"
            rows={rows}
            series={[
              { key: "d_real", label: "on real", tone: "a" },
              { key: "d_fake", label: "on generated", tone: "b" },
            ]}
            format={(v) => v.toFixed(2)}
            max={1}
            dots={false}
            caption="Neither loss goes to zero: the two networks keep pushing against each other. A discriminator that wins outright would leave the generator with no useful gradient."
          />
        </div>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Generator.</strong> {c.z} random numbers go through a linear layer to a 128-channel 7×7 map,
            then two transposed convolutions upsample to 14×14 and 28×28, with batch norm and ReLU, and tanh at the
            end, following Radford et al. (2016).
          </p>
          <p>
            <strong>Discriminator.</strong> Two strided convolutions with leaky ReLU, then one linear output: real or
            generated.
          </p>
          <p>
            <strong>Training.</strong> Alternate one discriminator step and one generator step per batch of{" "}
            {c.batch_size}, Adam with learning rate {c.lr} and β1 = {c.betas[0]}, {c.epochs} epochs. The generator
            uses the non-saturating loss: it maximises the discriminator&apos;s belief that its images are real,
            which gives stronger gradients early on than minimising the belief that they are fake.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: "MNIST, 60,000 training images" },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "Train, export, judge with the CNN", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
