import type { Metadata } from "next";
import Link from "next/link";
import { ForecastPlayground } from "@/components/ml/ForecastPlayground";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { TrainingChart } from "@/components/ml/TrainingChart";
import { readLog } from "@/lib/runlog";
import meta from "../../../../public/models/lstm-load/meta.json";

const LOG = "training/lstm_load/log.csv";
const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/lstm_load";

export const metadata: Metadata = {
  title: "LSTM forecaster",
  description: `An LSTM that forecasts Delhi's electricity demand an hour ahead: ${meta.results.test_mape.toFixed(2)}% MAPE over the 2024 test year, running in your browser.`,
};

export default function Page() {
  const rows = readLog(LOG);
  const last = rows[rows.length - 1];
  const r = meta.results;
  const c = meta.config;
  const src = "public/models/lstm-load/meta.json";

  return (
    <article className="container">
      <ModelHeader
        family="Recurrent"
        date="Oct 2026"
        title="LSTM forecaster"
        lede={
          <p>
            Every model before this one looks at a single image. Demand is a sequence: what happens at 18:00 depends
            on the afternoon before it, the weather, the day of the week and where the sun is. An LSTM reads the
            last 24 hours one five-minute step at a time and forecasts the next hour, the problem behind{" "}
            <Link href="/research">my forecasting paper</Link>, here on a public dataset.
          </p>
        }
        stats={[
          { label: "Test MAPE, 2024, 1 h ahead", value: `${r.test_mape.toFixed(2)}%` },
          { label: "Same time yesterday", value: `${r.yesterday_mape.toFixed(2)}%` },
          { label: "Parameters", value: meta.params.toLocaleString("en-US") },
          { label: "Training time", value: `${(r.train_seconds / 60).toFixed(1)} min, GPU` },
        ]}
      />

      <Section title="Try it" id="try">
        <ForecastPlayground dates={meta.demo.dates} />
        <p className="prose" style={{ fontSize: 14 }}>
          The shaded curve is the sun&apos;s elevation over Delhi, computed from the date and time. It is one of the
          inputs: rooftop solar output is not in the data, but the sun&apos;s position is a proxy for when it
          lowers the demand the grid sees.
        </p>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            {
              metric: `LSTM, mean absolute percentage error over the 12 steps of ${r.test_origins.toLocaleString("en-US")} hourly forecasts in 2024`,
              value: `${r.test_mape.toFixed(2)}%`,
              source: `${LOG}, epoch ${last.epoch}`,
            },
            { metric: "LSTM, mean absolute error", value: `${r.test_mae_mw.toFixed(0)} MW`, source: `${LOG}, epoch ${last.epoch}` },
            { metric: "Persistence: the last value, held for the hour", value: `${r.persistence_mape.toFixed(2)}%`, source: src },
            { metric: "Same time yesterday", value: `${r.yesterday_mape.toFixed(2)}%`, source: src },
            {
              metric: "LSTM by horizon: 5 minutes ahead → 60 minutes ahead",
              value: `${r.test_mape_by_horizon[0].toFixed(2)}% → ${r.test_mape_by_horizon[r.test_mape_by_horizon.length - 1].toFixed(2)}%`,
              source: src,
            },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          The test year was never used to choose anything: the schedule is fixed and the last epoch is reported. The
          error is computed on the same forecast origins for the model and both baselines.
        </p>
      </Section>

      <Section title="Training run" id="run">
        <TrainingChart
          title="Test MAPE per epoch, %"
          rows={rows}
          series={[{ key: "test_mape", label: "LSTM, 2024", tone: "b" }]}
          format={(v) => v.toFixed(2)}
          caption="Tracked for the chart only; nothing was selected on it."
        />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Inputs.</strong> For each of the last {c.context} five-minute steps: load, temperature, relative
            humidity, time of day and day of week (each as a sine and cosine, so 23:55 sits next to 00:00), and the
            sine of the sun&apos;s elevation at Delhi from standard declination and equation-of-time formulas. The
            model normalises its inputs itself, so the browser feeds raw values.
          </p>
          <p>
            <strong>Network.</strong> A {c.layers}-layer LSTM with {c.hidden} units reads the sequence; its last state
            goes through one linear layer to {c.horizon} outputs, predicted as changes from the last observed load.
          </p>
          <p>
            <strong>Data handling.</strong> The data is put on a full five-minute grid. Gaps of up to an hour are
            interpolated; any window that touches a longer gap is skipped. Training uses 2021 to 2023 (
            {r.train_origins.toLocaleString("en-US")} windows, one every 15 minutes), testing all of 2024 up to the
            end of the data.
          </p>
          <p>
            <strong>Training.</strong> AdamW, one-cycle learning rate peaking at {c.lr}, batch {c.batch_size},{" "}
            {c.epochs} epochs, mean squared error on normalised load.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: meta.hardware },
            { label: "Commit", value: meta.commit },
            {
              label: "Data",
              value: `${meta.data.name}, ${meta.data.range[0]} to ${meta.data.range[1]}, ${meta.data.license}. Load is labelled kW in the file; the values are MW.`,
            },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install torch numpy onnx onnxruntime kaggle" },
            {
              label: "Data",
              cmd: "kaggle datasets download yug201/delhi-5-minute-electricity-demand-for-forecasting -p training/data/delhi --unzip",
            },
            { label: "Train, export, check", cmd: meta.command },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Data: <a href={meta.data.url}>{meta.data.name}</a> by yug201 on Kaggle, licensed {meta.data.license}.
        </p>
      </Section>
    </article>
  );
}
