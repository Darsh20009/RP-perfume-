import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertProductSchema, insertOrderSchema, insertCouponSchema, insertCashShiftSchema, insertCategorySchema } from "@shared/schema";
import { seed } from "./seed";
import multer from "multer";
import path from "path";
import fs from "fs";
import { UserModel, NotificationModel, PushSubscriptionModel, ActivityLogModel, StoreSettingsModel } from "./models";
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
import { buildZatcaQrDataUrl } from "./zatca";
import rateLimit from "express-rate-limit";
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

  // Serve uploaded files statically
  const express = await import("express");
  app.use("/uploads", express.static(uploadDir));

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

  // Image Upload Endpoint
  app.post("/api/upload", upload.any(), (req, res) => {
    const files = req.files as Express.Multer.File[];
    const file = files?.[0] || (req as any).file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = `/uploads/${file.filename}`;
    res.json({ url });
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
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [allOrders, dailyOrders, monthlyOrders, totalProducts, totalCustomers] = await Promise.all([
        OrderModel.find({}).lean(),
        OrderModel.find({ createdAt: { $gte: startOfDay } }).lean(),
        OrderModel.find({ createdAt: { $gte: startOfMonth } }).lean(),
        ProductModel.countDocuments(),
        UM.countDocuments({ role: "customer" }),
      ]);

      // Exclude cancelled & refunded orders from revenue calculations
      const EXCLUDED_STATUSES = new Set(["cancelled", "refunded", "failed"]);
      const isRevenueOrder = (o: any) => !EXCLUDED_STATUSES.has(o.status);
      const revenueOrders = allOrders.filter(isRevenueOrder);
      const dailyRevenueOrders = dailyOrders.filter(isRevenueOrder);
      const monthlyRevenueOrders = monthlyOrders.filter(isRevenueOrder);

      const sumField = (orders: any[], field: string) =>
        orders.reduce((acc, o) => acc + Number(o[field] || 0), 0);

      const totalSales = sumField(revenueOrders, "total");
      const netProfit = sumField(revenueOrders, "netProfit");
      const dailySales = sumField(dailyRevenueOrders, "total");
      const monthlySales = sumField(monthlyRevenueOrders, "total");
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
        allTime: { totalRevenue: totalSales },
        today: { totalRevenue: todaySales },
        thisMonth: { totalRevenue: monthlySales },
        dailyOrders: dailyOrders.length,
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
      const order = await storage.createOrder({
        ...parsed.data,
        type: parsed.data.type || "online",
        branchId: parsed.data.branchId || user.branchId,
        cashierId: parsed.data.cashierId || user.id,
      });

      // Notify admins of new order
      try {
        await fireNotifyAdmins(
          "🛒 طلب جديد",
          `طلب جديد بقيمة ${order.total} ر.س — ${order.paymentMethod}`,
          { type: "info", link: "/admin", icon: "🛒", webPush: true }
        );
        // Notify customer that order was received
        await fireNotify(
          order.userId,
          "✅ تم استلام طلبك",
          `طلبك رقم #${order.id.slice(-6).toUpperCase()} بقيمة ${order.total} ر.س في انتظار المراجعة.`,
          { type: "success", link: "/orders", icon: "✅", webPush: true }
        );
      } catch (notifErr) {
        console.error("[NOTIFY] Failed to send order notifications:", notifErr);
      }

      // Send order confirmation email
      try {
        const customer = await storage.getUser(order.userId);
        if (customer?.email) {
          const orderRef = order.id.slice(-8).toUpperCase();
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
        }
      } catch (emailErr: any) {
        console.error("[EMAIL] Order confirmation error:", emailErr?.message);
      }

      try {
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
      } catch (invErr) {
        console.error("[INVOICE] Failed to auto-generate invoice:", invErr);
      }

      // Mark this user's pending cart as converted (stops abandoned-cart reminders)
      try { await markCartConverted(order.userId, order.id); } catch {}

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
          if (customer?.email && ["processing", "shipped", "completed", "cancelled", "out_for_delivery"].includes(status)) {
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
      sender: "rf-purfume@outlook.com",
      senderName: "رفيف العود",
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

  // Branches
  app.get("/api/branches", async (_req, res) => {
    try {
      const branches = await storage.getBranches();
      res.json(branches);
    } catch (err: any) {
      console.error("[API] branches.list error:", err?.message);
      res.json([]);
    }
  });

  app.post("/api/admin/branches", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const branch = await storage.createBranch(req.body);
      res.status(201).json(branch);
    } catch (err: any) {
      console.error("[API] branches.create error:", err?.message);
      res.status(500).json({ message: "خطأ في إنشاء الفرع" });
    }
  });

  app.patch("/api/admin/branches/:id", checkPermission("settings.manage"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const branch = await storage.updateBranch(req.params.id, req.body);
      res.json(branch);
    } catch (err: any) {
      console.error("[API] branches.update error:", err?.message);
      res.status(500).json({ message: "خطأ في تحديث الفرع" });
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
      const companies = await storage.getShippingCompanies();
      res.json(companies);
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
      const review = await storage.createProductReview({
        productId: req.params.id,
        userId: user.id,
        userName: user.name || "عميل",
        rating: Number(req.body.rating),
        comment: req.body.comment || "",
      });
      res.status(201).json(review);
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في إضافة التقييم" });
    }
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
        sellerName: settings?.storeNameAr || settings?.storeName || "رفيف العود",
        vatNumber: settings?.vatNumber || "",
        timestamp: new Date(order.createdAt || Date.now()),
        total: Number(order.total) || 0,
        vatAmount: Number(order.vatAmount) || 0,
      });
      res.json({
        qr: result.dataUrl,
        base64: result.base64,
        sellerName: settings?.storeNameAr || "رفيف العود",
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

  // Boot the abandoned-cart background worker
  startAbandonedCartWorker();

  return httpServer;
}
