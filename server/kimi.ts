/**
 * Kimi AI (Moonshot) provider — used as the FINAL fallback in the AI chain:
 * Gemini (free 3M/day) → Groq (key pool) → Kimi (paid, always available)
 *
 * Token budget strategy:
 *   - Customer pool:  70% of daily budget  (high traffic, advisor/support)
 *   - Employee pool:  30% of daily budget  (staff assistant, lower volume)
 *
 * Model: moonshot-v1-8k  (cheapest, fast, good Arabic)
 * API:   https://api.moonshot.cn/v1  (OpenAI-compatible)
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const KIMI_API_KEY = (process.env.KIMI_API_KEY || "").trim();
const KIMI_BASE    = "https://api.moonshot.ai/v1/chat/completions";
const KIMI_MODEL   = "moonshot-v1-8k";

// ─── Daily token budget tracking ───────────────────────────────────────────
// Reset every UTC midnight. We track estimate only — Kimi charges per actual
// usage but we cap to avoid surprise bills.
const DAILY_BUDGET = {
  customer: 17_500_000,   // 70% of 25M
  employee:  7_500_000,   // 30% of 25M
};

const usedTokens: Record<"customer" | "employee", number> = {
  customer: 0,
  employee: 0,
};
let budgetResetAt = todayMidnightUTC();

function todayMidnightUTC(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + 86_400_000; // next midnight
}

function checkAndResetBudget() {
  if (Date.now() >= budgetResetAt) {
    usedTokens.customer = 0;
    usedTokens.employee = 0;
    budgetResetAt = todayMidnightUTC();
    console.log("[Kimi] Daily token budget reset");
  }
}

export function isKimiConfigured(): boolean {
  return !!KIMI_API_KEY;
}

/** Estimated tokens (very rough: 1 token ≈ 4 chars for mixed Arabic/English) */
function estimateTokens(messages: ChatMessage[], maxTokens: number): number {
  const promptChars = messages.reduce((acc, m) => acc + m.content.length, 0);
  return Math.ceil(promptChars / 4) + maxTokens;
}

export function kimiRemainingBudget(audience: "customer" | "employee") {
  checkAndResetBudget();
  return Math.max(0, DAILY_BUDGET[audience] - usedTokens[audience]);
}

export function kimiBudgetStatus() {
  checkAndResetBudget();
  return {
    customer: {
      used: usedTokens.customer,
      budget: DAILY_BUDGET.customer,
      pct: Math.round((usedTokens.customer / DAILY_BUDGET.customer) * 100),
    },
    employee: {
      used: usedTokens.employee,
      budget: DAILY_BUDGET.employee,
      pct: Math.round((usedTokens.employee / DAILY_BUDGET.employee) * 100),
    },
    resetsAt: new Date(budgetResetAt).toISOString(),
  };
}

/**
 * Call Kimi chat API. Returns text or throws.
 * audience controls which budget pool is debited.
 */
// Language guard injected before every call to prevent Chinese leaking into Arabic/English replies.
const LANG_GUARD: ChatMessage = {
  role: "system",
  content: "CRITICAL RULE: You MUST reply ONLY in Arabic or English as instructed. NEVER use Chinese, Japanese, Korean, or any other language. If the prompt is in Arabic, reply in Arabic only. If in English, reply in English only. No Chinese characters under any circumstances.",
};

export async function kimiChat(
  messages: ChatMessage[],
  maxTokens = 1024,
  audience: "customer" | "employee" = "customer",
): Promise<string> {
  if (!KIMI_API_KEY) throw new Error("KIMI_API_KEY not configured");

  checkAndResetBudget();
  // Prepend the language guard to every call
  const messagesWithGuard = [LANG_GUARD, ...messages];
  const estimated = estimateTokens(messagesWithGuard, maxTokens);
  if (estimated > kimiRemainingBudget(audience)) {
    throw new Error(`[Kimi] Daily ${audience} budget exhausted (${usedTokens[audience].toLocaleString()} / ${DAILY_BUDGET[audience].toLocaleString()} tokens used)`);
  }

  const res = await fetch(KIMI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: messagesWithGuard,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[Kimi] HTTP ${res.status}:`, txt.slice(0, 200));
    throw new Error(`Kimi API error ${res.status}: ${txt.slice(0, 100)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || "";

  // Debit estimated tokens from pool
  usedTokens[audience] += estimated;
  console.log(`[Kimi] ${audience} used ~${estimated} tokens (total today: ${usedTokens[audience].toLocaleString()})`);

  return text;
}
