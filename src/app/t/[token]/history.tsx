"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/site-chrome";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";

export type Night = {
  date: string;
  starter: Player;
  status: "DONE" | "SKIPPED";
  appliedFlip: boolean;
  recordedBy: Player | null;
};
export type Activity = { type: "SWAP" | "UNDO" | "CORRECT" | "ROTATE"; date: string; by: Player | null };

type Draft = { date: string; starter: Player | null; status: "DONE" | "SKIPPED"; isNew: boolean };

function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDate(today, -1)) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
  const mo = dt.toLocaleDateString("en-US", { month: "short" });
  return `${wd} ${String(d).padStart(2, "0")} ${mo}`;
}

const ACTIVITY_VERB: Record<Activity["type"], string> = {
  SWAP: "Swapped",
  UNDO: "Undone",
  CORRECT: "Corrected",
  ROTATE: "Link rotated",
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label text-mute">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2">
        {options.map((o, i) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-11 truncate border border-ink px-3 font-display text-[16px] font-medium tracking-[-0.02em] transition-colors",
                i === 1 && "-ml-px",
                on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-wash",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function History({
  today,
  windowDays,
  history,
  activity,
  split,
  names,
  busy,
  onSave,
}: {
  today: string;
  windowDays: number;
  history: Night[];
  activity: Activity[];
  split: Record<Player, number>;
  names: Record<Player, string>;
  busy: boolean;
  onSave: (draft: { date: string; starter: Player; status: "DONE" | "SKIPPED"; isNew: boolean }) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  const byDate = new Map(history.map((n) => [n.date, n]));
  const days = Array.from({ length: windowDays }, (_, i) => shiftDate(today, -i));
  const activityFor = (date: string) => activity.filter((a) => a.date === date);

  function open(date: string) {
    if (date === today) return; // tonight is handled by Done / Skip / Undo above
    const n = byDate.get(date);
    setDraft(
      n
        ? { date, starter: n.starter, status: n.status, isNew: false }
        : { date, starter: null, status: "DONE", isNew: true },
    );
  }

  async function save() {
    if (!draft || !draft.starter) return;
    const ok = await onSave({ date: draft.date, starter: draft.starter, status: draft.status, isNew: draft.isNew });
    if (ok) setDraft(null);
  }

  return (
    <section>
      <SectionLabel n="02" aside={`Last ${windowDays} days`}>
        History
      </SectionLabel>

      <div className="grid grid-cols-2 border border-ink">
        {(["A", "B"] as const).map((p, i) => (
          <div key={p} className={cn("flex flex-col gap-1 px-5 py-4", i === 1 && "border-l border-ink")}>
            <span className="label truncate text-mute">{names[p]}</span>
            <span className="font-display text-[40px] font-semibold leading-none tracking-[-0.04em]">{split[p]}</span>
          </div>
        ))}
        <div className="col-span-2 border-t border-ink px-5 py-2">
          <span className="label text-mute">Days started and finished</span>
        </div>
      </div>

      <ol className="-mt-px border border-ink">
        {days.map((date, i) => {
          const n = byDate.get(date);
          const acts = activityFor(date);
          const isTonight = date === today;
          const editing = draft?.date === date;
          return (
            <li key={date} className={cn(i > 0 && "border-t border-ink")}>
              <button
                type="button"
                onClick={() => (editing ? setDraft(null) : open(date))}
                disabled={isTonight}
                aria-expanded={editing}
                className={cn(
                  "flex w-full items-baseline justify-between gap-4 px-5 py-3 text-left",
                  !isTonight && "hover:bg-wash",
                  editing && "bg-wash",
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="label text-mute">{dayLabel(date, today)}</span>
                  {n ? (
                    <span className="truncate font-display text-[17px] font-medium tracking-[-0.02em]">
                      {n.status === "DONE" ? `${names[n.starter]} started` : "Skipped"}
                    </span>
                  ) : (
                    <span className="font-display text-[17px] font-medium tracking-[-0.02em] text-faint">
                      {isTonight ? "Not logged yet" : "Not logged"}
                    </span>
                  )}
                  {n?.recordedBy || acts.length ? (
                    <span className="label normal-case tracking-[0.04em] text-mute">
                      {[
                        n?.recordedBy ? `Logged by ${names[n.recordedBy]}` : null,
                        ...acts.map((a) => `${ACTIVITY_VERB[a.type]}${a.by ? ` by ${names[a.by]}` : ""}`),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
                {!isTonight ? <span className="label shrink-0">{editing ? "Close" : n ? "Edit" : "Add"}</span> : null}
              </button>

              {editing && draft ? (
                <div className="flex flex-col gap-4 border-t border-ink bg-paper px-5 py-4">
                  <Segmented
                    label="Who started"
                    value={draft.starter}
                    options={[
                      { value: "A", label: names.A },
                      { value: "B", label: names.B },
                    ]}
                    onChange={(v) => setDraft({ ...draft, starter: v })}
                  />
                  <Segmented
                    label="That day"
                    value={draft.status}
                    options={[
                      { value: "DONE", label: "Played" },
                      { value: "SKIPPED", label: "Skipped" },
                    ]}
                    onChange={(v) => setDraft({ ...draft, status: v })}
                  />
                  <p className="text-[12px] leading-relaxed text-mute">
                    {draft.isNew ? "Adding a past day" : "Fixing a past day"} doesn&apos;t change who starts next.
                    Use Swap for that.
                  </p>
                  <div className="grid grid-cols-2">
                    <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button className="-ml-px" onClick={save} disabled={busy || !draft.starter}>
                      {busy ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="label mt-3 normal-case tracking-[0.04em] text-mute">
        Days older than {windowDays} days are deleted for good. There&apos;s no export.
      </p>
    </section>
  );
}
