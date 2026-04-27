import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertProductSchema, insertOrderSchema, insertCouponSchema, insertCashShiftSchema, insertCategorySchema, insertBundleOfferSchema, insertBranchSchema } from "@shared/schema";
import { seed } from "./seed";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { UserModel, NotificationModel, PushSubscriptionModel, ActivityLogModel, StoreSettingsModel, MailAccountModel, MailMessageModel } from "./models";
import { encryptSecret, PROVIDER_PRESETS, testConnection as testInboxConnection, syncAccount as syncInboxAccount, setMessageFlags as setInboxFlags, deleteMessage as deleteInboxMessage, sendFromAccount as sendInboxMessage } from "./inbox";
import { paymentGateway } from "./payments";
import { fireNotify, fireNotifyAdmins, VAPID_PUBLIC_KEY } from "./notifications";
import {
  initiateCardPayment, verify3DS, initiateSTPay, verifySTCPay,
  processApplePay, createTamaraCheckout, confirmTamaraCheckout,
  createTabbyCheckout, confirmTabbyCheckout, getTransaction, TEST_CARD_GUIDE,
  luhnCheck, detectCardBrand
} from "./payment-simulator";
import {
  sendOrderConfirmationEmail, sendOrderStatusEmail,
  sendWelcomeEmail, sendPaymentConfirmationEmail
} from "./email";
import {
  initiatePaymobPayment, verifyPaymobHmac, flattenPaymobCallback, isPaymobConfigured
} from "./paymob";
import {
  perfumeAdvisor, supportAssistant, adminAssistant, isGroqConfigured
} from "./groq";

// Configure storage for uploaded files
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, webp, gif) are allowed"));
  }
});

import { registerEmployeeAssistant } from "./employee-assistant";
import { CartSessionModel, CancellationPolicyModel, OrderModel } from "./models";
import { cancelOrder, canCustomerCancel, getPolicy as getCancellationPolicy } from "./cancellation";
import { startAbandonedCartWorker, notifyCart, markCartConverted } from "./abandoned-carts";
import { startPickupExpiryWorker } from "./pickup-expiry";
import { buildZatcaQrDataUrl } from "./zatca";
import rateLimit from "express-rate-limit";
import { enqueueJob, getQueueStats, resetQueueStats } from "./job-queue";
import {
  cacheMiddleware, invalidateTags, getStats as getCacheStats, resetStats as resetCacheStats,
  setCacheEnabled, isCacheEnabled, setDefaultTtlMs, getDefaultTtlMs, cacheClear,
} from "./cache";

// ─── Tiered rate limiters (in addition to global 500/15min) ─────────────────
const cartLimiter = rateLimit({
  windowMs: 60_000, max: 60, // 60 cart syncs / minute / IP
  message: { message: "تحديثات السلة كثيرة جداً، أبطئ قليلاً" },
  standardHeaders: true, legacyHeaders: false,
});
const orderCreateLimiter = rateLimit({
  windowMs: 60_000, max: 10, // 10 order attempts / minute / IP
  message: { message: "محاولات طلب كثيرة، انتظر دقيقة" },
  standardHeaders: true, legacyHeaders: false,
});
const aiLimiter = rateLimit({
  windowMs: 60_000, max: 20, // AI is expensive — 20/min/IP
  message: { message: "طلبات الذكاء الاصطناعي تجاوزت الحد، انتظر قليلاً" },
  standardHeaders: true, legacyHeaders: false,
});
const couponLimiter = rateLimit({
  windowMs: 60_000, max: 30,
  message: { message: "محاولات تحقق من الكوبون كثيرة" },
  standardHeaders: true, legacyHeaders: false,
});

// ─── Bundle pricing helper ───
// Greedy: applies the largest tier first, repeatedly, picking the cheapest items
// to be the "bundled" ones so the customer benefits from discounting expensive items.
// Returns { originalTotal, bundleTotal, savings, applications: [{offerId, tier, productIds[]}] }
export function computeBundleSavings(
  items: Array<{ productId: string; quantity: number; price: number; categoryId?: string }>,
  offers: any[]
) {
  // Expand items into individual units (one per unit) so we can group them
  type Unit = { productId: string; price: number; categoryId?: string; index: number };
  const units: Unit[] = [];
  let counter = 0;
  for (const it of items) {
    for (let i = 0; i < (it.quantity || 0); i++) {
      units.push({ productId: it.productId, price: Number(it.price) || 0, categoryId: it.categoryId, index: counter++ });
    }
  }
  const originalTotal = units.reduce((s, u) => s + u.price, 0);

  const consumed = new Set<number>();
  const applications: Array<{ offerId: string; offerTitle: string; tierQuantity: number; tierPrice: number; productIds: string[]; savings: number }> = [];
  let bundleTotal = 0;

  // Sort offers by priority desc, then by best per-unit value
  const sortedOffers = [...offers].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const offer of sortedOffers) {
    const tiers = [...(offer.tiers || [])].sort((a: any, b: any) => b.quantity - a.quantity); // largest first
    if (!tiers.length) continue;

    // Filter eligible units for this offer
    const eligible = (u: Unit) => {
      if (offer.scope === "categories") return offer.categoryIds?.length ? offer.categoryIds.includes(u.categoryId || "") : true;
      if (offer.scope === "products") return offer.productIds?.length ? offer.productIds.includes(u.productId) : true;
      return true;
    };

    while (true) {
      const pool = units.filter(u => !consumed.has(u.index) && eligible(u));
      const tier = tiers.find((t: any) => pool.length >= t.quantity);
      if (!tier) break;

      // Pick the most expensive units to bundle (so customer saves more on premium items)
      pool.sort((a, b) => b.price - a.price);
      const picked = pool.slice(0, tier.quantity);
      const picksOriginal = picked.reduce((s, u) => s + u.price, 0);
      const savings = Math.max(0, picksOriginal - tier.price);

      // Only apply if there's actual savings
      if (savings <= 0) break;

      picked.forEach(u => consumed.add(u.index));
      bundleTotal += tier.price;
      applications.push({
        offerId: offer.id || offer._id?.toString() || "",
        offerTitle: offer.title || "",
        tierQuantity: tier.quantity,
        tierPrice: tier.price,
        productIds: picked.map(u => u.productId),
        savings,
      });
    }
  }

  // Add remaining un-bundled units at their original price
  for (const u of units) if (!consumed.has(u.index)) bundleTotal += u.price;

  return {
    originalTotal: round2(originalTotal),
    bundleTotal: round2(bundleTotal),
    savings: round2(originalTotal - bundleTotal),
    applications,
  };
}
function round2(n: number) { return Math.round(n * 100) / 100; }

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Public endpoint: check if phone belongs to a staff member (returns minimal info only)
  app.get("/api/auth/check-role/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("966")) cleanPhone = cleanPhone.substring(3);
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);

      if (cleanPhone.length < 8 || cleanPhone.length > 10) {
        return res.json({ isStaff: false, role: "customer" });
      }

      const user = await UserModel.findOne({
        $or: [
          { phone: cleanPhone },
          { username: cleanPhone },
          { phone: "0" + cleanPhone },
          { username: "0" + cleanPhone },
          { phone: "966" + cleanPhone },
          { phone: new RegExp(cleanPhone + "$") }
        ]
      }).select("role isActive").lean();

      if (!user) return res.json({ isStaff: false, role: "customer" });

      const staffRoles = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "support", "cashier"];
      const isStaff = staffRoles.includes(user.role);
      res.json({ isStaff, role: isStaff ? user.role : "customer" });
    } catch (err) {
      res.json({ isStaff: false, role: "customer" });
    }
  });

  // Get user by phone — requires authentication (admin/staff only)
  app.get("/api/admin/users/by-phone/:phone", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const reqUser = req.user as any;
      const isStaffUser = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "support", "cashier"].includes(reqUser?.role);
      if (!isStaffUser) return res.sendStatus(403);

      const { phone } = req.params;
      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("966")) cleanPhone = cleanPhone.substring(3);
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);

      const user = await UserModel.findOne({
        $or: [
          { phone: cleanPhone },
          { username: cleanPhone },
          { phone: "0" + cleanPhone },
          { username: "0" + cleanPhone },
          { phone: "966" + cleanPhone },
          { phone: new RegExp(cleanPhone + "$") }
        ]
      }).lean();

      if (!user) return res.status(404).send("User not found");

      res.json({
        id: (user as any)._id?.toString() || (user as any).id,
        role: user.role,
        isActive: (user as any).isActive,
        name: user.name
      });
    } catch (err) {
      console.error(`[API] Error in by-phone:`, err);
      res.status(500).send("Internal server error");
    }
  });

  // Auth setup
  setupAuth(app);

  // AI Employee Assistant — must be registered AFTER setupAuth so req.isAuthenticated() exists
  registerEmployeeAssistant(app);

  // Serve uploaded files — local disk fast-path, Object Storage fallback.
  // Same `/uploads/<filename>` URLs work in both modes so frontend is unchanged.
  const { serveUpload } = await import("./uploads");
  app.get("/uploads/:key", serveUpload);

  // Apple domain association (Sign in with Apple / Apple Pay verification)
  const path = await import("path");
  const fs = await import("fs");
  app.get("/.well-known/apple-developer-merchantid-domain-association", (_req, res) => {
    const filePath = path.resolve(process.cwd(), "client/public/.well-known/apple-developer-merchantid-domain-association");
    if (fs.existsSync(filePath)) {
      res.type("text/plain").sendFile(filePath);
    } else {
      res.status(404).send("Not found");
    }
  });
  app.get("/.well-known/apple-developer-domain-association.txt", (_req, res) => {
    const filePath = path.resolve(process.cwd(), "client/public/.well-known/apple-developer-merchantid-domain-association");
    if (fs.existsSync(filePath)) {
      res.type("text/plain").sendFile(filePath);
    } else {
      res.status(404).send("Not found");
    }
  });

  // Apple Maps JWT token for MapKit JS
  // Prefers env-secrets (APPLE_MAPS_PRIVATE_KEY/KEY_ID/TEAM_ID) over disk file fallback
  function getMapsSigningConfig(): { privateKey: string; keyId: string; teamId: string } | null {
    const envKey = process.env.APPLE_MAPS_PRIVATE_KEY;
    const envKid = process.env.APPLE_MAPS_KEY_ID;
    const envTeam = process.env.APPLE_MAPS_TEAM_ID;
    if (envKey && envKid && envTeam) {
      // Allow \n escapes in secret values to be turned into real newlines
      const normalizedKey = envKey.includes("BEGIN") ? envKey.replace(/\\n/g, "\n") : envKey;
      return { privateKey: normalizedKey, keyId: envKid, teamId: envTeam };
    }
    const fallbackTeam = "V4K6RM59LS";
    for (const fallbackKid of ["WD3KBJP67H", "XW8G48DGMQ"]) {
      const fallbackPath = path.resolve(process.cwd(), `server/keys/AuthKey_${fallbackKid}.p8`);
      if (fs.existsSync(fallbackPath)) {
        return { privateKey: fs.readFileSync(fallbackPath, "utf8"), keyId: fallbackKid, teamId: fallbackTeam };
      }
    }
    return null;
  }

  app.get("/api/maps/token", (_req, res) => {
    try {
      const cfg = getMapsSigningConfig();
      if (!cfg) return res.status(500).json({ error: "Maps key not configured" });
      const now = Math.floor(Date.now() / 1000);
      const token = jwt.sign(
        { iss: cfg.teamId, iat: now, exp: now + 1800 },
        cfg.privateKey,
        { algorithm: "ES256", header: { alg: "ES256", kid: cfg.keyId, typ: "JWT" } } as any
      );
      res.json({ token });
    } catch (e) {
      console.error("[Maps] token error:", e);
      res.status(500).json({ error: "Failed to generate maps token" });
    }
  });

  // Image Upload Endpoint — persists to Object Storage if configured,
  // else local disk. Both produce the same /uploads/<filename> URL.
  app.post("/api/upload", upload.any(), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const single = (req as any).file as Express.Multer.File | undefined;
    const all = files.length > 0 ? files : (single ? [single] : []);
    if (all.length === 0) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const { persistUpload } = await import("./uploads");
    const results: { url: string; storage: string; bytes?: number }[] = [];
    for (const f of all) {
      try {
        const r = await persistUpload(f.path, f.filename);
        results.push({ url: r.url, storage: r.storage, bytes: r.bytes });
      } catch (e: any) {
        console.error("[upload] persist failed:", e?.message);
        results.push({ url: `/uploads/${f.filename}`, storage: "local" });
      }
    }
    // Backward-compat: also expose .url (first file) for legacy single-file callers
    res.json({ urls: results.map(r => r.url), files: results, url: results[0].url, storage: results[0].storage, bytes: results[0].bytes });
  });

  // Bank Transfer Receipt Upload
  app.post("/api/orders/:id/receipt", upload.single("receipt"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No receipt file uploaded" });
    
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      
      const user = req.user as any;
      if (user.role !== "admin" && order.userId !== user.id) {
        return res.sendStatus(403);
      }
      
      const receiptUrl = `/uploads/${req.file.filename}`;
      const updatedOrder = await storage.updateOrderReceipt(req.params.id, receiptUrl);
      res.json(updatedOrder);
    } catch (err) {
      console.error("[API] Error uploading receipt:", err);
      res.status(500).send("Internal server error");
    }
  });
  
  // Seed data (only if DB is connected)
  try {
    const { getIsConnected } = await import("./db");
    if (getIsConnected()) {
      await seed();
    } else {
      console.log("Skipping seed — MongoDB not connected yet");
    }
  } catch (err) {
    console.error("Seeding failed:", err);
  }

  // Admin Stats Dashboard
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { OrderModel, ProductModel, UserModel: UM } = await import("./models");
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [allOrders, dailyOrders, weeklyOrders, monthlyOrders, totalProducts, totalCustomers] = await Promise.all([
        OrderModel.find({}).lean(),
        OrderModel.find({ createdAt: { $gte: startOfDay } }).lean(),
        OrderModel.find({ createdAt: { $gte: startOfWeek } }).lean(),
        OrderModel.find({ createdAt: { $gte: startOfMonth } }).lean(),
        ProductModel.countDocuments(),
        UM.countDocuments({ role: "customer" }),
      ]);

      // Exclude cancelled & refunded orders from revenue calculations
      const EXCLUDED_STATUSES = new Set(["cancelled", "refunded", "failed"]);
      const isRevenueOrder = (o: any) => !EXCLUDED_STATUSES.has(o.status);
      const revenueOrders = allOrders.filter(isRevenueOrder);
      const dailyRevenueOrders = dailyOrders.filter(isRevenueOrder);
      const weeklyRevenueOrders = weeklyOrders.filter(isRevenueOrder);
      const monthlyRevenueOrders = monthlyOrders.filter(isRevenueOrder);

      const sumField = (orders: any[], field: string) =>
        orders.reduce((acc, o) => acc + Number(o[field] || 0), 0);

      const totalSales = sumField(revenueOrders, "total");
      const netProfit = sumField(revenueOrders, "netProfit");
      const dailySales = sumField(dailyRevenueOrders, "total");
      const weeklySales = sumField(weeklyRevenueOrders, "total");
      const weeklyNetProfit = sumField(weeklyRevenueOrders, "netProfit");
      const monthlySales = sumField(monthlyRevenueOrders, "total");
      const monthlyNetProfit = sumField(monthlyRevenueOrders, "netProfit");
      const totalOrders = allOrders.length;

      // Top selling products
      const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
      for (const order of allOrders) {
        for (const item of (order.items || [])) {
          const key = item.productId || item.title;
          if (!productSales[key]) {
            productSales[key] = { name: item.title || key, count: 0, revenue: 0 };
          }
          productSales[key].count += item.quantity || 1;
          productSales[key].revenue += Number(item.price || 0) * (item.quantity || 1);
        }
      }
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly chart data (last 6 months)
      const chartData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthOrders = allOrders.filter(o => {
          const created = new Date(o.createdAt);
          return created >= d && created < end;
        });
        chartData.push({
          month: d.toLocaleDateString("ar-SA", { month: "short" }),
          sales: sumField(monthOrders, "total"),
          orders: monthOrders.length,
        });
      }

      // Daily revenue last 30 days
      const last30Days = new Date(now);
      last30Days.setDate(last30Days.getDate() - 29);
      const recentOrders30 = allOrders.filter(o => new Date(o.createdAt) >= last30Days);
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
        dailyMap[key] = { revenue: 0, orders: 0 };
      }
      for (const o of recentOrders30) {
        const key = new Date(o.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
        if (dailyMap[key]) {
          dailyMap[key].revenue += Number(o.total || 0);
          dailyMap[key].orders += 1;
        }
      }
      const dailyRevenue30 = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

      // Order status counts
      const orderStatusCounts: Record<string, number> = {};
      for (const o of allOrders) {
        orderStatusCounts[o.status] = (orderStatusCounts[o.status] || 0) + 1;
      }

      // Payment method breakdown
      const paymentBreakdown: Record<string, number> = {};
      for (const o of allOrders) {
        const pm = o.paymentMethod || "unknown";
        paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + Number(o.total || 0);
      }

      // New customers last 30 days
      const newCustomers30 = await UM.countDocuments({ role: "customer", createdAt: { $gte: last30Days } });

      // Orders today & yesterday
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayOrders = allOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= yesterday && d < startOfDay;
      });
      const todaySales = sumField(dailyOrders, "total");
      const yesterdaySales = sumField(yesterdayOrders, "total");
      const revenueGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1) : "0";

      // Recent orders (last 5)
      const recentOrders = allOrders.slice(-5).reverse().map(o => ({
        id: (o as any)._id?.toString(),
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        userId: o.userId,
      }));

      // Return requests count
      const { ReturnRequestModel } = await import("./models");
      const pendingReturns = await ReturnRequestModel.countDocuments({ status: "pending" });

      // Vendor count
      const { VendorModel } = await import("./models");
      const activeVendors = await VendorModel.countDocuments({ status: "active" });
      const pendingVendors = await VendorModel.countDocuments({ status: "pending" });

      res.json({
        totalSales,
        netProfit,
        dailySales,
        monthlySales,
        totalOrders,
        totalProducts,
        totalCustomers,
        topProducts,
        chartData,
        dailyRevenue30,
        orderStatusCounts,
        paymentBreakdown,
        newCustomers30,
        revenueGrowth,
        recentOrders,
        pendingReturns,
        activeVendors,
        pendingVendors,
        allTime: { totalRevenue: totalSales, netProfit },
        today: { totalRevenue: todaySales },
        thisWeek: { totalRevenue: weeklySales, netProfit: weeklyNetProfit, orders: weeklyOrders.length },
        thisMonth: { totalRevenue: monthlySales, netProfit: monthlyNetProfit, orders: monthlyOrders.length },
        dailyOrders: dailyOrders.length,
        weeklySales,
        weeklyNetProfit,
        monthlyNetProfit,
      });
    } catch (err: any) {
      console.error("[API] admin.stats error:", err?.message);
      res.json({
        totalSales: 0, netProfit: 0, dailySales: 0, monthlySales: 0,
        totalOrders: 0, totalProducts: 0, totalCustomers: 0,
        topProducts: [], chartData: [], dailyRevenue30: [],
        orderStatusCounts: {}, paymentBreakdown: {}, newCustomers30: 0,
        revenueGrowth: "0", recentOrders: [], pendingReturns: 0,
        activeVendors: 0, pendingVendors: 0,
        allTime: { totalRevenue: 0 }, today: { totalRevenue: 0 }, thisMonth: { totalRevenue: 0 }, dailyOrders: 0,
      });
    }
  });

  // Middleware for granular permissions
  const checkPermission = (permission: string) => {
    return (req: any, res: any, next: any) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as any;
      if (user.role === "admin" || (user.permissions && user.permissions.includes(permission))) {
        return next();
      }
      res.status(403).json({ message: "ليس لديك صلاحية للقيام بهذا الإجراء" });
    };
  };

  // Branch staff access — requires assignment to a branch and a branch permission (or admin role).
  const branchAccess = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const isAdminRole = ["admin", "assistant_manager", "tech_support"].includes(user.role);
    const perms: string[] = user.permissions || [];
    const hasBranchPerm = perms.includes("branch.orders") || perms.includes("branch.inventory") || perms.includes("branch.scan") || perms.includes("branch.manage");
    if (!isAdminRole && !hasBranchPerm) return res.status(403).json({ message: "ليس لديك صلاحية لوحة الفرع" });
    // Determine effective branchId — admins may target any branch via ?branchId=
    const queryBranch = (req.query.branchId as string) || (req.body && req.body.branchId);
    const effectiveBranchId = isAdminRole ? (queryBranch || user.branchId || null) : user.branchId;
    if (!effectiveBranchId) return res.status(400).json({ message: "لم يتم تحديد الفرع — اطلب من الإدارة إسناد فرع لحسابك" });
    req.branchId = effectiveBranchId;
    req.isBranchAdmin = isAdminRole;
    next();
  };

  // RBAC Page Protection Middleware for common admin sections
  const protectAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "cashier", "support"].includes(user.role)) {
      return next();
    }
    res.status(403).json({ message: "دخول غير مصرح" });
  };

  // Marketing (active banners/popups)
  app.get("/api/marketing/active", async (_req, res) => {
    res.json([]);
  });

  // Products
  app.get(api.products.list.path, cacheMiddleware({ ttlMs: 60_000, tags: ["products"] }), async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      res.json(products);
    } catch (err: any) {
      console.error("[API] products.list error:", err?.message);
      res.json([]);
    }
  });

  app.get(api.products.get.path, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.json(product);
    } catch (err: any) {
      console.error("[API] products.get error:", err?.message);
      res.status(500).json({ message: "خطأ في جلب المنتج" });
    }
  });

  app.post(api.products.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const parsed = insertProductSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(parsed.error);
      const product = await storage.createProduct(parsed.data);
      res.status(201).json(product);
    } catch (err: any) {
      console.error("[API] products.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء المنتج" });
    }
  });

  app.patch("/api/products/:id", checkPermission("products.edit"), async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      invalidateTags("products");
      res.json(product);
    } catch (err: any) {
      console.error("[API] products.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث المنتج" });
    }
  });

  app.delete("/api/products/:id", checkPermission("products.edit"), async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      invalidateTags("products");
      res.sendStatus(200);
    } catch (err: any) {
      console.error("[API] products.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف المنتج" });
    }
  });

  // Categories
  app.get("/api/categories", cacheMiddleware({ ttlMs: 5 * 60_000, tags: ["categories"] }), async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (err: any) {
      console.error("[API] categories.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/categories", checkPermission("products.edit"), async (req, res) => {
    try {
      const parsed = insertCategorySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "بيانات غير صحيحة", details: parsed.error.issues });
      const category = await storage.createCategory(parsed.data);
      invalidateTags("categories");
      res.status(201).json(category);
    } catch (err: any) {
      console.error("[API] categories.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الفئة" });
    }
  });

  app.patch("/api/categories/:id", checkPermission("products.edit"), async (req, res) => {
    try {
      const category = await storage.updateCategory(req.params.id, req.body);
      invalidateTags("categories");
      res.json(category);
    } catch (err: any) {
      console.error("[API] categories.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث الفئة" });
    }
  });

  app.delete("/api/categories/:id", checkPermission("products.edit"), async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      invalidateTags("categories");
      res.sendStatus(200);
    } catch (err: any) {
      console.error("[API] categories.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف الفئة" });
    }
  });

  // Orders
  app.get(api.orders.list.path, checkPermission("orders.view"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      if (user.role === "admin" || (user.permissions && user.permissions.includes("orders.view"))) {
        const orders = await storage.getOrders();
        const enriched = await Promise.all(orders.map(async (order: any) => {
          if (order.customerName) return order;
          try {
            const customer = await storage.getUser(order.userId);
            return {
              ...order,
              customerName: customer?.name || "عميل زائر",
              customerPhone: customer?.phone || order.customerPhone || "",
              customerEmail: customer?.email || "",
            };
          } catch { return order; }
        }));
        res.json(enriched);
      } else {
        const orders = await storage.getOrdersByUser(user.id || user._id);
        res.json(orders);
      }
    } catch (err: any) {
      console.error("[API] orders.list error:", err?.message);
      res.json([]);
    }
  });

  app.get(api.orders.my.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const orders = await storage.getOrdersByUser(user.id || user._id);
      res.json(orders);
    } catch (err: any) {
      console.error("[API] orders.my error:", err?.message);
      res.json([]);
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
      const ownerId = (order.userId || (order as any).user)?.toString();
      const userId = (user.id || user._id)?.toString();
      const isAdmin = user.role === "admin" || user.isAdmin;
      if (!isAdmin && ownerId !== userId) return res.status(403).json({ message: "غير مصرح" });
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/verify-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { password } = req.body;
      if (!password) return res.status(400).send("كلمة المرور مطلوبة");
      const user = req.user as any;
      const dbUser = await storage.getUser(user.id || user._id);
      if (!dbUser || !dbUser.password) return res.status(401).send("فشل في التحقق من الحساب");
      const { scrypt, timingSafeEqual } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const parts = dbUser.password.split(".");
      if (parts.length === 2) {
        const [hashedPassword, salt] = parts;
        const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
        if (timingSafeEqual(Buffer.from(hashedPassword, "hex"), buffer)) return res.json({ success: true });
      } else if (dbUser.password === password) return res.json({ success: true });
      res.status(401).send("كلمة المرور غير صحيحة");
    } catch (err: any) {
      console.error("[API] verify-password error:", err?.message);
      res.status(500).send("خطأ في التحقق");
    }
  });

  app.post(api.orders.create.path, orderCreateLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("[API] orders.create validation error:", JSON.stringify(parsed.error.issues));
        return res.status(400).json({ message: "بيانات الطلب غير مكتملة أو غير صحيحة", details: parsed.error.issues });
      }

      // ── Server-trusted bundle pricing: recompute savings from cart items
      let bundleApplications: any[] = [];
      try {
        const activeBundles = await storage.getBundleOffers(true);
        if (activeBundles.length > 0 && parsed.data.items?.length) {
          // Enrich items with categoryId for scope filtering
          const enriched = await Promise.all(parsed.data.items.map(async (it: any) => {
            const p = await storage.getProduct(it.productId).catch(() => null);
            return { productId: it.productId, quantity: it.quantity, price: it.price, categoryId: (p as any)?.categoryId };
          }));
          const calc = computeBundleSavings(enriched, activeBundles);
          if (calc.savings > 0) {
            bundleApplications = calc.applications;
            // Reduce the order total by the calculated bundle savings
            parsed.data.total = Math.max(0, Number(parsed.data.total) - calc.savings);
            (parsed.data as any).bundleDiscount = calc.savings;
            (parsed.data as any).bundleApplications = calc.applications;
          }
        }
      } catch (e: any) {
        console.error("[API] bundle calc on order failed:", e?.message);
      }

      if (parsed.data.paymentMethod === "wallet" && parsed.data.userId) {
        const user = await storage.getUser(parsed.data.userId);
        if (user) {
          const balance = Number(user.walletBalance || 0);
          const orderTotal = Number(parsed.data.total);
          if (balance < orderTotal) return res.status(400).json({ message: "رصيد المحفظة غير كافٍ" });
          await storage.updateUserWallet(user.id, (balance - orderTotal).toString());
          await storage.createWalletTransaction({
            userId: user.id,
            amount: orderTotal,
            type: "withdrawal",
            description: `دفع طلب POS #${new Date().getTime()}`,
          });
        }
      }
      const user = req.user as any;
      let order;
      try {
        order = await storage.createOrder({
          ...parsed.data,
          type: parsed.data.type || "online",
          branchId: parsed.data.branchId || user.branchId,
          cashierId: parsed.data.cashierId || user.id,
        });
      } catch (e: any) {
        if (e?.code === "OUT_OF_STOCK") {
          // Refund the wallet if we already debited it above
          if (parsed.data.paymentMethod === "wallet" && parsed.data.userId) {
            try {
              const u = await storage.getUser(parsed.data.userId);
              if (u) {
                const restored = (Number(u.walletBalance || 0) + Number(parsed.data.total)).toString();
                await storage.updateUserWallet(u.id, restored);
              }
            } catch {}
          }
          return res.status(409).json({ message: "نفدت كمية أحد المنتجات قبل إتمام الطلب", variantSku: e.variantSku, code: "OUT_OF_STOCK" });
        }
        throw e;
      }

      // ── Track bundle offer usage (one increment per applied tier)
      if (bundleApplications.length > 0) {
        for (const a of bundleApplications) {
          if (a.offerId) storage.incrementBundleOfferUsage(a.offerId, 1).catch(() => {});
        }
      }

      // ── Defer slow side-effects to the background queue so the response
      //    returns immediately. Critical for handling 100k orders/hour.
      const orderRef = order.id.slice(-8).toUpperCase();

      enqueueJob("notify-admins-new-order", async () => {
        await fireNotifyAdmins(
          "🛒 طلب جديد",
          `طلب جديد بقيمة ${order.total} ر.س — ${order.paymentMethod}`,
          { type: "info", link: "/admin", icon: "🛒", webPush: true }
        );
      });

      enqueueJob("notify-customer-order-received", async () => {
        await fireNotify(
          order.userId,
          "✅ تم استلام طلبك",
          `طلبك رقم #${order.id.slice(-6).toUpperCase()} بقيمة ${order.total} ر.س في انتظار المراجعة.`,
          { type: "success", link: "/orders", icon: "✅", webPush: true }
        );
      });

      enqueueJob("email-order-confirmation", async () => {
        const customer = await storage.getUser(order.userId);
        if (!customer?.email) return;
        await sendOrderConfirmationEmail({
          to: customer.email,
          customerName: customer.name || "عزيزي العميل",
          orderId: order.id,
          orderRef,
          items: (order.items || []).map((item: any) => ({
            title: item.title || "",
            quantity: item.quantity || 1,
            price: item.price || 0,
            color: item.color,
            size: item.size,
          })),
          subtotal: Number(order.subtotal) || 0,
          vatAmount: Number(order.vatAmount) || 0,
          shippingCost: Number(order.shippingCost) || 0,
          discountAmount: Number(order.discountAmount) || 0,
          total: Number(order.total) || 0,
          paymentMethod: order.paymentMethod || "unknown",
          deliveryAddress: order.deliveryAddress || "",
          shippingCompany: order.shippingCompany,
        });
      }, { critical: true, maxAttempts: 5 });

      enqueueJob("auto-generate-invoice", async () => {
        await storage.createInvoice({
          userId: order.userId,
          orderId: order.id,
          invoiceNumber: `INV-${Date.now()}-${order.id.slice(-4).toUpperCase()}`,
          issueDate: new Date(),
          status: order.paymentStatus === "paid" ? "paid" : "issued",
          items: order.items.map((item: any) => ({
            description: item.title,
            quantity: item.quantity,
            unitPrice: item.price,
            taxRate: 15,
            taxAmount: Number((item.price * item.quantity * 0.15).toFixed(2)),
            total: Number((item.price * item.quantity * 1.15).toFixed(2)),
          })),
          subtotal: Number(order.subtotal),
          taxTotal: Number(order.vatAmount),
          total: Number(order.total),
          notes: `فاتورة مرتبطة بالطلب #${order.id.slice(-6).toUpperCase()}`
        });
      }, { critical: true });

      enqueueJob("mark-cart-converted", async () => {
        await markCartConverted(order.userId, order.id);
      });

      // Invalidate product cache so updated stock is visible immediately
      try { invalidateTags(["products"]); } catch {}

      res.status(201).json(order);
    } catch (err: any) {
      console.error("[API] orders.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الطلب" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.sendStatus(403);
      const { status, shippingProvider, trackingNumber, deliveryDriverName, deliveryDriverPhone, note } = req.body;

      const order = await storage.updateOrderStatus(req.params.id, status, {
        provider: shippingProvider,
        tracking: trackingNumber,
        deliveryDriver: status === "out_for_delivery" && deliveryDriverName ? { name: deliveryDriverName, phone: deliveryDriverPhone, assignedAt: new Date() } : undefined,
        historyNote: note,
      });

      // Notify customer of status change
      const statusLabels: Record<string, { title: string; body: string; icon: string; type: "info" | "success" | "warning" | "error" }> = {
        processing: { title: "⚙️ جاري تجهيز طلبك", body: `طلبك #${order.id.slice(-6).toUpperCase()} قيد التجهيز الآن.`, icon: "⚙️", type: "info" },
        ready_for_pickup: {
          title: "📦 طلبك جاهز للاستلام",
          body: `طلبك #${order.id.slice(-6).toUpperCase()} جاهز في الفرع. أحضر رمز الاستلام عند الحضور.`,
          icon: "📦", type: "success"
        },
        out_for_delivery: {
          title: "🛵 السائق في طريقه إليك!",
          body: `طلبك #${order.id.slice(-6).toUpperCase()} خرج للتوصيل${deliveryDriverName ? ` مع ${deliveryDriverName}` : ""}. كن جاهزاً!`,
          icon: "🛵", type: "success"
        },
        shipped: { title: "🚚 طلبك في الطريق", body: `تم شحن طلبك #${order.id.slice(-6).toUpperCase()}${trackingNumber ? ` — رقم التتبع: ${trackingNumber}` : ""}`, icon: "🚚", type: "success" },
        completed: { title: "✅ تم تسليم طلبك", body: `تم تسليم طلبك #${order.id.slice(-6).toUpperCase()} بنجاح. شكراً لثقتك!`, icon: "✅", type: "success" },
        cancelled: { title: "❌ تم إلغاء طلبك", body: `تم إلغاء طلبك #${order.id.slice(-6).toUpperCase()}.`, icon: "❌", type: "error" },
      };
      const label = statusLabels[status];
      if (label) {
        try {
          await fireNotify(order.userId, label.title, label.body, {
            type: label.type, link: "/orders", icon: label.icon, webPush: true,
          });
        } catch {}

        // Send status update email
        try {
          const customer = await storage.getUser(order.userId);
          if (customer?.email && ["processing", "ready_for_pickup", "shipped", "completed", "cancelled", "out_for_delivery"].includes(status)) {
            await sendOrderStatusEmail({
              to: customer.email,
              customerName: customer.name || "عزيزي العميل",
              orderRef: order.id.slice(-8).toUpperCase(),
              status: status as any,
              trackingNumber,
              shippingProvider,
            });
          }
        } catch (emailErr: any) {
          console.error("[EMAIL] Status update error:", emailErr?.message);
        }
      }

      res.json(order);
    } catch (err: any) {
      console.error("[API] orders.status error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث حالة الطلب" });
    }
  });

  // ─── Admin Broadcast Notification to Customers ───────────────────────────
  app.post("/api/admin/broadcast", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const admin = req.user as any;
      if (admin.role !== "admin") return res.sendStatus(403);
      const { title, body, type = "info", link = "/", targetUserId } = req.body;
      if (!title || !body) return res.status(400).json({ message: "title و body مطلوبان" });

      if (targetUserId) {
        await fireNotify(targetUserId, title, body, { type, link, webPush: true });
        return res.json({ sent: 1 });
      }

      // Broadcast to ALL users
      const { UserModel } = await import("./models");
      const users = await UserModel.find({ role: { $ne: "admin" } }).select("_id").lean();
      let sent = 0;
      await Promise.allSettled(
        users.map(async (u: any) => {
          try {
            await fireNotify(String(u._id), title, body, { type, link, webPush: true });
            sent++;
          } catch {}
        })
      );
      res.json({ sent });
    } catch (err: any) {
      console.error("[API] broadcast error:", err?.message);
      res.status(500).json({ message: "خطأ في إرسال الإشعار" });
    }
  });

  // ─── Confirm / Reject bank-transfer payment ───────────────────────────────
  app.patch("/api/orders/:id/confirm-payment", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.sendStatus(403);
      const { action } = req.body; // "confirm" | "reject"
      if (!["confirm", "reject"].includes(action))
        return res.status(400).json({ message: "action must be confirm or reject" });

      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      let updatedOrder: any;
      if (action === "confirm") {
        updatedOrder = await storage.updateOrderPaymentStatus(req.params.id, "paid");
        // updateOrderPaymentStatus already sets status = "processing" when paid
        try {
          await fireNotify(
            order.userId,
            "✅ تم تأكيد دفعتك",
            `تم التحقق من إيصال التحويل البنكي لطلبك #${order.id.slice(-6).toUpperCase()} وجاري التجهيز الآن.`,
            { type: "success", link: "/orders", icon: "✅", webPush: true }
          );
          const customer = await storage.getUser(order.userId);
          if (customer?.email) {
            await sendOrderStatusEmail({
              to: customer.email,
              customerName: customer.name || "عزيزي العميل",
              orderRef: order.id.slice(-8).toUpperCase(),
              status: "processing",
            });
          }
        } catch {}
      } else {
        // reject → cancel order and mark payment failed
        await storage.updateOrderPaymentStatus(req.params.id, "failed");
        updatedOrder = await storage.updateOrderStatus(req.params.id, "cancelled");
        try {
          await fireNotify(
            order.userId,
            "❌ تعذّر تأكيد الدفع",
            `لم يتم التحقق من إيصال التحويل البنكي لطلبك #${order.id.slice(-6).toUpperCase()}. يرجى التواصل معنا.`,
            { type: "error", link: "/orders", icon: "❌", webPush: true }
          );
          const customer = await storage.getUser(order.userId);
          if (customer?.email) {
            await sendOrderStatusEmail({
              to: customer.email,
              customerName: customer.name || "عزيزي العميل",
              orderRef: order.id.slice(-8).toUpperCase(),
              status: "cancelled",
            });
          }
        } catch {}
      }

      res.json(updatedOrder);
    } catch (err: any) {
      console.error("[API] confirm-payment error:", err?.message);
      res.status(500).json({ message: "خطأ في تأكيد الدفع" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Forgot Password Flow — Phone-first, smart routing
  // ────────────────────────────────────────────────────────────────────────
  // Step 1 (init):    POST /api/auth/forgot/init       { phone }
  //   → Employees / users WITH email   →  emails 6-digit OTP, returns { method: "otp", masked }
  //   → Customers WITHOUT email        →  returns { method: "verify",
  //                                       prompt: "name OR previous order number" }
  //
  // Step 2 (verify):  POST /api/auth/forgot/verify     { phone, code? , name? , orderNumber? }
  //   → Validates whichever path applies → returns { resetToken } (single use, 15 min)
  //
  // Step 3 (reset):   POST /api/auth/forgot/reset      { resetToken, password }
  //   → Sets new password, clears all reset state
  // ════════════════════════════════════════════════════════════════════════

  function maskEmail(e: string) {
    const [u, d] = String(e || "").split("@");
    if (!u || !d) return e;
    return `${u.slice(0, 2)}***@${d}`;
  }
  function normalizePhone(raw: string) {
    let p = (raw || "").replace(/\D/g, "");
    if (p.startsWith("966")) p = p.substring(3);
    if (p.startsWith("0")) p = p.substring(1);
    return p;
  }
  async function findUserByPhone(raw: string) {
    const core = normalizePhone(raw);
    if (!core) return null;
    return await UserModel.findOne({
      $or: [
        { phone: core }, { phone: "0" + core },
        { username: core }, { username: "0" + core },
      ],
    });
  }
  const STAFF_ROLES = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "support", "cashier"];

  // ── Step 1: init ─────────────────────────────────────────────────────────
  app.post("/api/auth/forgot/init", async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone) return res.status(400).json({ message: "رقم الجوال مطلوب" });
      const user: any = await findUserByPhone(phone);
      if (!user) {
        // Generic message — do not leak whether the phone is registered
        return res.json({ method: "verify", prompt: "name_or_order" });
      }

      const isStaff = STAFF_ROLES.includes(user.role);
      const hasEmail = !!(user.email && /^\S+@\S+\.\S+$/.test(user.email) && !user.email.endsWith("@rfperfume.sa"));

      // Employees ALWAYS go through email — required for them
      if (isStaff) {
        if (!hasEmail) {
          return res.status(400).json({ message: "حسابك موظف ولا يحتوي بريداً صالحاً — راجع المدير" });
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        user.passwordResetCode = code;
        user.passwordResetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.passwordResetAttempts = 0;
        await user.save();
        try {
          const { sendPasswordResetEmail } = await import("./email");
          await sendPasswordResetEmail({ to: user.email, customerName: user.name, otp: code });
        } catch (e: any) { console.error("[Forgot] email failed:", e?.message); }
        return res.json({ method: "otp", masked: maskEmail(user.email) });
      }

      // Customer with email → OTP path
      if (hasEmail) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        user.passwordResetCode = code;
        user.passwordResetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.passwordResetAttempts = 0;
        await user.save();
        try {
          const { sendPasswordResetEmail } = await import("./email");
          await sendPasswordResetEmail({ to: user.email, customerName: user.name, otp: code });
        } catch (e: any) { console.error("[Forgot] email failed:", e?.message); }
        return res.json({ method: "otp", masked: maskEmail(user.email), allowVerify: true });
      }

      // Customer without email → verify identity via name OR previous order number
      return res.json({ method: "verify", prompt: "name_or_order" });
    } catch (err: any) {
      console.error("[Forgot/init] error:", err?.message);
      res.status(500).json({ message: "خطأ في معالجة الطلب" });
    }
  });

  // ── Step 2: verify (OTP or identity) ─────────────────────────────────────
  app.post("/api/auth/forgot/verify", async (req, res) => {
    try {
      const { phone, code, name, orderNumber } = req.body || {};
      if (!phone) return res.status(400).json({ message: "رقم الجوال مطلوب" });
      const user: any = await findUserByPhone(phone);
      if (!user) return res.status(400).json({ message: "البيانات غير متطابقة" });

      // Throttle brute force (max 5 wrong attempts, then must restart from init)
      if ((user.passwordResetAttempts || 0) >= 5) {
        return res.status(429).json({ message: "محاولات كثيرة خاطئة — ابدأ من جديد" });
      }

      let verified = false;

      // Path A: OTP from email
      if (code) {
        const valid = user.passwordResetCode &&
                      String(user.passwordResetCode) === String(code) &&
                      user.passwordResetCodeExpires &&
                      new Date(user.passwordResetCodeExpires).getTime() > Date.now();
        if (valid) verified = true;
      }

      // Path B: identity (name or previous-order match) — customers only
      if (!verified && (name || orderNumber)) {
        if (STAFF_ROLES.includes(user.role)) {
          return res.status(403).json({ message: "الموظفون يستخدمون البريد فقط" });
        }
        let nameOk = false, orderOk = false;
        if (name) {
          const n = String(name).trim().toLowerCase();
          const userName = String(user.name || "").trim().toLowerCase();
          // Accept full match OR ≥2 word overlap
          if (n && userName && (userName === n || n.split(/\s+/).filter(p => userName.includes(p)).length >= 2)) {
            nameOk = true;
          }
        }
        if (orderNumber) {
          const orderId = String(orderNumber).trim();
          const order: any = await OrderModel.findOne({
            userId: String(user._id),
            $or: [
              { _id: orderId.length === 24 ? orderId : null },
              { orderNumber: orderId },
            ].filter(Boolean) as any,
          }).lean();
          if (order) orderOk = true;
        }
        if (nameOk || orderOk) verified = true;
      }

      if (!verified) {
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ message: "البيانات غير صحيحة" });
      }

      // Issue single-use reset token (15 min)
      const { randomBytes } = await import("crypto");
      const resetToken = randomBytes(32).toString("hex");
      user.passwordResetToken = resetToken;
      user.passwordResetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
      user.passwordResetCode = undefined;
      user.passwordResetCodeExpires = undefined;
      user.passwordResetAttempts = 0;
      await user.save();
      res.json({ resetToken });
    } catch (err: any) {
      console.error("[Forgot/verify] error:", err?.message);
      res.status(500).json({ message: "خطأ في التحقق" });
    }
  });

  // ── Step 3: reset ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot/reset", async (req, res) => {
    try {
      const { resetToken, password } = req.body || {};
      if (!resetToken || !password || String(password).length < 6) {
        return res.status(400).json({ message: "بيانات غير صالحة (كلمة مرور 6 أحرف على الأقل)" });
      }
      const user: any = await UserModel.findOne({
        passwordResetToken: resetToken,
        passwordResetTokenExpires: { $gt: new Date() },
      });
      if (!user) return res.status(400).json({ message: "رمز إعادة التعيين غير صالح أو منتهي" });

      const { scrypt, randomBytes } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
      user.password = `${buffer.toString("hex")}.${salt}`;
      user.mustChangePassword = false;
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      await user.save();
      res.json({ ok: true, message: "تم تحديث كلمة المرور — يمكنك تسجيل الدخول" });
    } catch (err: any) {
      console.error("[Forgot/reset] error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث كلمة المرور" });
    }
  });

  // ── Legacy (kept for backward compatibility) ─────────────────────────────
  app.post("/api/verify-reset", async (req, res) => {
    const { phone, name } = req.body || {};
    if (!phone || !name) return res.status(400).json({ message: "جميع الحقول مطلوبة" });
    const user: any = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ message: "المعلومات غير متطابقة" });
    const userName = String(user.name || "").trim().toLowerCase();
    const inName = String(name).trim().toLowerCase();
    if (userName !== inName) return res.status(404).json({ message: "المعلومات غير متطابقة" });
    res.json({ id: user._id.toString() });
  });
  app.post("/api/reset-password", async (req, res) => {
    const { id, password } = req.body || {};
    if (!id || !password) return res.status(400).json({ message: "بيانات غير مكتملة" });
    try {
      const { scrypt, randomBytes } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buffer.toString("hex")}.${salt}`;
      const result = await UserModel.findByIdAndUpdate(id, { password: hashedPassword, mustChangePassword: false }, { new: true });
      if (!result) return res.status(404).send("المستخدم غير موجود");
      res.json({ message: "تم تحديث كلمة المرور بنجاح" });
    } catch (err: any) {
      res.status(500).send("فشل تحديث كلمة المرور");
    }
  });

  // ─── Admin Email Testing ────────────────────────────────────────────────
  app.get("/api/admin/email/status", checkPermission("settings.manage"), (_req, res) => {
    res.json({
      configured: !!process.env.SMTP2GO_API_KEY,
      sender: "support@rfperfume.sa",
      senderName: "عطور آر اف",
      provider: "SMTP2GO",
    });
  });

  app.post("/api/admin/email/test", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { to, template, name, orderRef, amount } = req.body as any;
      if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
      }
      if (!process.env.SMTP2GO_API_KEY) {
        return res.status(503).json({ success: false, message: "SMTP2GO_API_KEY غير مُعدّ في متغيّرات البيئة" });
      }

      const customerName = name || "عميل تجريبي";
      const ref = orderRef || `TEST-${Date.now().toString().slice(-6)}`;

      let result;
      switch (template) {
        case "welcome":
          result = await sendWelcomeEmail({ to, customerName });
          break;
        case "order_confirmation":
          result = await sendOrderConfirmationEmail({
            to, customerName, orderId: ref, orderRef: ref,
            items: [{ title: "عطر العود الملكي", quantity: 1, price: 450, size: "50ml" }],
            subtotal: 450, vatAmount: 67.5, shippingCost: 25, total: amount || 542.5,
            paymentMethod: "tap", deliveryAddress: "الرياض، المملكة العربية السعودية",
          });
          break;
        case "order_shipped":
          result = await sendOrderStatusEmail({
            to, customerName, orderRef: ref, status: "shipped",
            trackingNumber: "RF123456789SA", shippingProvider: "أرامكس",
          });
          break;
        case "payment":
          result = await sendPaymentConfirmationEmail({
            to, customerName, orderRef: ref,
            amount: amount || 542.5, paymentMethod: "card",
            transactionId: "txn_" + Date.now(), authCode: "AUTH123",
          });
          break;
        default:
          return res.status(400).json({ success: false, message: "نوع البريد غير معروف" });
      }

      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || "فشل الإرسال" });
      }
      res.json({ success: true, message: `تم إرسال البريد إلى ${to}`, template });
    } catch (err: any) {
      console.error("[API] email test error:", err?.message);
      res.status(500).json({ success: false, message: err?.message || "خطأ في الخادم" });
    }
  });

  // Audit Logs
  app.get("/api/admin/audit-logs", checkPermission("staff.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const logs = await storage.getAuditLogs(100);
      res.json(logs);
    } catch (err: any) {
      console.error("[API] audit-logs error:", err?.message);
      res.json([]);
    }
  });

  // Branches — public list. Includes a lightweight inventory snapshot
  // (sku → stock) so checkout can warn shoppers about out-of-stock items
  // at the chosen pickup branch without exposing prices/costs.
  app.get("/api/branches", async (_req, res) => {
    try {
      const branches = await storage.getBranches();
      const products = await storage.getProducts();
      const stockBySku: Array<{ sku: string; stock: number }> = [];
      for (const p of products as any[]) {
        for (const v of (p.variants || [])) {
          if (v?.sku) stockBySku.push({ sku: v.sku, stock: Number(v.stock) || 0 });
        }
      }
      const enriched = branches.map((b: any) => ({ ...b, inventory: stockBySku }));
      res.json(enriched);
    } catch (err: any) {
      console.error("[API] branches.list error:", err?.message);
      res.json([]);
    }
  });

  // ─── Helper: hash a plain password using the same scrypt scheme as auth.ts ──
  async function hashBranchPassword(plain: string): Promise<string> {
    const { scrypt: _scrypt, randomBytes: _rb } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
    const salt = _rb(16).toString("hex");
    const buf = await scryptAsync(plain, salt, 64);
    return `${buf.toString("hex")}.${salt}`;
  }
  function cleanPhoneSA(p: string): string {
    let phone = (p || "").replace(/\D/g, "");
    if (phone.startsWith("966")) phone = phone.substring(3);
    if (phone.startsWith("0")) phone = phone.substring(1);
    return phone;
  }
  const BRANCH_MANAGER_PERMS = [
    "branch.orders", "branch.inventory", "branch.scan", "branch.manage",
    "orders.view", "products.view", "customers.view",
    "pos.access", "pos.use", "pos.close_shift",
  ];

  app.post("/api/admin/branches", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { managerName, managerPhone, managerPassword, ...rawBranchData } = req.body || {};

      // Validate the branch payload up-front so we can return a clear,
      // user-friendly Arabic error instead of a generic 500.
      const parsed = insertBranchSchema.safeParse(rawBranchData);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const fieldPath = firstIssue?.path?.join(".") || "حقل";
        const message = firstIssue?.message || "بيانات الفرع غير صالحة";
        return res.status(400).json({ message: `${message} (${fieldPath})` });
      }
      const branchData = parsed.data;
      const branch = await storage.createBranch(branchData);

      // Auto-create a branch manager login if credentials provided
      let manager: any = null;
      let managerError: string | null = null;
      if (managerPhone && managerPassword) {
        const phone = cleanPhoneSA(String(managerPhone));
        const pw = String(managerPassword);
        if (phone.length < 8) {
          managerError = "رقم هاتف المسؤول غير صالح";
        } else if (pw.length < 6) {
          managerError = "كلمة المرور قصيرة جداً (6 أحرف على الأقل)";
        } else {
          const existing = await storage.getUserByUsername(phone);
          if (existing && existing.role !== "customer") {
            managerError = "يوجد مستخدم بهذا الرقم بالفعل";
          } else {
            const hashed = await hashBranchPassword(pw);
            const baseUserData: any = {
              name: managerName || `مسؤول ${branch.name}`,
              phone,
              username: phone,
              email: branchData.email || `${phone}@rfperfume.sa`,
              password: hashed,
              role: "employee",
              branchId: branch.id,
              loginType: "dashboard",
              isActive: true,
              mustChangePassword: false,
              walletBalance: "0",
              addresses: [],
              permissions: BRANCH_MANAGER_PERMS,
              loyaltyPoints: 0,
              loyaltyTier: "bronze",
              totalSpent: 0,
              phoneDiscountEligible: false,
            };
            if (existing) {
              manager = await storage.updateUser(existing.id, {
                ...baseUserData,
                walletBalance: existing.walletBalance,
              } as any);
            } else {
              manager = await storage.createUser(baseUserData);
            }
          }
        }
      }

      res.status(201).json({
        ...branch,
        manager: manager ? { id: manager.id, phone: manager.phone, name: manager.name } : null,
        managerError,
      });
    } catch (err: any) {
      console.error("[API] branches.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الفرع" });
    }
  });

  app.patch("/api/admin/branches/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { managerName, managerPhone, managerPassword, ...rawBranchData } = req.body || {};

      // Validate the partial branch payload — same Arabic-friendly errors as POST.
      const parsed = insertBranchSchema.partial().safeParse(rawBranchData);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const fieldPath = firstIssue?.path?.join(".") || "حقل";
        const message = firstIssue?.message || "بيانات الفرع غير صالحة";
        return res.status(400).json({ message: `${message} (${fieldPath})` });
      }
      const branchData = parsed.data;
      const branch = await storage.updateBranch(req.params.id, branchData);

      // Optional: update / create a manager on this branch
      let manager: any = null;
      let managerError: string | null = null;
      if (managerPhone || managerPassword) {
        const pw = managerPassword ? String(managerPassword) : "";
        if (managerPhone) {
          const phone = cleanPhoneSA(String(managerPhone));
          if (phone.length < 8) {
            managerError = "رقم هاتف المسؤول غير صالح";
          } else if (pw && pw.length < 6) {
            managerError = "كلمة المرور قصيرة جداً (6 أحرف على الأقل)";
          } else {
            const existing = await storage.getUserByUsername(phone);
            const update: any = {
              name: managerName || `مسؤول ${branch.name}`,
              phone,
              username: phone,
              role: "employee",
              branchId: branch.id,
              loginType: "dashboard",
              isActive: true,
              mustChangePassword: false,
              permissions: BRANCH_MANAGER_PERMS,
            };
            if (pw) update.password = await hashBranchPassword(pw);

            if (!existing) {
              // No user with this phone → create new manager bound to this branch
              if (!pw) {
                managerError = "كلمة المرور مطلوبة لإنشاء مسؤول جديد";
              } else {
                manager = await storage.createUser({
                  ...update,
                  email: branchData.email || `${phone}@rfperfume.sa`,
                  walletBalance: "0",
                  addresses: [],
                  loyaltyPoints: 0,
                  loyaltyTier: "bronze",
                  totalSpent: 0,
                  phoneDiscountEligible: false,
                });
              }
            } else if (existing.role === "employee" && existing.branchId === branch.id) {
              // Safe: existing user is already a manager of THIS branch — allow rotation of name/password
              manager = await storage.updateUser(existing.id, update);
            } else {
              // Refuse: do not hijack admin / customer / staff bound to a different branch
              managerError = "هذا الرقم مستخدم لحساب آخر — استخدم رقماً مختلفاً للمسؤول";
            }
          }
        }
      }

      res.json({
        ...branch,
        manager: manager ? { id: manager.id, phone: manager.phone, name: manager.name } : null,
        managerError,
      });
    } catch (err: any) {
      console.error("[API] branches.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث الفرع" });
    }
  });

  // List managers for a specific branch (admin)
  app.get("/api/admin/branches/:id/managers", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const all = await storage.getAllUsers();
      const list = (all || []).filter((u: any) => u.branchId === req.params.id && u.role !== "customer");
      res.json(list.map((u: any) => ({
        id: u.id, name: u.name, phone: u.phone, role: u.role, isActive: u.isActive,
      })));
    } catch (err: any) {
      console.error("[API] branches.managers error:", err?.message);
      res.status(500).json({ message: "خطأ في جلب المسؤولين" });
    }
  });

  app.delete("/api/admin/branches/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteBranch(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      console.error("[API] branches.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف الفرع" });
    }
  });

  // Cash Shifts
  app.get("/api/pos/shifts/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const shift = await storage.getActiveShift(user.id || user._id);
      res.json(shift || null);
    } catch (err: any) {
      console.error("[API] shifts.active error:", err?.message);
      res.json(null);
    }
  });

  app.post("/api/pos/shifts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const shift = await storage.createCashShift({
        ...req.body,
        cashierId: user.id || user._id,
        openedAt: new Date(),
        status: "open"
      });
      res.status(201).json(shift);
    } catch (err: any) {
      console.error("[API] shifts.create error:", err?.message);
      res.status(500).json({ message: "خطأ في فتح الوردية" });
    }
  });

  // Staff Management
  app.get("/api/admin/users", checkPermission("staff.manage"), async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (err: any) {
      console.error("[API] admin.users error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/admin/users", checkPermission("staff.manage"), async (req, res) => {
    try {
      const userData = req.body;
      let phone = (userData.phone || "").replace(/\D/g, "");
      if (phone.startsWith("0")) phone = phone.substring(1);
      const email = (userData.email || "").trim();
      const username = userData.username || phone;
      const role = userData.role || "employee";

      // Email is REQUIRED for staff so they can activate their account
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).send("البريد الإلكتروني للموظف مطلوب لإرسال رابط التفعيل");
      }

      const existingUser = await storage.getUserByUsername(phone);
      if (existingUser) {
        if (existingUser.role !== "customer" && existingUser.role !== "admin") {
          return res.status(400).send("مستخدم بهذا الرقم موجود بالفعل كـ " + existingUser.role);
        }
        const updatedUser = await storage.updateUser(existingUser.id, {
          ...userData,
          role,
          isActive: true,
        });
        return res.json(updatedUser);
      }

      // Generate activation token (48h validity) — employee sets their own password
      const { randomBytes } = await import("crypto");
      const activationToken = randomBytes(32).toString("hex");
      const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const user = await storage.createUser({
        ...userData,
        phone,
        email,
        username,
        password: "", // empty — they MUST activate to set one
        walletBalance: "0",
        mustChangePassword: true,
        isActive: false, // inactive until activation
        role,
        addresses: [],
        permissions: userData.permissions || [],
        activationToken,
        activationExpires,
      } as any);

      // Send activation email
      try {
        const { sendActivationEmail } = await import("./email");
        const baseUrl =
          process.env.PUBLIC_BASE_URL ||
          (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "") ||
          `${req.protocol}://${req.get("host")}`;
        const activationLink = `${baseUrl}/activate?token=${activationToken}`;
        await sendActivationEmail({
          to: email,
          name: user.name || username,
          role,
          activationLink,
          expiresInHours: 48,
        });
      } catch (e: any) {
        console.error("[Staff] Activation email failed:", e?.message);
      }

      res.status(201).json({
        ...user,
        activationEmailSent: true,
        message: "تم إنشاء الموظف وأرسل رابط التفعيل إلى بريده",
      });
    } catch (err: any) {
      res.status(400).send(err.message);
    }
  });

  // ── Resend activation email (for an existing inactive employee) ──────────
  app.post("/api/admin/users/:id/resend-activation", checkPermission("staff.manage"), async (req, res) => {
    try {
      const { randomBytes } = await import("crypto");
      const user: any = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      if (!user.email) return res.status(400).json({ message: "لا يوجد بريد إلكتروني" });

      user.activationToken = randomBytes(32).toString("hex");
      user.activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await user.save();

      const { sendActivationEmail } = await import("./email");
      const baseUrl =
        process.env.PUBLIC_BASE_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "") ||
        `${req.protocol}://${req.get("host")}`;
      await sendActivationEmail({
        to: user.email,
        name: user.name,
        role: user.role,
        activationLink: `${baseUrl}/activate?token=${user.activationToken}`,
        expiresInHours: 48,
      });
      res.json({ ok: true, message: "تم إعادة إرسال رابط التفعيل" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Activate account (employee clicks the link, sets their password) ─────
  app.post("/api/auth/activate", async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password || String(password).length < 6) {
        return res.status(400).json({ message: "بيانات غير صالحة (كلمة مرور 6 أحرف على الأقل)" });
      }
      const user: any = await UserModel.findOne({
        activationToken: token,
        activationExpires: { $gt: new Date() },
      });
      if (!user) {
        return res.status(400).json({ message: "رابط التفعيل غير صالح أو منتهي الصلاحية" });
      }
      const { scrypt, randomBytes } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
      user.password = `${buffer.toString("hex")}.${salt}`;
      user.activationToken = undefined;
      user.activationExpires = undefined;
      user.mustChangePassword = false;
      user.isActive = true;
      await user.save();
      res.json({ ok: true, message: "تم تفعيل حسابك. يمكنك تسجيل الدخول الآن", username: user.username });
    } catch (err: any) {
      console.error("[Activate] error:", err?.message);
      res.status(500).json({ message: "خطأ في تفعيل الحساب" });
    }
  });

  // ── Inspect activation token (for the activate page UI) ──────────────────
  app.get("/api/auth/activate/:token", async (req, res) => {
    try {
      const user: any = await UserModel.findOne({
        activationToken: req.params.token,
        activationExpires: { $gt: new Date() },
      }).select("name email username role").lean();
      if (!user) return res.status(404).json({ valid: false, message: "رابط غير صالح أو منتهي" });
      res.json({ valid: true, name: user.name, email: user.email, username: user.username, role: user.role });
    } catch (err: any) {
      res.status(500).json({ valid: false, message: err.message });
    }
  });

  app.patch("/api/admin/users/:id", checkPermission("staff.manage"), async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (err: any) {
      console.error("[API] admin.users.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث المستخدم" });
    }
  });

  app.delete("/api/admin/users/:id", checkPermission("staff.manage"), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.sendStatus(200);
    } catch (err: any) {
      console.error("[API] admin.users.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف المستخدم" });
    }
  });

  // Roles
  app.get("/api/admin/roles", checkPermission("staff.manage"), async (_req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (err: any) {
      console.error("[API] roles.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/admin/roles", checkPermission("staff.manage"), async (req, res) => {
    try {
      const role = await storage.createRole(req.body);
      res.status(201).json(role);
    } catch (err: any) {
      console.error("[API] roles.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الدور" });
    }
  });

  app.delete("/api/admin/roles/:id", checkPermission("staff.manage"), async (req, res) => {
    try {
      await storage.deleteRole(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      console.error("[API] roles.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف الدور" });
    }
  });

  // Banners
  app.get("/api/banners", async (_req, res) => {
    try {
      const banners = await storage.getBanners();
      res.json(banners);
    } catch (err: any) {
      console.error("[API] banners.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/banners", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const banner = await storage.createBanner(req.body);
      invalidateTags("banners");
      res.status(201).json(banner);
    } catch (err: any) {
      console.error("[API] banners.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء البانر" });
    }
  });

  app.patch("/api/banners/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const banner = await storage.updateBanner(req.params.id, req.body);
      invalidateTags("banners");
      res.json(banner);
    } catch (err: any) {
      console.error("[API] banners.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث البانر" });
    }
  });

  app.delete("/api/banners/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteBanner(req.params.id);
      invalidateTags("banners");
      res.sendStatus(204);
    } catch (err: any) {
      console.error("[API] banners.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف البانر" });
    }
  });

  // Coupons
  app.get("/api/coupons", async (_req, res) => {
    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (err: any) {
      console.error("[API] coupons.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/coupons", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const parsed = insertCouponSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "بيانات الكوبون غير صحيحة" });
      const coupon = await storage.createCoupon(parsed.data);
      res.status(201).json(coupon);
    } catch (err: any) {
      console.error("[API] coupons.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الكوبون" });
    }
  });

  app.delete("/api/coupons/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteCoupon(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      console.error("[API] coupons.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف الكوبون" });
    }
  });

  // Cash Shifts (alias routes used by CashDrawer.tsx)
  app.get("/api/cash-shifts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const branchId = req.query.branchId as string | undefined;
      const shifts = await storage.getCashShifts(branchId);
      res.json(shifts);
    } catch (err: any) {
      console.error("[API] cash-shifts.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/cash-shifts/open", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const shift = await storage.createCashShift({
        ...req.body,
        cashierId: user.id || user._id,
        openedAt: new Date(),
        status: "open"
      });
      res.status(201).json(shift);
    } catch (err: any) {
      console.error("[API] cash-shifts.open error:", err?.message);
      res.status(500).json({ message: "خطأ في فتح الوردية" });
    }
  });

  app.patch("/api/cash-shifts/:id/close", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const shift = await storage.updateCashShift(req.params.id, {
        ...req.body,
        closedAt: new Date(),
        status: "closed"
      });
      res.json(shift);
    } catch (err: any) {
      console.error("[API] cash-shifts.close error:", err?.message);
      res.status(500).json({ message: "خطأ في إغلاق الوردية" });
    }
  });

  app.get("/api/cash-shifts/branch/:branchId/report", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const shifts = await storage.getCashShifts(req.params.branchId);
      const completed = shifts.filter((s: any) => s.status === "closed");
      const totalSales = completed.reduce((sum: number, s: any) => sum + (parseFloat(s.totalSales) || 0), 0);
      const totalExpenses = completed.reduce((sum: number, s: any) => sum + (parseFloat(s.totalExpenses) || 0), 0);
      res.json({ shifts: completed, totalSales, totalExpenses, netCash: totalSales - totalExpenses });
    } catch (err: any) {
      console.error("[API] cash-shifts.report error:", err?.message);
      res.status(500).json({ message: "خطأ في تقرير الوردية" });
    }
  });

  // Branch Inventory
  app.get("/api/admin/inventory", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const branchId = (req.query.branchId as string) || "central";
      const inventory = await storage.getBranchInventory(branchId);
      res.json(inventory);
    } catch (err: any) {
      console.error("[API] inventory.list error:", err?.message);
      res.json([]);
    }
  });

  app.patch("/api/admin/inventory/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const item = await storage.updateBranchStock(req.params.id, req.body.stock);
      res.json(item);
    } catch (err: any) {
      console.error("[API] inventory.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث المخزون" });
    }
  });

  // ─── Branch Dashboard API ─────────────────────────────────────────────────
  // Each employee sees their assigned branch only. Admins may pass ?branchId=
  app.get("/api/branch/me", branchAccess, async (req: any, res) => {
    try {
      const branches = await storage.getBranches();
      const branch = branches.find((b: any) => String(b.id || b._id) === String(req.branchId));
      res.json({
        branchId: req.branchId,
        branch: branch || null,
        isBranchAdmin: !!req.isBranchAdmin,
        availableBranches: req.isBranchAdmin ? branches : [],
      });
    } catch (err: any) {
      console.error("[API] branch.me error:", err?.message);
      res.status(500).json({ message: "خطأ" });
    }
  });

  app.get("/api/branch/orders", branchAccess, async (req: any, res) => {
    try {
      const onlyPickup = req.query.scope === "pickup";
      const orders = await storage.getOrdersByBranch(req.branchId, { onlyPickup });
      res.json(orders);
    } catch (err: any) {
      console.error("[API] branch.orders error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/branch/orders/verify-pickup", branchAccess, async (req: any, res) => {
    try {
      const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) return res.status(400).json({ message: "كود غير صحيح" });
      const employeeId = (req.user as any).id || (req.user as any)._id;
      const order = await storage.verifyPickupCode(req.branchId, code, String(employeeId));
      // Notify customer
      try {
        await fireNotify(order.userId!, "✅ تم استلام طلبك من الفرع",
          `تم تسليم طلبك #${order.id.slice(-6).toUpperCase()} بنجاح. شكراً لك!`,
          { type: "success", link: `/orders/${order.id}`, icon: "🛍️", webPush: true });
      } catch {}
      res.json(order);
    } catch (err: any) {
      if (err?.code === "PICKUP_INVALID") return res.status(404).json({ message: err.message });
      console.error("[API] branch.verify-pickup error:", err?.message);
      res.status(500).json({ message: "خطأ في التحقق من الكود" });
    }
  });

  app.get("/api/branch/inventory", branchAccess, async (req: any, res) => {
    try {
      const inventory = await storage.getBranchInventory(req.branchId);
      res.json(inventory);
    } catch (err: any) {
      console.error("[API] branch.inventory error:", err?.message);
      res.json([]);
    }
  });

  app.patch("/api/branch/inventory/:id", branchAccess, async (req: any, res) => {
    try {
      const user = req.user as any;
      const perms: string[] = user.permissions || [];
      const allowed = req.isBranchAdmin || perms.includes("branch.inventory") || perms.includes("branch.manage");
      if (!allowed) return res.status(403).json({ message: "ليس لديك صلاحية تحديث المخزون" });
      const stock = Math.max(0, Number(req.body?.stock) || 0);
      const item = await storage.updateBranchStock(req.params.id, stock);

      // Real-time low-stock alert (≤ 5 units) → notify all admins + branch managers
      const LOW = 5;
      if (stock <= LOW) {
        const branches = await storage.getBranches().catch(() => [] as any[]);
        const branch = branches.find((b: any) => String(b.id || b._id) === String(req.branchId));
        const branchName = branch?.name || req.branchId;
        const title = stock === 0 ? "🚨 نفذ منتج من فرع" : "⚠️ مخزون منخفض في فرع";
        const body = `${branchName}: SKU ${item.variantSku || req.params.id} — متبقّي ${stock} فقط`;
        try {
          await fireNotifyAdmins(title, body, {
            type: stock === 0 ? "error" : "warning",
            link: "/branch-dashboard",
            icon: stock === 0 ? "🚨" : "⚠️",
            webPush: true,
          });
        } catch (e) { /* best-effort */ }
      }
      res.json(item);
    } catch (err: any) {
      console.error("[API] branch.inventory.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث المخزون" });
    }
  });

  // Customer "I'm on my way" — alert branch staff that customer is heading over
  app.post("/api/orders/:id/on-my-way", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const order: any = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
      if (String(order.userId) !== String(user._id || user.id)) return res.sendStatus(403);
      if (order.shippingMethod !== "pickup") return res.status(400).json({ message: "هذا الطلب ليس استلام من فرع" });
      if (order.pickupVerified) return res.status(400).json({ message: "تم استلام هذا الطلب مسبقاً" });

      const eta = Math.max(1, Math.min(120, Number(req.body?.etaMin ?? 15)));
      await OrderModel.updateOne(
        { _id: order._id },
        { $set: { customerOnWay: true, customerOnWayAt: new Date(), customerOnWayEtaMin: eta } }
      );

      // Notify branch employees + admins
      try {
        const { UserModel } = await import("./models");
        const branchUsers = order.pickupBranch
          ? await UserModel.find({ branchId: order.pickupBranch }).select("_id").lean()
          : [];
        const ref = String(order._id).slice(-6).toUpperCase();
        const title = "🚗 العميل في الطريق";
        const body = `طلب #${ref} — العميل ${user.name || ""} في الطريق (وصول خلال ${eta} دقيقة)`;
        await Promise.allSettled(
          branchUsers.map((u: any) =>
            fireNotify(String(u._id), title, body, {
              type: "info", link: "/branch-dashboard", icon: "🚗", webPush: true,
            })
          )
        );
        await fireNotifyAdmins(title, body, { type: "info", link: "/admin", icon: "🚗" });
      } catch (e: any) { console.warn("[on-my-way] notify err:", e?.message); }

      res.json({ ok: true, etaMin: eta });
    } catch (err: any) {
      console.error("[API] on-my-way error:", err?.message);
      res.status(500).json({ message: "خطأ في إرسال الإشعار" });
    }
  });

  // Admin: per-branch analytics (revenue, pickups, fulfillment, inventory health)
  app.get("/api/admin/branches/analytics", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (!["admin", "assistant_manager"].includes(user.role)) return res.sendStatus(403);
    try {
      const branches = await storage.getBranches();
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

      const rows = await Promise.all(branches.map(async (b: any) => {
        const orders = await storage.getOrdersByBranch(b.id || b._id).catch(() => [] as any[]);
        const monthOrders = orders.filter((o: any) => new Date(o.createdAt) >= startOfMonth);
        const todayOrders = orders.filter((o: any) => new Date(o.createdAt) >= startOfDay);
        const completed = monthOrders.filter((o: any) => o.status === "completed" || o.pickupVerified);
        const revenueMonth = completed.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        const todayPickups = todayOrders.filter((o: any) =>
          o.pickupVerified && new Date(o.pickupVerifiedAt || 0) >= startOfDay
        ).length;
        const pendingPickups = orders.filter((o: any) =>
          o.shippingMethod === "pickup" && !o.pickupVerified && o.status !== "cancelled"
        ).length;
        const onWay = orders.filter((o: any) => o.customerOnWay && !o.pickupVerified).length;

        // Fulfillment: avg minutes from createdAt → pickupVerifiedAt
        const fulfilled = orders.filter((o: any) => o.pickupVerified && o.pickupVerifiedAt && o.createdAt);
        const avgMinutes = fulfilled.length
          ? Math.round(fulfilled.reduce((s: number, o: any) =>
              s + (new Date(o.pickupVerifiedAt).getTime() - new Date(o.createdAt).getTime()) / 60000, 0
            ) / fulfilled.length)
          : 0;

        const inv = await storage.getBranchInventory(b.id || b._id).catch(() => [] as any[]);
        const lowStock = inv.filter((i: any) => Number(i.stock || 0) <= 5).length;
        const outOfStock = inv.filter((i: any) => Number(i.stock || 0) === 0).length;

        return {
          branchId: b.id || b._id,
          name: b.name,
          city: b.city || "",
          revenueMonth,
          ordersMonth: monthOrders.length,
          todayOrders: todayOrders.length,
          todayPickups,
          pendingPickups,
          onWay,
          avgFulfillmentMin: avgMinutes,
          totalProducts: inv.length,
          lowStock,
          outOfStock,
        };
      }));

      // Sort by revenue desc
      rows.sort((a, b) => b.revenueMonth - a.revenueMonth);
      res.json({
        branches: rows,
        totals: {
          revenueMonth: rows.reduce((s, r) => s + r.revenueMonth, 0),
          ordersMonth: rows.reduce((s, r) => s + r.ordersMonth, 0),
          todayPickups: rows.reduce((s, r) => s + r.todayPickups, 0),
          pendingPickups: rows.reduce((s, r) => s + r.pendingPickups, 0),
          onWay: rows.reduce((s, r) => s + r.onWay, 0),
        },
      });
    } catch (err: any) {
      console.error("[API] branches.analytics error:", err?.message);
      res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
    }
  });

  // End-of-day shift summary for branch employees
  app.get("/api/branch/shift-summary", branchAccess, async (req: any, res) => {
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const orders = await storage.getOrdersByBranch(req.branchId).catch(() => [] as any[]);
      const todayOrders = orders.filter((o: any) => new Date(o.createdAt) >= startOfDay);
      const todayDelivered = orders.filter((o: any) =>
        o.pickupVerified && o.pickupVerifiedAt && new Date(o.pickupVerifiedAt) >= startOfDay
      );
      const revenue = todayDelivered.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const pending = orders.filter((o: any) =>
        o.shippingMethod === "pickup" && !o.pickupVerified && o.status !== "cancelled"
      );
      const inventory = await storage.getBranchInventory(req.branchId).catch(() => [] as any[]);
      const branches = await storage.getBranches().catch(() => [] as any[]);
      const branch: any = branches.find((b: any) => String(b.id || b._id) === String(req.branchId)) || null;

      res.json({
        date: startOfDay.toISOString(),
        branchName: branch?.name || "",
        ordersToday: todayOrders.length,
        deliveredToday: todayDelivered.length,
        revenueToday: revenue,
        pendingPickups: pending.length,
        lowStockCount: inventory.filter((i: any) => Number(i.stock || 0) <= 5).length,
        outOfStockCount: inventory.filter((i: any) => Number(i.stock || 0) === 0).length,
        deliveredOrders: todayDelivered.map((o: any) => ({
          id: o.id || o._id,
          ref: String(o.id || o._id).slice(-6).toUpperCase(),
          total: Number(o.total || 0),
          customerName: o.customerName || o.shippingName || "",
          verifiedAt: o.pickupVerifiedAt,
        })),
      });
    } catch (err: any) {
      console.error("[API] shift-summary error:", err?.message);
      res.status(500).json({ message: "خطأ في تجهيز التقرير" });
    }
  });

  // Branch dashboard stats: today's pickups, pending pickups, low-stock count, last inventory update
  app.get("/api/branch/stats", branchAccess, async (req: any, res) => {
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const orders = await storage.getOrdersByBranch(req.branchId);
      const todayPickups = orders.filter((o: any) =>
        o.pickupVerified && o.pickupVerifiedAt && new Date(o.pickupVerifiedAt) >= startOfDay
      ).length;
      const pendingPickups = orders.filter((o: any) =>
        o.shippingMethod === "pickup" && !o.pickupVerified && o.status !== "cancelled"
      ).length;
      const inventory = await storage.getBranchInventory(req.branchId);
      const lowStockCount = inventory.filter((i: any) => Number(i.stock || 0) <= 5).length;
      const outOfStockCount = inventory.filter((i: any) => Number(i.stock || 0) === 0).length;

      // Find last inventory update time from audit log
      const logs = await storage.getAuditLogs(200).catch(() => [] as any[]);
      const lastInvLog = logs.find((l: any) =>
        (l.action === "update" && l.targetType === "inventory") ||
        (l.action === "update" && (l.details || "").includes("stock"))
      );
      const lastUpdate = lastInvLog ? lastInvLog.createdAt : null;
      const hoursSinceUpdate = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 3600000) : null;
      const reminderDue = hoursSinceUpdate === null || hoursSinceUpdate >= 24;

      res.json({
        todayPickups, pendingPickups,
        lowStockCount, outOfStockCount,
        totalProducts: inventory.length,
        lastInventoryUpdate: lastUpdate,
        hoursSinceUpdate,
        reminderDue,
      });
    } catch (err: any) {
      console.error("[API] branch.stats error:", err?.message);
      res.json({ todayPickups: 0, pendingPickups: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0, reminderDue: false });
    }
  });

  // Get an order's pickup code (only owner or branch staff can fetch)
  app.get("/api/orders/:id/pickup-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const order: any = await storage.getOrder(req.params.id);
      if (!order) return res.sendStatus(404);
      const user = req.user as any;
      const isOwner = String(order.userId) === String(user.id || user._id);
      const isBranchStaff = ["admin", "assistant_manager", "tech_support"].includes(user.role)
        || (user.branchId && String(user.branchId) === String(order.pickupBranch));
      if (!isOwner && !isBranchStaff) return res.sendStatus(403);
      res.json({
        pickupCode: order.pickupCode || null,
        pickupBranch: order.pickupBranch || null,
        pickupVerified: !!order.pickupVerified,
        pickupVerifiedAt: order.pickupVerifiedAt || null,
      });
    } catch (err: any) {
      console.error("[API] order.pickup-code error:", err?.message);
      res.status(500).json({ message: "خطأ" });
    }
  });

  // Stock Transfers
  app.get("/api/admin/transfers", checkPermission("settings.manage"), async (_req, res) => {
    if (!_req.isAuthenticated()) return res.sendStatus(401);
    try {
      const transfers = await storage.getStockTransfers();
      res.json(transfers);
    } catch (err: any) {
      console.error("[API] transfers.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/admin/transfers", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const transfer = await storage.createStockTransfer({ ...req.body, requestedBy: user.id || user._id });
      res.status(201).json(transfer);
    } catch (err: any) {
      console.error("[API] transfers.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء طلب النقل" });
    }
  });

  app.patch("/api/admin/transfers/:id/status", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const transfer = await storage.updateStockTransferStatus(req.params.id, req.body.status, user.id || user._id);
      res.json(transfer);
    } catch (err: any) {
      console.error("[API] transfers.status error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث حالة النقل" });
    }
  });

  app.patch("/api/pos/shifts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const shift = await storage.updateCashShift(req.params.id, req.body);
      res.json(shift);
    } catch (err: any) {
      console.error("[API] shifts.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث الوردية" });
    }
  });

  // Wallet Transactions
  app.get("/api/wallet/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const transactions = await storage.getWalletTransactions(user.id);
      res.json(transactions);
    } catch (err: any) {
      console.error("[API] wallet.transactions error:", err?.message);
      res.json([]);
    }
  });

  // Shipping Companies
  app.get("/api/shipping-companies", async (req, res) => {
    try {
      const role = req.isAuthenticated() ? (req.user as any)?.role : null;
      const isStaff = role === "admin" || role === "employee";
      const companies = await storage.getShippingCompanies();
      const filtered = isStaff ? companies : companies.filter((c: any) => c.isActive !== false);
      res.json(filtered);
    } catch (err: any) {
      console.error("[API] shipping-companies.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/shipping-companies", checkPermission("settings.manage"), async (req, res) => {
    try {
      const company = await storage.createShippingCompany(req.body);
      res.status(201).json(company);
    } catch (err: any) {
      console.error("[API] shipping-companies.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء شركة الشحن" });
    }
  });

  app.patch("/api/shipping-companies/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const company = await storage.updateShippingCompany(req.params.id, req.body);
      res.json(company);
    } catch (err: any) {
      console.error("[API] shipping-companies.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث شركة الشحن" });
    }
  });

  app.delete("/api/shipping-companies/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      await storage.deleteShippingCompany(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] shipping-companies.delete error:", err?.message);
      res.status(500).json({ message: "خطأ في حذف شركة الشحن" });
    }
  });

  // ─── Wishlist ──────────────────────────────────────────────────────────────
  app.get("/api/wishlist/ids", async (req, res) => {
    if (!req.isAuthenticated()) return res.json([]);
    try {
      const user = req.user as any;
      const ids = await storage.getWishlistProductIds(user.id);
      res.json(ids);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/wishlist", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const items = await storage.getWishlist(user.id);
      const products = await Promise.all(items.map(i => storage.getProduct(i.productId)));
      res.json(products.filter(Boolean));
    } catch (err: any) {
      res.json([]);
    }
  });

  app.post("/api/wishlist", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      await storage.addToWishlist(user.id, req.body.productId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في إضافة المنتج للمفضلة" });
    }
  });

  app.delete("/api/wishlist/:productId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      await storage.removeFromWishlist(user.id, req.params.productId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في إزالة المنتج من المفضلة" });
    }
  });

  // ─── Product Reviews ────────────────────────────────────────────────────────
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id);
      res.json(reviews);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.post("/api/products/:id/reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const existing = await storage.getUserReviewForProduct(user.id, req.params.id);
      if (existing) return res.status(409).json({ message: "لقد قمت بتقييم هذا المنتج مسبقاً" });
      // Verified-buyer gate: only customers who actually paid for this product can review.
      const purchased = await storage.hasUserPurchasedProduct(user.id, req.params.id);
      if (!purchased) {
        return res.status(403).json({ message: "يمكن للعملاء الذين اشتروا المنتج فقط إضافة تقييم" });
      }
      // Note: race-condition safety — DB has unique index on { userId, productId }; duplicate-key handled in catch.
      // Denormalize product info for admin/home view
      const product = await storage.getProduct(req.params.id);
      const rawImages = Array.isArray(req.body.images) ? req.body.images : [];
      // Whitelist: only allow paths under /uploads/ (block protocol-relative //evil.com/x.jpg)
      const images = rawImages
        .filter((u: any) => typeof u === "string" && /^\/uploads\/[A-Za-z0-9._\-]+$/.test(u))
        .slice(0, 5);
      const review = await storage.createProductReview({
        productId: req.params.id,
        userId: user.id,
        userName: user.name || "عميل",
        userAvatar: user.avatar || "",
        rating: Math.min(5, Math.max(1, Number(req.body.rating) || 5)),
        comment: String(req.body.comment || "").slice(0, 1000),
        images,
        productName: product?.name || "",
        productImage: (product as any)?.images?.[0] || "",
      } as any);
      res.status(201).json(review);
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "لقد قمت بتقييم هذا المنتج مسبقاً" });
      }
      res.status(500).json({ message: "خطأ في إضافة التقييم" });
    }
  });

  // Public — homepage testimonial carousel
  app.get("/api/reviews/featured", async (req, res) => {
    try {
      const limit = Math.min(24, parseInt((req.query.limit as string) || "12", 10));
      const items = await storage.getFeaturedReviews(limit);
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  // ─── Admin Reviews Management ────────────────────────────────────────────────
  app.get("/api/admin/reviews", checkPermission("orders.view"), async (req, res) => {
    try {
      const { rating, hasReply, q, page, limit } = req.query as any;
      const r = await storage.getAllReviews({
        rating: rating ? parseInt(rating, 10) : undefined,
        hasReply: hasReply === "yes" ? true : hasReply === "no" ? false : undefined,
        q: q || undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.json(r);
    } catch (err: any) { res.status(500).json({ message: err.message, items: [], total: 0 }); }
  });

  app.post("/api/admin/reviews/:id/reply", checkPermission("orders.view"), async (req, res) => {
    try {
      const user = req.user as any;
      const text = String(req.body?.text || "").trim().slice(0, 1500);
      if (!text) return res.status(400).json({ message: "الرد مطلوب" });
      const r = await storage.replyToReview(req.params.id, {
        text,
        byUserId: String(user.id),
        byName: user.name || "إدارة عطور آر اف",
      });
      if (!r) return res.status(404).json({ message: "التقييم غير موجود" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/reviews/:id/featured", checkPermission("orders.view"), async (req, res) => {
    try {
      const r = await storage.setReviewFeatured(req.params.id, !!req.body?.isFeatured);
      if (!r) return res.status(404).json({ message: "التقييم غير موجود" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/reviews/:id", checkPermission("orders.view"), async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Promo Strip (admin-controlled trust badges) ────────────────────────────
  app.get("/api/promo-strip", async (_req, res) => {
    try {
      const items = await storage.getPromoStripItems(true);
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  app.get("/api/admin/promo-strip", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const items = await storage.getPromoStripItems(false);
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  app.post("/api/admin/promo-strip", checkPermission("settings.manage"), async (req, res) => {
    try {
      const item = await storage.createPromoStripItem(req.body);
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/promo-strip/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const item = await storage.updatePromoStripItem(req.params.id, req.body);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/promo-strip/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      await storage.deletePromoStripItem(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Stat Items (admin-controlled stats strip) ─────────────────────────────
  app.get("/api/stats", async (_req, res) => {
    try {
      const items = await storage.getStatItems(true);
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  app.get("/api/admin/stats", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const items = await storage.getStatItems(false);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/stats", checkPermission("settings.manage"), async (req, res) => {
    try {
      const item = await storage.createStatItem(req.body);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/stats/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const item = await storage.updateStatItem(req.params.id, req.body);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/stats/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      await storage.deleteStatItem(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Custom Pages ───────────────────────────────────────────────────────────
  app.get("/api/pages", async (req, res) => {
    try {
      const navOnly = req.query.nav === "1" || req.query.nav === "true";
      const items = await storage.getCustomPages({ activeOnly: true, navOnly });
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  app.get("/api/pages/:slug", async (req, res) => {
    try {
      const page = await storage.getCustomPageBySlug(req.params.slug);
      if (!page || !page.isActive) return res.status(404).json({ message: "Page not found" });
      res.json(page);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/pages", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const items = await storage.getCustomPages({});
      res.json(items);
    } catch (err: any) { res.json([]); }
  });

  app.post("/api/admin/pages", checkPermission("settings.manage"), async (req, res) => {
    try {
      const DOMPurify = (await import("isomorphic-dompurify")).default;
      const slug = String(req.body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return res.status(400).json({ message: "slug مطلوب" });
      const exists = await storage.getCustomPageBySlug(slug);
      if (exists) return res.status(409).json({ message: "هذا الـ slug مستخدم مسبقاً" });
      const sanitized = {
        ...req.body,
        slug,
        contentAr: DOMPurify.sanitize(String(req.body.contentAr || "")),
        contentEn: DOMPurify.sanitize(String(req.body.contentEn || "")),
      };
      const item = await storage.createCustomPage(sanitized);
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/pages/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const DOMPurify = (await import("isomorphic-dompurify")).default;
      const update: any = { ...req.body };
      if (update.slug != null) {
        update.slug = String(update.slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        if (!update.slug) return res.status(400).json({ message: "slug مطلوب" });
        const existing = await storage.getCustomPageBySlug(update.slug);
        if (existing && (existing.id || (existing as any)._id?.toString()) !== req.params.id) {
          return res.status(409).json({ message: "هذا الـ slug مستخدم مسبقاً" });
        }
      }
      if (update.contentAr != null) update.contentAr = DOMPurify.sanitize(String(update.contentAr));
      if (update.contentEn != null) update.contentEn = DOMPurify.sanitize(String(update.contentEn));
      const item = await storage.updateCustomPage(req.params.id, update);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/pages/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      await storage.deleteCustomPage(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── AI Product Insights ─────────────────────────────────────────────────────
  app.get("/api/products/:id/insights", aiLimiter, async (req, res) => {
    try {
      const productId = req.params.id;
      const cached = await storage.getProductInsights(productId);
      const reviews = await storage.getProductReviews(productId);
      const reviewsWithComments = reviews.filter((r: any) => r.comment && r.comment.length > 5);
      // Refresh if stale: more than 24h old OR new reviews since last gen
      const stale = !cached
        || (reviewsWithComments.length - (cached.basedOnReviewCount || 0)) >= 2
        || (Date.now() - new Date(cached.generatedAt || 0).getTime()) > 24 * 60 * 60 * 1000;
      if (cached && !stale) return res.json(cached);
      if (reviewsWithComments.length < 2) {
        // Not enough data — return existing cached (if any) or null
        return res.json(cached || null);
      }
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
      try {
        const { generateProductInsights } = await import("./ai");
        const insights = await generateProductInsights({
          productName: (product as any).name,
          productCategory: "perfume",
          reviews: reviewsWithComments.map((r: any) => ({ rating: r.rating, comment: r.comment })),
        });
        const saved = await storage.upsertProductInsights(productId, {
          ...insights,
          basedOnReviewCount: reviewsWithComments.length,
        });
        res.json(saved);
      } catch (e: any) {
        console.error("[product-insights] AI failed:", e?.message);
        res.json(cached || null);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── AI Inventory Insights ───────────────────────────────────────────────────
  app.get("/api/admin/ai/inventory-insights", aiLimiter, checkPermission("products.view"), async (_req, res) => {
    try {
      const [products, orders] = await Promise.all([storage.getProducts(), storage.getOrders()]);
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const sales: Record<string, { qty: number; revenue: number }> = {};
      let totalRevenue = 0;
      for (const o of orders) {
        const created = new Date((o as any).createdAt || 0).getTime();
        if (created < cutoff) continue;
        if ((o as any).paymentStatus !== "paid") continue;
        for (const it of (o as any).items || []) {
          const pid = it.productId;
          if (!pid) continue;
          if (!sales[pid]) sales[pid] = { qty: 0, revenue: 0 };
          sales[pid].qty += Number(it.quantity || 0);
          sales[pid].revenue += Number(it.price || 0) * Number(it.quantity || 0);
          totalRevenue += Number(it.price || 0) * Number(it.quantity || 0);
        }
      }
      const productSummaries = products.map((p: any) => {
        const totalStock = (p.variants || []).reduce((s: number, v: any) => s + Number(v.stock || 0), 0);
        const s = sales[p.id || p._id] || { qty: 0, revenue: 0 };
        return { name: p.name, stock: totalStock, sold30d: s.qty, revenue30d: s.revenue, price: Number(p.price || 0) };
      });
      try {
        const { generateInventoryInsights } = await import("./ai");
        const insights = await generateInventoryInsights({ products: productSummaries, totalRevenue });
        res.json({ ...insights, generatedAt: new Date(), totalRevenue, productCount: products.length });
      } catch (e: any) {
        console.error("[inventory-insights] AI failed:", e?.message);
        // Fallback: deterministic heuristic
        const sorted = [...productSummaries].sort((a, b) => b.revenue30d - a.revenue30d);
        const restockUrgent = productSummaries
          .filter(p => p.stock <= 5 && p.sold30d > 0)
          .map(p => ({ name: p.name, reason: `المخزون ${p.stock} ومبيعات ٣٠ يوم: ${p.sold30d}`, suggestedQty: Math.max(20, p.sold30d * 2) }));
        res.json({
          topMovers: sorted.slice(0, 3).map(p => ({ name: p.name, insight: `حقّق ${p.revenue30d.toFixed(0)} ر.س في ٣٠ يوم` })),
          slowMovers: sorted.slice(-3).reverse().map(p => ({ name: p.name, insight: `مبيعات ضعيفة: ${p.sold30d} وحدات` })),
          restockUrgent,
          overallHealth: `إجمالي إيرادات ٣٠ يوم: ${totalRevenue.toFixed(0)} ر.س عبر ${products.length} منتج.`,
          recommendations: ["فعّل حملة تسويقية للمنتجات الراكدة", "أعد تخزين المنتجات الأكثر مبيعاً", "راجع تسعير المنتجات بطيئة الحركة"],
          generatedAt: new Date(),
          totalRevenue,
          productCount: products.length,
          fallback: true,
        });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Verified-buyer eligibility (for review prompt) ─────────────────────────
  app.get("/api/products/:id/can-review", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ canReview: false, reason: "auth" });
    try {
      const user = req.user as any;
      const existing = await storage.getUserReviewForProduct(user.id, req.params.id);
      if (existing) return res.json({ canReview: false, reason: "already-reviewed", review: existing });
      const purchased = await storage.hasUserPurchasedProduct(user.id, req.params.id);
      res.json({ canReview: purchased, reason: purchased ? "verified-buyer" : "not-purchased", verified: purchased });
    } catch (err: any) { res.json({ canReview: false, reason: "error" }); }
  });

  // ─── Low Stock ───────────────────────────────────────────────────────────────
  app.get("/api/admin/low-stock", checkPermission("products.view"), async (req, res) => {
    try {
      const threshold = parseInt(req.query.threshold as string) || 5;
      const products = await storage.getLowStockProducts(threshold);
      res.json(products);
    } catch (err: any) {
      res.json([]);
    }
  });

  // Invoices — accessible by all authenticated users (admins see all, others see their own)
  app.get("/api/invoices", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const invoices = await storage.getInvoices(user.role === "admin" ? undefined : user.id);
      res.json(invoices);
    } catch (err: any) {
      console.error("[API] invoices.list error:", err?.message);
      res.json([]);
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) return res.status(404).send("Invoice not found");
      res.json(invoice);
    } catch (err: any) {
      console.error("[API] invoices.get error:", err?.message);
      res.status(500).json({ message: "خطأ في جلب الفاتورة" });
    }
  });

  // ─── Notifications ────────────────────────────────────────────────────────
  // VAPID Public Key (needed by client to subscribe to web push)
  app.get("/api/notifications/vapid-public-key", (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // Get my notifications (paginated, newest first)
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const userId = user.id || user._id;
      const notifications = await NotificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      const unreadCount = await NotificationModel.countDocuments({ userId, isRead: false });
      res.json({ notifications, unreadCount });
    } catch (err: any) {
      console.error("[API] notifications.list error:", err?.message);
      res.json({ notifications: [], unreadCount: 0 });
    }
  });

  // Mark one notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      await NotificationModel.findOneAndUpdate(
        { _id: req.params.id, userId: user.id || user._id },
        { isRead: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] notifications.read error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      await NotificationModel.updateMany(
        { userId: user.id || user._id, isRead: false },
        { isRead: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] notifications.read-all error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      await NotificationModel.findOneAndDelete({ _id: req.params.id, userId: user.id || user._id });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] notifications.delete error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // Save Web Push subscription
  app.post("/api/notifications/subscribe", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user as any;
      const userId = user.id || user._id;
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "بيانات الاشتراك غير مكتملة" });
      }
      await PushSubscriptionModel.findOneAndUpdate(
        { endpoint },
        { userId, endpoint, keys },
        { upsert: true, new: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] push.subscribe error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // Remove Web Push subscription (on logout or disable)
  app.delete("/api/notifications/subscribe", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { endpoint } = req.body;
      if (endpoint) await PushSubscriptionModel.deleteOne({ endpoint });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] push.unsubscribe error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // Admin: send manual notification to a user
  app.post("/api/admin/notify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const reqUser = req.user as any;
    if (reqUser.role !== "admin") return res.sendStatus(403);
    try {
      const { userId, title, body, type, link } = req.body;
      if (!userId || !title || !body) return res.status(400).json({ message: "بيانات ناقصة" });
      await fireNotify(userId, title, body, { type: type || "info", link: link || "" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[API] admin.notify error:", err?.message);
      res.status(500).json({ ok: false });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PAYMENT GATEWAY — Full Simulator Routes
  // ─────────────────────────────────────────────────────────────

  // Test card guide for admin/testing
  app.get("/api/pay/test-cards", (_req, res) => {
    res.json({ cards: TEST_CARD_GUIDE, stcOtp: "1234", otp3ds: "123456" });
  });

  // Card validation (live feedback)
  app.post("/api/pay/validate-card", (req, res) => {
    try {
      const { cardNumber } = req.body;
      if (!cardNumber) return res.status(400).json({ valid: false });
      const num = cardNumber.replace(/\D/g, "");
      const valid = luhnCheck(num);
      const brand = detectCardBrand(num);
      res.json({ valid, brand });
    } catch (err: any) {
      res.status(500).json({ valid: false, error: err.message });
    }
  });

  // Paymob status check
  app.get("/api/paymob/status", (_req, res) => {
    res.json({ configured: isPaymobConfigured() });
  });

  // Initiate Paymob payment (create intention → return iframe URL)
  app.post("/api/paymob/initiate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      if (!isPaymobConfigured()) {
        return res.status(503).json({ success: false, error: "بوابة الدفع غير مُعدّة بعد. يرجى إضافة مفاتيح Paymob." });
      }
      const { orderId, amount, items, address, city } = req.body;
      if (!orderId || !amount) {
        return res.status(400).json({ success: false, error: "بيانات الطلب ناقصة" });
      }
      const u = req.user as any;
      const result = await initiatePaymobPayment({
        merchantOrderId: String(orderId),
        amount: Number(amount),
        items: items || [],
        customer: {
          name: u?.name || "عميل",
          email: u?.email || "",
          phone: u?.phone || "",
          address: address || "",
          city: city || "",
        },
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[Paymob] initiate error:", err?.message);
      res.status(500).json({ success: false, error: err?.message || "خطأ في بوابة الدفع" });
    }
  });

  // Paymob transaction callback (server-to-server webhook)
  app.post("/api/paymob/callback", async (req, res) => {
    try {
      const body = req.body;
      const hmac = (req.query.hmac as string) || "";
      const txn = body.obj || body;
      const flat = flattenPaymobCallback(txn);

      if (hmac && !verifyPaymobHmac(flat, hmac)) {
        console.error("[Paymob] HMAC verification failed");
        return res.status(403).json({ error: "HMAC mismatch" });
      }

      const merchantOrderId = txn.order?.merchant_order_id || txn.merchant_order_id;
      const success = txn.success === true || txn.success === "true";
      const paymobTxnId = txn.id;

      console.log(`[Paymob] Callback: order=${merchantOrderId} success=${success} txnId=${paymobTxnId}`);

      if (merchantOrderId && success) {
        try {
          const order = await storage.getOrder(merchantOrderId);
          if (order) {
            await storage.updateOrderPaymentStatus(merchantOrderId, "paid");
            if (order.status === "pending_payment") {
              await storage.updateOrderStatus(merchantOrderId, "new" as any);
            }
            console.log(`[Paymob] Order ${merchantOrderId} marked as paid`);
          }
        } catch (e: any) {
          console.error("[Paymob] Error updating order:", e?.message);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Paymob] callback error:", err?.message);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Paymob redirect callback (browser redirect after payment)
  app.get("/api/paymob/callback", (req, res) => {
    const success = req.query.success === "true";
    const orderId = req.query.merchant_order_id || req.query.order || "";
    const txnId = req.query.id || "";
    res.redirect(`/paymob/result?success=${success}&orderId=${orderId}&txnId=${txnId}`);
  });

  // Initiate card payment
  app.post("/api/pay/card", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { orderId, amount, cardNumber, cardHolderName, expiryMonth, expiryYear, cvv } = req.body;
      if (!orderId || !amount || !cardNumber || !cvv) {
        return res.status(400).json({ success: false, error: "بيانات البطاقة ناقصة" });
      }
      // Simulate realistic processing delay
      await new Promise(r => setTimeout(r, 1800 + Math.random() * 1200));
      const result = await initiateCardPayment({ orderId, amount, cardNumber, cardHolderName, expiryMonth, expiryYear, cvv }) as any;

      // If card charged directly without 3DS, send payment confirmation
      if (result.success && !result.requires3DS) {
        try {
          const u = req.user as any;
          if (u?.email) {
            await sendPaymentConfirmationEmail({
              to: u.email,
              customerName: u.name || "عزيزي العميل",
              orderRef: String(orderId).slice(-8).toUpperCase(),
              amount: Number(amount),
              paymentMethod: "card",
              transactionId: result.transactionId,
              authCode: result.authCode,
            });
          }
        } catch (e: any) { console.error("[EMAIL] Payment confirm card:", e?.message); }
      }

      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.card error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في معالجة الدفع، حاول مجدداً" });
    }
  });

  // Verify 3DS OTP
  app.post("/api/pay/card/3ds", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { transactionId, otp } = req.body;
      if (!transactionId || !otp) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      await new Promise(r => setTimeout(r, 1200));
      const result = await verify3DS(transactionId, otp) as any;

      // Send payment confirmation email on success
      if (result.success) {
        try {
          const u = req.user as any;
          if (u?.email) {
            await sendPaymentConfirmationEmail({
              to: u.email,
              customerName: u.name || "عزيزي العميل",
              orderRef: result.orderId ? String(result.orderId).slice(-8).toUpperCase() : transactionId.slice(-8).toUpperCase(),
              amount: result.amount || 0,
              paymentMethod: "card",
              transactionId: result.transactionId || transactionId,
              authCode: result.authCode,
            });
          }
        } catch (e: any) { console.error("[EMAIL] Payment confirm 3ds:", e?.message); }
      }

      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.3ds error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في التحقق" });
    }
  });

  // Initiate STC Pay (sends OTP)
  app.post("/api/pay/stc/initiate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { orderId, amount, phone } = req.body;
      if (!orderId || !amount || !phone) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      await new Promise(r => setTimeout(r, 1000));
      const result = await initiateSTPay({ orderId, amount, phone });
      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.stc.initiate error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في إرسال OTP" });
    }
  });

  // Verify STC Pay OTP
  app.post("/api/pay/stc/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { sessionToken, otp, orderId, amount } = req.body;
      if (!sessionToken || !otp) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      await new Promise(r => setTimeout(r, 1000));
      const result = await verifySTCPay({ sessionToken, otp }) as any;

      if (result.success) {
        try {
          const u = req.user as any;
          if (u?.email) {
            await sendPaymentConfirmationEmail({
              to: u.email,
              customerName: u.name || "عزيزي العميل",
              orderRef: orderId ? String(orderId).slice(-8).toUpperCase() : sessionToken.slice(-8).toUpperCase(),
              amount: amount || result.amount || 0,
              paymentMethod: "stc_pay",
              transactionId: result.transactionId || sessionToken,
              authCode: result.authCode,
            });
          }
        } catch (e: any) { console.error("[EMAIL] Payment confirm stc:", e?.message); }
      }

      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.stc.verify error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في التحقق" });
    }
  });

  // Apple Pay
  app.post("/api/pay/apple-pay", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { orderId, amount } = req.body;
      if (!orderId || !amount) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      const result = await processApplePay({ orderId, amount }) as any;

      if (result.success) {
        try {
          const u = req.user as any;
          if (u?.email) {
            await sendPaymentConfirmationEmail({
              to: u.email,
              customerName: u.name || "عزيزي العميل",
              orderRef: String(orderId).slice(-8).toUpperCase(),
              amount: Number(amount),
              paymentMethod: "apple_pay",
              transactionId: result.transactionId,
              authCode: result.authCode,
            });
          }
        } catch (e: any) { console.error("[EMAIL] Payment confirm apple:", e?.message); }
      }

      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.apple-pay error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في Apple Pay" });
    }
  });

  // Tamara BNPL
  app.post("/api/payments/tamara/checkout", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { orderId, amount, customer, installments } = req.body;
      if (!orderId || !amount) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      const result = await createTamaraCheckout({
        orderId, amount,
        customer: customer || { name: "Customer", phone: "", email: "" },
        installments: installments || 4
      });
      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.tamara error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في تمارة" });
    }
  });

  app.post("/api/payments/tamara/confirm", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ success: false });
      await new Promise(r => setTimeout(r, 1500));
      const result = await confirmTamaraCheckout(sessionId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Tabby BNPL
  app.post("/api/payments/tabby/checkout", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { orderId, amount, customer } = req.body;
      if (!orderId || !amount) return res.status(400).json({ success: false, error: "بيانات ناقصة" });
      const result = await createTabbyCheckout({
        orderId, amount,
        customer: customer || { name: "Customer", phone: "", email: "" }
      });
      res.json(result);
    } catch (err: any) {
      console.error("[API] pay.tabby error:", err?.message);
      res.status(500).json({ success: false, error: "خطأ في تابي" });
    }
  });

  app.post("/api/payments/tabby/confirm", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ success: false });
      await new Promise(r => setTimeout(r, 1500));
      const result = await confirmTabbyCheckout(sessionId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get transaction status
  app.get("/api/pay/transaction/:id", (req, res) => {
    try {
      const tx = getTransaction(req.params.id);
      if (!tx) return res.status(404).json({ error: "العملية غير موجودة" });
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Groq AI Endpoints ──────────────────────────────────────

  app.get("/api/ai/status", (_req, res) => {
    res.json({ configured: isGroqConfigured() });
  });

  app.post("/api/ai/perfume-advisor", aiLimiter, async (req, res) => {
    try {
      if (!isGroqConfigured()) {
        return res.json({ response: "المستشار غير متاح حالياً. يرجى التواصل مع فريق الدعم.", products: [] });
      }
      const { message, history } = req.body;
      if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });
      const products = await storage.getProducts();
      const result = await perfumeAdvisor(message, history || [], products);
      res.json(result);
    } catch (err: any) {
      console.error("[AI] perfume-advisor error:", err?.message);
      res.json({ response: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.", products: [] });
    }
  });

  app.post("/api/ai/support", aiLimiter, async (req, res) => {
    try {
      if (!isGroqConfigured()) {
        return res.json({ response: "الدعم الذكي غير متاح حالياً. تواصل معنا عبر الواتساب 966551329821", needsEscalation: true });
      }
      const { message, history, customerInfo, orderId } = req.body;
      if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });
      const u = req.user as any;
      const result = await supportAssistant(message, history || [], {
        name: u?.name || customerInfo?.name || "زائر",
        orderId,
      });
      res.json(result);
    } catch (err: any) {
      console.error("[AI] support error:", err?.message);
      res.json({ response: "عذراً، حدث خطأ. تواصل معنا عبر الواتساب 966551329821", needsEscalation: true });
    }
  });

  app.post("/api/ai/admin-assistant", aiLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    if (!["admin", "assistant_manager", "support", "accountant", "legal"].includes(u?.role)) {
      return res.sendStatus(403);
    }
    try {
      if (!isGroqConfigured()) {
        return res.json({ response: "المساعد الذكي غير متاح حالياً." });
      }
      const { message, history, stats } = req.body;
      if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });
      const response = await adminAssistant(message, history || [], { stats, role: u?.role });
      res.json({ response });
    } catch (err: any) {
      console.error("[AI] admin-assistant error:", err?.message);
      res.json({ response: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى." });
    }
  });

  // ─── AI Endpoints (legacy) ─────────────────────────────────────

  app.post("/api/ai/size-advisor", aiLimiter, async (req, res) => {
    try {
      const { getSizeRecommendation } = await import("./ai");
      const result = await getSizeRecommendation(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/insights", aiLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { getBusinessInsights } = await import("./ai");
      const result = await getBusinessInsights(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generate-description", aiLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { generateProductDescription } = await import("./ai");
      const result = await generateProductDescription(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Public AI Perfume Highlights (cached, used in featured best-seller card) ──
  const highlightsCache = new Map<string, { at: number; data: any }>();
  const HIGHLIGHTS_TTL_MS = 24 * 60 * 60 * 1000;
  app.get("/api/products/:id/highlights", aiLimiter, async (req, res) => {
    try {
      const id = req.params.id;
      const cached = highlightsCache.get(id);
      if (cached && Date.now() - cached.at < HIGHLIGHTS_TTL_MS) {
        return res.json(cached.data);
      }
      const product: any = await storage.getProduct(id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      // Always-safe defaults (used if AI fails or returns nothing usable)
      const defaultHighlightsAr = ["تركيبة فاخرة وثابتة", "حضور آسر طوال اليوم", "مناسب لجميع المناسبات"];
      const defaultHighlightsEn = ["Luxurious long-lasting blend", "Captivating all-day presence", "Perfect for every occasion"];
      const defaultTaglineAr = product.description || `عطر ${product.name} — لمسة فاخرة من عطور آر اف`;
      const defaultTaglineEn = product.descriptionEn || `${product.nameEn || product.name} — a signature scent by RF Perfume`;

      try {
        const { generateProductDescription } = await import("./ai");
        const ai: any = await generateProductDescription({
          name: product.name,
          nameEn: product.nameEn || "",
          category: "perfume",
          price: Number(product.price) || 0,
        }) || {};
        const aiHighlightsAr = Array.isArray(ai.highlights_ar) ? ai.highlights_ar.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3) : [];
        const aiHighlightsEn = Array.isArray(ai.highlights_en) ? ai.highlights_en.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3) : [];
        const data = {
          tagline_ar: (typeof ai.description_ar === "string" && ai.description_ar.trim()) || defaultTaglineAr,
          tagline_en: (typeof ai.description_en === "string" && ai.description_en.trim()) || defaultTaglineEn,
          highlights_ar: aiHighlightsAr.length ? aiHighlightsAr : defaultHighlightsAr,
          highlights_en: aiHighlightsEn.length ? aiHighlightsEn : defaultHighlightsEn,
        };
        // Only cache when we got something AI-generated; otherwise short-cache fallback
        const usedAi = !!aiHighlightsAr.length || !!aiHighlightsEn.length || !!(ai.description_ar || ai.description_en);
        highlightsCache.set(id, { at: usedAi ? Date.now() : Date.now() - HIGHLIGHTS_TTL_MS + 60 * 60_000, data });
        res.json(data);
      } catch (e: any) {
        const fallback = {
          tagline_ar: defaultTaglineAr,
          tagline_en: defaultTaglineEn,
          highlights_ar: defaultHighlightsAr,
          highlights_en: defaultHighlightsEn,
        };
        // Cache fallback for only ~1h so AI is retried sooner
        highlightsCache.set(id, { at: Date.now() - HIGHLIGHTS_TTL_MS + 60 * 60_000, data: fallback });
        res.json(fallback);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/outfit-suggestions", aiLimiter, async (req, res) => {
    try {
      const { getOutfitSuggestions } = await import("./ai");
      const result = await getOutfitSuggestions(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Store Settings ──────────────────────────────────────────

  app.get("/api/store/settings", async (_req, res) => {
    try {
      const settings = await storage.getStoreSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/store/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const updated = await storage.updateStoreSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────

  app.post("/api/shipping/storage-station/create-order", checkPermission("orders.edit"), async (_req, res) => {
    res.json({ success: true, trackingNumber: "SS-" + Math.random().toString(36).substring(7).toUpperCase(), message: "Storage Station B20 stubbed" });
  });

  // ─── Flash Deals ─────────────────────────────────────────────

  // Public: get active flash deals
  app.get("/api/flash-deals", async (_req, res) => {
    try {
      const deals = await storage.getActiveFlashDeals();
      // Enrich with product info
      const enriched = await Promise.all(deals.map(async (deal: any) => {
        const product = await storage.getProduct(deal.productId);
        return { ...deal, product: product || null };
      }));
      res.json(enriched.filter((d: any) => d.product));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: get all flash deals
  app.get("/api/admin/flash-deals", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const deals = await storage.getFlashDeals();
      const enriched = await Promise.all(deals.map(async (deal: any) => {
        const product = await storage.getProduct(deal.productId);
        return { ...deal, product: product || null };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: create flash deal
  app.post("/api/admin/flash-deals", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const deal = await storage.createFlashDeal(req.body);
      res.status(201).json(deal);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update flash deal
  app.patch("/api/admin/flash-deals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const deal = await storage.updateFlashDeal(req.params.id, req.body);
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: delete flash deal
  app.delete("/api/admin/flash-deals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      await storage.deleteFlashDeal(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Bundle Offers ───────────────────────────────────────────
  // Public: list active bundles (sorted by priority desc)
  app.get("/api/bundle-offers", async (_req, res) => {
    try {
      const offers = await storage.getBundleOffers(true);
      res.json(offers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: calculate best bundle pricing for a given cart payload
  // body: { items: [{ productId, quantity, price, categoryId? }] }
  app.post("/api/bundle-offers/calculate", async (req, res) => {
    try {
      const items: Array<{ productId: string; quantity: number; price: number; categoryId?: string }> = req.body?.items || [];
      const offers = await storage.getBundleOffers(true);
      const result = computeBundleSavings(items, offers);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin/staff: list all bundles
  app.get("/api/admin/bundle-offers", checkPermission("bundles.manage"), async (_req, res) => {
    try {
      const offers = await storage.getBundleOffers(false);
      res.json(offers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/bundle-offers", checkPermission("bundles.manage"), async (req, res) => {
    try {
      const u = req.user as any;
      const parsed = insertBundleOfferSchema.parse(req.body);
      const offer = await storage.createBundleOffer({
        ...parsed,
        createdBy: u?.id || "",
        createdByName: u?.name || u?.username || "",
      });
      res.status(201).json(offer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/bundle-offers/:id", checkPermission("bundles.manage"), async (req, res) => {
    try {
      const offer = await storage.updateBundleOffer(req.params.id, req.body);
      res.json(offer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/admin/bundle-offers/:id", checkPermission("bundles.manage"), async (req, res) => {
    try {
      await storage.deleteBundleOffer(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Return Requests ──────────────────────────────────────────

  // Customer: create return request
  app.post("/api/returns", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      // verify order belongs to user
      const order = await storage.getOrder(req.body.orderId);
      if (!order || order.userId !== user.id) return res.status(403).json({ message: "غير مسموح" });
      if (!["completed", "shipped", "delivered"].includes(order.status) && order.status !== "completed") {
        return res.status(400).json({ message: "لا يمكن طلب إرجاع لهذا الطلب" });
      }
      // check no existing return
      const existing = await storage.getReturnRequests({ userId: user.id });
      const alreadyRequested = existing.some((r: any) => r.orderId === req.body.orderId);
      if (alreadyRequested) return res.status(409).json({ message: "طلب الإرجاع موجود بالفعل" });
      const returnReq = await storage.createReturnRequest({
        ...req.body,
        userId: user.id,
        status: "pending",
      });
      res.status(201).json(returnReq);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Customer: get own returns
  app.get("/api/returns", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const returns = await storage.getReturnRequests({ userId: user.id });
      res.json(returns);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: get all returns
  app.get("/api/admin/returns", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const filter: any = {};
      if (req.query.status) filter.status = req.query.status as string;
      const returns = await storage.getReturnRequests(filter);
      // Enrich with order info
      const enriched = await Promise.all(returns.map(async (r: any) => {
        try {
          const order = await storage.getOrder(r.orderId);
          const customer = r.userId ? await storage.getUser(r.userId) : null;
          return { ...r, order: order || null, customer: customer ? { name: customer.name, phone: customer.phone } : null };
        } catch { return r; }
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update return request (approve/reject)
  app.patch("/api/admin/returns/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const returnReq = await storage.getReturnRequest(req.params.id);
      if (!returnReq) return res.status(404).json({ message: "طلب الإرجاع غير موجود" });
      const updated = await storage.updateReturnRequest(req.params.id, req.body);
      // If approved, refund to wallet
      if (req.body.status === "approved" && returnReq.status !== "approved") {
        const refundAmount = req.body.refundAmount || returnReq.refundAmount;
        if (refundAmount > 0 && returnReq.userId) {
          const customer = await storage.getUser(returnReq.userId);
          if (customer) {
            const currentBalance = parseFloat((customer as any).walletBalance || "0");
            await storage.updateUser(returnReq.userId, {
              walletBalance: (currentBalance + refundAmount).toString()
            });
            await storage.createWalletTransaction({
              userId: returnReq.userId,
              amount: refundAmount,
              type: "deposit",
              description: `استرداد طلب #${returnReq.orderId?.slice(-6)}`,
              reference: returnReq.orderId,
              status: "completed",
            });
          }
        }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Loyalty Points ───────────────────────────────────────────

  // Get loyalty info for current user
  app.get("/api/user/loyalty", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const u = await storage.getUser(user.id);
      if (!u) return res.status(404).json({ message: "User not found" });
      const points = (u as any).loyaltyPoints || 0;
      const tier = (u as any).loyaltyTier || "bronze";
      const totalSpent = (u as any).totalSpent || 0;
      // Tier thresholds
      const tiers = {
        bronze: { min: 0, max: 1000, discount: 1, icon: "🥉", nameAr: "برونزي" },
        silver: { min: 1000, max: 5000, discount: 2, icon: "🥈", nameAr: "فضي" },
        gold: { min: 5000, max: 15000, discount: 3, icon: "🥇", nameAr: "ذهبي" },
        platinum: { min: 15000, max: Infinity, discount: 5, icon: "💎", nameAr: "بلاتيني" },
      };
      const tierInfo = tiers[tier as keyof typeof tiers] || tiers.bronze;
      const nextTier = tier === "bronze" ? "silver" : tier === "silver" ? "gold" : tier === "gold" ? "platinum" : null;
      const nextTierInfo = nextTier ? tiers[nextTier as keyof typeof tiers] : null;
      const progressToNext = nextTierInfo ? Math.min(100, Math.round((totalSpent - tierInfo.min) / (tierInfo.max - tierInfo.min) * 100)) : 100;
      res.json({
        points,
        tier,
        tierInfo: { ...tierInfo, name: tier },
        totalSpent,
        nextTier,
        nextTierThreshold: nextTierInfo?.min,
        progressToNext,
        pointsValue: (points / 100).toFixed(2), // 100 points = 1 SAR
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Vendor / Multi-Seller Marketplace ───────────────────────

  // Public: list active vendors
  app.get("/api/vendors", async (_req, res) => {
    try {
      const all = await storage.getVendors();
      const active = all.filter((v: any) => v.status === "active");
      res.json(active);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: get single vendor store
  app.get("/api/vendors/:id", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor || (vendor as any).status !== "active") return res.status(404).json({ message: "Vendor not found" });
      res.json(vendor);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: get vendor products
  app.get("/api/vendors/:id/products", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor || (vendor as any).status !== "active") return res.status(404).json({ message: "Vendor not found" });
      const products = await storage.getVendorProducts(req.params.id);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Authenticated: apply to become a vendor
  app.post("/api/vendor/apply", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const existing = await storage.getVendorByUserId(user.id);
      if (existing) return res.status(409).json({ message: "لديك طلب بائع مسجل بالفعل" });
      const data = { ...req.body, userId: user.id, status: "pending" };
      const vendor = await storage.createVendor(data);
      await storage.updateUser(user.id, { role: "vendor" });
      res.status(201).json(vendor);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: get own profile
  app.get("/api/vendor/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(404).json({ message: "لا يوجد حساب بائع" });
      res.json(vendor);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: update own profile
  app.patch("/api/vendor/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(404).json({ message: "لا يوجد حساب بائع" });
      const allowed = ["storeName", "storeNameEn", "description", "logo", "coverImage", "phone", "email", "bankIBAN", "tags"];
      const update: any = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
      const updated = await storage.updateVendor((vendor as any).id, update);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: get own products
  app.get("/api/vendor/products", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(404).json({ message: "لا يوجد حساب بائع" });
      const products = await storage.getVendorProducts((vendor as any).id);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: add product
  app.post("/api/vendor/products", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor || (vendor as any).status !== "active") return res.status(403).json({ message: "حساب البائع غير مفعّل" });
      const product = await storage.createProduct({ ...req.body, vendorId: (vendor as any).id });
      res.status(201).json(product);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: update own product
  app.patch("/api/vendor/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(403).json({ message: "حساب البائع غير موجود" });
      const product = await storage.getProduct(req.params.id);
      if (!product || (product as any).vendorId !== (vendor as any).id) return res.status(403).json({ message: "غير مسموح" });
      const updated = await storage.updateProduct(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: delete own product
  app.delete("/api/vendor/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(403).json({ message: "حساب البائع غير موجود" });
      const product = await storage.getProduct(req.params.id);
      if (!product || (product as any).vendorId !== (vendor as any).id) return res.status(403).json({ message: "غير مسموح" });
      await storage.deleteProduct(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Vendor: get own orders
  app.get("/api/vendor/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const vendor = await storage.getVendorByUserId(user.id);
      if (!vendor) return res.status(404).json({ message: "لا يوجد حساب بائع" });
      const orders = await storage.getVendorOrders((vendor as any).id);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: get all vendors
  app.get("/api/admin/vendors", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update vendor (approve/reject/commission)
  app.patch("/api/admin/vendors/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const updated = await storage.updateVendor(req.params.id, req.body);
      // sync user role if activating/suspending
      if (req.body.status === "active") {
        await storage.updateUser((updated as any).userId, { role: "vendor" });
      } else if (req.body.status === "suspended") {
        await storage.updateUser((updated as any).userId, { role: "customer" });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: delete vendor
  app.delete("/api/admin/vendors/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (vendor) {
        await storage.updateUser((vendor as any).userId, { role: "customer" });
        await storage.deleteVendor(req.params.id);
      }
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Addresses ──────────────────────────────────────────────
  app.get("/api/addresses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    try {
      const user = await storage.getUser(u.id);
      res.json((user as any)?.addresses || []);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/addresses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    try {
      const user = await storage.getUser(u.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const addresses = (user as any).addresses || [];
      const newAddr = { id: Date.now().toString(), ...req.body };
      if (newAddr.isDefault) {
        addresses.forEach((a: any) => a.isDefault = false);
      }
      addresses.push(newAddr);
      await storage.updateUserAddresses(u.id, addresses);
      res.json(newAddr);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    try {
      const user = await storage.getUser(u.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const addresses = ((user as any).addresses || []).filter((a: any) => a.id !== req.params.id);
      await storage.updateUserAddresses(u.id, addresses);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Wallet Balance ───────────────────────────────────────
  app.get("/api/wallet", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    try {
      const user = await storage.getUser(u.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const transactions = await storage.getWalletTransactions(u.id);
      res.json({
        balance: (user as any).walletBalance || "0",
        transactions,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Change Password ──────────────────────────────────────
  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "كلمة المرور الحالية والجديدة مطلوبة" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }
    try {
      const user = await storage.getUser(u.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { scryptSync, randomBytes, timingSafeEqual } = await import("crypto");
      const [hash, salt] = (user as any).password.split(".");
      const hashedBuf = Buffer.from(hash, "hex");
      const suppliedBuf = scryptSync(currentPassword, salt, 64);
      if (!timingSafeEqual(hashedBuf, suppliedBuf)) {
        return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
      }
      const newSalt = randomBytes(16).toString("hex");
      const newHash = scryptSync(newPassword, newSalt, 64).toString("hex") + "." + newSalt;
      await storage.updateUserPassword(u.id, newHash);
      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Loyalty Status (public-facing) ────────────────────────
  app.get("/api/loyalty/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user as any;
    try {
      const user = await storage.getUser(u.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        points: (user as any).loyaltyPoints || 0,
        tier: (user as any).loyaltyTier || "bronze",
        totalSpent: (user as any).totalSpent || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Marketing Campaigns ───────────────────────────
  app.get("/api/admin/marketing", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const { MarketingCampaignModel } = await import("./models");
      if (!MarketingCampaignModel) return res.json([]);
      const campaigns = await MarketingCampaignModel.find().sort({ createdAt: -1 }).lean();
      res.json(campaigns);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/marketing", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { MarketingCampaignModel } = await import("./models");
      const campaign = await MarketingCampaignModel.create(req.body);
      res.status(201).json(campaign);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/marketing/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { MarketingCampaignModel } = await import("./models");
      await MarketingCampaignModel.findByIdAndDelete(req.params.id);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Activity Logs ─────────────────────────────────
  app.get("/api/admin/logs", checkPermission("staff.manage"), async (_req, res) => {
    try {
      const logs = await ActivityLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Staff (alias for users with staff roles) ──────
  app.get("/api/admin/staff", checkPermission("staff.manage"), async (_req, res) => {
    try {
      const staffRoles = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "support", "cashier"];
      const staff = await UserModel.find({ role: { $in: staffRoles } }).select("-password").sort({ createdAt: -1 }).lean();
      res.json(staff);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Banners ───────────────────────────────────────
  app.get("/api/admin/banners", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const banners = await storage.getBanners();
      res.json(banners);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Orders (alias) ────────────────────────────────
  app.get("/api/admin/orders", checkPermission("orders.view"), async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Products (alias) ──────────────────────────────
  app.get("/api/admin/products", checkPermission("products.view"), async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Check Phone ─────────────────────────────────────
  app.post("/api/admin/check-phone", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const reqUser = req.user as any;
    const staffRoles = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant"];
    if (!staffRoles.includes(reqUser?.role)) return res.sendStatus(403);
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "رقم الهاتف مطلوب" });
      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("966")) cleanPhone = cleanPhone.substring(3);
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
      const user = await UserModel.findOne({
        $or: [
          { phone: cleanPhone },
          { username: cleanPhone },
          { phone: "0" + cleanPhone },
          { username: "0" + cleanPhone },
        ]
      }).lean();
      res.json({ exists: !!user, user: user ? { id: (user as any)._id, name: user.name, role: user.role } : null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin: Wallet Deposit ────────────────────────────────
  app.post("/api/admin/wallet/deposit", checkPermission("wallet.adjust"), async (req, res) => {
    try {
      const { userId, amount, description } = req.body;
      if (!userId || !amount) return res.status(400).json({ message: "معرف المستخدم والمبلغ مطلوب" });
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ message: "المبلغ يجب أن يكون رقم موجب" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      const currentBalance = parseFloat((user as any).walletBalance || "0");
      const newBalance = (currentBalance + numAmount).toFixed(2);
      await storage.updateUserWallet(userId, newBalance);
      await storage.createWalletTransaction({
        userId,
        amount: numAmount,
        type: "deposit",
        description: description || "إيداع من الإدارة",
        balanceAfter: newBalance,
      } as any);
      res.json({ message: "تم إضافة الرصيد بنجاح", newBalance });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // ════════════════════════════════════════════════════════════════════════
  // Cart Sync (anonymous + logged-in) — for abandoned-cart tracking
  // ════════════════════════════════════════════════════════════════════════
  app.post("/api/cart/sync", cartLimiter, async (req, res) => {
    try {
      const { sessionId, items, total } = req.body || {};
      const user: any = req.isAuthenticated() ? req.user : null;
      if (!user && !sessionId) {
        return res.status(400).json({ message: "sessionId مطلوب للزوار" });
      }
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "items يجب أن يكون مصفوفة" });
      }

      const query: any = user
        ? { userId: String(user.id), $or: [{ convertedToOrderId: { $exists: false } }, { convertedToOrderId: null }, { convertedToOrderId: "" }] }
        : { sessionId, $or: [{ userId: { $exists: false } }, { userId: null }] };

      // Empty cart → delete tracker
      if (items.length === 0) {
        await CartSessionModel.deleteMany(query).catch(() => {});
        return res.json({ ok: true, cleared: true });
      }

      const sanitized = items.slice(0, 50).map((i: any) => ({
        productId: String(i.productId || ""),
        variantSku: i.variantSku ? String(i.variantSku) : undefined,
        title: String(i.title || ""),
        image: i.image ? String(i.image) : undefined,
        price: Number(i.price) || 0,
        quantity: Math.max(1, Number(i.quantity) || 1),
      }));
      const computedTotal = Number(total) || sanitized.reduce((s, i) => s + i.price * i.quantity, 0);

      // Compute a stable signature of cart contents to decide reset
      const sig = sanitized
        .map(i => `${i.productId}:${i.variantSku || ""}:${i.quantity}`)
        .sort().join("|");

      const setFields: any = {
        items: sanitized,
        total: computedTotal,
      };
      if (user) {
        setFields.userId = String(user.id);
        setFields.customerName = user.name;
        setFields.customerPhone = user.phone;
        setFields.customerEmail = user.email;
      } else {
        setFields.sessionId = sessionId;
      }

      // First fetch existing to determine signature change
      const existing: any = await CartSessionModel.findOne(query).lean();
      const existingSig = (existing?.items || [])
        .map((i: any) => `${i.productId}:${i.variantSku || ""}:${i.quantity}`)
        .sort().join("|");

      const update: any = { $set: setFields };
      // Only reset reminder when contents materially changed (not on every keystroke debounce)
      if (existingSig !== sig) {
        update.$set.reminderSent = false;
        update.$set.reminderSentAt = null;
      }

      const cart = await CartSessionModel.findOneAndUpdate(
        query,
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // If user just logged in, adopt any anonymous session cart for this sessionId
      if (user && sessionId) {
        await CartSessionModel.deleteMany({
          sessionId,
          $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }],
          _id: { $ne: cart!._id },
        } as any).catch(() => {});
      }
      res.json({ ok: true, cartId: cart._id });
    } catch (err: any) {
      console.error("[Cart] sync error:", err?.message);
      res.status(500).json({ message: "تعذر مزامنة السلة" });
    }
  });

  // Load saved cart for logged-in user (cross-device sync)
  app.get("/api/cart", async (req, res) => {
    const user: any = req.isAuthenticated() ? req.user : null;
    if (!user) return res.json({ items: [] });
    try {
      const cart = await CartSessionModel.findOne({
        userId: String(user.id),
        $or: [{ convertedToOrderId: { $exists: false } }, { convertedToOrderId: null }, { convertedToOrderId: "" }],
      }).lean();
      res.json({ items: (cart as any)?.items || [] });
    } catch {
      res.json({ items: [] });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Customer Order Cancellation
  // ════════════════════════════════════════════════════════════════════════
  app.get("/api/orders/:id/can-cancel", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user: any = req.user;
      const order = await OrderModel.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ allowed: false, reason: "الطلب غير موجود" });
      if (String((order as any).userId) !== String(user.id) && user.role !== "admin") {
        return res.status(403).json({ allowed: false });
      }
      const result = await canCustomerCancel(order);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ allowed: false, reason: err?.message });
    }
  });

  app.post("/api/orders/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user: any = req.user;
      const order: any = await OrderModel.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });

      const isOwner = String(order.userId) === String(user.id);
      const isStaff = ["admin", "assistant_manager", "employee", "support"].includes(user.role);
      if (!isOwner && !isStaff) return res.sendStatus(403);

      const result = await cancelOrder({
        orderId: req.params.id,
        reason: req.body?.reason || (isOwner ? "إلغاء بناءً على طلب العميل" : "إلغاء إداري"),
        initiatedBy: isOwner ? "customer" : "admin",
        actorName: user.name,
        bypassPolicy: isStaff,
      });
      res.json(result);
    } catch (err: any) {
      console.error("[Cancel] error:", err?.message);
      res.status(400).json({ message: err?.message || "تعذر إلغاء الطلب" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Cancellation Policy (admin)
  // ════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/cancellation-policy", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user: any = req.user;
    if (!["admin", "assistant_manager"].includes(user.role)) return res.sendStatus(403);
    const policy = await getCancellationPolicy();
    res.json(policy);
  });

  app.put("/api/admin/cancellation-policy", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user: any = req.user;
    if (user.role !== "admin") return res.sendStatus(403);
    try {
      const updated = await CancellationPolicyModel.findOneAndUpdate(
        { key: "main" },
        { $set: req.body },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err?.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Abandoned Carts (admin / employee)
  // ════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/abandoned-carts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user: any = req.user;
    if (!["admin", "assistant_manager", "employee", "support"].includes(user.role)) {
      return res.sendStatus(403);
    }
    try {
      const carts = await CartSessionModel.find({
        $or: [{ convertedToOrderId: { $exists: false } }, { convertedToOrderId: null }, { convertedToOrderId: "" }],
        "items.0": { $exists: true },
      } as any)
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();

      // Enrich with user info if available
      const enriched = await Promise.all(carts.map(async (c: any) => {
        let userInfo: any = null;
        if (c.userId) {
          try {
            const u: any = await UserModel.findById(c.userId).lean();
            if (u) userInfo = { name: u.name, phone: u.phone, email: u.email };
          } catch {}
        }
        const idleMinutes = Math.round((Date.now() - new Date(c.updatedAt).getTime()) / 60000);
        return {
          id: String(c._id),
          userId: c.userId || null,
          sessionId: c.sessionId || null,
          user: userInfo,
          items: c.items,
          total: c.total,
          itemCount: (c.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0),
          reminderSent: !!c.reminderSent,
          reminderSentAt: c.reminderSentAt,
          manualReminderCount: c.manualReminderCount || 0,
          idleMinutes,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error("[AdminCarts] list error:", err?.message);
      res.status(500).json({ message: "تعذر جلب السلال" });
    }
  });

  app.post("/api/admin/abandoned-carts/:id/notify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user: any = req.user;
    if (!["admin", "assistant_manager", "employee", "support"].includes(user.role)) {
      return res.sendStatus(403);
    }
    try {
      const result = await notifyCart(req.params.id, {
        customDiscountPercent: Number(req.body?.discountPercent) || 0,
        customMessage: req.body?.message,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "تعذر إرسال التنبيه" });
    }
  });

  app.delete("/api/admin/abandoned-carts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user: any = req.user;
    if (!["admin", "assistant_manager"].includes(user.role)) return res.sendStatus(403);
    await CartSessionModel.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ZATCA QR for invoice / order
  // ════════════════════════════════════════════════════════════════════════
  app.get("/api/orders/:id/zatca-qr", async (req, res) => {
    try {
      const order: any = await OrderModel.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
      const settings: any = await StoreSettingsModel.findOne({ key: "main" }).lean();
      const result = await buildZatcaQrDataUrl({
        sellerName: settings?.storeNameAr || settings?.storeName || "عطور آر اف",
        vatNumber: settings?.vatNumber || "",
        timestamp: new Date(order.createdAt || Date.now()),
        total: Number(order.total) || 0,
        vatAmount: Number(order.vatAmount) || 0,
      });
      res.json({
        qr: result.dataUrl,
        base64: result.base64,
        sellerName: settings?.storeNameAr || "عطور آر اف",
        vatNumber: settings?.vatNumber || "",
        total: Number(order.total) || 0,
        vatAmount: Number(order.vatAmount) || 0,
        issuedAt: order.createdAt,
      });
    } catch (err: any) {
      console.error("[ZATCA] error:", err?.message);
      res.status(500).json({ message: "تعذر إنشاء رمز ZATCA" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Admin: Performance & Scaling
  // ════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/performance", checkPermission("settings.manage"), async (_req, res) => {
    try {
      const mongoose = (await import("mongoose")).default;
      const memMB = (n: number) => +(n / 1024 / 1024).toFixed(1);
      const mem = process.memoryUsage();
      res.json({
        cache: getCacheStats(),
        jobQueue: getQueueStats(),
        rateLimits: {
          global: { windowMin: 15, max: 500 },
          auth:   { windowMin: 15, max: 20 },
          upload: { windowHr:  1, max: 50 },
          cart:   { windowSec: 60, max: 60 },
          orderCreate: { windowSec: 60, max: 10 },
          ai: { windowSec: 60, max: 20 },
          coupon: { windowSec: 60, max: 30 },
        },
        mongo: {
          state: mongoose.connection.readyState, // 1 = connected
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          poolMax: parseInt(process.env.MONGO_POOL_MAX || "50", 10),
          poolMin: parseInt(process.env.MONGO_POOL_MIN || "5", 10),
        },
        process: {
          uptimeSec: Math.floor(process.uptime()),
          rssMB: memMB(mem.rss),
          heapUsedMB: memMB(mem.heapUsed),
          heapTotalMB: memMB(mem.heapTotal),
          nodeVersion: process.version,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Toggle cache on/off + change default TTL + clear / reset stats
  app.post("/api/admin/performance/cache", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { action, enabled, ttlMs } = req.body || {};
      if (action === "clear") {
        const n = cacheClear();
        return res.json({ ok: true, cleared: n });
      }
      if (action === "reset-stats") {
        resetCacheStats();
        return res.json({ ok: true });
      }
      if (typeof enabled === "boolean") setCacheEnabled(enabled);
      if (typeof ttlMs === "number" && ttlMs > 0) setDefaultTtlMs(ttlMs);
      res.json({ ok: true, enabled: isCacheEnabled(), defaultTtlMs: getDefaultTtlMs() });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Employee Inbox (Zoho / Gmail / etc. via IMAP+SMTP) ─────────────────────
  // Helper: check inbox account ownership (admins bypass)
  const ADMIN_ROLES = ["admin", "assistant_manager", "tech_support"];
  const INBOX_STAFF_ROLES = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "cashier", "support"];

  // Allow any authenticated staff user to access the inbox endpoints; ownership is enforced per-account below.
  const inboxAccess = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any)?.role;
    if (!INBOX_STAFF_ROLES.includes(role)) return res.status(403).json({ message: "ليس لديك صلاحية" });
    next();
  };

  async function assertAccountAccess(req: any, accountId: string): Promise<{ ok: true; account: any } | { ok: false; status: number; message: string }> {
    if (!accountId) return { ok: false, status: 400, message: "accountId مطلوب" };
    const account = await MailAccountModel.findById(accountId).lean();
    if (!account) return { ok: false, status: 404, message: "الحساب غير موجود" };
    const userId = String(req.user?._id || req.user?.id || "");
    const isAdmin = ADMIN_ROLES.includes(req.user?.role);
    if (!isAdmin && String((account as any).userId || "") !== userId) {
      return { ok: false, status: 403, message: "ليس لديك صلاحية على هذا الحساب" };
    }
    return { ok: true, account };
  }

  app.get("/api/admin/inbox/providers", checkPermission("settings.manage"), async (_req, res) => {
    res.json(PROVIDER_PRESETS);
  });

  app.get("/api/admin/inbox/accounts", inboxAccess, async (req, res) => {
    try {
      const userId = (req as any).user?._id || (req as any).user?.id;
      const isAdmin = ["admin", "assistant_manager", "tech_support"].includes((req as any).user?.role);
      const filter: any = { isActive: true };
      if (!isAdmin) filter.userId = userId;
      const accounts = await MailAccountModel.find(filter).sort({ createdAt: 1 }).lean();
      const result = await Promise.all(accounts.map(async (a: any) => {
        const unreadCount = await MailMessageModel.countDocuments({ accountId: a._id.toString(), folder: "INBOX", isRead: false });
        return {
          id: a._id.toString(),
          userId: a.userId,
          email: a.email,
          displayName: a.displayName,
          provider: a.provider,
          imapHost: a.imapHost, imapPort: a.imapPort,
          smtpHost: a.smtpHost, smtpPort: a.smtpPort,
          color: a.color,
          isActive: a.isActive,
          lastSyncAt: a.lastSyncAt,
          lastSyncStatus: a.lastSyncStatus,
          lastSyncError: a.lastSyncError,
          unreadCount,
        };
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/inbox/accounts/test", checkPermission("settings.manage"), async (req, res) => {
    try {
      const r = await testInboxConnection(req.body);
      res.json(r);
    } catch (err: any) { res.status(500).json({ message: err.message, ok: false }); }
  });

  app.post("/api/admin/inbox/accounts", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { email, password, displayName, provider, userId, color, imapHost, imapPort, smtpHost, smtpPort } = req.body;
      if (!email || !password) return res.status(400).json({ message: "البريد وكلمة المرور مطلوبان" });
      const preset = PROVIDER_PRESETS[provider || "zoho"] || PROVIDER_PRESETS.custom;
      const account = await MailAccountModel.create({
        email, displayName: displayName || email.split("@")[0],
        provider: provider || "zoho",
        userId: userId || "",
        imapHost: imapHost || preset.imapHost,
        imapPort: imapPort || preset.imapPort,
        smtpHost: smtpHost || preset.smtpHost,
        smtpPort: smtpPort || preset.smtpPort,
        password: encryptSecret(password),
        color: color || "#c9a96e",
      });
      // Trigger first sync in background
      syncInboxAccount(account._id.toString(), { limit: 30 }).catch(e => console.error("[Inbox] initial sync:", e?.message));
      res.json({ id: account._id.toString(), email: account.email });
    } catch (err: any) {
      const msg = err?.code === 11000 ? "هذا البريد مضاف مسبقاً" : (err?.message || "خطأ");
      res.status(400).json({ message: msg });
    }
  });

  app.delete("/api/admin/inbox/accounts/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const chk = await assertAccountAccess(req, req.params.id);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      await MailAccountModel.deleteOne({ _id: req.params.id });
      await MailMessageModel.deleteMany({ accountId: req.params.id });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/inbox/accounts/:id", checkPermission("settings.manage"), async (req, res) => {
    try {
      const { userId, displayName, color, isActive } = req.body || {};
      const update: any = {};
      if (typeof userId === "string") update.userId = userId;
      if (typeof displayName === "string") update.displayName = displayName;
      if (typeof color === "string") update.color = color;
      if (typeof isActive === "boolean") update.isActive = isActive;
      const account = await MailAccountModel.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
      if (!account) return res.status(404).json({ message: "الحساب غير موجود" });
      res.json({ id: account._id.toString(), email: account.email, userId: account.userId, displayName: account.displayName, color: account.color, isActive: account.isActive });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/inbox/accounts/:id/sync", inboxAccess, async (req, res) => {
    try {
      const chk = await assertAccountAccess(req, req.params.id);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      const r = await syncInboxAccount(req.params.id, { limit: 50, folder: req.body?.folder || "INBOX" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/inbox/messages", inboxAccess, async (req, res) => {
    try {
      const { accountId, folder = "INBOX", q = "", filter = "all", page = "1", limit = "30" } = req.query as any;
      const chk = await assertAccountAccess(req, accountId);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      const query: any = { accountId, folder };
      if (filter === "unread") query.isRead = false;
      if (filter === "starred") query.isStarred = true;
      if (q) {
        const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ subject: rx }, { fromEmail: rx }, { fromName: rx }, { snippet: rx }];
      }
      const pg = Math.max(1, parseInt(page, 10));
      const lm = Math.min(100, Math.max(5, parseInt(limit, 10)));
      const [items, total] = await Promise.all([
        MailMessageModel.find(query).sort({ date: -1 }).skip((pg - 1) * lm).limit(lm).select("-htmlBody -textBody").lean(),
        MailMessageModel.countDocuments(query),
      ]);
      res.json({ items: items.map((m: any) => ({ ...m, id: m._id.toString() })), total, page: pg, limit: lm });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Helper for message-by-id ownership check
  async function assertMessageAccess(req: any, msgId: string) {
    const msg = await MailMessageModel.findById(msgId).lean() as any;
    if (!msg) return { ok: false as const, status: 404, message: "غير موجود" };
    const chk = await assertAccountAccess(req, msg.accountId);
    if (!chk.ok) return chk;
    return { ok: true as const, msg };
  }

  app.get("/api/admin/inbox/messages/:id", inboxAccess, async (req, res) => {
    try {
      const chk = await assertMessageAccess(req, req.params.id);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      res.json({ ...chk.msg, id: chk.msg._id.toString() });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/inbox/messages/:id", inboxAccess, async (req, res) => {
    try {
      const chk = await assertMessageAccess(req, req.params.id);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      const { isRead, isStarred } = req.body || {};
      const msg = await setInboxFlags(req.params.id, { isRead, isStarred });
      res.json({ id: msg._id.toString(), isRead: msg.isRead, isStarred: msg.isStarred });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/inbox/messages/:id", inboxAccess, async (req, res) => {
    try {
      const chk = await assertMessageAccess(req, req.params.id);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      await deleteInboxMessage(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/inbox/send", inboxAccess, async (req, res) => {
    try {
      const { accountId, to, cc, bcc, subject, html, text, inReplyTo, references } = req.body || {};
      if (!accountId || !to || !subject) return res.status(400).json({ message: "accountId, to, subject مطلوبة" });
      const chk = await assertAccountAccess(req, accountId);
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      const r = await sendInboxMessage(accountId, {
        to: Array.isArray(to) ? to : [to],
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        subject, html, text, inReplyTo,
        references: Array.isArray(references) ? references : (references ? [references] : undefined),
      });
      res.json({ ok: true, ...r });
    } catch (err: any) { res.status(500).json({ message: err.message, ok: false }); }
  });

  // Background sync (every 2 minutes)
  setInterval(async () => {
    try {
      const accounts = await MailAccountModel.find({ isActive: true });
      for (const acc of accounts) {
        try { await syncInboxAccount(acc._id.toString(), { limit: 20 }); }
        catch (e: any) { console.warn("[Inbox] auto-sync failed for", acc.email, "-", e?.message); }
      }
    } catch (e: any) { console.warn("[Inbox] auto-sync loop:", e?.message); }
  }, 2 * 60_000);

  // Boot the abandoned-cart background worker
  startAbandonedCartWorker();
  startPickupExpiryWorker();

  return httpServer;
}
