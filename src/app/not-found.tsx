import Link from "next/link";
import { Shell, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Shell>
      <SiteHeader right="404" />
      <main className="flex flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="display text-[48px]">This link doesn&apos;t work.</h1>
        <p className="text-[13px] leading-relaxed text-mute">
          It may have been rotated. Ask the other player for the new one.
        </p>
        <Link href="/">
          <Button variant="outline" size="lg" className="w-full">
            Start a new tracker
          </Button>
        </Link>
      </main>
      <SiteFooter />
    </Shell>
  );
}
