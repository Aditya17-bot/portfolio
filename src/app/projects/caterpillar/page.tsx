import type { Metadata } from "next";
import { ModelHeader, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { OperatorDemo } from "@/components/projects/OperatorCab";
import speed from "../../../../public/projects/operator/speed_model.json";

const REPO = "https://github.com/Aditya17-bot/caterpillar";

export const metadata: Metadata = {
  title: "Smart operator assistant",
  description:
    "Sit in a simulated excavator cab: the hackathon backend's safety rules, overheat forecast and speed advisor react to every control in your browser.",
};

export default function Page() {
  const m = speed.metrics;
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#caterpillar", label: "Projects" }}
        kind="Project"
        badge="interactive"
        family="Smart operator assistant"
        date="2026"
        title="An excavator cab that watches your back"
        lede={
          <p>
            Heavy-machine accidents come from a few repeated situations: an unbuckled operator, a worker inside the
            swing radius, a slope past the tipping point, an engine cooked by a blocked radiator. The Smart Operator
            Assistant reads the machine&apos;s sensors every second and turns them into alerts and forecasts. Below,
            its rules run in your browser on a simulated machine you drive.
          </p>
        }
        stats={[
          { label: "Seatbelt grace before a critical alert", value: "5 s" },
          { label: "Overheat forecast horizon", value: "3 min" },
          { label: "Speed advisor, hold-out R²", value: m.r2.toFixed(3) },
          { label: "ML models in the full app", value: "4" },
        ]}
      />

      <Section title="Try it" id="try">
        <OperatorDemo />
        <p className="prose" style={{ fontSize: 14 }}>
          Pick a situation or move the controls yourself. The simulation runs at four times real speed so the timed
          rules (seatbelt grace, idling) show up quickly; switch to real time to feel them as an operator would.
        </p>
      </Section>

      <Section title="How it decides" id="how">
        <div className="prose">
          <p>
            <strong>Rules with memory.</strong> A seatbelt that is off for a moment while climbing in is normal, so
            the alert waits 5 seconds. Obstacles are tiered: within 1 m is a warning, within 50 cm critical, and only
            while the engine runs. An alert that changes severity is logged again, so the incident log shows how a
            situation escalated and when it cleared.
          </p>
          <p>
            <strong>Forecasting, not just thresholds.</strong> Engine temperature behaves like a first-order system:
            it rises fast, then levels off where cooling balances load. Regressing the rate of change against the
            temperature itself over the last 40 seconds estimates that level. If it settles below 110 °C there is
            nothing to say; if it settles above, or keeps climbing, the cab warns with the time left. Turn on the
            cooling fault and the warning arrives minutes before the limit.
          </p>
          <p>
            <strong>A learned speed limit.</strong> A safe speed depends on the machine, the surface, the slope and
            the load. Gradient-boosted trees learned it from {m.rows.toLocaleString("en-US")} simulated runs and run
            here in JavaScript; going 25% over the advice raises a warning. Try mud on a downhill.
          </p>
        </div>
      </Section>

      <Section title="Results" id="results">
        <ResultsTable
          rows={[
            { metric: "Speed advisor in this page: gradient-boosted trees, hold-out R² / MAE", value: `${m.r2.toFixed(4)} / ${m.mae_kmh.toFixed(2)} km/h`, source: "public/projects/operator/speed_model.json" },
            { metric: "Speed advisor in the app: random forest, hold-out R² / MAE", value: "0.9819 / 0.61 km/h", source: "backend/RESULTS.md" },
            { metric: "Engine fault classifier (5 classes), accuracy / macro F1", value: "0.966 / 0.940", source: "backend/RESULTS.md" },
            { metric: "Task-time estimator, MAPE", value: "13.4%", source: "backend/RESULTS.md" },
            { metric: "Unusual-behaviour detector (isolation forest), precision / recall", value: "0.974 / 0.922", source: "backend/RESULTS.md" },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          All four models were trained on synthetic data from the project&apos;s own generator; there was no real
          machine to log. The browser speed advisor is smaller than the app&apos;s 11 MB random forest and was retrained
          from the same data so it fits in a web page.
        </p>
      </Section>

      <Section title="The full system" id="system">
        <div className="prose">
          <p>
            The app around these rules: a FastAPI backend fed every second by a machine simulator standing in for an
            ESP32 and its sensors, a live dashboard over WebSockets, in-browser drowsiness and person detection on
            the cab camera, a site map with geofences and machine-to-machine distance, SOS to nearby machines, a
            pre-start inspection that can lock the engine out, and an incident black box that keeps 60 seconds
            before each alert. Team project, built against a problem statement for CAT machinery operators.
          </p>
          <p>
            <a href={REPO} target="_blank" rel="noreferrer">
              Code on GitHub
            </a>
          </p>
        </div>
      </Section>
    </article>
  );
}
