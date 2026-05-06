/**
 * AI Self-Learning System for RF Perfume
 *
 * Tracks customer interactions with the perfume advisor:
 *   - Which products were shown vs actually purchased/added-to-cart
 *   - Which keywords/intents lead to successful conversions
 *   - Which advisor responses got positive engagement
 *
 * Every night, a background job runs generateLearnedDescriptions() which:
 *   1. Aggregates interaction data per product
 *   2. Calls Kimi to write improved Arabic/English descriptions
 *   3. Updates the product record in MongoDB
 *
 * Audience token budget split: 70% customer / 30% employee (enforced by kimi.ts)
 */

import mongoose, { Schema } from "mongoose";
import { ProductModel } from "./models";
import { kimiChat, isKimiConfigured } from "./kimi";

// ─── Schema: AI Interaction Log ─────────────────────────────────────────────

const aiInteractionSchema = new Schema(
  {
    sessionId:   { type: String, index: true },
    productId:   { type: String, index: true },
    userMessage: { type: String },
    intent:      { type: String },             // "recommend" | "compare" | "price" | "occasion"
    wasShown:    { type: Boolean, default: true },
    wasClicked:  { type: Boolean, default: false },
    wasOrdered:  { type: Boolean, default: false },
    wasAddedToCart: { type: Boolean, default: false },
    lang:        { type: String, enum: ["ar", "en"], default: "ar" },
    keywords:    [String],
    // Sentiment of the user message toward this product ("positive"|"neutral"|"negative")
    sentiment:   { type: String, enum: ["positive", "neutral", "negative"], default: "neutral" },
  },
  { timestamps: true }
);

aiInteractionSchema.index({ productId: 1, createdAt: -1 });
aiInteractionSchema.index({ wasOrdered: 1, wasClicked: 1 });

export const AiInteractionModel = mongoose.models.AiInteraction
  || mongoose.model("AiInteraction", aiInteractionSchema);

// ─── Schema: AI-Generated Product Insights (persisted) ──────────────────────

const aiProductInsightSchema = new Schema(
  {
    productId:       { type: String, required: true, unique: true, index: true },
    descriptionAr:   { type: String, default: "" },
    descriptionEn:   { type: String, default: "" },
    keywordsAr:      [String],
    keywordsEn:      [String],
    bestOccasions:   [String],
    targetAudience:  { type: String, default: "" },
    conversionRate:  { type: Number, default: 0 },  // clicked/shown ratio
    orderRate:       { type: Number, default: 0 },  // ordered/shown ratio
    totalShown:      { type: Number, default: 0 },
    totalClicked:    { type: Number, default: 0 },
    totalOrdered:    { type: Number, default: 0 },
    lastLearnedAt:   { type: Date },
    learnVersion:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AiProductInsightModel = mongoose.models.AiProductInsight
  || mongoose.model("AiProductInsight", aiProductInsightSchema);

// ─── Track: record product shown in advisor response ────────────────────────

export async function trackAdvisorShown(
  sessionId: string,
  productIds: string[],
  userMessage: string,
  lang: "ar" | "en" = "ar",
) {
  if (!productIds.length) return;
  const keywords = extractKeywords(userMessage);
  const intent   = detectIntent(userMessage);
  const docs = productIds.map(pid => ({
    sessionId,
    productId: pid,
    userMessage: userMessage.slice(0, 300),
    intent,
    wasShown: true,
    lang,
    keywords,
  }));
  await AiInteractionModel.insertMany(docs).catch(() => {});
}

export async function trackProductClicked(sessionId: string, productId: string) {
  await AiInteractionModel.updateMany(
    { sessionId, productId },
    { $set: { wasClicked: true } },
  ).catch(() => {});
}

export async function trackProductOrdered(userId: string, productIds: string[]) {
  // Mark ordered for ANY session where the product was recently shown (last 24h)
  const since = new Date(Date.now() - 24 * 3600_000);
  await AiInteractionModel.updateMany(
    { productId: { $in: productIds }, createdAt: { $gte: since } },
    { $set: { wasOrdered: true } },
  ).catch(() => {});
}

// ─── Aggregate stats per product ─────────────────────────────────────────────

async function aggregateProductStats(productId: string) {
  const [shown, clicked, ordered, recentMsgs] = await Promise.all([
    AiInteractionModel.countDocuments({ productId, wasShown: true }),
    AiInteractionModel.countDocuments({ productId, wasClicked: true }),
    AiInteractionModel.countDocuments({ productId, wasOrdered: true }),
    AiInteractionModel.find({ productId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("userMessage keywords intent")
      .lean(),
  ]);

  const allKeywords: Record<string, number> = {};
  for (const doc of recentMsgs as any[]) {
    for (const kw of (doc.keywords || [])) {
      allKeywords[kw] = (allKeywords[kw] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(allKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);

  const sampleMessages = (recentMsgs as any[]).slice(0, 10).map((d: any) => d.userMessage).filter(Boolean);

  return { shown, clicked, ordered, topKeywords, sampleMessages };
}

// ─── Nightly learn job ───────────────────────────────────────────────────────

let learningRunning = false;

export async function runNightlyLearning() {
  if (learningRunning) {
    console.log("[AI Learn] Already running, skipping");
    return;
  }
  if (!isKimiConfigured()) {
    console.warn("[AI Learn] Kimi not configured, skipping");
    return;
  }

  learningRunning = true;
  console.log("[AI Learn] Starting nightly learning cycle...");

  try {
    // Get all products that have had at least 5 interactions
    const activeProductIds = await AiInteractionModel.aggregate([
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 } } },
      { $project: { _id: 1 } },
    ]);

    console.log(`[AI Learn] ${activeProductIds.length} products to learn from`);

    for (const { _id: productId } of activeProductIds) {
      try {
        await learnForProduct(productId);
        // Small delay to not hammer the API
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        console.error(`[AI Learn] Failed for product ${productId}:`, err?.message);
      }
    }

    console.log("[AI Learn] Nightly learning cycle complete");
  } finally {
    learningRunning = false;
  }
}

async function learnForProduct(productId: string) {
  const [product, stats] = await Promise.all([
    ProductModel.findById(productId).lean(),
    aggregateProductStats(productId),
  ]);

  if (!product) return;
  const p = product as any;

  const conversionRate = stats.shown > 0 ? stats.clicked / stats.shown : 0;
  const orderRate      = stats.shown > 0 ? stats.ordered / stats.shown : 0;

  // Only regenerate description if conversion rate is low OR not learned yet
  const existing = await AiProductInsightModel.findOne({ productId }).lean() as any;
  const needsUpdate = !existing || conversionRate < 0.3 || orderRate < 0.05;

  let descriptionAr = p.description || "";
  let descriptionEn = p.descriptionEn || "";
  let keywordsAr: string[] = [];
  let keywordsEn: string[] = [];
  let bestOccasions: string[] = [];
  let targetAudience = "";

  if (needsUpdate && stats.sampleMessages.length >= 3) {
    const prompt = buildLearnPrompt(p, stats);
    try {
      const raw = await kimiChat(
        [{ role: "user", content: prompt }],
        800,
        "employee",
      );
      const parsed = extractJSON(raw);
      if (parsed) {
        descriptionAr    = parsed.descriptionAr    || descriptionAr;
        descriptionEn    = parsed.descriptionEn    || descriptionEn;
        keywordsAr       = parsed.keywordsAr       || [];
        keywordsEn       = parsed.keywordsEn       || [];
        bestOccasions    = parsed.bestOccasions    || [];
        targetAudience   = parsed.targetAudience   || "";

        // Update the product's description in DB if AI improved it
        if (parsed.descriptionAr && parsed.descriptionAr !== p.description) {
          await ProductModel.findByIdAndUpdate(productId, {
            $set: {
              description:   parsed.descriptionAr,
              descriptionEn: parsed.descriptionEn || p.descriptionEn,
            },
          });
          console.log(`[AI Learn] Updated description for "${p.name}" (conversion: ${(conversionRate * 100).toFixed(0)}%)`);
        }
      }
    } catch (err: any) {
      console.warn(`[AI Learn] Kimi failed for "${p.name}":`, err?.message);
    }
  }

  // Always upsert stats
  await AiProductInsightModel.findOneAndUpdate(
    { productId },
    {
      $set: {
        descriptionAr,
        descriptionEn,
        keywordsAr,
        keywordsEn,
        bestOccasions,
        targetAudience,
        conversionRate,
        orderRate,
        totalShown:    stats.shown,
        totalClicked:  stats.clicked,
        totalOrdered:  stats.ordered,
        lastLearnedAt: new Date(),
        $inc: { learnVersion: 1 },
      },
    },
    { upsert: true, new: true },
  );
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildLearnPrompt(product: any, stats: { topKeywords: string[]; sampleMessages: string[]; shown: number; clicked: number; ordered: number }) {
  return `أنت خبير تسويق عطور فاخرة. مهمتك تحسين وصف هذا العطر بناءً على ما يبحث عنه العملاء فعلاً.

**المنتج:** ${product.name}
**الوصف الحالي:** ${product.description || "لا يوجد"}
**بيانات العملاء:**
- عدد مرات الظهور: ${stats.shown}
- عدد النقرات: ${stats.clicked} (${stats.shown > 0 ? ((stats.clicked / stats.shown) * 100).toFixed(0) : 0}%)
- عدد الطلبات: ${stats.ordered}
- أكثر الكلمات بحثاً: ${stats.topKeywords.join("، ")}
- نماذج من طلبات العملاء: 
${stats.sampleMessages.slice(0, 5).map((m, i) => `  ${i + 1}. "${m}"`).join("\n")}

**المطلوب:**
اكتب وصفاً محسّناً للعطر يستهدف هذه الطلبات تحديداً. الوصف يجب أن:
- يبرز مميزات تهم هذا الجمهور
- يذكر المناسبات والأوقات المثالية
- يكون شاعرياً وجذاباً (2-3 جمل)

أجب بـ JSON فقط:
{
  "descriptionAr": "وصف عربي جذاب 2-3 جمل",
  "descriptionEn": "English description 2-3 sentences",
  "keywordsAr": ["كلمة1", "كلمة2", "كلمة3"],
  "keywordsEn": ["keyword1", "keyword2", "keyword3"],
  "bestOccasions": ["مناسبة1", "مناسبة2"],
  "targetAudience": "وصف الجمهور المستهدف"
}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJSON(text: string): any {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

const INTENT_PATTERNS: Record<string, string[]> = {
  recommend:  ["أنصحني", "اقترح", "recommend", "suggest", "ما أحسن", "أي عطر"],
  compare:    ["فرق", "مقارنة", "compare", "vs", "أحسن من", "ولا"],
  price:      ["سعر", "price", "كم", "غالي", "رخيص", "تكلفة"],
  occasion:   ["مناسبة", "زفاف", "عمل", "سهرة", "occasion", "event", "wedding"],
  gender:     ["رجال", "نساء", "men", "women", "للرجل", "للمرأة"],
  notes:      ["رائحة", "عود", "مسك", "ورد", "oud", "musk", "rose", "note"],
};

function detectIntent(msg: string): string {
  const lower = msg.toLowerCase();
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) return intent;
  }
  return "general";
}

const ARABIC_KEYWORDS = [
  "عود", "مسك", "ورد", "عنبر", "بخور", "زعفران", "سانداوود", "ياسمين",
  "فاخر", "خفيف", "قوي", "ثقيل", "منعش", "حلو", "دافئ", "بارد",
  "رجال", "نساء", "للجميع", "يومي", "سهرة", "عمل", "زفاف", "هدية",
  "صيف", "شتاء", "ليل", "نهار", "طويل", "ثبات",
];
const ENGLISH_KEYWORDS = [
  "oud", "musk", "rose", "amber", "incense", "saffron", "sandalwood", "jasmine",
  "luxury", "light", "strong", "heavy", "fresh", "sweet", "warm", "cool",
  "men", "women", "unisex", "daily", "evening", "office", "wedding", "gift",
  "summer", "winter", "night", "day", "longevity", "lasting",
];

function extractKeywords(msg: string): string[] {
  const lower = msg.toLowerCase();
  const found: string[] = [];
  for (const kw of [...ARABIC_KEYWORDS, ...ENGLISH_KEYWORDS]) {
    if (lower.includes(kw)) found.push(kw);
  }
  return found.slice(0, 8);
}

// ─── Public API: get enriched product data for advisor ───────────────────────

export async function getProductInsights(productId: string) {
  return AiProductInsightModel.findOne({ productId }).lean();
}

export async function getAllInsightsSummary() {
  const insights = await AiProductInsightModel.find()
    .sort({ orderRate: -1 })
    .limit(50)
    .lean();

  return (insights as any[]).map(i => ({
    productId: i.productId,
    conversionRate: i.conversionRate,
    orderRate: i.orderRate,
    totalShown: i.totalShown,
    totalClicked: i.totalClicked,
    totalOrdered: i.totalOrdered,
    lastLearnedAt: i.lastLearnedAt,
    learnVersion: i.learnVersion,
  }));
}

// ─── Schedule nightly learning at 3 AM UTC ───────────────────────────────────

export function startAiLearningScheduler() {
  console.log("[AI Learn] Scheduler started — runs nightly at 03:00 UTC");

  function scheduleNext() {
    const now = new Date();
    const next = new Date();
    next.setUTCHours(3, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const msUntil = next.getTime() - now.getTime();
    console.log(`[AI Learn] Next run in ${Math.round(msUntil / 3600_000)}h (${next.toISOString()})`);
    setTimeout(async () => {
      await runNightlyLearning().catch(e => console.error("[AI Learn]", e?.message));
      scheduleNext();
    }, msUntil);
  }

  scheduleNext();
}
