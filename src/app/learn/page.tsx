import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Learn" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Explainers" title="Learn">
        <p>Ideas taken apart step by step, computed in front of you.</p>
      </PageIntro>
      <ComingSoon what="Learn" />
    </>
  );
}
