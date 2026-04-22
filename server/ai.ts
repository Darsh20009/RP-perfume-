import { isGroqConfigured, detectLang, groqChatFor } from "./groq";

async function groqJSON(prompt: string, maxTokens = 500, _temperature = 0.4): Promise<any> {
  if (!isGroqConfigured()) {
    throw new Error("AI service not configured");
  }
  // ai.ts powers customer-facing helpers (size advisor, product descriptions, outfit etc.)
  const raw = await groqChatFor("customer", [{ role: "user", content: prompt }], maxTokens);
  try {
    // Try to find a JSON object in the response (some models wrap it in prose).
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return {};
  }
}

/** Resolves a target language: explicit param > auto-detect from text > default Arabic */
function pickLang(explicit?: string, ...textsToDetect: (string | undefined)[]): "ar" | "en" {
  if (explicit === "ar" || explicit === "en") return explicit;
  for (const t of textsToDetect) {
    if (t && t.trim()) return detectLang(t);
  }
  return "ar";
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
  lang?: "ar" | "en";
}) {
  const { productName, productCategory, availableSizes, measurements, gender } = params;
  const m = measurements;
  const lang = pickLang(params.lang, productName, productCategory);

  const prompt = lang === "ar"
    ? `أنت مستشار أزياء خبير. العميل يريد شراء "${productName}" (فئة: ${productCategory}).
المقاسات المتوفرة: ${availableSizes.join(", ")}
مقاسات العميل:
${m.height ? `- الطول: ${m.height} سم` : ""}
${m.weight ? `- الوزن: ${m.weight} كغ` : ""}
${m.chest ? `- محيط الصدر: ${m.chest} سم` : ""}
${m.waist ? `- محيط الخصر: ${m.waist} سم` : ""}
${m.hip ? `- محيط الورك: ${m.hip} سم` : ""}
${m.shoulder ? `- عرض الكتف: ${m.shoulder} سم` : ""}
${gender ? `- الجنس: ${gender === "male" ? "رجل" : "امرأة"}` : ""}

أجب بصيغة JSON فقط بالعربية:
{
  "recommendedSize": "المقاس الموصى به من القائمة المتوفرة",
  "confidence": "high|medium|low",
  "reasoning": "سبب قصير وواضح للتوصية بالعربية",
  "fit": "slim|regular|loose",
  "tips": ["نصيحة مختصرة", "نصيحة أخرى"],
  "alternativeSize": "مقاس بديل إن كان العميل يفضل الراحة أو الضيق"
}`
    : `You are an expert fashion advisor. The customer wants to buy "${productName}" (category: ${productCategory}).
Available sizes: ${availableSizes.join(", ")}
Customer measurements:
${m.height ? `- Height: ${m.height} cm` : ""}
${m.weight ? `- Weight: ${m.weight} kg` : ""}
${m.chest ? `- Chest: ${m.chest} cm` : ""}
${m.waist ? `- Waist: ${m.waist} cm` : ""}
${m.hip ? `- Hip: ${m.hip} cm` : ""}
${m.shoulder ? `- Shoulder: ${m.shoulder} cm` : ""}
${gender ? `- Gender: ${gender === "male" ? "male" : "female"}` : ""}

Reply in JSON only, in English:
{
  "recommendedSize": "the recommended size from the available list",
  "confidence": "high|medium|low",
  "reasoning": "short clear reason in English",
  "fit": "slim|regular|loose",
  "tips": ["short tip", "another tip"],
  "alternativeSize": "alternative size if the customer prefers comfort or tightness"
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
  lang?: "ar" | "en";
}) {
  const lang = pickLang(data.lang);
  const prompt = lang === "ar"
    ? `أنت محلل أعمال خبير. حلّل هذه البيانات لمتجر عطور آر اف وقدم تقريراً مختصراً وقابلاً للتطبيق:

البيانات (آخر ${data.periodDays || 30} يوم):
- إجمالي الطلبات: ${data.totalOrders}
- إجمالي الإيرادات: ${data.totalRevenue} ر.س
- الطلبات حسب الحالة: ${JSON.stringify(data.ordersByStatus)}
- أفضل المنتجات مبيعاً: ${data.topProducts.map(p => `${p.name} (${p.sales} مبيعات)`).join(", ")}

أجب بصيغة JSON فقط بالعربية:
{
  "overview": "جملة واحدة تلخص الأداء العام",
  "score": 85,
  "highlights": ["إنجاز إيجابي 1", "إنجاز إيجابي 2"],
  "warnings": ["تحذير أو مشكلة إن وجدت"],
  "recommendations": [
    {"title": "توصية قصيرة", "action": "خطوة محددة لتنفيذها", "impact": "high|medium|low"}
  ],
  "trend": "up|down|stable"
}`
    : `You are an expert business analyst. Analyze this data for RF Perfume store and provide a concise, actionable report:

Data (last ${data.periodDays || 30} days):
- Total orders: ${data.totalOrders}
- Total revenue: ${data.totalRevenue} SAR
- Orders by status: ${JSON.stringify(data.ordersByStatus)}
- Top-selling products: ${data.topProducts.map(p => `${p.name} (${p.sales} sales)`).join(", ")}

Reply in JSON only, in English:
{
  "overview": "one sentence summarising overall performance",
  "score": 85,
  "highlights": ["positive achievement 1", "positive achievement 2"],
  "warnings": ["warning or issue if any"],
  "recommendations": [
    {"title": "short recommendation", "action": "specific actionable step", "impact": "high|medium|low"}
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
  lang?: "ar" | "en" | "both";
}) {
  // generate-description always returns BOTH languages by default since the
  // store is bilingual — preserved behaviour.
  const prompt = `You are a professional copywriter for a luxury perfume store. Write an engaging description for this product.

Product name: ${product.name} ${product.nameEn ? `(${product.nameEn})` : ""}
Category: ${product.category}
Price: ${product.price} SAR
${product.attributes ? `Attributes: ${JSON.stringify(product.attributes)}` : ""}
${product.targetAudience ? `Target audience: ${product.targetAudience}` : ""}

Reply in JSON only, providing BOTH Arabic and English copy:
{
  "description_ar": "وصف عربي جذاب 2-3 جمل يبرز المميزات والجودة",
  "description_en": "Engaging English description 2-3 sentences",
  "highlights_ar": ["ميزة رئيسية 1", "ميزة رئيسية 2", "ميزة رئيسية 3"],
  "highlights_en": ["Key benefit 1", "Key benefit 2", "Key benefit 3"],
  "seo_tags_ar": ["كلمة مفتاحية", "كلمة أخرى"],
  "seo_tags_en": ["keyword", "another keyword"],
  "care_instructions_ar": "تعليمات العناية بالمنتج",
  "care_instructions_en": "Product care instructions"
}`;

  return groqJSON(prompt, 700, 0.6);
}

export async function getOutfitSuggestions(params: {
  productName: string;
  productCategory: string;
  occasion?: string;
  gender?: string;
  lang?: "ar" | "en";
}) {
  const lang = pickLang(params.lang, params.productName, params.occasion);
  const prompt = lang === "ar"
    ? `أنت مستشار عطور خبير. اقترح كيفية استخدام هذا العطر:
المنتج: ${params.productName} (${params.productCategory})
${params.occasion ? `المناسبة: ${params.occasion}` : ""}
${params.gender ? `للـ: ${params.gender === "male" ? "رجال" : "نساء"}` : ""}

أجب بصيغة JSON فقط بالعربية:
{
  "occasions": ["مناسبة 1", "مناسبة 2", "مناسبة 3"],
  "combinations": [
    {"item": "عطر أو بخور يناسبه", "why": "سبب قصير"}
  ],
  "style_tip": "نصيحة استخدام واحدة قيّمة",
  "avoid": "ما يجب تجنبه"
}`
    : `You are an expert perfume advisor. Suggest how to use this scent:
Product: ${params.productName} (${params.productCategory})
${params.occasion ? `Occasion: ${params.occasion}` : ""}
${params.gender ? `For: ${params.gender === "male" ? "men" : "women"}` : ""}

Reply in JSON only, in English:
{
  "occasions": ["occasion 1", "occasion 2", "occasion 3"],
  "combinations": [
    {"item": "matching scent or incense", "why": "short reason"}
  ],
  "style_tip": "one valuable usage tip",
  "avoid": "what to avoid"
}`;

  return groqJSON(prompt, 400, 0.6);
}

/** Generate AI insights from product reviews — scent profile, longevity, occasions, summary. */
export async function generateProductInsights(params: {
  productName: string;
  productCategory?: string;
  reviews: { rating: number; comment: string }[];
}): Promise<{
  summaryAr: string;
  summaryEn: string;
  scentNotes: string[];
  longevity: string;
  sillage: string;
  occasions: string[];
  pros: string[];
  cons: string[];
  sentiment: number;
}> {
  if (!isGroqConfigured()) throw new Error("AI service not configured");
  const reviewsText = params.reviews.slice(0, 30).map((r, i) => `${i + 1}. (${r.rating}★) ${r.comment}`).join("\n");
  const prompt = `أنت خبير عطور محترف. حلّل تقييمات العملاء لهذا العطر واستخرج الملف العطري بدقّة.

المنتج: ${params.productName}${params.productCategory ? ` — الفئة: ${params.productCategory}` : ""}

تقييمات العملاء:
${reviewsText}

أعد JSON فقط بالشكل التالي (بدون أي نص خارج الـ JSON):
{
  "summaryAr": "ملخص في جملتين بالعربية يصف الانطباع العام",
  "summaryEn": "two-sentence English summary of overall impression",
  "scentNotes": ["نوتات عطرية مستخرجة من التقييمات (3-6 كلمات)"],
  "longevity": "وصف ثبات العطر (مثال: ٦-٨ ساعات / متوسط / قوي)",
  "sillage": "وصف بصمة العطر (هادئ / متوسط / قوي / يلفت الأنظار)",
  "occasions": ["مناسبات يُنصح بها (3-5 كلمات)"],
  "pros": ["أبرز 3 ميزات"],
  "cons": ["أبرز 2 ملاحظات سلبية أو 'لا توجد ملاحظات سلبية بارزة'"],
  "sentiment": 0.85
}
`;
  return groqJSON(prompt, 700, 0.3);
}

/** Generate inventory insights — restock suggestions, slow movers, anomalies. */
export async function generateInventoryInsights(params: {
  products: { name: string; stock: number; sold30d: number; revenue30d: number; price: number }[];
  totalRevenue: number;
}): Promise<{
  topMovers: { name: string; insight: string }[];
  slowMovers: { name: string; insight: string }[];
  restockUrgent: { name: string; reason: string; suggestedQty: number }[];
  overallHealth: string;
  recommendations: string[];
}> {
  if (!isGroqConfigured()) throw new Error("AI service not configured");
  const productsList = params.products.slice(0, 40).map((p, i) =>
    `${i + 1}. ${p.name} | المخزون: ${p.stock} | مبيعات ٣٠ يوم: ${p.sold30d} | إيراد: ${p.revenue30d} ر.س | السعر: ${p.price}`
  ).join("\n");

  const prompt = `أنت محلل مخزون ومبيعات محترف لمتجر عطور سعودي. حلّل البيانات وأعطِ توصيات عملية بالعربية.

إجمالي الإيرادات (٣٠ يوم): ${params.totalRevenue} ر.س
عدد المنتجات: ${params.products.length}

بيانات المنتجات:
${productsList}

أعد JSON فقط:
{
  "topMovers": [{"name":"اسم المنتج","insight":"سبب الأداء القوي"}],
  "slowMovers": [{"name":"اسم المنتج","insight":"سبب البطء + اقتراح"}],
  "restockUrgent": [{"name":"اسم المنتج","reason":"السبب","suggestedQty":50}],
  "overallHealth": "تقييم عام بثلاث جمل عن صحة المخزون والمبيعات",
  "recommendations": ["3-5 توصيات استراتيجية قصيرة وعملية"]
}
`;
  return groqJSON(prompt, 1000, 0.4);
}
