// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) using WebCrypto only. No secrets stored:
// the VAPID key pair is derived from a server-side secret that already exists in the project.
const te = new TextEncoder();
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

// --- P-256 point multiplication (only used once to get the public key from the derived private key) ---
const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const A = P - 3n;
const G: [bigint, bigint] = [0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n, 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n];
const mod = (a: bigint, m = P) => ((a % m) + m) % m;
const inv = (a: bigint) => { let [t, nt, r, nr] = [0n, 1n, P, mod(a)]; while (nr) { const q = r / nr; [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; } return mod(t); };
type Pt = [bigint, bigint] | null;
const add = (p: Pt, q: Pt): Pt => {
  if (!p) return q; if (!q) return p;
  if (p[0] === q[0] && mod(p[1] + q[1]) === 0n) return null;
  const l = p[0] === q[0] && p[1] === q[1] ? mod((3n * p[0] * p[0] + A) * inv(2n * p[1])) : mod((q[1] - p[1]) * inv(q[0] - p[0]));
  const x = mod(l * l - p[0] - q[0]);
  return [x, mod(l * (p[0] - x) - p[1])];
};
const mul = (k: bigint, p: Pt): Pt => { let r: Pt = null; while (k > 0n) { if (k & 1n) r = add(r, p); p = add(p, p); k >>= 1n; } return r; };
const toBytes = (n: bigint) => { const o = new Uint8Array(32); for (let i = 31; i >= 0; i--) { o[i] = Number(n & 0xffn); n >>= 8n; } return o; };
const toBig = (b: Uint8Array) => b.reduce((n, x) => (n << 8n) | BigInt(x), 0n);

export async function vapidKeys(seed: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode("workout-logbook-vapid-v1|" + seed)));
  const d = mod(toBig(h), N - 1n) + 1n;
  const Q = mul(d, G)!;
  const pub = cat(new Uint8Array([4]), toBytes(Q[0]), toBytes(Q[1]));
  const jwk = { kty: "EC", crv: "P-256", d: b64u(toBytes(d)), x: b64u(toBytes(Q[0])), y: b64u(toBytes(Q[1])), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { publicKey: b64u(pub), signKey: key };
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

export async function encrypt(p256dh: string, auth: string, payload: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const header = cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub);
  return cat(header, ct);
}

export async function vapidAuth(endpoint: string, keys: { publicKey: string; signKey: CryptoKey }, subject: string) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.signKey, te.encode(h + "." + c)));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${keys.publicKey}`;
}

export async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: unknown, keys: { publicKey: string; signKey: CryptoKey }, subject: string) {
  const body = await encrypt(sub.keys.p256dh, sub.keys.auth, te.encode(JSON.stringify(payload)));
  return fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidAuth(sub.endpoint, keys, subject), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "120", Urgency: "high" },
    body,
  });
}
