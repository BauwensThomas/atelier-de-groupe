import "server-only";

// Limites simples en mémoire (par instance Vercel). Le pare-feu Vercel et Turnstile
// complètent cette protection de base.

type Entry = { count: number; until: number; seen: number };

const failures = new Map<string, Entry>();
const hits = new Map<string, Entry>();

const MAX_FAILURES = 5;
const BLOCK_MS = 10 * 60 * 1000;

function cleanup(map: Map<string, Entry>, now: number) {
  if (map.size < 5000) return;
  for (const [key, entry] of map) {
    if (entry.until < now && now - entry.seen > BLOCK_MS) map.delete(key);
  }
}

/** Secondes restantes de blocage après trop d'échecs (0 si pas bloqué). */
export function blockedSeconds(key: string): number {
  const entry = failures.get(key);
  const now = Date.now();
  return entry && entry.until > now ? Math.ceil((entry.until - now) / 1000) : 0;
}

export function failureCount(key: string): number {
  return failures.get(key)?.count ?? 0;
}

export function registerFailure(key: string): void {
  const now = Date.now();
  cleanup(failures, now);
  const entry = failures.get(key) ?? { count: 0, until: 0, seen: now };
  if (entry.until && entry.until <= now) {
    entry.count = 0;
    entry.until = 0;
  }
  entry.count += 1;
  entry.seen = now;
  if (entry.count >= MAX_FAILURES) entry.until = now + BLOCK_MS;
  failures.set(key, entry);
}

export function registerSuccess(key: string): void {
  failures.delete(key);
}

/** Compte une action (par exemple une création de projet) : vrai si la limite est dépassée. */
export function overLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup(hits, now);
  const entry = hits.get(key);
  if (!entry || entry.until <= now) {
    hits.set(key, { count: 1, until: now + windowMs, seen: now });
    return false;
  }
  entry.count += 1;
  entry.seen = now;
  return entry.count > max;
}
