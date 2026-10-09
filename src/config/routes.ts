/**
 * Path prefixes whose next segment is a secret (a token that grants access).
 * Used to redact logs (src/lib/csp-report.ts). Keep in sync with the
 * privateHeaders entries in next.config.ts.
 */
export const secretPathPrefixes = ["/t/", "/api/households/"] as const;
