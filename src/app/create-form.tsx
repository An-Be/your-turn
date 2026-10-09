"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/site-chrome";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";

export function CreateForm() {
  const router = useRouter();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [starter, setStarter] = useState<Player>("A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = a.trim().length > 0 && b.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAName: a, playerBName: b, starter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/t/${data.token}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-10">
      <section>
        <SectionLabel n="01">Players</SectionLabel>
        <div className="flex flex-col">
          <Input
            aria-label="First player"
            placeholder="Andrea"
            value={a}
            onChange={(e) => setA(e.target.value)}
            maxLength={24}
            autoComplete="off"
          />
          <Input
            aria-label="Second player"
            placeholder="Sabrina"
            value={b}
            onChange={(e) => setB(e.target.value)}
            maxLength={24}
            autoComplete="off"
            className="-mt-px"
          />
        </div>
      </section>

      <section>
        <SectionLabel n="02">Who starts today</SectionLabel>
        <div role="radiogroup" className="grid grid-cols-2">
          {(["A", "B"] as const).map((p, i) => {
            const label = (p === "A" ? a : b).trim() || (p === "A" ? "Player 1" : "Player 2");
            const on = starter === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStarter(p)}
                className={cn(
                  "flex h-14 items-center justify-between border border-ink px-4 text-left transition-colors",
                  i === 1 && "-ml-px",
                  on ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-wash",
                )}
              >
                <span className="truncate font-display text-[18px] font-medium tracking-[-0.02em]">{label}</span>
                <span className="label">{on ? "Starts" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={!ready || busy}>
          {busy ? "Creating…" : "Create tracker"}
        </Button>
        {error ? (
          <p role="alert" className="label border border-ink px-4 py-3">
            {error}
          </p>
        ) : (
          <p className="label text-mute">You get a secret link. Anyone with it can view and log.</p>
        )}
      </div>
    </form>
  );
}
