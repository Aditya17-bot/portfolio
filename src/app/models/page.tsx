import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Models" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Model zoo" title="Models">
        <p>Every model here is trained from scratch, and every one runs in your browser. Each page shows the run behind its numbers.</p>
      </PageIntro>
      <ComingSoon what="Models" />
    </>
  );
}
