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

console.log(`[Gemini] loaded ${GEMINI_KEYS.length} key(s)`);

// Gemini free-tier models — each has its OWN per-project quota bucket
// (RPM = requests/minute, RPD = requests/day):
//   gemini-2.5-flash       → 10 RPM,  250 RPD  (best Arabic quality)
//   gemini-2.0-flash       → 15 RPM, 1500 RPD  (very good fallback)
//   gemini-2.0-flash-lite  → 30 RPM, 1500 RPD  (lightweight final safety net)
// Trying all three in cascade lets us survive bursts and per-minute quotas
// because hitting 429 on one model does NOT consume the next model's quota.
const MODEL_CASCADE = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

// Cooldown is keyed by `${key}|${model}` because each (key,model) pair has
// its own quota bucket on Google's side. Marking the whole key as cool-down
// would needlessly block the other models that still have quota.
const cooldownUntil = new Map<string, number>();

function ckey(key: string, model: string) { return `${key}|${model}`; }

function isAvailable(key: string, model: string): boolean {
  const until = cooldownUntil.get(ckey(key, model)) || 0;
  return until <= Date.now();
}

function markCooldown(key: string, model: string, seconds: number) {
  cooldownUntil.set(ckey(key, model), Date.now() + Math.min(seconds, 24 * 3600) * 1000);
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
 *
 * Strategy: cascade through (model × key) pairs. We iterate by MODEL first so
 * that a hot per-minute quota on the primary model immediately rolls down to
 * the next model (which has its own bucket) instead of blocking the request.
 * For each model we walk every key that's not in cooldown.
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

  for (const model of MODEL_CASCADE) {
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const key = GEMINI_KEYS[i];
      if (!isAvailable(key, model)) continue;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
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
          console.warn(`[Gemini] empty response key#${i} model=${model}`);
          lastErr = new Error("Gemini returned empty content");
          continue;
        }

        const errText = await res.text();
        console.error(
          `[Gemini] key#${i} model=${model} HTTP ${res.status}:`,
          errText.slice(0, 160),
        );

        if (res.status === 429) {
          // Per-minute RPM is the most common cause; 60s is plenty.
          // The day-quota will simply re-trigger and re-cool.
          markCooldown(key, model, 60);
        } else if (res.status === 401 || res.status === 403) {
          // Invalid/revoked key for this model — cool down 24h.
          markCooldown(key, model, 24 * 3600);
        } else if (![500, 502, 503, 504].includes(res.status)) {
          // Hard error (400 etc.) — don't keep hammering the same model.
          markCooldown(key, model, 30);
        }
        lastErr = new Error(`Gemini API error ${res.status}`);
      } catch (err: any) {
        console.error(`[Gemini] key#${i} model=${model} threw:`, err?.message || err);
        lastErr = err;
      }
    }
  }

  throw lastErr || new Error("Gemini request failed on all keys/models");
}
