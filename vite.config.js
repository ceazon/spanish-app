import { defineConfig } from "vite";

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

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

function asAnthropicShape({ id, model, text }) {
  return {
    id: id || "fallback-response",
    model: model || "unknown",
    role: "assistant",
    content: [{ type: "text", text: text || "" }],
  };
}

function aiProxy() {
  let statusCache = null;
  let statusCacheAt = 0;
  const STATUS_TTL_MS = 60_000;

  async function probeProviders() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openaiModel = process.env.SPANISH_APP_OPENAI_MODEL || "gpt-4o";
    const geminiModel = process.env.SPANISH_APP_GEMINI_MODEL || "gemini-2.0-flash";

    const providers = {
      anthropic: { configured: !!anthropicKey, available: false, status: "missing_key", reason: "ANTHROPIC_API_KEY not set" },
      openai: { configured: !!openaiKey, available: false, status: "missing_key", reason: "OPENAI_API_KEY not set" },
      gemini: { configured: !!geminiKey, available: false, status: "missing_key", reason: "GEMINI_API_KEY/GOOGLE_API_KEY not set" },
    };

    if (anthropicKey) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        });
        if (r.ok) providers.anthropic = { configured: true, available: true, status: "ok", reason: "ready" };
        else {
          const data = await r.json().catch(() => ({}));
          const reason = data?.error?.message || r.statusText;
          providers.anthropic = { configured: true, available: false, status: r.status === 429 ? "quota" : "error", reason };
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

    const anyAvailable = Object.values(providers).some((p) => p.available);
    return { anyAvailable, providers, checkedAt: new Date().toISOString() };
  }

  async function getStatus(force = false) {
    if (!force && statusCache && Date.now() - statusCacheAt < STATUS_TTL_MS) return statusCache;
    statusCache = await probeProviders();
    statusCacheAt = Date.now();
    return statusCache;
  }

  const handler = async (req, res) => {
    const url = req.url || "";

    if (req.method === "GET" && url.startsWith("/api/ai/status")) {
      const force = url.includes("force=1");
      const status = await getStatus(force);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(status));
      return true;
    }

    if (req.method !== "POST" || url !== "/api/anthropic/messages") return false;

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return true;
    }

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
        if (upstream.ok) {
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
          res.end(text);
          return true;
        }

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
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${openaiKey}`,
          },
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
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(asAnthropicShape({ id: data?.id || "openai-fallback", model, text })));
          return true;
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
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(asAnthropicShape({ id: data?.responseId || "gemini-fallback", model: `google/${model}`, text })));
          return true;
        }

        errors.push(`gemini: ${data?.error?.message || upstream.statusText}`);
      } catch {
        errors.push("gemini: fallback unavailable");
      }
    }

    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: errors.length
        ? `All AI providers failed | ${errors.join(" | ")}`
        : "Missing ANTHROPIC_API_KEY, OPENAI_API_KEY, and GEMINI_API_KEY on server",
    }));
    return true;
  };

  return {
    name: "ai-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handler(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handler(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [aiProxy()],
});
