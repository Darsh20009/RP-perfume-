/**
 * ChatGPT Admin Assistant
 * Proxies admin questions to OpenAI API with full RF Perfume system context.
 */

import type { Express } from "express";
import { ProductModel, OrderModel, UserModel } from "./models";

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

function isConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY || "").trim();
}

async function buildSystemContext(): Promise<string> {
  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Fetch real-time stats
  let statsText = "";
  try {
    const [totalProducts, totalOrders, totalCustomers, recentOrders] = await Promise.all([
      ProductModel.countDocuments({ isActive: true }),
      OrderModel.countDocuments(),
      UserModel.countDocuments({ role: "customer" }),
      OrderModel.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber status total createdAt")
        .lean(),
    ]);

    const pendingOrders = await OrderModel.countDocuments({ status: "pending" });
    const processingOrders = await OrderModel.countDocuments({ status: "processing" });

    const revenueResult = await OrderModel.aggregate([
      { $match: { status: { $in: ["delivered", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    statsText = `
## إحصائيات النظام الحالية (${today})
- **المنتجات النشطة:** ${totalProducts}
- **إجمالي الطلبات:** ${totalOrders} (${pendingOrders} معلق، ${processingOrders} قيد المعالجة)
- **إجمالي العملاء:** ${totalCustomers}
- **إجمالي الإيرادات (الطلبات المكتملة):** ${totalRevenue.toFixed(2)} ريال
- **آخر 5 طلبات:** ${recentOrders.map((o: any) => `#${o.orderNumber} (${o.status}) - ${o.total} ريال`).join(" | ")}
`;
  } catch (e) {
    statsText = "\n## إحصائيات النظام: غير متوفرة حالياً\n";
  }

  return `أنت مساعد ذكاء اصطناعي متخصص في نظام "رفيف العود | RF Perfume" — منصة تجارة إلكترونية فاخرة للعطور العربية.

## وصف النظام
- **المنصة:** متجر إلكتروني للعطور الفاخرة باللغة العربية (RTL أولاً)
- **التقنية:** React 18 + Vite (واجهة) + Express.js + TypeScript (خادم) + MongoDB Atlas (قاعدة البيانات)
- **المصادقة:** Passport.js (محلي + Google OAuth + Apple Sign-In) + express-session
- **المدفوعات:** Paymob, Tabby (BNPL), Tamara (BNPL), STC Pay, Apple Pay
- **الشحن:** Shipox / 3rd Mile (تكامل مباشر) + Storage Station (3PL)
- **البريد:** SMTP2Go
- **الذكاء الاصطناعي الداخلي:** Kimi (Moonshot) للمستشار والدعم والإدارة

## هيكل الكود
- \`client/src/\` — كود React (الواجهة)
- \`client/src/pages/Admin.tsx\` — لوحة تحكم الأدمن (ملف ضخم 6700+ سطر)
- \`client/src/pages/admin/\` — صفحات الأدمن الفرعية
- \`server/routes.ts\` — API routes الرئيسية
- \`server/employee-assistant.ts\` — المساعد الداخلي (Lamsa) بـ 16 أداة
- \`server/models.ts\` — Mongoose schemas (Product, Order, User, Category...)
- \`server/auth.ts\` — المصادقة
- \`server/email.ts\` — البريد الإلكتروني
- \`server/kimi.ts\` — تكامل Moonshot AI
- \`server/shipox.ts\` — تكامل الشحن
- \`server/notifications.ts\` — WebSocket + Push notifications
- \`shared/schema.ts\` — Zod schemas المشتركة
- \`shared/routes.ts\` — API endpoints constants

## الميزات الرئيسية
- نظام المحفظة الإلكترونية للعملاء
- فواتير ضريبية (ZATCA) PDF
- نظام نقاط البيع (POS)
- استرداد عربات التسوق المهجورة
- إدارة المخزون بالفروع
- نظام المراجعات (verified buyers)
- إشعارات Push + WebSocket
- RBAC (أدوار: admin, assistant_manager, tech_support, accountant, employee, cashier, support)
- صفحات CMS ديناميكية
- شريط عروض قابل للتخصيص
- حزم المنتجات + عروض Flash
- تكامل Meta/TikTok/Snapchat Pixels

## قواعد هامة عند تطوير النظام
1. الملفات العربية تحتاج \`dir="rtl"\` في المكونات
2. استخدم Mongoose lean() للقراءة فقط
3. العمليات الحساسة (مخزون، طلبات) تستخدم atomic operations
4. session cookies تعتمد SameSite=None للـ Replit preview
5. كل API يحتاج middleware المصادقة (\`requireAuth\`, \`requireAdmin\`)

${statsText}

## تعليماتك
- أجب بالعربية دائماً (أو الإنجليزية إذا سألك بالإنجليزية)
- كن دقيقاً في الإجابات التقنية، واستشهد بأسماء الملفات والدوال الفعلية
- إذا سألك عن كود، اكتب كوداً نظيفاً مع شرح موجز
- ساعد في: تطوير ميزات جديدة، تصحيح الأخطاء، فهم الكود، تحسين الأداء
- التاريخ اليوم: ${today}`;
}

async function callOpenAI(messages: any[]): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY غير مضبوط");

  const res = await fetch(OPENAI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "لا يوجد رد";
}

export function registerChatGPTAdmin(app: Express) {
  // POST /api/admin/chatgpt-chat
  app.post("/api/admin/chatgpt-chat", async (req: any, res) => {
    // Auth check
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    const allowedRoles = ["admin", "tech_support", "assistant_manager"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "صلاحية غير كافية" });
    }

    if (!isConfigured()) {
      return res.status(503).json({
        message: "OpenAI API غير مضبوط. أضف OPENAI_API_KEY في الإعدادات.",
      });
    }

    const { messages } = req.body as { messages: { role: string; content: string }[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages مطلوب" });
    }

    try {
      const systemContext = await buildSystemContext();
      const fullMessages = [
        { role: "system", content: systemContext },
        ...messages.slice(-20), // Keep last 20 messages for context
      ];

      const reply = await callOpenAI(fullMessages);
      res.json({ reply });
    } catch (err: any) {
      console.error("[ChatGPT Admin]", err?.message);
      res.status(500).json({ message: err?.message || "خطأ في الاتصال بـ OpenAI" });
    }
  });

  // GET /api/admin/chatgpt-status — check if configured
  app.get("/api/admin/chatgpt-status", (req: any, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ configured: false });
    }
    res.json({ configured: isConfigured(), model: OPENAI_MODEL });
  });
}
