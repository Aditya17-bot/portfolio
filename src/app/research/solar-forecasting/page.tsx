import type { Metadata } from "next";
import Link from "next/link";
import { HourErrorChart } from "@/components/HourErrorChart";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { SolarExplorer } from "@/components/SolarExplorer";
import data from "../../../../public/projects/solar/explorer.json";

const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/solar_forecast";
const SRC = "public/projects/solar/explorer.json";

const t = data.table;
const names: Record<keyof typeof t, string> = {
  lgbm_solar: "LightGBM, calendar + weather + sun",
  lgbm_base: "LightGBM, calendar + weather",
  ridge_solar: "Linear (ridge), calendar + weather + sun",
  ridge_base: "Linear (ridge), calendar + weather",
  lstm: "LSTM (its inputs include the sun)",
  persistence: "Persistence: the last reading, held",
  yesterday: "Same time yesterday",
};
const f2 = (v: number) => `${v.toFixed(2)}%`;
const order = (Object.keys(t) as (keyof typeof t)[]).sort((a, b) => t[a].mape - t[b].mape);
const best = order[0];

export const metadata: Metadata = {
  title: "Solar-aware forecasting",
  description: `The idea of my SIPCOV-2026 paper rerun on public Delhi data: LightGBM, a linear model and an LSTM, with and without the sun's position. Best: ${f2(t[best].mape)} MAPE, 5 to 60 minutes ahead.`,
};

export default function Page() {
  const lgbmGain = t.lgbm_base.mape - t.lgbm_solar.mape;
  const ridgeGain = t.ridge_base.mape - t.ridge_solar.mape;
  const treesBeatLstm = t.lgbm_solar.mape < t.lstm.mape && t.lgbm_base.mape < t.lstm.mape;
  const negligible = (g: number) => Math.abs(g) < 0.02;
  const h = data.by_hour;
  const peakHour = h.lgbm_solar.indexOf(Math.max(...h.lgbm_solar));
  const dayHours = Array.from({ length: 24 }, (_, i) => i).filter((i) => data.sun_by_hour[i] > 0.3);
  const mean = (v: number[], idx: number[]) => idx.reduce((s, i) => s + v[i], 0) / idx.length;
  const dayGainRidge = mean(h.ridge_base, dayHours) - mean(h.ridge_solar, dayHours);
  const c = data.config;

  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/research", label: "Research" }}
        kind="Research"
        badge="interactive"
        family="Solar-aware forecasting"
        date="Oct 2026"
        title="Does knowing where the sun is help forecast Delhi's demand?"
        lede={
          <>
            <p>
              Rooftop solar is not metered, but it lowers the demand the grid sees in the middle of the day. My{" "}
              <Link href="/research">SIPCOV-2026 paper</Link> uses the sun&apos;s position as a stand-in for it. The
              paper&apos;s data and code are not public, so this reruns the idea in the open: the public Delhi data of
              the <Link href="/models/lstm-load">LSTM page</Link>, the same test year and forecast windows, with and
              without the sun.
            </p>
          </>
        }
        stats={[
          { label: `Best: ${names[best].split(",")[0]}, 5–60 min ahead`, value: f2(t[best].mape) },
          { label: "LSTM, same windows", value: f2(t.lstm.mape) },
          { label: "MAPE change with sun, LightGBM", value: `${lgbmGain >= 0 ? "−" : "+"}${Math.abs(lgbmGain).toFixed(3)} pts` },
          { label: "MAPE change with sun, linear", value: `${ridgeGain >= 0 ? "−" : "+"}${Math.abs(ridgeGain).toFixed(3)} pts` },
        ]}
      />

      <Section title="Try it" id="try">
        <SolarExplorer
          start={Math.max(0, data.days.dates.findIndex((d) => d.startsWith("2024-06")))}
          lines={[
            { key: "lgbm_solar", label: "LightGBM, with sun", tone: "signal" },
            { key: "lgbm_base", label: "LightGBM, calendar only", tone: "muted" },
            { key: "lstm", label: "LSTM", tone: "activation" },
            { key: "ridge_solar", label: "Linear, with sun", tone: "faint" },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Each line is the forecast made an hour earlier for every five-minute step of the day. Forecasts were
          computed once by the training script on the 2024 test year, which no model saw.
        </p>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={order.map((k) => ({
            metric: names[k],
            value: `${f2(t[k].mape)} · ${f2(t[k].mape_60)} · ${t[k].mae_mw.toFixed(0)} MW`,
            source: SRC,
          }))}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Values: MAPE over all 12 steps (5 to 60 minutes ahead) · MAPE at 60 minutes · mean absolute error, on the
          same {data.counts.test_origins.toLocaleString("en-US")} hourly forecast origins of 2024 for every model.
        </p>
      </Section>

      <Section title="What it shows" id="findings">
        <div className="prose">
          <p>
            <strong>{treesBeatLstm ? "Trees beat the LSTM, as in the paper." : "The LSTM holds its own here."}</strong>{" "}
            {treesBeatLstm
              ? `LightGBM reaches ${f2(t.lgbm_solar.mape)} against the LSTM's ${f2(t.lstm.mape)} on the same windows, from features built out of the same 24 hours of history.`
              : `The LSTM reaches ${f2(t.lstm.mape)} against LightGBM's ${f2(t.lgbm_solar.mape)}, unlike in the paper.`}
          </p>
          <p>
            <strong>
              {negligible(lgbmGain) ? "For trees, the sun adds nothing the calendar does not already say." : lgbmGain > 0 ? "The sun helps the trees." : "The sun features hurt the trees slightly."}
            </strong>{" "}
            LightGBM scores {f2(t.lgbm_base.mape)} without the sun features and {f2(t.lgbm_solar.mape)} with them.
            {negligible(lgbmGain)
              ? " Hour of day and day of year fix where the sun is, and trees can learn that mapping on their own."
              : ""}{" "}
            {ridgeGain > 0
              ? `A linear model cannot build that curve from sines and cosines, and there the sun features do help a little: ${f2(t.ridge_base.mape)} to ${f2(t.ridge_solar.mape)}. ${dayGainRidge >= 0.05 ? `Most of it comes in daylight (${dayGainRidge.toFixed(2)} points), where solar output would act.` : `But the gain is not in daylight hours (${dayGainRidge >= 0 ? "" : "−"}${Math.abs(dayGainRidge).toFixed(2)} points there), so it reads as a better daily curve for the linear model, not as a solar effect.`}`
              : `Even the linear model gains nothing from them (${f2(t.ridge_base.mape)} to ${f2(t.ridge_solar.mape)}).`}
          </p>
          <p>
            <strong>Not the paper&apos;s number.</strong> The paper reports 0.77% MAPE on its own 18 months of data
            and setup. These results use different data and should not be compared with it; what carries over is the
            method and the ranking of the models.
          </p>
        </div>
      </Section>

      <Section title="Where the error is" id="hours">
        <HourErrorChart
          sun={data.sun_by_hour}
          series={[
            { key: "lgbm_solar", label: "LightGBM, with sun", tone: "signal", values: h.lgbm_solar },
            { key: "lgbm_base", label: "LightGBM, calendar only", tone: "muted", values: h.lgbm_base },
            { key: "lstm", label: "LSTM", tone: "activation", values: h.lstm },
          ]}
          caption={`MAPE of the 60-minute-ahead forecast by the hour it is for, over ${data.counts.dense_origins.toLocaleString("en-US")} forecasts every 15 minutes through 2024. The hardest hour for LightGBM is ${String(peakHour).padStart(2, "0")}:00.`}
        />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Same problem as the LSTM.</strong> At each origin, load and weather are known up to five minutes
            before it; forecast the next 12 five-minute steps. Same five-minute grid, gap handling and breaks at
            impossible jumps, same {c.test_from.slice(0, 4)} test year.
          </p>
          <p>
            <strong>Features.</strong> From the previous 24 hours only: the last load, its changes over the last 5
            minutes to 4 hours, the 1-hour and 24-hour means, the load at the target time yesterday and how it moved
            from now to then, temperature, humidity and the temperature trend. From the calendar at the target time:
            hour, weekday and day of year, as sines and cosines. The sun group adds the sine of the sun&apos;s
            elevation at the target time and its change since the last reading.
          </p>
          <p>
            <strong>Models.</strong> One model per horizon predicts the change from the last reading. Ridge regression
            (alpha {c.ridge_alpha}) on standardised features. LightGBM with {c.lgbm.num_leaves} leaves and learning
            rate {c.lgbm.learning_rate}; its number of trees per horizon is set by early stopping on{" "}
            {c.validation_from.slice(0, 4)} while training on the years before, then the model is refit on all training
            years. The LSTM is the one on its own page, run through the same ONNX file the browser uses.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: data.hardware },
            { label: "Commit", value: data.commit },
            { label: "Data", value: `${data.data.name}, ${data.data.license}` },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install numpy scikit-learn lightgbm onnxruntime torch kaggle" },
            {
              label: "Data",
              cmd: "kaggle datasets download yug201/delhi-5-minute-electricity-demand-for-forecasting -p training/data/delhi --unzip",
            },
            { label: "LSTM first (its ONNX file is compared here)", cmd: "python training/lstm_load/train.py" },
            { label: "Run the comparison", cmd: data.command },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Data: <a href={data.data.url}>{data.data.name}</a> by yug201 on Kaggle, licensed {data.data.license}.
        </p>
      </Section>
    </article>
  );
}
