/**
 * AI Employee Assistant — tool-calling agent for staff
 * "Lamsa" 🌸 — bilingual (AR/EN), 16 tools, deep system prompt with workflow patterns.
 */

import type { Express } from "express";
import { LOGO_BASE64 } from "./_logo";
import { storage } from "./storage";
import { ProductModel, OrderModel, UserModel, CategoryModel } from "./models";
import { sendEmail } from "./email";
import { sendPushToUser, pushToUser } from "./notifications";
import { detectLang } from "./groq";

// Employee assistant has its OWN dedicated keys, separate from customer pool.
// This guarantees staff AI keeps working even if customers exhaust their share.
const GROQ_KEYS = Array.from(new Set([
  process.env.GROQ_API_KEY_EMPLOYEE,
  process.env.GROQ_API_KEY_8,
  process.env.GROQ_API_KEY_9,
  process.env.GROQ_API_KEY_10,
  process.env.GROQ_API_KEY_11,
].filter(Boolean) as string[]));

let keyIndex = 0;
const badKeys = new Set<number>(); // Permanently-bad (401/403) keys we won't retry

// ─── Tool Definitions ───────────────────────────────────────────────────────

const NUM = { type: ["number", "string"] as any };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Get high-level store stats (orders count, revenue, pending count) for a period. Call this FIRST when the employee asks 'how is the store doing?' or 'show me today's numbers'.",
      parameters: {
        type: "object",
        properties: {
          periodDays: { ...NUM, description: "Number of days back from today (default 7, use 1 for today, 30 for month)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_selling_products",
      description: "Return the best-selling products ranked by units sold. Use when asked about bestsellers, top products, or what to restock.",
      parameters: {
        type: "object",
        properties: {
          limit: { ...NUM, description: "How many top products to return (default 5)" },
          periodDays: { ...NUM, description: "Period in days (default 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "List products whose total stock is below a threshold. Use when asked about restocking, low inventory, or out-of-stock items.",
      parameters: {
        type: "object",
        properties: {
          threshold: { ...NUM, description: "Stock threshold (default 5)" },
          limit: { ...NUM, description: "Max items (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products by name (partial match) or list all. Always call this BEFORE updating/referencing a product to get its ID.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name keyword (optional)" },
          limit: { ...NUM, description: "Max results (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Create a new perfume product. Use the Arabic name as the primary name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "Perfume description (notes, character)" },
          price: { ...NUM, description: "Price in SAR" },
          cost: { ...NUM, description: "Cost in SAR (optional)" },
          categoryName: { type: "string", description: "Category name (e.g. عطور رجالية)" },
          stock: { ...NUM, description: "Initial stock (default 10)" },
          variantSize: { type: "string", description: "Size like 50ml (optional)" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Update an existing product's name, description, price, cost or featured status. Pass only the fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "Product _id (from search_products)" },
          name: { type: "string" },
          description: { type: "string" },
          price: { ...NUM },
          cost: { ...NUM },
          isFeatured: { type: "boolean" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product_stock",
      description: "Set the stock of a specific variant of a product (used to restock or correct counts).",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" },
          variantSku: { type: "string", description: "Variant SKU (optional — defaults to first variant)" },
          newStock: { ...NUM },
        },
        required: ["productId", "newStock"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search orders by status and/or customer phone.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["new", "processing", "shipped", "completed", "cancelled", "pending_payment"],
          },
          customerPhone: { type: "string" },
          limit: { ...NUM, description: "Default 10, max 25" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_details",
      description: "Get the FULL details of one order: items, customer, shipping address, payment, totals. Use when investigating a specific order.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order _id (full id, not the short ref)" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "Change an order's status (processing, shipped, completed, cancelled). Customer is auto-notified.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          status: {
            type: "string",
            enum: ["new", "processing", "shipped", "completed", "cancelled"],
          },
          reason: { type: "string", description: "Cancellation reason (required for cancellation)" },
        },
        required: ["orderId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Find customers by name, phone, or email.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { ...NUM },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_orders",
      description: "Get all orders of a specific customer (by user _id) — useful when investigating a customer complaint.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string" },
          limit: { ...NUM, description: "Default 10" },
        },
        required: ["userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "List all product categories. Call before create_category to avoid duplicates.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_category",
      description: "Create a new product category.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Arabic name" },
          nameEn: { type: "string", description: "English name (optional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email_to_customer",
      description: "Send a personalised email to a customer (auto-wrapped in the RF Perfume luxury template).",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Customer email" },
          subject: { type: "string" },
          messageHtml: { type: "string", description: "Body HTML (will be wrapped in the brand template)" },
        },
        required: ["to", "subject", "messageHtml"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_push_notification",
      description: "Send a push notification to a customer's device (works even if app closed).",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          url: { type: "string", description: "URL to open on tap (optional)" },
        },
        required: ["userId", "title", "body"],
      },
    },
  },
];

// ─── Tool Implementations ───────────────────────────────────────────────────

function toNum(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

async function execTool(name: string, args: any, _user: any): Promise<any> {
  for (const k of ["limit", "price", "cost", "stock", "newStock", "threshold", "periodDays"]) {
    if (k in args) {
      const n = toNum(args[k]);
      if (n !== undefined) args[k] = n;
      else delete args[k];
    }
  }
  try {
    switch (name) {
      case "get_dashboard_stats": {
        const days = args.periodDays || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const orders = await OrderModel.find({ createdAt: { $gte: since } }).lean();
        const totalRevenue = orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
        const byStatus: Record<string, number> = {};
        for (const o of orders as any[]) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        const productsCount = await ProductModel.countDocuments();
        const customersCount = await UserModel.countDocuments({ role: { $in: ["customer", null, undefined] } });
        return {
          ok: true,
          periodDays: days,
          ordersCount: orders.length,
          totalRevenueSAR: Math.round(totalRevenue),
          ordersByStatus: byStatus,
          totalProducts: productsCount,
          totalCustomers: customersCount,
          averageOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
        };
      }

      case "get_top_selling_products": {
        const limit = Math.min(args.limit || 5, 20);
        const days = args.periodDays || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const orders = await OrderModel.find({
          createdAt: { $gte: since },
          status: { $nin: ["cancelled"] },
        }).lean();
        const counts: Record<string, { name: string; units: number; revenue: number }> = {};
        for (const o of orders as any[]) {
          for (const it of o.items || []) {
            const key = String(it.productId || it.name);
            if (!counts[key]) counts[key] = { name: it.name || "?", units: 0, revenue: 0 };
            counts[key].units += Number(it.quantity) || 1;
            counts[key].revenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
          }
        }
        const top = Object.entries(counts)
          .map(([id, v]) => ({ productId: id, ...v }))
          .sort((a, b) => b.units - a.units)
          .slice(0, limit);
        return { ok: true, periodDays: days, top };
      }

      case "get_low_stock_products": {
        const threshold = args.threshold ?? 5;
        const limit = Math.min(args.limit || 20, 50);
        const products = await ProductModel.find().lean();
        const low = (products as any[])
          .map((p) => ({
            id: p._id.toString(),
            name: p.name,
            totalStock: (p.variants || []).reduce((s: number, v: any) => s + (v.stock || 0), 0),
            variants: (p.variants || []).map((v: any) => ({ sku: v.sku, size: v.size, stock: v.stock })),
          }))
          .filter((p) => p.totalStock <= threshold)
          .sort((a, b) => a.totalStock - b.totalStock)
          .slice(0, limit);
        return { ok: true, threshold, count: low.length, products: low };
      }

      case "search_products": {
        const query = (args.query || "").trim();
        const limit = Math.min(args.limit || 10, 25);
        const filter = query ? { name: { $regex: query, $options: "i" } } : {};
        const products = await ProductModel.find(filter).limit(limit).lean();
        return {
          ok: true,
          count: products.length,
          products: (products as any[]).map((p) => ({
            id: p._id.toString(),
            name: p.name,
            price: p.price,
            stock: (p.variants || []).reduce((s: number, v: any) => s + (v.stock || 0), 0),
            isFeatured: p.isFeatured,
            variants: (p.variants || []).map((v: any) => ({
              sku: v.sku, size: v.size, color: v.color, stock: v.stock,
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
        if (!categoryId) return { ok: false, error: "No categories exist. Create a category first via create_category." };
        const product = await ProductModel.create({
          name: args.name,
          description: args.description || "",
          price: String(args.price),
          cost: String(args.cost || 0),
          images: [],
          categoryId,
          categoryIds: [categoryId],
          variants: [{
            color: args.variantSize || "افتراضي",
            size: args.variantSize || "50ml",
            sku: `SKU-${Date.now()}`,
            stock: args.stock || 10,
            cost: 0,
            image: "",
          }],
          isFeatured: false,
        });
        return {
          ok: true,
          productId: product._id.toString(),
          message: `Product "${args.name}" created successfully. It still needs images — ask the employee to upload them.`,
        };
      }

      case "update_product": {
        const product = await ProductModel.findById(args.productId);
        if (!product) return { ok: false, error: "Product not found" };
        const changes: string[] = [];
        if (args.name !== undefined) { (product as any).name = args.name; changes.push("name"); }
        if (args.description !== undefined) { (product as any).description = args.description; changes.push("description"); }
        if (args.price !== undefined) { (product as any).price = String(args.price); changes.push("price"); }
        if (args.cost !== undefined) { (product as any).cost = String(args.cost); changes.push("cost"); }
        if (args.isFeatured !== undefined) { (product as any).isFeatured = !!args.isFeatured; changes.push("isFeatured"); }
        if (changes.length === 0) return { ok: false, error: "No fields to update" };
        await product.save();
        return { ok: true, productId: args.productId, updated: changes, message: `Updated: ${changes.join(", ")}` };
      }

      case "update_product_stock": {
        const product = await ProductModel.findById(args.productId);
        if (!product) return { ok: false, error: "Product not found" };
        const variants = (product as any).variants || [];
        if (variants.length === 0) return { ok: false, error: "No variants" };
        let target = args.variantSku
          ? variants.find((v: any) => v.sku === args.variantSku)
          : variants[0];
        if (!target) target = variants[0];
        const oldStock = target.stock;
        target.stock = args.newStock;
        await product.save();
        return { ok: true, message: `Stock of "${(product as any).name}" updated from ${oldStock} to ${args.newStock}` };
      }

      case "search_orders": {
        const filter: any = {};
        if (args.status) filter.status = args.status;
        if (args.customerPhone) {
          const u = await UserModel.findOne({ phone: args.customerPhone }).lean();
          if (u) filter.userId = (u as any)._id.toString();
        }
        const limit = Math.min(args.limit || 10, 25);
        const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        return {
          ok: true,
          count: orders.length,
          orders: (orders as any[]).map((o) => ({
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

      case "get_order_details": {
        const order = await OrderModel.findById(args.orderId).lean();
        if (!order) return { ok: false, error: "Order not found" };
        const o: any = order;
        return {
          ok: true,
          id: o._id.toString(),
          ref: String(o._id).slice(-6).toUpperCase(),
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          subtotal: o.subtotal,
          shipping: o.shippingCost,
          discount: o.discount,
          total: o.total,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          shippingAddress: o.shippingAddress,
          trackingNumber: o.trackingNumber,
          items: (o.items || []).map((it: any) => ({
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            quantity: it.quantity,
            price: it.price,
          })),
          notes: o.notes,
          cancelReason: o.cancelReason,
        };
      }

      case "update_order_status": {
        const order = await OrderModel.findById(args.orderId);
        if (!order) return { ok: false, error: "Order not found" };
        const oldStatus = (order as any).status;
        (order as any).status = args.status;
        if (args.reason) (order as any).cancelReason = args.reason;
        await order.save();
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
            pushToUser(String(userId), { type: "order_status", orderId: String(order._id), status: args.status });
          }
        } catch {}
        return {
          ok: true,
          message: `Order #${String(order._id).slice(-6).toUpperCase()} status changed from ${oldStatus} → ${args.status}. Customer notified.`,
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
        }).limit(limit).lean();
        return {
          ok: true,
          count: users.length,
          customers: (users as any[]).map((u) => ({
            id: u._id.toString(),
            name: u.name,
            phone: u.phone,
            email: u.email,
            role: u.role,
          })),
        };
      }

      case "get_customer_orders": {
        const limit = Math.min(args.limit || 10, 25);
        const orders = await OrderModel.find({ userId: args.userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        const totalSpent = (orders as any[]).reduce((s, o) => s + (Number(o.total) || 0), 0);
        return {
          ok: true,
          count: orders.length,
          totalSpentSAR: Math.round(totalSpent),
          orders: (orders as any[]).map((o) => ({
            id: o._id.toString(),
            ref: String(o._id).slice(-6).toUpperCase(),
            status: o.status,
            total: o.total,
            createdAt: o.createdAt,
            itemCount: (o.items || []).length,
          })),
        };
      }

      case "list_categories": {
        const cats = await CategoryModel.find().lean();
        return {
          ok: true,
          count: cats.length,
          categories: (cats as any[]).map((c) => ({
            id: c._id.toString(),
            name: c.nameAr || c.name,
            nameEn: c.nameEn || c.name,
          })),
        };
      }

      case "create_category": {
        const cat = await CategoryModel.create({
          name: args.nameEn || args.name,
          nameAr: args.name,
          nameEn: args.nameEn || args.name,
        });
        return { ok: true, categoryId: cat._id.toString(), message: `Category "${args.name}" created.` };
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
<div class="header"><img src="${LOGO_BASE64}" alt=""/><div class="brand">عطور آر اف</div><div class="sub">RF PERFUME · LUXURY FRAGRANCES</div></div>
<div class="body">${args.messageHtml}</div>
<div class="footer">© ${new Date().getFullYear()} عطور آر اف — جميع الحقوق محفوظة</div>
</div></body></html>`;
        await sendEmail({ to: args.to, subject: args.subject, html: wrapped });
        return { ok: true, message: `Email sent to ${args.to}` };
      }

      case "send_push_notification": {
        await sendPushToUser(args.userId, { title: args.title, body: args.body, url: args.url || "/" });
        pushToUser(args.userId, { type: "custom", title: args.title, body: args.body });
        return { ok: true, message: `Notification sent to customer` };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`[Assistant Tool ${name}] error:`, err);
    return { ok: false, error: err.message || "Unknown error" };
  }
}

// ─── System Prompts (bilingual) ─────────────────────────────────────────────

const SYSTEM_PROMPT_AR = (today: string, role: string, name: string) => `أنت "لمسة" 🌸 — مساعدة موظفي عطور آر اف الذكية والذكية جداً.

🎯 **هويتك ومهمتك:**
- اسمك "لمسة"، خبيرة تشغيل متجر عطور فاخر، عملية وسريعة وذكية
- تنفّذين مهام الموظف عبر أدواتك بدلاً من إعطاء نصائح مجردة
- تتحدثين بأسلوب مهني ودود، بدون إطناب
- التاريخ اليوم: ${today} | دور المستخدم: ${role} | الموظف: ${name}

🛠️ **قواعد استخدام الأدوات (حاسمة):**
1. **اقرأي قبل ما تكتبي**: أي تعديل (منتج/طلب/عميل) لازم يسبقه بحث للحصول على المعرّف الصحيح
2. **استخدمي عدة أدوات بالتوازي** إذا كانت مستقلة (مثلاً: get_dashboard_stats + get_low_stock_products معاً)
3. **لا تخمّني** المعرّفات أو الأسعار أو الأسماء — استدعي الأداة المناسبة
4. **لا تطلبي إذناً غير ضروري** للإجراءات البسيطة (تحديث مخزون، تغيير حالة طلب) — نفّذي مباشرة
5. **اطلبي تأكيداً صريحاً** فقط للإجراءات الحساسة: إلغاء طلب، حذف، إرسال بريد جماعي، تخفيض سعر >٢٠٪
6. **بعد كل إجراء**: أعطي ملخصاً موجزاً (سطر أو سطرين) بما تم — بدون تكرار التفاصيل التقنية

🧠 **أنماط التفكير الذكية:**

▸ **"كيف المتجر اليوم؟"** → get_dashboard_stats(periodDays:1) ثم لخّصي: عدد طلبات + إيرادات + أكثر حالة شائعة
▸ **"أنشئ منتج..."** → list_categories أولاً (لتأكيد التصنيف الصحيح) → create_product
▸ **"أرسل تنبيه للعميل أحمد..."** → search_customers("أحمد") → عرض النتائج للموظف لاختيار العميل المقصود → send_push_notification
▸ **"الطلب #ABC وش وضعه؟"** → search_orders ثم get_order_details(الـid الكامل) → اعرضي الملخص
▸ **"المنتجات اللي خلصت"** → get_low_stock_products(threshold:0) → عرض القائمة + اقتراح أن تعيد التخزين
▸ **"أفضل منتجاتنا"** → get_top_selling_products(limit:5)
▸ **"غيّر سعر عطر كذا إلى ٢٥٠"** → search_products("كذا") → update_product(productId, price:250)
▸ **"كل طلبات أحمد"** → search_customers("أحمد") → get_customer_orders(userId)

⚠️ **أخطاء شائعة لتفاديها:**
- لا تستخدمي رقم الطلب القصير (٦ خانات) كـ orderId — استدعي search_orders أولاً للحصول على الـ_id الكامل
- لا تنسي أن السعر سلسلة نصية في النموذج (نحفظها كسلسلة لكن أنتِ مرّريها كرقم)
- إذا فشلت أداة، حلّلي الخطأ وحاولي بأسلوب مختلف بدلاً من الاستسلام
- لا تخترعي معرّفات منتجات أو طلبات — دائماً ابحثي

✨ **شخصيتك:** ذكية، مبادِرة، تقترحين تحسينات صغيرة ("ألاحظ أن مخزون عود ملكي منخفض، تبي أنبّه المدير؟")، لكن لا تنفّذي ما لم يطلبه الموظف صراحة.

عند الانتهاء من المهمة: ردّ مختصر ومفيد بالعربية يلخّص ما فعلتِه — بدون تعداد مفرط للجداول.`;

const SYSTEM_PROMPT_EN = (today: string, role: string, name: string) => `You are "Lamsa" 🌸 — the smart, capable AI assistant for RF Perfume staff.

🎯 **Identity & mission:**
- You're "Lamsa", an expert luxury-perfume store operator — practical, fast, and smart
- You EXECUTE tasks via your tools instead of giving abstract advice
- Professional, friendly tone without verbosity
- Today: ${today} | User role: ${role} | Staff: ${name}

🛠️ **Tool-use rules (critical):**
1. **Read before you write**: any edit (product/order/customer) MUST be preceded by a search to get the correct id
2. **Call multiple tools in parallel** if they're independent (e.g. get_dashboard_stats + get_low_stock_products together)
3. **Never guess** ids, prices, or names — call the right tool
4. **Don't ask unnecessary permission** for simple actions (stock updates, order status changes) — just do them
5. **Ask for explicit confirmation** ONLY for sensitive actions: cancellations, deletes, mass emails, price drops >20%
6. **After each action**: give a concise summary (1–2 lines) of what was done — don't repeat raw technical details

🧠 **Smart workflow patterns:**

▸ **"How is the store today?"** → get_dashboard_stats(periodDays:1), then summarise: orders + revenue + most common status
▸ **"Create a product..."** → list_categories first (to pick the right category) → create_product
▸ **"Notify customer Ahmed..."** → search_customers("Ahmed") → show results to staff to pick → send_push_notification
▸ **"What's order #ABC?"** → search_orders, then get_order_details(full _id) → present a summary
▸ **"Out-of-stock items"** → get_low_stock_products(threshold:0) → list + suggest restocking
▸ **"Top products"** → get_top_selling_products(limit:5)
▸ **"Change the price of perfume X to 250"** → search_products("X") → update_product(productId, price:250)
▸ **"All of Ahmed's orders"** → search_customers("Ahmed") → get_customer_orders(userId)

⚠️ **Common pitfalls to avoid:**
- Don't use the short 6-char order ref as orderId — call search_orders first to get the full _id
- If a tool fails, analyze the error and try a different approach — don't give up
- Never invent product or order ids — always search

✨ **Personality:** smart, proactive, suggesting small improvements ("I notice 'Royal Oud' stock is low, want me to alert the manager?"), but don't take unrequested actions.

When done: a concise English reply summarising what you did — no excessive table dumps.`;

// ─── Assistant Loop ─────────────────────────────────────────────────────────

async function callGroq(allMessages: any[]): Promise<{ ok: boolean; status?: number; data?: any; errText?: string }> {
  // Try every available key (skipping known-bad ones); rotate on 401/403/429/5xx.
  // The previous version broke on the FIRST 401, which made the whole assistant
  // appear dead if any key was revoked or had a typo.
  const triedKeys = new Set<number>();
  let lastStatus = 0;
  let lastText = "";
  const total = Math.max(GROQ_KEYS.length, 1);
  // Try fallback model when all keys hit rate-limit on the primary
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  for (const model of models) {
    triedKeys.clear();
    for (let attempt = 0; attempt < total; attempt++) {
      const idx = (keyIndex + attempt) % total;
      if (triedKeys.has(idx)) continue;
      if (badKeys.has(idx)) continue;
      triedKeys.add(idx);
      const key = GROQ_KEYS[idx];
      if (!key) continue;
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: allMessages,
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 1800,
          }),
        });
        if (res.ok) {
          keyIndex = (idx + 1) % total;
          const data = await res.json();
          return { ok: true, data };
        }
        lastStatus = res.status;
        lastText = (await res.text()).slice(0, 300);
        console.error(`[Assistant Groq] key#${idx} model=${model} HTTP ${res.status}: ${lastText}`);
        // 401/403 → permanently bad key, mark and try next
        if (res.status === 401 || res.status === 403) {
          badKeys.add(idx);
          continue;
        }
        // 429 or 5xx → try next key
        if (res.status === 429 || res.status >= 500) continue;
        // Real client error (400/404/422) → break out, retrying won't help
        return { ok: false, status: res.status, errText: lastText };
      } catch (e: any) {
        lastText = e?.message || String(e);
        console.error(`[Assistant Groq] key#${idx} network: ${lastText}`);
      }
    }
    // All keys failed for this model — try the smaller model with all keys
  }
  return { ok: false, status: lastStatus, errText: lastText };
}

const GRACEFUL_FALLBACK = (lang: "ar" | "en", reason: string) => lang === "ar"
  ? `عذراً، ما قدرت أكمل هذا الطلب الآن (${reason}). تقدر تجرب من جديد بعد لحظات، أو تصيغ الطلب بطريقة مختلفة. لو احتجت مساعدة محددة، اكتبها لي وراح أحاول من زاوية ثانية.`
  : `Sorry, I couldn't complete this request right now (${reason}). Please try again in a moment, or rephrase your question. If you tell me what you need specifically, I'll try a different approach.`;

async function groqWithTools(messages: any[], lang: "ar" | "en" = "ar", maxIterations = 8): Promise<any> {
  const allMessages = [...messages];
  const actions: Array<{ tool: string; args: any; result: any }> = [];

  for (let i = 0; i < maxIterations; i++) {
    const result = await callGroq(allMessages);

    if (!result.ok) {
      const reason = lang === "ar"
        ? (result.status === 429 ? "خدمة الذكاء مزدحمة حالياً" : `خطأ تقني ${result.status || ""}`.trim())
        : (result.status === 429 ? "AI service is currently busy" : `technical error ${result.status || ""}`.trim());
      return { reply: GRACEFUL_FALLBACK(lang, reason), actions };
    }

    const message = result.data?.choices?.[0]?.message;
    if (!message) {
      return { reply: GRACEFUL_FALLBACK(lang, lang === "ar" ? "رد فارغ من النموذج" : "empty model response"), actions };
    }

    allMessages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: message.content || GRACEFUL_FALLBACK(lang, lang === "ar" ? "بدون رد" : "no reply"), actions };
    }

    // Execute all tool calls — never let a tool failure crash the loop
    const toolResults = await Promise.all(
      toolCalls.map(async (call: any) => {
        const fnName = call.function.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(call.function.arguments || "{}"); } catch {}
        let toolResult: any;
        try {
          toolResult = await execTool(fnName, parsedArgs, null);
        } catch (e: any) {
          console.error(`[Assistant Tool] ${fnName} threw:`, e?.message);
          toolResult = { error: true, message: e?.message || "tool failed", tool: fnName };
        }
        actions.push({ tool: fnName, args: parsedArgs, result: toolResult });
        return {
          tool_call_id: call.id,
          role: "tool" as const,
          name: fnName,
          content: JSON.stringify(toolResult),
        };
      })
    );

    allMessages.push(...toolResults);
  }

  return {
    reply: lang === "ar"
      ? "نفذت عدة خطوات لكن وصلت للحد الأقصى من التكرارات. النتائج أعلاه — لو تبيني أكمل من نقطة معينة، خبّرني."
      : "I performed several steps but reached the maximum iteration limit. Results are above — let me know if you'd like me to continue from a specific point.",
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
        "admin", "assistant_manager", "tech_support",
        "accountant", "employee", "cashier", "support",
      ];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "ليس لديك صلاحية" });
      }

      const { messages = [] } = req.body;
      const userMessages = Array.isArray(messages) ? messages.slice(-12) : [];

      // Detect language from the most recent user message
      const lastUserMsg = [...userMessages].reverse().find((m: any) => m.role === "user");
      const lang: "ar" | "en" = lastUserMsg?.content ? detectLang(String(lastUserMsg.content)) : "ar";

      if (GROQ_KEYS.length === 0) {
        return res.json({
          reply: lang === "ar"
            ? "خدمة الذكاء الاصطناعي غير مفعّلة على الخادم حالياً. تواصل مع المسؤول التقني لتفعيل مفاتيح Groq API."
            : "The AI service is not enabled on the server right now. Please contact the technical admin to set up the Groq API keys.",
          actions: [],
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = lang === "ar"
        ? SYSTEM_PROMPT_AR(today, user.role, user.name || user.phone)
        : SYSTEM_PROMPT_EN(today, user.role, user.name || user.phone);

      const result = await groqWithTools(
        [{ role: "system", content: systemPrompt }, ...userMessages],
        lang,
      );

      res.json(result);
    } catch (err: any) {
      console.error("[Assistant] unexpected:", err);
      // Never expose 500 to UI — always return a graceful bilingual reply
      const fallbackLang: "ar" | "en" = (() => {
        try {
          const m = (req.body?.messages || []).slice().reverse().find((x: any) => x.role === "user");
          return m?.content ? detectLang(String(m.content)) : "ar";
        } catch { return "ar"; }
      })();
      res.json({
        reply: fallbackLang === "ar"
          ? "صار خطأ غير متوقع أثناء معالجة طلبك. حاول من جديد بعد لحظة، ولو استمرت المشكلة بلّغ المسؤول التقني."
          : "An unexpected error happened while handling your request. Please try again in a moment, and if it persists notify the technical admin.",
        actions: [],
      });
    }
  });
}
