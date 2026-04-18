/**
 * AI Employee Assistant — tool-calling agent for staff
 * Lets employees say things like:
 *   "أنشئ منتج جديد اسمه عود ملكي بسعر 350"
 *   "ابحث عن طلبات قيد الشحن"
 *   "أرسل بريد للعميل أحمد بأن طلبه جاهز"
 *   "غيّر حالة الطلب #ABC إلى مكتمل"
 */

import type { Express } from "express";
import { LOGO_BASE64 } from "./_logo";
import { storage } from "./storage";
import { ProductModel, OrderModel, UserModel, CategoryModel } from "./models";
import { sendEmail } from "./email";
import { sendPushToUser, pushToUser } from "./notifications";

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
].filter(Boolean) as string[];

let keyIndex = 0;
function getNextKey(): string {
  if (GROQ_KEYS.length === 0) throw new Error("Groq not configured");
  const key = GROQ_KEYS[keyIndex % GROQ_KEYS.length];
  keyIndex++;
  return key;
}

// ─── Tool Definitions (OpenAI function calling format) ──────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "البحث عن منتجات بالاسم أو إرجاع كل المنتجات. استخدمها قبل تعديل أو الإشارة لمنتج.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "كلمة بحث في اسم المنتج (اختياري)" },
          limit: { type: "number", description: "أقصى عدد نتائج (افتراضي 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "إنشاء منتج عطر جديد. استخدم اسم المنتج بالعربي.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "اسم المنتج" },
          description: { type: "string", description: "وصف العطر (نوتاته، شخصيته)" },
          price: { type: "number", description: "السعر بالريال السعودي" },
          cost: { type: "number", description: "سعر التكلفة بالريال (اختياري)" },
          categoryName: { type: "string", description: "اسم التصنيف (مثلاً: عطور رجالية، عود ودخون)" },
          stock: { type: "number", description: "الكمية المتوفرة (افتراضي 10)" },
          variantSize: { type: "string", description: "الحجم مثل 50ml (اختياري)" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product_stock",
      description: "تحديث مخزون منتج معيّن (للزيادة أو النقصان).",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "معرف المنتج (من search_products)" },
          variantSku: { type: "string", description: "SKU للنسخة (اختياري — أول نسخة افتراضياً)" },
          newStock: { type: "number", description: "الكمية الجديدة" },
        },
        required: ["productId", "newStock"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "البحث عن طلبات حسب الحالة أو رقم الهاتف.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["new", "processing", "shipped", "completed", "cancelled", "pending_payment"],
            description: "حالة الطلب",
          },
          customerPhone: { type: "string", description: "رقم هاتف العميل" },
          limit: { type: "number", description: "أقصى عدد (افتراضي 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "تغيير حالة طلب (شحن، إكمال، إلغاء، إلخ).",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "معرف الطلب الكامل" },
          status: {
            type: "string",
            enum: ["new", "processing", "shipped", "completed", "cancelled"],
          },
          reason: { type: "string", description: "سبب التغيير (للإلغاء)" },
        },
        required: ["orderId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "البحث عن عميل بالاسم أو رقم الهاتف.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "اسم أو رقم هاتف" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email_to_customer",
      description: "إرسال بريد إلكتروني مخصص لعميل (مثلاً: تنبيه، رد، عرض). يُغلَّف بقالب رفيف العود الفاخر تلقائياً.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "البريد الإلكتروني للعميل" },
          subject: { type: "string", description: "موضوع البريد" },
          messageHtml: {
            type: "string",
            description: "محتوى البريد بـ HTML بسيط (سيُغلَّف داخل قالب رفيف العود)",
          },
        },
        required: ["to", "subject", "messageHtml"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_push_notification",
      description: "إرسال إشعار push للعميل في تطبيقه (يصل حتى لو التطبيق مغلق).",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "معرف العميل (من search_customers)" },
          title: { type: "string" },
          body: { type: "string" },
          url: { type: "string", description: "رابط لفتحه عند الضغط (اختياري)" },
        },
        required: ["userId", "title", "body"],
      },
    },
  },
];

// ─── Tool Implementations ───────────────────────────────────────────────────

async function execTool(name: string, args: any, _user: any): Promise<any> {
  try {
    switch (name) {
      case "search_products": {
        const query = (args.query || "").trim();
        const limit = Math.min(args.limit || 10, 25);
        const filter = query
          ? { name: { $regex: query, $options: "i" } }
          : {};
        const products = await ProductModel.find(filter).limit(limit).lean();
        return {
          ok: true,
          count: products.length,
          products: products.map((p: any) => ({
            id: p._id.toString(),
            name: p.name,
            price: p.price,
            stock: (p.variants || []).reduce(
              (s: number, v: any) => s + (v.stock || 0),
              0
            ),
            variants: (p.variants || []).map((v: any) => ({
              sku: v.sku,
              size: v.size,
              color: v.color,
              stock: v.stock,
            })),
          })),
        };
      }

      case "create_product": {
        let categoryId: string | undefined;
        if (args.categoryName) {
          const cat = await CategoryModel.findOne({
            $or: [
              { nameAr: { $regex: args.categoryName, $options: "i" } },
              { name: { $regex: args.categoryName, $options: "i" } },
            ],
          }).lean();
          if (cat) categoryId = (cat as any)._id.toString();
        }
        if (!categoryId) {
          const firstCat = await CategoryModel.findOne().lean();
          categoryId = firstCat ? (firstCat as any)._id.toString() : undefined;
        }
        if (!categoryId) {
          return { ok: false, error: "لا توجد تصنيفات. أنشئ تصنيف أولاً." };
        }

        const product = await ProductModel.create({
          name: args.name,
          description: args.description || "",
          price: String(args.price),
          cost: String(args.cost || 0),
          images: [],
          categoryId,
          categoryIds: [categoryId],
          variants: [
            {
              color: args.variantSize || "افتراضي",
              size: args.variantSize || "50ml",
              sku: `SKU-${Date.now()}`,
              stock: args.stock || 10,
              cost: 0,
              image: "",
            },
          ],
          isFeatured: false,
        });
        return {
          ok: true,
          productId: product._id.toString(),
          message: `تم إنشاء المنتج "${args.name}" بنجاح. ينقصه صور — اطلب من الموظف رفعها.`,
        };
      }

      case "update_product_stock": {
        const product = await ProductModel.findById(args.productId);
        if (!product) return { ok: false, error: "المنتج غير موجود" };
        const variants = (product as any).variants || [];
        if (variants.length === 0) return { ok: false, error: "لا توجد نسخ" };
        let target = args.variantSku
          ? variants.find((v: any) => v.sku === args.variantSku)
          : variants[0];
        if (!target) target = variants[0];
        const oldStock = target.stock;
        target.stock = args.newStock;
        await product.save();
        return {
          ok: true,
          message: `تم تحديث مخزون "${(product as any).name}" من ${oldStock} إلى ${args.newStock}`,
        };
      }

      case "search_orders": {
        const filter: any = {};
        if (args.status) filter.status = args.status;
        if (args.customerPhone) {
          const u = await UserModel.findOne({ phone: args.customerPhone }).lean();
          if (u) filter.userId = (u as any)._id.toString();
        }
        const limit = Math.min(args.limit || 10, 25);
        const orders = await OrderModel.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return {
          ok: true,
          count: orders.length,
          orders: orders.map((o: any) => ({
            id: o._id.toString(),
            ref: String(o._id).slice(-6).toUpperCase(),
            status: o.status,
            total: o.total,
            customer: o.shippingAddress?.fullName || o.userId,
            phone: o.shippingAddress?.phone,
            createdAt: o.createdAt,
            itemCount: (o.items || []).length,
          })),
        };
      }

      case "update_order_status": {
        const order = await OrderModel.findById(args.orderId);
        if (!order) return { ok: false, error: "الطلب غير موجود" };
        const oldStatus = (order as any).status;
        (order as any).status = args.status;
        if (args.reason) (order as any).cancelReason = args.reason;
        await order.save();
        // Notify customer
        try {
          const userId = (order as any).userId;
          if (userId) {
            const statusLabels: any = {
              processing: "قيد التجهيز",
              shipped: "تم الشحن",
              completed: "مكتمل",
              cancelled: "ملغي",
            };
            await sendPushToUser(String(userId), {
              title: "تحديث حالة طلبك",
              body: `طلبك #${String(order._id).slice(-6).toUpperCase()}: ${statusLabels[args.status] || args.status}`,
              url: "/orders",
            });
            pushToUser(String(userId), {
              type: "order_status",
              orderId: String(order._id),
              status: args.status,
            });
          }
        } catch {}
        return {
          ok: true,
          message: `تم تغيير حالة الطلب #${String(order._id).slice(-6).toUpperCase()} من ${oldStatus} إلى ${args.status}`,
        };
      }

      case "search_customers": {
        const q = args.query.trim();
        const limit = Math.min(args.limit || 10, 25);
        const users = await UserModel.find({
          $or: [
            { phone: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        })
          .limit(limit)
          .lean();
        return {
          ok: true,
          count: users.length,
          customers: users.map((u: any) => ({
            id: u._id.toString(),
            name: u.name,
            phone: u.phone,
            email: u.email,
            role: u.role,
          })),
        };
      }

      case "send_email_to_customer": {
        const wrapped = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${args.subject}</title>
<style>body{margin:0;background:#f5f5f0;font-family:Tahoma,sans-serif}
.wrap{max-width:600px;margin:40px auto;background:#fff;border:1px solid rgba(0,0,0,.06)}
.header{background:linear-gradient(135deg,#1a2744,#243154,#1a2744);padding:28px;text-align:center;border-bottom:3px solid #c9a96e}
.header img{height:56px}
.brand{color:#fff;font-size:20px;font-weight:900;margin-top:8px}
.sub{color:#c9a96e;font-size:10px;letter-spacing:.4em;margin-top:4px}
.body{padding:40px 32px;color:#1a1a1a;font-size:14px;line-height:1.8}
.footer{background:#000;color:rgba(255,255,255,.4);padding:20px;text-align:center;font-size:11px}
</style></head><body><div class="wrap">
<div class="header"><img src="${LOGO_BASE64}" alt=""/><div class="brand">رفيف العود</div><div class="sub">RF PERFUME · LUXURY FRAGRANCES</div></div>
<div class="body">${args.messageHtml}</div>
<div class="footer">© ${new Date().getFullYear()} رفيف العود — جميع الحقوق محفوظة</div>
</div></body></html>`;
        await sendEmail({ to: args.to, subject: args.subject, html: wrapped });
        return { ok: true, message: `تم إرسال البريد إلى ${args.to}` };
      }

      case "send_push_notification": {
        await sendPushToUser(args.userId, {
          title: args.title,
          body: args.body,
          url: args.url || "/",
        });
        pushToUser(args.userId, {
          type: "custom",
          title: args.title,
          body: args.body,
        });
        return { ok: true, message: `تم إرسال الإشعار للعميل` };
      }

      default:
        return { ok: false, error: `أداة غير معروفة: ${name}` };
    }
  } catch (err: any) {
    console.error(`[Assistant Tool ${name}] error:`, err);
    return { ok: false, error: err.message || "خطأ غير معروف" };
  }
}

// ─── Assistant Loop ─────────────────────────────────────────────────────────

async function groqWithTools(messages: any[], maxIterations = 5): Promise<any> {
  const allMessages = [...messages];
  const actions: Array<{ tool: string; args: any; result: any }> = [];

  for (let i = 0; i < maxIterations; i++) {
    const key = getNextKey();
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Assistant Groq]", res.status, text.slice(0, 200));
      throw new Error(`Groq error ${res.status}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("No response from model");

    allMessages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: message.content || "", actions };
    }

    // Execute tools in parallel
    const results = await Promise.all(
      toolCalls.map(async (call: any) => {
        const fnName = call.function.name;
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}");
        } catch {}
        const result = await execTool(fnName, parsedArgs, null);
        actions.push({ tool: fnName, args: parsedArgs, result });
        return {
          tool_call_id: call.id,
          role: "tool" as const,
          name: fnName,
          content: JSON.stringify(result),
        };
      })
    );

    allMessages.push(...results);
  }

  return {
    reply: "وصلت للحد الأقصى من الخطوات. الإجراءات المنفذة تظهر أعلاه.",
    actions,
  };
}

// ─── Express Route ──────────────────────────────────────────────────────────

export function registerEmployeeAssistant(app: Express) {
  app.post("/api/admin/assistant", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as any;
      const allowedRoles = [
        "admin",
        "assistant_manager",
        "tech_support",
        "accountant",
        "employee",
        "cashier",
        "support",
      ];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "ليس لديك صلاحية" });
      }

      if (GROQ_KEYS.length === 0) {
        return res.status(503).json({ message: "AI غير مُفعّل" });
      }

      const { messages = [] } = req.body;
      const userMessages = Array.isArray(messages) ? messages.slice(-12) : [];

      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = `أنت "لمسة" 🌸 — مساعدة موظفي رفيف العود الذكية.
أنت تتحدثين باللغة العربية الفصحى المهذبة، ودودة وسريعة.

دورك:
- تنفيذ مهام الموظف بأدواتك المتاحة (إنشاء منتجات، تعديل طلبات، إرسال بريد، إشعارات، إلخ)
- استخدمي الأدوات بحكمة — ابحثي قبل أن تعدّلي
- تأكدي قبل تنفيذ إجراءات حساسة (إلغاء طلبات، إرسال بريد للعملاء)
- أعطي ملخص واضح بعد كل إجراء

التاريخ اليوم: ${today}
دور المستخدم: ${user.role}
الموظف: ${user.name || user.phone}

حين تنتهين من المهمة، أعطي ردًا مختصرًا واضحًا بالعربية يلخّص ما فعلتِه.`;

      const result = await groqWithTools([
        { role: "system", content: systemPrompt },
        ...userMessages,
      ]);

      res.json(result);
    } catch (err: any) {
      console.error("[Assistant]", err);
      res.status(500).json({ message: err.message || "خطأ في المساعد" });
    }
  });
}
