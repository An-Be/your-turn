import "server-only";
import { randomBytes } from "crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 128 bits of randomness, base62-encoded (~22 chars). */
export function newToken(): string {
  let n = BigInt("0x" + randomBytes(16).toString("hex"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out.padStart(22, "0");
}

export function isWellFormedToken(t: string): boolean {
  return /^[0-9A-Za-z]{16,32}$/.test(t);
}
