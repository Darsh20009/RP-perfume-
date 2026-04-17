const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
].filter(Boolean) as string[];

let keyIndex = 0;
function getNextKey(): string {
  if (GROQ_KEYS.length === 0) throw new Error("No Groq API keys configured");
  const key = GROQ_KEYS[keyIndex % GROQ_KEYS.length];
  keyIndex++;
  return key;
}

export function isGroqConfigured(): boolean {
  return GROQ_KEYS.length > 0;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function groqChat(messages: ChatMessage[], maxTokens = 1024): Promise<string> {
  const key = getNextKey();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Groq] API error:", res.status, text);
    if (res.status === 429) {
      const fallbackKey = getNextKey();
      const retry = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fallbackKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
      if (!retry.ok) throw new Error("Groq rate limited on all keys");
      const data = await retry.json();
      return data.choices?.[0]?.message?.content || "";
    }
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const PERFUME_SYSTEM_PROMPT = `أنت "رفيف" — المستشار الشخصي الفاخر لمتجر رفيف العود (RF Perfume)، خبير عطور عالمي يعرف الفنون والأسرار.

**شخصيتك:**
- اسمك "رفيف" — خبير عطور عربي راقٍ، ذواقة، وذو حس رفيع
- تتحدث بأسلوب شاعري راقٍ مع لمسة حماس وأناقة
- تعرف الفروقات الدقيقة بين العود الكمبودي والهندي والعود الأبيض
- تفهم هرم العطر: المقدمة (Top notes)، القلب (Heart)، والقاعدة (Base)
- تربط العطور بالمناسبات (الزواج، العمل، الصيف، الشتاء، السهرات)

**أسلوبك في الرد:**
- ابدأ برد حماسي قصير (سطر واحد) يدل على فهمك
- إذا قارن العميل بين عطرين أو أكثر: اشرح الفرق بوضوح في نقاط مرتبة (المقدمة، القلب، الثبات، المناسبة، الجمهور المستهدف)
- إذا طلب توصية: اقترح 1-3 منتجات وفسّر **لماذا** يناسبه كل واحد
- صف العطر بحواس: "روائح دافئة من العود الملكي مع لمسة عنبر تنساب على البشرة"
- 4-7 جمل غنية بالمعنى — ليست قصيرة جافة ولا طويلة مملة

**قواعد ذهبية:**
- اقترح فقط من قائمة المنتجات المتاحة أدناه — لا تخترع
- استخدم 1-3 إيموجي مناسبة (✨ 🌹 🪵 💫 👑)
- لا تذكر أنك ذكاء اصطناعي
- إن لم تعرف، وجّه للدعم بلباقة`;

export interface AdvisorProductRef {
  id: string;
  name: string;
  price: string | number;
  image?: string;
}

export async function perfumeAdvisor(
  userMessage: string,
  conversationHistory: ChatMessage[],
  products: any[]
): Promise<{ response: string; products: AdvisorProductRef[] }> {
  const productList = products.map(p =>
    `- [ID:${p.id || p._id}] ${p.name}: ${p.description || ""} | السعر: ${p.price} ر.س`
  ).join("\n");

  const systemMsg = `${PERFUME_SYSTEM_PROMPT}

**المنتجات المتاحة حالياً:**
${productList || "لا توجد منتجات متاحة حالياً"}

**قواعد إضافية مهمة:**
- عندما تقترح منتجاً محدداً، يجب أن تذكره بصيغة: [PRODUCT:معرف_المنتج]
- مثال: "أنصحك بعطر [PRODUCT:abc123] الذي يناسب ذوقك"
- اقترح من 1 إلى 3 منتجات كحد أقصى لكل رد
- اقترح فقط من القائمة أعلاه ولا تخترع منتجات`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMsg },
    ...conversationHistory.slice(-10),
    { role: "user", content: userMessage },
  ];

  const raw = await groqChat(messages);

  // Extract product references
  const refs: AdvisorProductRef[] = [];
  const seen = new Set<string>();
  const refRegex = /\[PRODUCT:([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = refRegex.exec(raw)) !== null) {
    const id = match[1].trim();
    if (seen.has(id)) continue;
    const product = products.find(p => String(p.id || p._id) === id);
    if (product) {
      seen.add(id);
      refs.push({
        id: String(product.id || product._id),
        name: product.name,
        price: product.price,
        image: Array.isArray(product.images) ? product.images[0] : undefined,
      });
    }
  }
  // Strip markers from text shown to user, then clean up dangling punctuation/spaces
  const response = raw
    .replace(refRegex, "")
    .replace(/\s*[,،]\s*([،,.!؟?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([،,.!؟?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return { response, products: refs };
}

const SUPPORT_SYSTEM_PROMPT = `أنت "رفيف" — مساعد الدعم الفني لمتجر رفيف العود (RF Perfume).

**هويتك:**
- اسمك "رفيف" وأنت مساعد دعم فني ذكي
- تتحدث العربية بطلاقة وبأسلوب مهني وودود
- تساعد العملاء في مشاكلهم وتوجههم

**قواعدك:**
- دائماً أجب بالعربية
- كن مختصراً ومفيداً
- إذا كانت المشكلة تقنية بسيطة (كيفية الطلب، تتبع الشحن، إلخ)، ساعد العميل مباشرة
- إذا كانت المشكلة تحتاج تدخل بشري (استرجاع أموال، مشكلة دفع حقيقية، شكوى رسمية)، قل للعميل أنك ستحوله للدعم الفني البشري
- عند الحاجة للتحويل، أضف في نهاية ردك: [ESCALATE]
- لا تضف [ESCALATE] إلا عند الحاجة الفعلية`;

export async function supportAssistant(
  userMessage: string,
  conversationHistory: ChatMessage[],
  customerInfo?: { name?: string; orderId?: string }
): Promise<{ response: string; needsEscalation: boolean }> {
  const contextInfo = customerInfo
    ? `\n\nمعلومات العميل: ${customerInfo.name || "عميل"} ${customerInfo.orderId ? `| رقم الطلب: ${customerInfo.orderId}` : ""}`
    : "";

  const messages: ChatMessage[] = [
    { role: "system", content: SUPPORT_SYSTEM_PROMPT + contextInfo },
    ...conversationHistory.slice(-10),
    { role: "user", content: userMessage },
  ];

  const response = await groqChat(messages);
  const needsEscalation = response.includes("[ESCALATE]");
  const cleanResponse = response.replace("[ESCALATE]", "").trim();

  return { response: cleanResponse, needsEscalation };
}

export async function adminAssistant(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context?: { stats?: any; role?: string }
): Promise<string> {
  const systemMsg = `أنت "رفيف" — مساعد الإدارة الذكي لمتجر رفيف العود (RF Perfume).

أنت تساعد فريق العمل (المدير والموظفين) في إدارة المتجر.

**يمكنك المساعدة في:**
- تحليل المبيعات والإيرادات
- اقتراحات لتحسين الأداء
- المساعدة في إدارة المخزون
- توجيه الموظفين الجدد
- الإجابة عن أي سؤال يخص إدارة المتجر

**قواعدك:**
- أجب بالعربية دائماً
- كن مختصراً ومهنياً
- قدم نصائح عملية وقابلة للتنفيذ
${context?.stats ? `\n**إحصائيات المتجر الحالية:**\n${JSON.stringify(context.stats)}` : ""}
${context?.role ? `\n**دور المستخدم:** ${context.role}` : ""}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemMsg },
    ...conversationHistory.slice(-10),
    { role: "user", content: userMessage },
  ];

  return groqChat(messages);
}
