// Remembers this phone's tracker so opening the home page can offer a way back.
//
// The secret link is still the only key: this just keeps a copy of it on this
// device (like browser history does), never on the server. Browser-only; every
// call is wrapped because storage can be blocked (private mode, strict settings).

export type SavedTracker = { token: string; playerAName: string; playerBName: string };

const KEY = "yourturn:tracker";
const EVENT = "yourturn:tracker-change";
const TOKEN_RE = /^[0-9A-Za-z]{16,32}$/;

/** Parses a stored value, rejecting anything malformed or tampered with. */
export function parseSavedTracker(raw: string | null): SavedTracker | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const { token, playerAName, playerBName } = v as Record<string, unknown>;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  if (typeof playerAName !== "string" || typeof playerBName !== "string") return null;
  return { token, playerAName: playerAName.slice(0, 24), playerBName: playerBName.slice(0, 24) };
}

// useSyncExternalStore needs a stable snapshot, so cache by the raw string.
let lastRaw: string | null = null;
let lastParsed: SavedTracker | null = null;

export function readSavedTracker(): SavedTracker | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseSavedTracker(raw);
  }
  return lastParsed;
}

export function saveTracker(t: SavedTracker) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(t));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage blocked: the link itself still works.
  }
}

/** Forgets the saved tracker. With a token, only if it's the one saved. */
export function forgetTracker(token?: string) {
  try {
    if (token && readSavedTracker()?.token !== token) return;
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // nothing to do
  }
}

export function subscribeSavedTracker(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
