import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CreateForm } from "@/components/tracker/create-form";
import { SavedTrackerCard } from "@/components/tracker/saved-tracker-card";
import { SectionLabel } from "@/components/ui/section-label";
import { Shell } from "@/components/ui/shell";

const STEPS = [
  ["Make a tracker", "Two names in, one secret link out. Save it and send it to the other person."],
  ["Check today", "The page shows who starts. Same answer on both phones."],
  ["Tap Done", "It flips for next time. Skip a day and nothing flips."],
] as const;

const WONT = [
  ["No accounts", "The link is the only key. Both of you can do everything."],
  ["No reminders", "It never pings either of you or nudges anyone to log."],
  ["Forgets in 7 days", "Older days are deleted. No streaks, no all-time scores."],
  ["Nothing leaves", "No export, no sharing the log. It lives in the tracker."],
] as const;

export default function Home() {
  return (
    <>
      <SiteHeader right="No login" />
      <Shell>
        <main className="flex flex-col gap-14 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="display text-[56px]">Whose turn is it today?</h1>
            <p className="max-w-[36ch] text-[13px] leading-relaxed text-mute">
              One shared link for two people who take turns. It shows who starts today, flips when you&apos;re
              done, and settles &ldquo;wait, who went last time?&rdquo;
            </p>
          </div>

          <SavedTrackerCard />

          <CreateForm />

          <section>
            <SectionLabel n="03">How it works</SectionLabel>
            <ol className="border border-ink">
              {STEPS.map(([title, body], i) => (
                <li key={title} className={`flex gap-4 px-5 py-4 ${i > 0 ? "border-t border-ink" : ""}`}>
                  <span className="label pt-1 text-mute">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-[18px] font-medium tracking-[-0.02em]">{title}</span>
                    <span className="text-[12px] leading-relaxed text-mute">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionLabel n="04">What it won&apos;t do</SectionLabel>
            <div className="grid grid-cols-2 border border-ink">
              {WONT.map(([title, body], i) => (
                <div
                  key={title}
                  className={`flex flex-col gap-2 px-4 py-4 ${i % 2 === 1 ? "border-l border-ink" : ""} ${
                    i > 1 ? "border-t border-ink" : ""
                  }`}
                >
                  <span className="font-display text-[16px] font-medium leading-tight tracking-[-0.02em]">{title}</span>
                  <span className="text-[11px] leading-relaxed text-mute">{body}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              Built so a shared log can&apos;t turn into a way to keep tabs on someone.
            </p>
          </section>
        </main>
        <SiteFooter />
      </Shell>
    </>
  );
}
