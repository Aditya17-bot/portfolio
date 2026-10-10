import type { Metadata } from "next";
import { GptPlayground } from "@/components/ml/GptPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { readLog } from "@/lib/runlog";
import meta from "../../../../public/models/mini-gpt/meta.json";

const LOG = "training/mini_gpt/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/mini_gpt";

export const metadata: Metadata = {
  title: "Mini-GPT",
  description: `A ${Math.round(meta.params / 1000)}k-parameter character-level transformer trained on Shakespeare. It writes in your browser and shows what each attention head looked at.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const r = meta.results;
  const c = meta.config;
  const bits = (nats: number) => (nats / Math.LN2).toFixed(2);

  return (
    <article className="container">
      <ModelHeader
        family="Transformer"
        date="Oct 2026"
        title="Mini-GPT"
        lede={
          <p>
            The same architecture as GPT, shrunk until it runs in a browser tab: {c.layers} layers,{" "}
            {c.heads} attention heads, a {c.context}-character context, trained from scratch on a million characters
            of Shakespeare&apos;s plays, one character at a time. It has never seen a word list; spelling, line breaks and speaker
            names are all learned from the characters.
          </p>
        }
        stats={[
          { label: "Validation loss", value: `${r.val_bits_per_char.toFixed(2)} bits/char` },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Model file", value: `${(meta.onnx_bytes / 1024 / 1024).toFixed(1)} MB, ONNX` },
          { label: "Training time", value: `${(r.train_seconds / 60).toFixed(1)} min, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <GptPlayground vocab={meta.vocab} context={c.context} layers={c.layers} heads={c.heads} defaultPrompt={meta.sample.prompt} />
        <p className="prose" style={{ fontSize: 14 }}>
          Each character is one full pass of the network over up to {c.context} characters of context. Lower
          temperature picks the likeliest character more often; higher temperature takes more risks.
        </p>
      </Section>

      <Section title="Training run" id="run">
        <TrainingChart
          title="Cross-entropy, nats per character"
          rows={rows.map((row) => ({ ...row, epoch: row.step }))}
          series={[
            { key: "train_loss", label: "train", tone: "a" },
            { key: "val_loss", label: "validation", tone: "b" },
          ]}
          format={(v) => v.toFixed(2)}
          dots={false}
          caption={`Estimated every ${c.eval_every} steps on ${c.eval_batches} random batches; the x axis is the optimiser step.`}
        />
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            {
              metric: `Validation loss, all ${meta.data.val_chars.toLocaleString("en-US")} held-out characters`,
              value: `${r.val_loss.toFixed(3)} nats · ${bits(r.val_loss)} bits`,
              source: "public/models/mini-gpt/meta.json",
            },
            {
              metric: "Bigram model on the same split, for comparison",
              value: `${r.bigram_val_loss.toFixed(3)} nats · ${bits(r.bigram_val_loss)} bits`,
              source: "public/models/mini-gpt/meta.json",
            },
            {
              metric: "Unigram (character frequency) model",
              value: `${r.unigram_val_loss.toFixed(3)} nats · ${bits(r.unigram_val_loss)} bits`,
              source: "public/models/mini-gpt/meta.json",
            },
            {
              metric: "Largest logit difference, exported ONNX vs PyTorch",
              value: r.onnx_max_abs_diff.toExponential(1),
              source: "public/models/mini-gpt/meta.json",
            },
          ]}
        />
        <figure className="prose" style={{ margin: 0 }}>
          <figcaption style={{ fontSize: 14, color: "var(--text-muted)" }}>
            A sample from the exported model at temperature {meta.sample.temperature}, written by the training
            script:
          </figcaption>
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              padding: 16,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
            }}
          >
            {meta.sample.text}
          </pre>
        </figure>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Tokens.</strong> Every one of the {meta.vocab.length} distinct characters in the text is a token.
            Each gets a learned {c.width}-dimensional embedding, plus a learned embedding for its position.
          </p>
          <p>
            <strong>Blocks.</strong> Each of the {c.layers} blocks is causal self-attention with {c.heads} heads,
            then a two-layer MLP, each wrapped in layer norm and a residual connection. A position can only attend to
            itself and earlier positions, so training on a whole sequence teaches it to predict every next character
            at once. The output layer shares its weights with the input embedding.
          </p>
          <p>
            <strong>Training.</strong> AdamW, batch {c.batch_size} × {c.context} characters, {c.steps.toLocaleString("en-US")}{" "}
            steps, learning rate {c.lr} with warm-up and cosine decay, weight decay {c.weight_decay}, dropout{" "}
            {c.dropout}, bf16 autocast. The last 10% of the text is held out for validation.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            { label: "Data", value: `Tiny Shakespeare, ${meta.data.chars.toLocaleString("en-US")} characters, MD5-checked by the script` },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime" },
            { label: "Train, export, check, sample", cmd: meta.command },
          ]}
        />
      </Section>
    </article>
  );
}
