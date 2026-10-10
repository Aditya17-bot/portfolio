import type { Metadata } from "next";
import { ModelHeader, ResultsTable, Section } from "@/components/ml/ModelLayout";
import { SplitterPlay, VoiceExplainer } from "@/components/projects/VoiceExplainer";

const REPO = "https://github.com/Aditya17-bot/voice_ai";

export const metadata: Metadata = {
  title: "Offline voice assistant",
  description:
    "An offline speech-in, speech-out assistant, replayed stage by stage: see where the time goes between your last word and its first, and what streaming, fillers and barge-in change.",
};

export default function Page() {
  return (
    <article className="container">
      <ModelHeader
        crumb={{ href: "/projects#voice-assistant", label: "Projects" }}
        kind="Project"
        badge="interactive"
        family="Offline voice assistant"
        date="2026"
        title="A voice assistant with nothing in the cloud"
        lede={
          <p>
            Speech in, speech out, with no server: voice detection, speech recognition, a language model and speech
            synthesis all run on the device. The hard part is not any one model but the wait between the end of your
            question and the first word of the answer. Below, one spoken turn is replayed stage by stage with the
            app&apos;s measured timings; change how it behaves and watch the first word move.
          </p>
        }
        stats={[
          { label: "First spoken word, real app on a laptop", value: "~1.3 s" },
          { label: "Filler phrase if the model is slow", value: "after 1.2 s" },
          { label: "Barge-in", value: "talk over it" },
          { label: "Network calls", value: "none" },
        ]}
      />

      <Section title="Try it" id="try">
        <VoiceExplainer />
        <p className="prose" style={{ fontSize: 14 }}>
          Press Ask, then untick &ldquo;speak sentence by sentence&rdquo; and ask again to see what streaming buys.
          Tick &ldquo;slow model&rdquo; to see the filler phrase cover a late answer, and press &ldquo;talk over
          it&rdquo; while it speaks. Stage times are the app&apos;s measurements; the replies are examples written for
          this page.
        </p>
      </Section>

      <Section title="The sentence splitter" id="splitter">
        <SplitterPlay />
      </Section>

      <Section title="How it works" id="how">
        <div className="prose">
          <p>
            <strong>Know when you have stopped.</strong> A voice detector listens to the microphone in short frames.
            Speech starts when the level rises above the background; the turn ends after 600 ms of silence, the price
            of not cutting people off mid-pause. The app uses the Silero neural detector; this page uses a simpler
            loudness detector with the same timing.
          </p>
          <p>
            <strong>Stream, don&apos;t wait.</strong> The language model writes its answer a few characters at a time.
            Each time a sentence is complete it goes straight to speech synthesis while the model keeps writing the
            next, so the first sentence is heard while the rest is still being generated. The splitter knows that
            &ldquo;Dr.&rdquo; and &ldquo;3.5&rdquo; do not end sentences.
          </p>
          <p>
            <strong>Never leave silence or an error.</strong> If no sentence is ready 1.2 s after the question, a short
            filler phrase plays. If the model fails, a canned conversational line replaces it, never a raw error.
          </p>
          <p>
            <strong>Let people interrupt.</strong> While the assistant talks, the microphone stays open with a stricter
            threshold, since its own voice leaks into the mic; speech that lasts 320 ms stops playback and the
            generation at once.
          </p>
        </div>
      </Section>

      <Section title="The real app" id="results">
        <ResultsTable
          rows={[
            { metric: "End-of-speech window", value: "600 ms", source: "ARCHITECTURE.md" },
            { metric: "Speech to text, faster-whisper base, int8, CPU", value: "~600 ms", source: "ARCHITECTURE.md" },
            { metric: "Llama 3.2 3B first sentence, streamed", value: "570–1,160 ms", source: "ARCHITECTURE.md" },
            { metric: "Piper speech for the first sentence", value: "100–540 ms", source: "ARCHITECTURE.md" },
            { metric: "Model plus speech to first audio, mean", value: "~1.34 s", source: "ARCHITECTURE.md" },
          ]}
        />
        <p className="prose" style={{ fontSize: 14 }}>
          Measured on an RTX 3050 laptop with Llama 3.2 3B in Ollama, faster-whisper and Piper, with nothing sent over
          the network.{" "}
          <a href={REPO} target="_blank" rel="noreferrer">
            Code on GitHub
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
