// Supabase Edge Function "push": lock-screen "rest over" alerts for the Workout Logbook app.
// GET  -> { publicKey } for subscribing.
// POST { sub, end, title?, body? } -> sends a push when the rest timer ends (end = epoch ms),
//      unless the app has since started a new rest or stopped it (checked against settings.restEnd).
// POST { sub, test: true } -> sends a test notification now.
// Nothing is stored: the phone sends its subscription with each request.
import { sendPush, vapidKeys } from "./webpush.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SUBJECT = "https://rohanchopra10.github.io/workout-logbook/";
const HOP_MS = 110_000; // stay well under the function time limit, then hand over to a fresh run
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_DB_URL") || "";
let keysP: ReturnType<typeof vapidKeys> | null = null;
const keys = () => (keysP ??= vapidKeys(seed));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!seed) return json({ error: "no_seed" }, 500);
  if (req.method === "GET") return json({ publicKey: (await keys()).publicKey });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const authz = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { Authorization: authz, apikey } });
  if (!u.ok) return json({ error: "signin" }, 401);
  const user = await u.json();

  let body: any = {};
  try { body = await req.json(); } catch { /* bad body */ }
  const sub = body?.sub;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) return json({ error: "bad_sub" }, 400);
  const payload = { title: String(body.title ?? "Rest over").slice(0, 60), body: String(body.body ?? "Time for your next set").slice(0, 120) };

  if (body.test) {
    const r = await sendPush(sub, { title: "Rest alerts are on", body: "You'll get a message here when your rest ends." }, await keys(), SUBJECT);
    return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
  }

  const end = Number(body.end);
  if (!end || end < Date.now() - 5000 || end > Date.now() + 10 * 60_000) return json({ error: "bad_end" }, 400);

  const task = (async () => {
    const wait = end - Date.now();
    if (wait > HOP_MS) {
      await sleep(HOP_MS);
      // hand over the rest of the wait to a new run of this function
      await fetch(`${URL_}/functions/v1/push`, { method: "POST", headers: { Authorization: authz, apikey, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
      return;
    }
    if (wait > 0) await sleep(wait);
    // still the current rest? (the app clears or replaces settings.restEnd when you stop or start another rest)
    const r = await fetch(`${URL_}/rest/v1/logbooks?select=restEnd:data->settings->restEnd&user_id=eq.${encodeURIComponent(user.id)}`, { headers: { Authorization: authz, apikey } }).catch(() => null);
    if (r?.ok) {
      const rows = await r.json().catch(() => []);
      const cur = Number(rows?.[0]?.restEnd ?? 0);
      if (cur && Math.abs(cur - end) > 1500) return; // a newer rest replaced this one
      if (rows?.[0] && !cur) return; // rest was stopped
    }
    await sendPush(sub, payload, await keys(), SUBJECT).catch(() => {});
  })();
  // @ts-ignore EdgeRuntime is provided by Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task); else await task;
  return json({ ok: true, scheduled: end }, 202);
});
