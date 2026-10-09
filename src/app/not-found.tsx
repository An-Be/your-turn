import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ForgetDeadLink } from "@/components/tracker/forget-dead-link";
import { buttonVariants } from "@/components/ui/button";
import { Shell } from "@/components/ui/shell";

export default function NotFound() {
  return (
    <Shell>
      <SiteHeader right="404" />
      <main className="flex flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="display text-[48px]">This link doesn&apos;t work.</h1>
        <p className="text-[13px] leading-relaxed text-mute">
          It may have been rotated. Ask the other player for the new one.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg", block: true })}>
          Start a new tracker
        </Link>
      </main>
      <SiteFooter />
      <ForgetDeadLink />
    </Shell>
  );
}
