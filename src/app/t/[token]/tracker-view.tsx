"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel, Shell, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { nameFor, type Player, type TrackerData } from "@/lib/types";
import { DevicePrompt } from "./device-prompt";
import { History, type Activity, type Night } from "./history";

type DeviceChoice = Player | "skip";
type Pending = null | "done" | "skip" | "swap" | "undo" | "rotate" | "history";

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

/** The device's local calendar date, yyyy-mm-dd. */
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatToday(d: Date) {
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const mo = d.toLocaleDateString("en-US", { month: "short" });
  return `${wd} ${day} ${mo}`;
}

export function TrackerView({ tracker, justCreated }: { tracker: TrackerData; justCreated: boolean }) {
  const names: Record<Player, string> = { A: tracker.playerAName, B: tracker.playerBName };

  const [token, setToken] = useState(tracker.token);
  const [currentStarter, setCurrentStarter] = useState<Player>(tracker.currentStarter);
  const [tonight, setTonight] = useState<Night | null>(null);
  const [history, setHistory] = useState<Night[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [split, setSplit] = useState<Record<Player, number>>({ A: 0, B: 0 });
  const [windowDays, setWindowDays] = useState(7);
  const [today, setToday] = useState("");
  const [synced, setSynced] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<"created" | "rotated" | null>(justCreated ? "created" : null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const [device, setDevice] = useState<DeviceChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const recordedBy: Player | null = device === "A" || device === "B" ? device : null;
  const url = origin ? `${origin}/t/${token}` : "";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/households/${tokenRef.current}?today=${localToday()}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotice("This link no longer works. It may have been rotated on the other phone.");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setCurrentStarter(data.currentStarter);
      setTonight(data.tonight);
      setHistory(data.history ?? []);
      setActivity(data.activity ?? []);
      setSplit(data.split ?? { A: 0, B: 0 });
      setWindowDays(data.windowDays ?? 7);
      setToday(localToday());
      setSynced(true);
    } catch {
      // Offline: keep showing the last known state.
    }
  }, []);

  useEffect(() => {
    const d = readDevice(tracker.id);
    setDevice(d);
    setPromptOpen(d === null);
    setHydrated(true);
    setTodayLabel(formatToday(new Date()));
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
    if (justCreated) window.history.replaceState(null, "", `/t/${tracker.token}`);

    refresh();
    // Keep both phones in step: refresh when the tab comes back and every 30s while visible.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTodayLabel(formatToday(new Date()));
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [tracker.id, tracker.token, justCreated, refresh]);

  function pick(v: DeviceChoice) {
    writeDevice(tracker.id, v);
    setDevice(v);
    setPromptOpen(false);
  }

  async function post(path: string, body: Record<string, unknown>) {
    return fetch(`/api/households/${token}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function record(status: "DONE" | "SKIPPED") {
    if (pending) return;
    setPending(status === "DONE" ? "done" : "skip");
    setNotice(null);
    const today = localToday();
    try {
      const res = await post("/nights", { date: today, today, status, recordedBy });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setCurrentStarter(data.currentStarter);
        setTonight(data.tonight);
        refresh();
      } else if (res.status === 409 && data.existing) {
        const e: Night = data.existing;
        const who = e.recordedBy ? ` by ${names[e.recordedBy]}` : "";
        setNotice(`Already logged as ${e.status === "DONE" ? "done" : "skipped"}${who}.`);
        await refresh();
      } else {
        setNotice(data.error ?? "Couldn't save. Try again.");
      }
    } catch {
      setNotice("You're offline. Nothing was saved.");
    } finally {
      setPending(null);
    }
  }

  async function swap() {
    if (pending) return;
    setPending("swap");
    setNotice(null);
    try {
      const res = await post("/swap", { today: localToday(), recordedBy });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCurrentStarter(data.currentStarter);
        refresh();
      } else setNotice(data.error ?? "Couldn't swap. Try again.");
    } catch {
      setNotice("You're offline. Nothing was saved.");
    } finally {
      setPending(null);
    }
  }

  async function undo() {
    if (pending || !tonight) return;
    setPending("undo");
    setNotice(null);
    const today = localToday();
    const qs = new URLSearchParams({ today });
    if (recordedBy) qs.set("by", recordedBy);
    try {
      const res = await fetch(`/api/households/${token}/nights/${today}?${qs}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCurrentStarter(data.currentStarter);
        setTonight(null);
        refresh();
      } else if (res.status === 409) {
        await refresh();
      } else {
        setNotice(data.error ?? "Couldn't undo. Try again.");
      }
    } catch {
      setNotice("You're offline. Nothing was changed.");
    } finally {
      setPending(null);
    }
  }

  async function rotate() {
    if (pending) return;
    setPending("rotate");
    setNotice(null);
    try {
      const res = await post("/rotate", { today: localToday(), recordedBy });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.token === "string") {
        setToken(data.token);
        window.history.replaceState(null, "", `/t/${data.token}`);
        setLinkNotice("rotated");
        setConfirmRotate(false);
      } else {
        setNotice(data.error ?? "Couldn't rotate the link. Try again.");
      }
    } catch {
      setNotice("You're offline. The link was not changed.");
    } finally {
      setPending(null);
    }
  }

  async function saveNight(d: { date: string; starter: Player; status: "DONE" | "SKIPPED"; isNew: boolean }) {
    if (pending) return false;
    setPending("history");
    setNotice(null);
    const t = localToday();
    try {
      const res = d.isNew
        ? await post("/nights", { date: d.date, today: t, starter: d.starter, status: d.status, recordedBy })
        : await fetch(`/api/households/${token}/nights/${d.date}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ today: t, starter: d.starter, status: d.status, recordedBy }),
          });
      const data = await res.json().catch(() => ({}));
      await refresh();
      if (!res.ok) {
        setNotice(data.error ?? "Couldn't save. Try again.");
        return false;
      }
      return true;
    } catch {
      setNotice("You're offline. Nothing was saved.");
      return false;
    } finally {
      setPending(null);
    }
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
      await navigator.share({ title: "TagYourTurn", text: "Whose turn is it tonight? Here\u2019s our TagYourTurn link.", url });
    } catch {
      // User dismissed the share sheet.
    }
  }

  const recipient = recordedBy ? names[recordedBy === "A" ? "B" : "A"] : "the other player";
  const busy = pending !== null;

  return (
    <Shell>
      <SiteHeader right={todayLabel || " "} />

      <main className="flex flex-col gap-10 py-8">
        <section aria-live="polite">
          <SectionLabel n="01" aside={tonight ? (tonight.status === "DONE" ? "Done" : "Skipped") : undefined}>
            Tonight
          </SectionLabel>

          <div className="border border-ink">
            {!tonight ? (
              <>
                <div className="flex flex-col gap-3 px-5 pb-6 pt-8">
                  <h1 className="display break-words text-[clamp(56px,18vw,88px)]">{names[currentStarter]}</h1>
                  <span className="label">starts</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-ink px-5 py-4">
                  <span className="label text-mute">Up next after Done</span>
                  <span className="font-display text-[18px] font-medium tracking-[-0.02em]">
                    {names[currentStarter === "A" ? "B" : "A"]}
                  </span>
                </div>
              </>
            ) : tonight.status === "DONE" ? (
              <>
                <div className="flex flex-col gap-3 px-5 pb-6 pt-8">
                  <span className="label text-mute">Tonight</span>
                  <h1 className="display break-words text-[clamp(48px,15vw,72px)]">{names[tonight.starter]}</h1>
                  <span className="label">
                    started{tonight.recordedBy ? ` · logged by ${names[tonight.recordedBy]}` : ""}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-ink bg-ink px-5 py-4 text-paper">
                  <span className="label">Next time</span>
                  <span className="font-display text-[22px] font-medium tracking-[-0.02em]">
                    {names[currentStarter]} starts
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-3 px-5 pb-6 pt-8">
                  <h1 className="display text-[clamp(48px,15vw,72px)]">Skipped</h1>
                  <span className="label">
                    no turn used{tonight.recordedBy ? ` · logged by ${names[tonight.recordedBy]}` : ""}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-ink bg-ink px-5 py-4 text-paper">
                  <span className="label">Next time</span>
                  <span className="font-display text-[22px] font-medium tracking-[-0.02em]">
                    {names[currentStarter]} starts
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-col">
            {!tonight ? (
              <>
                <Button size="lg" onClick={() => record("DONE")} disabled={busy || !synced}>
                  {pending === "done" ? "Saving…" : "Done for tonight"}
                </Button>
                <div className="-mt-px grid grid-cols-2">
                  <Button variant="outline" size="lg" onClick={() => record("SKIPPED")} disabled={busy || !synced}>
                    {pending === "skip" ? "Saving…" : "Skip tonight"}
                  </Button>
                  <Button variant="outline" size="lg" className="-ml-px" onClick={swap} disabled={busy || !synced}>
                    {pending === "swap" ? "Swapping…" : "Swap"}
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" size="lg" onClick={undo} disabled={busy}>
                {pending === "undo" ? "Undoing…" : "Undo"}
              </Button>
            )}
          </div>

          {notice ? (
            <p role="status" className="label mt-3 border border-ink px-4 py-3">
              {notice}
            </p>
          ) : null}
        </section>

        {synced && today ? (
          <History
            today={today}
            windowDays={windowDays}
            history={history}
            activity={activity}
            split={split}
            names={names}
            busy={pending === "history"}
            onSave={saveNight}
          />
        ) : null}

        <section>
          <SectionLabel n="03">Link</SectionLabel>
          {linkNotice ? (
            <p className="mb-3 text-[13px] leading-relaxed">
              {linkNotice === "rotated"
                ? `New link. The old one no longer works, so send this to ${recipient}.`
                : `Send this to ${recipient}. The link is the only key, so keep it between you two.`}
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

          {!confirmRotate ? (
            <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => setConfirmRotate(true)}>
              Rotate link
            </Button>
          ) : (
            <div className="mt-3 border border-ink">
              <p className="px-4 py-3 text-[12px] leading-relaxed">
                Makes a new link and kills the old one on both phones. History stays. Use this if the link leaked.
              </p>
              <div className="grid grid-cols-2 border-t border-ink">
                <Button variant="outline" className="h-12 border-0" onClick={() => setConfirmRotate(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="primary" className="h-12 border-0" onClick={rotate} disabled={busy}>
                  {pending === "rotate" ? "Rotating…" : "Rotate"}
                </Button>
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionLabel n="04">This device</SectionLabel>
          <div className="flex items-center justify-between border border-ink px-4 py-3">
            <span className="font-display text-[18px] font-medium tracking-[-0.02em]">
              {!hydrated ? " " : recordedBy ? names[recordedBy] : "Not set"}
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
