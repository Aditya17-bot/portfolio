import type { Metadata } from "next";
import { FraudExplorer } from "@/components/FraudExplorer";
import { ModelHeader, Reproduce, ResultsTable, Section } from "@/components/ml/ModelLayout";
import data from "../../../../public/projects/fraud/curves.json";

const CODE = "https://github.com/Aditya17-bot/portfolio/tree/master/training/fraud_sparkov";
const NOTEBOOK = "https://github.com/Aditya17-bot/Fraud_detection";
const SRC = "public/projects/fraud/curves.json";

type Row = [number, number, number, number];
const rf = data.models.random_forest;
const iso = data.models.isolation_forest;
const d = data.data;

/** The budget row closest to a share of all test transactions. */
function nearest(curve: Row[], share: number) {
  let best = 0;
  curve.forEach((r, i) => {
    if (Math.abs(r[0] / d.test_rows - share) < Math.abs(curve[best][0] / d.test_rows - share)) best = i;
  });
  return best;
}

const pct = (v: number, digits = 1) => `${(100 * v).toFixed(digits)}%`;
const fmt = (v: number) => v.toLocaleString("en-US");

export const metadata: Metadata = {
  title: "Fraud detection",
  description: `A random forest and an isolation forest on 1.85 million card transactions: pick an alert budget and see what each catches. PR-AUC ${rf.pr_auc.toFixed(3)} on a later, unseen period.`,
};

export default function Page() {
  const rfCurve = rf.curve as Row[];
  const isoCurve = iso.curve as Row[];
  const half = nearest(rfCurve, 0.005);
  const [hAlerts, hRf] = rfCurve[half];
  const hIso = isoCurve[half][1];
  const op = rf.at_threshold;
  const top = data.importance.slice(0, 3).map(([k]) => k as string);
  const names: Record<string, string> = {
    log_amt: "the amount",
    category: "the merchant category",
    hour: "the hour",
    weekday: "the weekday",
    age: "the cardholder's age",
    distance_km: "the distance to the merchant",
    log_city_pop: "the city's population",
    gender: "gender",
    log_since_last: "time since the card's last transaction",
    count_24h: "the card's transactions in the last 24 hours",
    log_spend_24h: "the card's spend in the last 24 hours",
    amt_vs_card_mean: "the amount against the card's usual amount",
  };

  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#fraud", label: "Projects" }}
        kind="Project"
        badge="interactive"
        family="Fraud detection"
        date="Oct 2026"
        title="Card fraud: what a review budget buys"
        lede={
          <p>
            In the test months, one transaction in {Math.round(d.test_rows / d.test_fraud)} is fraud, so accuracy
            says nothing: flagging nothing at all is {pct(1 - d.test_fraud / d.test_rows, 2)} accurate. What a bank actually chooses is how many transactions its team can review. Pick that budget and
            see what a supervised random forest and an unsupervised isolation forest each catch on half a year of
            simulated transactions they never saw.
          </p>
        }
        stats={[
          { label: "Random forest PR-AUC, test", value: rf.pr_auc.toFixed(3) },
          { label: "Isolation forest PR-AUC, test", value: iso.pr_auc.toFixed(3) },
          { label: "Test transactions", value: fmt(d.test_rows) },
          { label: "Fraud in test", value: `${fmt(d.test_fraud)} (${pct(d.test_fraud / d.test_rows, 2)})` },
        ]}
      />

      <Section title="Try it" id="try">
        <FraudExplorer
          models={[
            { key: "rf", label: "Random forest (learns from labels)", tone: "b", curve: rfCurve },
            { key: "iso", label: "Isolation forest (no labels)", tone: "a", curve: isoCurve },
          ]}
          total={d.test_rows}
          frauds={d.test_fraud}
          fraudDollars={d.test_fraud_dollars}
          start={half}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Reviewing the riskiest {pct(hAlerts / d.test_rows, 1)} ({fmt(hAlerts)} alerts), the random forest catches{" "}
          {pct(hRf / d.test_fraud)} of the fraud and the isolation forest {pct(hIso / d.test_fraud)}. The isolation
          forest never sees a label: it only learns what is unusual, and most unusual transactions are not fraud.
        </p>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Random forest, average precision (PR-AUC)", value: rf.pr_auc.toFixed(4), source: SRC },
            { metric: "Random forest, ROC-AUC", value: rf.roc_auc.toFixed(4), source: SRC },
            {
              metric: "Random forest at the threshold with the best F1 on validation: precision / recall / F1",
              value: `${op.precision.toFixed(3)} / ${op.recall.toFixed(3)} / ${op.f1.toFixed(3)}`,
              source: SRC,
            },
            { metric: "Isolation forest, average precision (PR-AUC)", value: iso.pr_auc.toFixed(4), source: SRC },
            { metric: "Isolation forest, ROC-AUC", value: iso.roc_auc.toFixed(4), source: SRC },
            {
              metric: "Isolation forest at its best-F1 validation threshold: precision / recall / F1",
              value: `${iso.at_threshold.precision.toFixed(3)} / ${iso.at_threshold.recall.toFixed(3)} / ${iso.at_threshold.f1.toFixed(3)}`,
              source: SRC,
            },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          At that threshold the random forest raises {fmt(op.tp + op.fp)} alerts over the six test months:{" "}
          {fmt(op.tp)} real fraud, {fmt(op.fp)} false alarms, and {fmt(op.fn)} frauds missed. The threshold was chosen
          on the three months before the test period; nothing was tuned on the test months.
        </p>
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Split by time.</strong> Models fit on {d.fit[0]} to {d.fit[1]} ({fmt(d.fit_rows)} transactions,{" "}
            {fmt(d.fit_fraud)} fraud). {d.validation[0]} to {d.validation[1]} picks the threshold.{" "}
            {d.test[0]} to {d.test[1]} is the test. A random split would let the model see the same card&apos;s
            fraud spree on both sides.
          </p>
          <p>
            <strong>Features a bank has at that moment.</strong> The transaction itself (amount, category, hour,
            weekday, distance from the cardholder&apos;s home to the merchant) and the card&apos;s own history up to,
            not including, this transaction: time since its last use, count and spend over the previous 24 hours,
            and the amount against the card&apos;s average so far. The random forest leans most on{" "}
            {top.map((k) => names[k] ?? k).join(", ")}.
          </p>
          <p>
            <strong>Two models, two jobs.</strong> The random forest learns the fraud patterns that were labelled.
            The isolation forest scores how easy a transaction is to isolate with random splits: it needs no labels,
            so it can flag new kinds of fraud, at the price of many more false alarms.
          </p>
          <p>
            <strong>Earlier version.</strong> This rebuilds my 2025{" "}
            <a href={NOTEBOOK} target="_blank" rel="noreferrer">
              fraud notebook
            </a>
            . It one-hot encoded merchants and jobs into 2,150 columns and tuned its threshold on a random 20% of
            the training file, but then fit the models on the whole file, those rows included. Validation F1 read
            0.850; the test file gave 0.675. Here the threshold comes from later months the models never fit on,
            and per-card history replaces the one-hot columns.
          </p>
        </div>
      </Section>

      <Section title="Reproduce" id="reproduce">
        <Reproduce
          code={CODE}
          facts={[
            { label: "Hardware", value: data.hardware },
            { label: "Commit", value: data.commit },
            {
              label: "Data",
              value: `${d.name}, ${d.license}. Simulated transactions, not real cardholders.`,
            },
          ]}
          steps={[
            { label: "Environment", cmd: "pip install scikit-learn pandas kaggle" },
            { label: "Data", cmd: "kaggle datasets download kartik2112/fraud-detection -p training/data/sparkov --unzip" },
            { label: "Train and score", cmd: data.command },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Data: <a href={d.url}>{d.name}</a> by kartik2112 on Kaggle, generated with Brandon Harris&apos;s Sparkov
          simulator, {d.license}.
        </p>
      </Section>
    </article>
  );
}
