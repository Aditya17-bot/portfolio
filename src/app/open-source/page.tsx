import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Open source" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Contributions" title="Open source">
        <p>Merged fixes in libraries people depend on, with the bug, the cause and the test.</p>
      </PageIntro>
      <ComingSoon what="Open source" />
    </>
  );
}
