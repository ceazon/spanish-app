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

export function asAnthropicShape({ id, model, text }) {
  return {
    id: id || "fallback-response",
    model: model || "unknown",
    role: "assistant",
    content: [{ type: "text", text: text || "" }],
  };
}

export async function probeProviders() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiModel = process.env.SPANISH_APP_OPENAI_MODEL || "gpt-4o";
  const geminiModel = process.env.SPANISH_APP_GEMINI_MODEL || "gemini-2.0-flash";

  const providers = {
    anthropic: { configured: !!anthropicKey, available: false, status: "missing", reason: "not configured" },
    openai: { configured: !!openaiKey, available: false, status: "missing", reason: "not configured" },
    gemini: { configured: !!geminiKey, available: false, status: "missing", reason: "not configured" },
  };

  if (anthropicKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
      if (r.ok) providers.anthropic = { configured: true, available: true, status: "ok", reason: "ready" };
      else {
        const data = await r.json().catch(() => ({}));
        providers.anthropic = { configured: true, available: false, status: r.status === 429 ? "quota" : "error", reason: data?.error?.message || r.statusText };
      }
    } catch {
      providers.anthropic = { configured: true, available: false, status: "network", reason: "upstream unavailable" };
    }
  }

  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: openaiModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) providers.openai = { configured: true, available: true, status: "ok", reason: "ready" };
      else providers.openai = { configured: true, available: false, status: r.status === 429 ? "quota" : "error", reason: data?.error?.message || r.statusText };
    } catch {
      providers.openai = { configured: true, available: false, status: "network", reason: "upstream unavailable" };
    }
  }

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) providers.gemini = { configured: true, available: true, status: "ok", reason: "ready" };
      else providers.gemini = { configured: true, available: false, status: r.status === 429 ? "quota" : "error", reason: data?.error?.message || r.statusText };
    } catch {
      providers.gemini = { configured: true, available: false, status: "network", reason: "upstream unavailable" };
    }
  }

  return {
    anyAvailable: Object.values(providers).some((p) => p.available),
    providers,
    checkedAt: new Date().toISOString(),
  };
}

export async function generateWithFallback(payload = {}) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const errors = [];

  if (anthropicKey) {
    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      if (upstream.ok) return { ok: true, status: upstream.status, body: text, contentType: upstream.headers.get("content-type") || "application/json" };
      try {
        const parsed = JSON.parse(text);
        errors.push(`anthropic: ${parsed?.error?.message || upstream.statusText}`);
      } catch {
        errors.push(`anthropic: ${upstream.status} ${upstream.statusText}`);
      }
    } catch {
      errors.push("anthropic: upstream unavailable");
    }
  }

  if (openaiKey) {
    try {
      const model = process.env.SPANISH_APP_OPENAI_MODEL || "gpt-4o";
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          messages: toOpenAiMessages(payload.system, payload.messages),
          max_tokens: payload.max_tokens || 250,
          temperature: 0.7,
        }),
      });
      const data = await upstream.json().catch(() => ({}));
      if (upstream.ok) {
        const text = data?.choices?.[0]?.message?.content || "";
        return { ok: true, status: 200, body: JSON.stringify(asAnthropicShape({ id: data?.id || "openai-fallback", model, text })), contentType: "application/json" };
      }
      errors.push(`openai: ${data?.error?.message || upstream.statusText}`);
    } catch {
      errors.push("openai: fallback unavailable");
    }
  }

  if (geminiKey) {
    try {
      const model = process.env.SPANISH_APP_GEMINI_MODEL || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: payload.system ? { parts: [{ text: payload.system }] } : undefined,
          contents: [{ role: "user", parts: [{ text: toPlainPrompt(payload.system, payload.messages) }] }],
          generationConfig: { maxOutputTokens: payload.max_tokens || 250, temperature: 0.7 },
        }),
      });
      const data = await upstream.json().catch(() => ({}));
      if (upstream.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n").trim() || "";
        return { ok: true, status: 200, body: JSON.stringify(asAnthropicShape({ id: data?.responseId || "gemini-fallback", model: `google/${model}`, text })), contentType: "application/json" };
      }
      errors.push(`gemini: ${data?.error?.message || upstream.statusText}`);
    } catch {
      errors.push("gemini: fallback unavailable");
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
