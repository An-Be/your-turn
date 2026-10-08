"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Shell } from "@/components/ui/shell";
import { api } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import { nameFor, type Player, type TrackerData } from "@/lib/types";
import { DevicePrompt } from "./device-prompt";
import { History, type Activity, type Night } from "./history";

type TrackerSnapshot = {
  currentStarter: Player;
  tonight: Night | null;
  history?: Night[];
  activity?: Activity[];
  split?: Record<Player, number>;
  windowDays?: number;
};

/** The conflicting record a 409 carries, if any. */
function existingFrom(body: unknown): Night | null {
  if (body && typeof body === "object" && "existing" in body && body.existing && typeof body.existing === "object") {
    return body.existing as Night;
  }
  return null;
}

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

  // refresh() reads the latest token without being re-created on every rotate.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const recordedBy: Player | null = device === "A" || device === "B" ? device : null;
  const url = origin ? `${origin}/t/${token}` : "";

  const refresh = useCallback(async () => {
    const res = await api<TrackerSnapshot>(`/api/households/${tokenRef.current}?today=${localToday()}`, { method: "GET" });
    if (!res.ok) {
      if (res.status === 404) setNotice("This link no longer works. It may have been rotated on the other phone.");
      // Offline or a server hiccup: keep showing the last known state.
      return;
    }
    const data = res.data;
    setCurrentStarter(data.currentStarter);
    setTonight(data.tonight);
    setHistory(data.history ?? []);
    setActivity(data.activity ?? []);
    setSplit(data.split ?? { A: 0, B: 0 });
    setWindowDays(data.windowDays ?? 7);
    setToday(localToday());
    setSynced(true);
  }, []);

  useEffect(() => {
    // Device choice, origin and the local date only exist in the browser. Reading
    // them here, after hydration, keeps server and client HTML identical.
    const d = readDevice(tracker.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser-only state
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

  function post<T>(path: string, body: Record<string, unknown>) {
    return api<T>(`/api/households/${token}${path}`, { method: "POST", body });
  }

  async function record(status: "DONE" | "SKIPPED") {
    if (pending) return;
    setPending(status === "DONE" ? "done" : "skip");
    setNotice(null);
    const today = localToday();
    const res = await post<{ currentStarter: Player; tonight: Night }>("/nights", { date: today, today, status, recordedBy });
    if (res.ok) {
      setCurrentStarter(res.data.currentStarter);
      setTonight(res.data.tonight);
      refresh();
    } else if (res.status === 409 && existingFrom(res.body)) {
      const e = existingFrom(res.body) as Night;
      const who = e.recordedBy ? ` by ${names[e.recordedBy]}` : "";
      setNotice(`Already logged as ${e.status === "DONE" ? "done" : "skipped"}${who}.`);
      await refresh();
    } else {
      setNotice(res.status === 0 ? "You're offline. Nothing was saved." : res.error);
    }
    setPending(null);
  }

  async function swap() {
    if (pending) return;
    setPending("swap");
    setNotice(null);
    const res = await post<{ currentStarter: Player }>("/swap", { today: localToday(), recordedBy });
    if (res.ok) {
      setCurrentStarter(res.data.currentStarter);
      refresh();
    } else {
      setNotice(res.status === 0 ? "You're offline. Nothing was saved." : res.error);
    }
    setPending(null);
  }

  async function undo() {
    if (pending || !tonight) return;
    setPending("undo");
    setNotice(null);
    const today = localToday();
    const qs = new URLSearchParams({ today });
    if (recordedBy) qs.set("by", recordedBy);
    const res = await api<{ currentStarter: Player }>(`/api/households/${token}/nights/${today}?${qs}`, { method: "DELETE" });
    if (res.ok) {
      setCurrentStarter(res.data.currentStarter);
      setTonight(null);
      refresh();
    } else if (res.status === 409) {
      await refresh();
    } else {
      setNotice(res.status === 0 ? "You're offline. Nothing was changed." : res.error);
    }
    setPending(null);
  }

  async function rotate() {
    if (pending) return;
    setPending("rotate");
    setNotice(null);
    const res = await post<{ token: string }>("/rotate", { today: localToday(), recordedBy });
    if (res.ok && typeof res.data.token === "string") {
      setToken(res.data.token);
      window.history.replaceState(null, "", `/t/${res.data.token}`);
      setLinkNotice("rotated");
      setConfirmRotate(false);
    } else if (!res.ok) {
      setNotice(res.status === 0 ? "You're offline. The link was not changed." : res.error);
    }
    setPending(null);
  }

  async function saveNight(d: { date: string; starter: Player; status: "DONE" | "SKIPPED"; isNew: boolean }) {
    if (pending) return false;
    setPending("history");
    setNotice(null);
    const t = localToday();
    const res = d.isNew
      ? await post("/nights", { date: d.date, today: t, starter: d.starter, status: d.status, recordedBy })
      : await api(`/api/households/${token}/nights/${d.date}`, {
          method: "PATCH",
          body: { today: t, starter: d.starter, status: d.status, recordedBy },
        });
    if (res.status !== 0) await refresh();
    setPending(null);
    if (!res.ok) {
      setNotice(res.status === 0 ? "You're offline. Nothing was saved." : res.error);
      return false;
    }
    return true;
  }

  async function copy() {
    // Falls back to execCommand on plain-http LAN testing; if both fail, the URL stays visible and selectable.
    if (!(await copyToClipboard(url))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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
                  <span className="label text-mute">Tomorrow, if you play</span>
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
