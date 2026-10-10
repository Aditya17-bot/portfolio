import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";

export default function NotFound() {
  return (
    <PageIntro eyebrow="404" title="No neuron fires here.">
      <p>
        That page does not exist. <Link href="/" className="link">Back to the input layer</Link>.
      </p>
    </PageIntro>
  );
}
