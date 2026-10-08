import Link from "next/link";
import { Mark } from "./mark";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 border-b border-ink py-4">
      <Link href="/" className="flex items-center gap-3">
        <Mark size={28} />
        <span className="display text-[22px] leading-none">Your Turn</span>
      </Link>
      {right ? <span className="label ml-auto text-mute">{right}</span> : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink py-5">
      <p className="label text-mute">Tiny tools for keeping things fair.</p>
    </footer>
  );
}

export function SectionLabel({ n, children, aside }: { n: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <span className="label">
        {n} — {children}
      </span>
      {aside ? <span className="label text-mute">{aside}</span> : null}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">{children}</div>;
}
