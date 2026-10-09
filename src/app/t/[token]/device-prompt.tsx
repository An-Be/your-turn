"use client";

import { Button } from "@/components/ui/button";
import { Mark } from "@/components/mark";
import type { Player } from "@/lib/types";

export function DevicePrompt({
  names,
  current,
  onPick,
  onClose,
}: {
  names: Record<Player, string>;
  current: Player | "skip" | null;
  onPick: (v: Player | "skip") => void;
  onClose?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-q"
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
        <div className="flex items-center gap-3 border-b border-ink py-4">
          <Mark size={28} />
          <span className="label ml-auto text-mute">00 — Setup</span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 py-10">
          <h2 id="device-q" className="display text-[44px]">
            Which player is this device?
          </h2>

          <div className="flex flex-col">
            {(["A", "B"] as const).map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => onPick(p)}
                className={
                  "flex h-20 items-center justify-between border border-ink px-5 text-left transition-colors hover:bg-wash active:bg-ink active:text-paper " +
                  (i === 1 ? "-mt-px " : "") +
                  (current === p ? "bg-ink text-paper hover:bg-ink" : "bg-paper")
                }
              >
                <span className="display truncate text-[32px]">{names[p]}</span>
                <span className="label">{current === p ? "This device" : `Player ${i + 1}`}</span>
              </button>
            ))}
          </div>

          <p className="text-[12px] leading-relaxed text-mute">
            Saved on this phone only. It labels who logged each day, nothing more.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-ink py-4">
          <Button variant="ghost" size="sm" onClick={() => onPick("skip")}>
            Skip
          </Button>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
