import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Systems" title="Projects">
        <p>Systems built end to end, each with a demo you can use.</p>
      </PageIntro>
      <ComingSoon what="Projects" />
    </>
  );
}
