const ITER = 100_000, SALT_LEN = 16, KEY_LEN = 32;
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => { const b = new Uint8Array(h.length / 2); for (let i=0;i<h.length;i+=2) b[i/2]=parseInt(h.slice(i,i+2),16); return b; };

export async function hashPassword(pw: string): Promise<string> {
  const salt = new Uint8Array(SALT_LEN);
  crypto.getRandomValues(salt);
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, km, KEY_LEN * 8);
  return `pbkdf2:${ITER}:${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1]!, 10);
  const salt = fromHex(parts[2]!);
  const storedHash = parts[3]!;
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, km, KEY_LEN * 8);
  const hashHex = toHex(bits);
  if (hashHex.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hashHex.length; i++) diff |= hashHex.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}
