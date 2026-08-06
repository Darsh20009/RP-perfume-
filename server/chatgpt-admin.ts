/**
 * Admin AI Chat — يستخدم Kimi (Moonshot) المجاني
 * الواجهة تشبه ChatGPT، السيستم يضيف سياق المتجر تلقائياً.
 */

import type { Express } from "express";
import { ProductModel, OrderModel, UserModel } from "./models";

const KIMI_BASE  = "https://api.moonshot.ai/v1/chat/completions";
const KIMI_MODEL = "moonshot-v1-32k"; // سياق كبير للمطورين

function isConfigured(): boolean {
  return !!(process.env.KIMI_API_KEY || "").trim();
}

async function buildSystemContext(): Promise<string> {
  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  let stats = "";
  try {
    const [products, orders, customers] = await Promise.all([
      ProductModel.countDocuments({ isActive: true }),
      OrderModel.countDocuments(),
      UserModel.countDocuments({ role: "customer" }),
    ]);
    const pending = await OrderModel.countDocuments({ status: "pending" });
    const rev = await OrderModel.aggregate([
      { $match: { status: { $in: ["delivered", "completed"] } } },
      { $group: { _id: null, t: { $sum: "$total" } } },
    ]);
    stats = `\n## إحصائيات حية (${today})\n- منتجات نشطة: ${products}\n- إجمالي الطلبات: ${orders} (معلق: ${pending})\n- عملاء: ${customers}\n- إيرادات مكتملة: ${(rev[0]?.t || 0).toFixed(0)} ريال\n`;
  } catch { stats = ""; }

  return `أنت مساعد تطوير متخصص في نظام **رفيف العود | RF Perfume**.

## النظام
- متجر عطور فاخر عربي (RTL)
- Stack: React 18 + Vite + Express.js + TypeScript + MongoDB Atlas + Mongoose
- Auth: Passport.js (local + Google + Apple) + express-session
- المدفوعات: Paymob, Tabby, Tamara, STC Pay, Apple Pay
- الشحن: Shipox/3rd Mile + Storage Station (3PL)
- الذكاء الاصطناعي: Kimi Moonshot (moonshot-v1-8k/32k)
- البريد: SMTP2Go
- أدوار RBAC: admin, assistant_manager, tech_support, accountant, employee, cashier, support

## هيكل الملفات
\`\`\`
client/src/pages/Admin.tsx        — لوحة أدمن رئيسية (6700+ سطر)
client/src/pages/admin/           — صفحات فرعية
server/routes.ts                  — كل الـ API routes
server/employee-assistant.ts      — المساعد الداخلي (Lamsa) + 16 أداة
server/models.ts                  — Mongoose schemas
server/auth.ts                    — المصادقة
server/email.ts                   — البريد
server/kimi.ts                    — Moonshot AI
server/shipox.ts                  — الشحن Shipox
server/notifications.ts           — WebSocket + Push
shared/schema.ts                  — Zod schemas مشتركة
shared/routes.ts                  — API endpoints constants
\`\`\`

## قواعد مهمة للتطوير
1. RTL دائماً للعربية في المكونات
2. استخدم \`lean()\` للقراءة فقط في Mongoose
3. العمليات الحساسة (مخزون/طلبات) → atomic operations
4. كل API يحتاج \`requireAuth\` + \`requireAdmin\`
5. Session cookies: SameSite=None للـ Replit preview
6. الذكاء الاصطناعي يمر عبر \`server/groq.ts\` → \`server/kimi.ts\`
${stats}
## تعليمات
- أجب بالعربية أو الإنجليزية حسب لغة السؤال
- اكتب كوداً نظيفاً مع شرح
- استشهد بأسماء الملفات الفعلية
- ساعد في: ميزات جديدة، تصحيح أخطاء، فهم الكود، تحسين الأداء
- اليوم: ${today}`;
}

async function callKimi(messages: any[]): Promise<string> {
  const key = (process.env.KIMI_API_KEY || "").trim();
  if (!key) throw new Error("KIMI_API_KEY غير مضبوط");

  const res = await fetch(KIMI_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: KIMI_MODEL, messages, temperature: 0.6, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kimi API خطأ ${res.status}: ${err.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "لا يوجد رد";
}

export function registerChatGPTAdmin(app: Express) {
  // POST /api/admin/chatgpt-chat
  app.post("/api/admin/chatgpt-chat", async (req: any, res) => {
    if (!req.isAuthenticated?.() || !req.user)
      return res.status(401).json({ message: "غير مصرح" });

    const allowed = ["admin", "tech_support", "assistant_manager"];
    if (!allowed.includes(req.user.role))
      return res.status(403).json({ message: "صلاحية غير كافية" });

    if (!isConfigured())
      return res.status(503).json({ message: "KIMI_API_KEY غير مضبوط. أضفه في Replit Secrets." });

    const { messages } = req.body as { messages: { role: string; content: string }[] };
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ message: "messages مطلوب" });

    try {
      const ctx = await buildSystemContext();
      const fullMessages = [
        { role: "system", content: ctx },
        ...messages.slice(-20),
      ];
      const reply = await callKimi(fullMessages);
      res.json({ reply });
    } catch (err: any) {
      console.error("[Admin AI]", err?.message);
      res.status(500).json({ message: err?.message || "خطأ في الاتصال بالذكاء الاصطناعي" });
    }
  });

  // GET /api/admin/chatgpt-status
  app.get("/api/admin/chatgpt-status", (req: any, res) => {
    if (!req.isAuthenticated?.() || !req.user)
      return res.status(401).json({ configured: false });
    res.json({ configured: isConfigured(), model: KIMI_MODEL });
  });
}
