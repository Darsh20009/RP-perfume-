/**
 * Google Gemini AI provider — Free tier: 1M tokens/day on Gemini 2.0 Flash.
 * Used as the PRIMARY provider before falling back to Groq.
 *
 * Why Gemini first? Free tier is 10× more generous than Groq's daily TPD,
 * and Google's free quota is renewed daily without rotation gymnastics.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

// Gemini 2.0 Flash: best free model, 1M tokens/day, supports Arabic excellently.
// Gemini 1.5 Flash: fallback if 2.0 is overloaded — same 1M/day quota.
const PRIMARY_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";

let keyIdx = 0;
const keyCooldownUntil = new Map<string, number>();

function pickKey(): string | null {
  if (GEMINI_KEYS.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
    keyIdx++;
    const until = keyCooldownUntil.get(key) || 0;
    if (until <= now) return key;
  }
  // All in cooldown — return next anyway (last-resort attempt)
  const key = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
  keyIdx++;
  return key;
}

function markCooldown(key: string, seconds: number) {
  keyCooldownUntil.set(key, Date.now() + Math.min(seconds, 24 * 3600) * 1000);
}

export function isGeminiConfigured(): boolean {
  return GEMINI_KEYS.length > 0;
}

/**
 * Convert OpenAI-style chat messages to Gemini's content format.
 * Gemini uses 'user' and 'model' roles, with system-instruction as a separate field.
 */
function toGeminiPayload(messages: ChatMessage[], maxTokens: number) {
  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const conversation = messages.filter((m) => m.role !== "system");

  const contents = conversation.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Merge consecutive same-role messages (Gemini requires alternating user/model)
  const merged: typeof contents = [];
  for (const c of contents) {
    const last = merged[merged.length - 1];
    if (last && last.role === c.role) {
      last.parts[0].text += "\n\n" + c.parts[0].text;
    } else {
      merged.push(c);
    }
  }

  // Gemini requires the conversation to start with 'user'
  while (merged.length > 0 && merged[0].role !== "user") merged.shift();

  return {
    contents: merged,
    systemInstruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
    },
  };
}

/**
 * Calls Google Gemini chat API. Returns the assistant text or throws on failure.
 * Tries each available key with the primary model, then the fallback model.
 */
export async function geminiChat(
  messages: ChatMessage[],
  maxTokens = 1024,
): Promise<string> {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const payload = toGeminiPayload(messages, maxTokens);
  let lastErr: any = null;
  let allRateLimited = true;

  // Try each key with the primary model
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = pickKey();
    if (!key) break;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || "")
          .join("") || "";
        if (text) return text;
        // Empty response — try next key
        console.warn(`[Gemini] empty response from key#${attempt}`);
        lastErr = new Error("Gemini returned empty content");
        continue;
      }

      const errText = await res.text();
      console.error(
        `[Gemini] key#${attempt} HTTP ${res.status}:`,
        errText.slice(0, 200),
      );

      if (res.status === 429) {
        // Rate-limited (quota exhausted) — cool down 1 hour
        markCooldown(key, 3600);
      } else if (res.status === 401 || res.status === 403) {
        // Invalid/revoked key — cool down 24h
        markCooldown(key, 24 * 3600);
        allRateLimited = false;
      } else if (![500, 502, 503, 504].includes(res.status)) {
        throw new Error(`Gemini API error ${res.status}`);
      } else {
        allRateLimited = false;
      }
      lastErr = new Error(`Gemini API error ${res.status}`);
    } catch (err: any) {
      console.error(`[Gemini] key#${attempt} threw:`, err?.message || err);
      lastErr = err;
      allRateLimited = false;
    }
  }

  // Fallback model if all primary attempts failed
  if (allRateLimited) {
    console.warn(
      `[Gemini] all keys rate-limited on ${PRIMARY_MODEL} — trying ${FALLBACK_MODEL}`,
    );
    for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
      const key = GEMINI_KEYS[attempt];
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text || "")
            .join("") || "";
          if (text) return text;
        }
      } catch (err: any) {
        console.error(
          `[Gemini][fallback] key#${attempt} threw:`,
          err?.message || err,
        );
      }
    }
  }

  throw lastErr || new Error("Gemini request failed on all keys");
}
