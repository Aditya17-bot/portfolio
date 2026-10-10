import type { Metadata } from "next";
import { ComingSoon, PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Profile" title="About">
        <p>ML engineer and Computer Science student at VIT Vellore.</p>
      </PageIntro>
      <ComingSoon what="About" />
    </>
  );
}
