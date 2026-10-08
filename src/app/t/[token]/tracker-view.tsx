"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel, Shell, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { nameFor, type Player, type TrackerData } from "@/lib/types";
import { DevicePrompt } from "./device-prompt";

type DeviceChoice = Player | "skip";

// Keyed by household id, not token, so rotating the link doesn't re-prompt.
const deviceKey = (id: string) => `yourturn:device:${id}`;

function readDevice(id: string): DeviceChoice | null {
  try {
    const v = window.localStorage.getItem(deviceKey(id));
    return v === "A" || v === "B" || v === "skip" ? v : null;
  } catch {
    return null;
  }
}

function writeDevice(id: string, v: DeviceChoice) {
  try {
    window.localStorage.setItem(deviceKey(id), v);
  } catch {
    // Blocked storage: we'll just ask again next visit.
  }
}

function formatToday(d: Date) {
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const mo = d.toLocaleDateString("en-US", { month: "short" });
  return `${wd} ${day} ${mo}`;
}

export function TrackerView({ tracker, justCreated }: { tracker: TrackerData; justCreated: boolean }) {
  const names: Record<Player, string> = { A: tracker.playerAName, B: tracker.playerBName };
  const starter = tracker.currentStarter;
  const other: Player = starter === "A" ? "B" : "A";

  const [device, setDevice] = useState<DeviceChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [today, setToday] = useState<string>("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const d = readDevice(tracker.id);
    setDevice(d);
    setPromptOpen(d === null);
    setHydrated(true);
    setToday(formatToday(new Date()));
    setUrl(`${window.location.origin}/t/${tracker.token}`);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    if (justCreated) window.history.replaceState(null, "", `/t/${tracker.token}`);
  }, [tracker.id, tracker.token, justCreated]);

  function pick(v: DeviceChoice) {
    writeDevice(tracker.id, v);
    setDevice(v);
    setPromptOpen(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked; the URL is visible and selectable.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Your Turn", text: "Whose turn is it tonight?", url });
    } catch {
      // User dismissed the share sheet.
    }
  }

  // The person on this device sends the link to the other one.
  const recipient = device === "A" || device === "B" ? names[device === "A" ? "B" : "A"] : "the other player";

  return (
    <Shell>
      <SiteHeader right={today || " "} />

      <main className="flex flex-col gap-10 py-8">
        <section aria-live="polite">
          <SectionLabel n="01">Tonight</SectionLabel>
          <div className="border border-ink">
            <div className="flex flex-col gap-3 px-5 pb-6 pt-8">
              <h1 className="display break-words text-[clamp(56px,18vw,88px)]">{names[starter]}</h1>
              <span className="label">starts</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink px-5 py-4">
              <span className="label text-mute">Tomorrow</span>
              <span className="font-display text-[18px] font-medium tracking-[-0.02em]">{names[other]}</span>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel n="02">Link</SectionLabel>
          {justCreated ? (
            <p className="mb-3 text-[13px] leading-relaxed">
              Send this to {recipient}. The link is the only key, so keep it between you two.
            </p>
          ) : null}
          <div className="border border-ink">
            <div className="truncate px-4 py-3 text-[12px] text-mute" title={url}>
              {url || " "}
            </div>
            <div className={`grid border-t border-ink ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
              {canShare ? (
                <Button variant="primary" className="h-12 border-0" onClick={share}>
                  Share
                </Button>
              ) : null}
              <Button
                variant={canShare ? "outline" : "primary"}
                className={`h-12 border-0 ${canShare ? "border-l border-ink" : ""}`}
                onClick={copy}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel n="03">This device</SectionLabel>
          <div className="flex items-center justify-between border border-ink px-4 py-3">
            <span className="font-display text-[18px] font-medium tracking-[-0.02em]">
              {!hydrated ? " " : device === "A" || device === "B" ? names[device] : "Not set"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPromptOpen(true)}>
              Change
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />

      {promptOpen ? (
        <DevicePrompt
          names={{ A: nameFor(tracker, "A"), B: nameFor(tracker, "B") }}
          current={device}
          onPick={pick}
          onClose={device !== null ? () => setPromptOpen(false) : undefined}
        />
      ) : null}
    </Shell>
  );
}
