import { isGroqConfigured } from "./groq";

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

async function groqJSON(prompt: string, maxTokens = 500, temperature = 0.4): Promise<any> {
  if (!isGroqConfigured()) {
    throw new Error("AI service not configured");
  }
  const key = getNextKey();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[AI] Groq API error:", res.status, text);
    throw new Error("AI request failed");
  }

  const data: any = await res.json();
  return JSON.parse(data.choices[0].message.content || "{}");
}

export async function getSizeRecommendation(params: {
  productName: string;
  productCategory: string;
  availableSizes: string[];
  measurements: {
    height?: number;
    weight?: number;
    chest?: number;
    waist?: number;
    hip?: number;
    shoulder?: number;
  };
  gender?: string;
}) {
  const { productName, productCategory, availableSizes, measurements, gender } = params;
  const m = measurements;

  const prompt = `أنت مستشار أزياء خبير. العميل يريد شراء "${productName}" (فئة: ${productCategory}).
المقاسات المتوفرة: ${availableSizes.join(", ")}
مقاسات العميل:
${m.height ? `- الطول: ${m.height} سم` : ""}
${m.weight ? `- الوزن: ${m.weight} كغ` : ""}
${m.chest ? `- محيط الصدر: ${m.chest} سم` : ""}
${m.waist ? `- محيط الخصر: ${m.waist} سم` : ""}
${m.hip ? `- محيط الورك: ${m.hip} سم` : ""}
${m.shoulder ? `- عرض الكتف: ${m.shoulder} سم` : ""}
${gender ? `- الجنس: ${gender === "male" ? "رجل" : "امرأة"}` : ""}

أجب بصيغة JSON فقط بالشكل التالي (بدون أي نص إضافي):
{
  "recommendedSize": "المقاس الموصى به من القائمة المتوفرة",
  "confidence": "high|medium|low",
  "reasoning": "سبب قصير وواضح للتوصية باللغة العربية",
  "fit": "slim|regular|loose",
  "tips": ["نصيحة مختصرة", "نصيحة مختصرة أخرى"],
  "alternativeSize": "مقاس بديل إن كان العميل يفضل الراحة أو الضيق"
}`;

  return groqJSON(prompt, 400, 0.3);
}

export async function getBusinessInsights(data: {
  totalOrders: number;
  totalRevenue: number;
  topProducts: { name: string; sales: number }[];
  ordersByStatus: Record<string, number>;
  recentOrders: any[];
  periodDays?: number;
}) {
  const prompt = `أنت محلل أعمال خبير. حلّل هذه البيانات لمتجر رفيف العود وقدم تقريراً مختصراً وقابلاً للتطبيق:

البيانات (آخر ${data.periodDays || 30} يوم):
- إجمالي الطلبات: ${data.totalOrders}
- إجمالي الإيرادات: ${data.totalRevenue} ر.س
- الطلبات حسب الحالة: ${JSON.stringify(data.ordersByStatus)}
- أفضل المنتجات مبيعاً: ${data.topProducts.map(p => `${p.name} (${p.sales} مبيعات)`).join(", ")}

أجب بصيغة JSON فقط:
{
  "overview": "جملة واحدة تلخص الأداء العام",
  "score": 85,
  "highlights": ["إنجاز إيجابي 1", "إنجاز إيجابي 2"],
  "warnings": ["تحذير أو مشكلة إن وجدت"],
  "recommendations": [
    {"title": "توصية قصيرة", "action": "خطوة محددة لتنفيذها", "impact": "high|medium|low"},
    {"title": "توصية أخرى", "action": "خطوة محددة", "impact": "high|medium|low"}
  ],
  "trend": "up|down|stable"
}`;

  return groqJSON(prompt, 500, 0.4);
}

export async function generateProductDescription(product: {
  name: string;
  nameEn?: string;
  category: string;
  price: number;
  attributes?: Record<string, string>;
  targetAudience?: string;
}) {
  const prompt = `أنت كاتب محتوى احترافي لمتجر عطور راقٍ. اكتب وصفاً جذاباً لهذا المنتج:

اسم المنتج: ${product.name} ${product.nameEn ? `(${product.nameEn})` : ""}
الفئة: ${product.category}
السعر: ${product.price} ر.س
${product.attributes ? `المواصفات: ${JSON.stringify(product.attributes)}` : ""}
${product.targetAudience ? `الجمهور المستهدف: ${product.targetAudience}` : ""}

أجب بصيغة JSON فقط:
{
  "description_ar": "وصف عربي جذاب 2-3 جمل يبرز المميزات والجودة",
  "description_en": "Engaging English description 2-3 sentences",
  "highlights_ar": ["ميزة رئيسية 1", "ميزة رئيسية 2", "ميزة رئيسية 3"],
  "seo_tags": ["كلمة مفتاحية", "كلمة أخرى"],
  "care_instructions": "تعليمات العناية بالمنتج"
}`;

  return groqJSON(prompt, 500, 0.6);
}

export async function getOutfitSuggestions(params: {
  productName: string;
  productCategory: string;
  occasion?: string;
  gender?: string;
}) {
  const prompt = `أنت مستشار عطور خبير. اقترح كيفية استخدام هذا العطر:
المنتج: ${params.productName} (${params.productCategory})
${params.occasion ? `المناسبة: ${params.occasion}` : ""}
${params.gender ? `للـ: ${params.gender === "male" ? "رجال" : "نساء"}` : ""}

أجب بصيغة JSON فقط:
{
  "occasions": ["مناسبة 1", "مناسبة 2", "مناسبة 3"],
  "combinations": [
    {"item": "عطر أو بخور يناسبه", "why": "سبب قصير"},
    {"item": "منتج آخر", "why": "سبب قصير"},
    {"item": "إكسسوار مقترح", "why": "سبب قصير"}
  ],
  "style_tip": "نصيحة استخدام واحدة قيّمة",
  "avoid": "ما يجب تجنبه"
}`;

  return groqJSON(prompt, 400, 0.6);
}
