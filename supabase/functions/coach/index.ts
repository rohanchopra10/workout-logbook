// Supabase Edge Function "coach": sends one workout to Claude and returns the coach feedback.
// Secrets (set in Supabase → Edge Functions → Secrets, never in this repo):
//   ANTHROPIC_API_KEY  your Claude API key
//   COACH_EMAIL        account email(s) allowed to use it, comma-separated
//   COACH_MODEL        optional, defaults to claude-sonnet-5
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Who is asking? Check the signed-in user with Supabase Auth.
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const u = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: req.headers.get("Authorization") ?? "", apikey },
  });
  if (!u.ok) return json({ error: "signin" }, 401);
  const user = await u.json();
  const allowed = (Deno.env.get("COACH_EMAIL") ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(String(user.email ?? "").toLowerCase())) return json({ error: "not_allowed" }, 403);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "no_key" }, 503);

  // Either one feedback prompt {prompt} or a chat {system, messages:[{role, content}]}.
  let body: any = {};
  try { body = await req.json(); } catch { /* bad body */ }
  let system: string | undefined;
  let messages: { role: string; content: any }[] = [];
  if (Array.isArray(body?.messages)) {
    messages = body.messages.slice(-20)
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    system = typeof body.system === "string" ? body.system.slice(0, 16000) : undefined;
    if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "bad_request" }, 400);
  } else {
    const prompt = String(body?.prompt ?? "").slice(0, 12000);
    if (!prompt) return json({ error: "bad_request" }, 400);
    // Optional photos (body check-in): up to 3 small JPEG/PNG/WebP images as base64.
    const imgs = Array.isArray(body?.images) ? body.images.slice(0, 3) : [];
    const blocks: any[] = [];
    for (const im of imgs) {
      const mt = String(im?.media_type ?? "");
      const data = String(im?.data ?? "");
      if (!/^image\/(jpeg|png|webp)$/.test(mt) || !data || data.length > 2_000_000) return json({ error: "bad_image" }, 400);
      blocks.push({ type: "image", source: { type: "base64", media_type: mt, data } });
    }
    messages = [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text: prompt }] : prompt } as any];
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("COACH_MODEL") || "claude-sonnet-5",
      // Room for the model's built-in thinking plus the reply; low effort keeps it quick and cheap.
      max_tokens: 4000,
      output_config: { effort: "low" },
      ...(system ? { system } : {}),
      messages,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = JSON.stringify(d).toLowerCase();
    return json({ error: /credit|billing|balance/.test(msg) ? "no_credit" : "api", status: r.status, detail: d?.error?.message ?? "" }, 502);
  }
  const text = (d.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
  if (!text) return json({ error: "empty", stop: d.stop_reason ?? "" }, 502);
  return json({ text });
});
