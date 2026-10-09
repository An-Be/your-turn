"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { forgetTracker, readSavedTracker, subscribeSavedTracker } from "@/lib/saved-tracker";

/**
 * "Your tracker" shortcut on the home page, shown only when this phone has
 * opened a tracker before. Renders nothing on the server, then appears after
 * hydration if a tracker is saved on this device.
 */
export function SavedTrackerCard() {
  const saved = useSyncExternalStore(subscribeSavedTracker, readSavedTracker, () => null);
  if (!saved) return null;

  return (
    <section>
      <SectionLabel n="00" aside="On this phone">
        Your tracker
      </SectionLabel>
      <div className="border border-ink">
        <div className="flex flex-col gap-1 px-5 py-4">
          <span className="font-display text-[22px] font-medium tracking-[-0.02em]">
            {saved.playerAName} &amp; {saved.playerBName}
          </span>
        </div>
        <Link
          href={`/t/${saved.token}`}
          className={buttonVariants({ size: "lg", block: true, className: "border-x-0 border-b-0" })}
        >
          Open your tracker
        </Link>
      </div>
      <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => forgetTracker()}>
        Not yours? Forget it on this phone
      </Button>
    </section>
  );
}
