function toOpenAiMessages(system, messages = []) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
    out.push({ role: m?.role || "user", content });
  }
  return out;
}

function toPlainPrompt(system, messages = []) {
  const lines = [];
  if (system) lines.push(`System: ${system}`);
  for (const m of messages) {
    const role = m?.role || "user";
    const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
    lines.push(`${role}: ${content}`);
  }
  return lines.join("\n");
}

function getProviderOrder() {
  // Modes:
  // - premium-first (default): best quality first, then free fallback
  // - free-first: lowest cost first, then premium upgrades
  const mode = (process.env.SPANISH_APP_AI_MODE || "premium-first").toLowerCase();
  if (mode === "free-first") return ["gemini", "anthropic", "openai"];
  return ["anthropic", "openai", "gemini"];
}

function buildProviderClients() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiModel = process.env.SPANISH_APP_OPENAI_MODEL || "gpt-4o";
  const geminiModel = process.env.SPANISH_APP_GEMINI_MODEL || "gemini-2.0-flash";

  return {
    anthropic: {
      configured: !!anthropicKey,
      call: async ({ payload, probe = false }) => {
        const body = probe
          ? { model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }
          : payload;
        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });

        if (probe) {
          if (upstream.ok) return { ok: true, status: "ok", reason: "ready" };
          const data = await upstream.json().catch(() => ({}));
          return {
            ok: false,
            status: upstream.status === 429 ? "quota" : "error",
            reason: data?.error?.message || upstream.statusText,
          };
        }

        const text = await upstream.text();
        if (upstream.ok) {
          return {
            ok: true,
            response: { ok: true, status: upstream.status, body: text, contentType: upstream.headers.get("content-type") || "application/json", provider: "anthropic" },
          };
        }

        let reason = `${upstream.status} ${upstream.statusText}`;
        try {
          const parsed = JSON.parse(text);
          reason = parsed?.error?.message || reason;
        } catch {}
        return { ok: false, reason };
      },
    },
    openai: {
      configured: !!openaiKey,
      call: async ({ payload, probe = false }) => {
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify(
            probe
              ? { model: openaiModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }
              : {
                  model: openaiModel,
                  messages: toOpenAiMessages(payload.system, payload.messages),
                  max_tokens: payload.max_tokens || 250,
                  temperature: 0.7,
                },
          ),
        });

        const data = await upstream.json().catch(() => ({}));
        if (probe) {
          if (upstream.ok) return { ok: true, status: "ok", reason: "ready" };
          return {
            ok: false,
            status: upstream.status === 429 ? "quota" : "error",
            reason: data?.error?.message || upstream.statusText,
          };
        }

        if (upstream.ok) {
          const text = data?.choices?.[0]?.message?.content || "";
          return {
            ok: true,
            response: {
              ok: true,
              status: 200,
              body: JSON.stringify(asAnthropicShape({ id: data?.id || "openai-fallback", model: openaiModel, text })),
              contentType: "application/json",
              provider: "openai",
            },
          };
        }

        return { ok: false, reason: data?.error?.message || upstream.statusText };
      },
    },
    gemini: {
      configured: !!geminiKey,
      call: async ({ payload, probe = false }) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const upstream = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            probe
              ? { contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }
              : {
                  systemInstruction: payload.system ? { parts: [{ text: payload.system }] } : undefined,
                  contents: [{ role: "user", parts: [{ text: toPlainPrompt(payload.system, payload.messages) }] }],
                  generationConfig: { maxOutputTokens: payload.max_tokens || 250, temperature: 0.7 },
                },
          ),
        });

        const data = await upstream.json().catch(() => ({}));
        if (probe) {
          if (upstream.ok) return { ok: true, status: "ok", reason: "ready" };
          return {
            ok: false,
            status: upstream.status === 429 ? "quota" : "error",
            reason: data?.error?.message || upstream.statusText,
          };
        }

        if (upstream.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n").trim() || "";
          return {
            ok: true,
            response: {
              ok: true,
              status: 200,
              body: JSON.stringify(asAnthropicShape({ id: data?.responseId || "gemini-fallback", model: `google/${geminiModel}`, text })),
              contentType: "application/json",
              provider: "gemini",
            },
          };
        }

        return { ok: false, reason: data?.error?.message || upstream.statusText };
      },
    },
  };
}

export function asAnthropicShape({ id, model, text }) {
  return {
    id: id || "fallback-response",
    model: model || "unknown",
    role: "assistant",
    content: [{ type: "text", text: text || "" }],
  };
}

export async function probeProviders() {
  const clients = buildProviderClients();
  const order = getProviderOrder();

  const providers = {
    anthropic: { configured: clients.anthropic.configured, available: false, status: "missing", reason: "not configured" },
    openai: { configured: clients.openai.configured, available: false, status: "missing", reason: "not configured" },
    gemini: { configured: clients.gemini.configured, available: false, status: "missing", reason: "not configured" },
  };

  for (const name of ["anthropic", "openai", "gemini"]) {
    if (!clients[name].configured) continue;
    try {
      const result = await clients[name].call({ payload: {}, probe: true });
      providers[name] = {
        configured: true,
        available: !!result.ok,
        status: result.status || (result.ok ? "ok" : "error"),
        reason: result.reason || (result.ok ? "ready" : "unknown error"),
      };
    } catch {
      providers[name] = { configured: true, available: false, status: "network", reason: "upstream unavailable" };
    }
  }

  const preferredProvider = order.find((name) => providers[name]?.available) || null;

  return {
    anyAvailable: Object.values(providers).some((p) => p.available),
    providers,
    strategy: process.env.SPANISH_APP_AI_MODE || "premium-first",
    order,
    preferredProvider,
    checkedAt: new Date().toISOString(),
  };
}

export async function generateWithFallback(payload = {}) {
  const clients = buildProviderClients();
  const order = getProviderOrder();
  const errors = [];

  for (const provider of order) {
    const client = clients[provider];
    if (!client?.configured) continue;

    try {
      const result = await client.call({ payload, probe: false });
      if (result?.ok && result.response) {
        return { ...result.response, strategy: process.env.SPANISH_APP_AI_MODE || "premium-first" };
      }
      errors.push(`${provider}: ${result?.reason || "failed"}`);
    } catch {
      errors.push(`${provider}: upstream unavailable`);
    }
  }

  return {
    ok: false,
    status: 502,
    body: JSON.stringify({
      error: errors.length
        ? `All AI providers failed | ${errors.join(" | ")}`
        : "Missing ANTHROPIC_API_KEY, OPENAI_API_KEY, and GEMINI_API_KEY on server",
    }),
    contentType: "application/json",
  };
}
