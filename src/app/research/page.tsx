import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Research" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Papers & patents" title="Research">
        <p>Published papers and patent applications.</p>
      </PageIntro>
      <ComingSoon what="Research" />
    </>
  );
}
