import { z } from "zod";

// Enums and Types
export const userRoles = ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "customer", "support", "cashier", "vendor"] as const;
export type UserRole = typeof userRoles[number];

export const employeePermissions = [
  "orders.view", "orders.edit", "orders.refund",
  "products.view", "products.edit",
  "customers.view", "wallet.adjust",
  "reports.view", "staff.manage",
  "pos.access", "settings.manage",
  "branch.orders", "branch.inventory", "branch.scan", "branch.manage",
  "inbox.access",
  "bundles.manage"
] as const;
export type EmployeePermission = typeof employeePermissions[number];

export const orderStatuses = ["new", "pending_payment", "processing", "ready_for_pickup", "out_for_delivery", "shipped", "completed", "cancelled", "returned"] as const;
export type OrderStatus = typeof orderStatuses[number];

export const orderTypes = ["online", "pos"] as const;
export type OrderType = typeof orderTypes[number];

// User Schema
export const insertUserSchema = z.object({
  name: z.string().min(1, "اسم العميل مطلوب"),
  phone: z.string().regex(/^0?5\d{8}$/, "رقم الهاتف يجب أن يبدأ بـ 5 أو 05 ويتكون من 9 أو 10 أرقام"),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
  password: z.string().optional().default(""),
  role: z.enum(userRoles).default("customer"),
  permissions: z.array(z.string()).default([]),
  branchId: z.string().optional(),
  loginType: z.enum(["dashboard", "pos", "both"]).default("dashboard"),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(false),
  loyaltyPoints: z.number().default(0),
  loyaltyTier: z.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),
  totalSpent: z.number().default(0),
  phoneDiscountEligible: z.boolean().default(false),
  username: z.string().optional(),
  walletBalance: z.string().default("0"),
  addresses: z.array(z.object({
    id: z.string(),
    name: z.string(),
    city: z.string(),
    street: z.string(),
    district: z.string().optional().default(""),
    building: z.string().optional().default(""),
    floor: z.string().optional().default(""),
    apartment: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    lat: z.number().optional(),
    lng: z.number().optional(),
    isDefault: z.boolean().default(false),
  })).default([]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = InsertUser & { _id: string; id: string; createdAt: Date; __v?: number };

// Cash Shift Schema
export const insertCashShiftSchema = z.object({
  branchId: z.string(),
  cashierId: z.string(),
  status: z.enum(["open", "closed"]).default("open"),
  openingBalance: z.number(),
  closingBalance: z.number().optional(),
  actualCash: z.number().optional(),
  difference: z.number().optional(),
  openedAt: z.date().optional(),
  closedAt: z.date().optional(),
});

export type InsertCashShift = z.infer<typeof insertCashShiftSchema>;
export type CashShift = InsertCashShift & { _id: string; id: string };

// Audit Log Schema (Immutable logs for compliance)
export const insertAuditLogSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  action: z.string(), // create, update, delete, view, etc.
  targetType: z.string(), // order, product, customer, staff, etc.
  targetId: z.string().optional(),
  changes: z.record(z.any()).optional(), // Track what changed
  details: z.string().optional(),
  ipAddress: z.string().optional(),
  createdAt: z.date().optional(),
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = InsertAuditLog & { _id: string; id: string; createdAt: Date };

// Employee Activity Log (Legacy - for backward compatibility)
export const insertActivityLogSchema = z.object({
  employeeId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().optional(),
  details: z.string().optional(),
  createdAt: z.date().optional(),
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = InsertActivityLog & { _id: string; id: string; createdAt: Date };

// Role Schema
export const insertRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.enum(employeePermissions)).default([]),
  isSystem: z.boolean().default(false), // Super Admin, Admin, etc.
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = InsertRole & { _id: string; id: string };

// Coupon Schema
export const insertCouponSchema = z.object({
  code: z.string().min(1),
  type: z.enum(["percentage", "fixed", "cashback"]),
  value: z.number(),
  maxCashback: z.number().optional(),
  description: z.string().optional(),
  expiryDate: z.date().optional(),
  usageLimit: z.number().optional(),
  perUserLimit: z.number().default(1),
  minOrderAmount: z.number().optional(),
  targetCategoryIds: z.array(z.string()).default([]),
  targetProductIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = InsertCoupon & { _id: string; id: string; usageCount: number };

// Product Schema
export const insertProductSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().optional().default(""),
  description: z.string().optional().default(""),
  descriptionEn: z.string().optional().default(""),
  price: z.string(),
  cost: z.string(),
  images: z.array(z.string()),
  isFeatured: z.boolean().default(false),
  isOnSale: z.boolean().optional().default(false),
  salePrice: z.string().optional().default(""),
  barcode: z.string().optional(),
  printBarcode: z.boolean().default(true),
  categoryId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  variants: z.array(z.object({
    color: z.string().optional(),
    size: z.string().optional(),
    sku: z.string(),
    stock: z.number().default(0),
    price: z.number().default(0),
    cost: z.number().default(0),
    image: z.string().optional(),
  })).default([]),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = InsertProduct & { _id: string; id: string; createdAt: Date; vendorId?: string | null; updatedAt?: Date };

// Category Schema
export const insertCategorySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  slug: z.string().min(1),
  image: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().optional().default(0),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = InsertCategory & { _id: string; id: string };

// Order Schema
export const insertOrderSchema = z.object({
  userId: z.string(),
  type: z.enum(orderTypes).default("online"),
  branchId: z.string().optional(),
  cashierId: z.string().optional(),
  total: z.string(),
  subtotal: z.string(),
  vatAmount: z.string(),
  shippingCost: z.string(),
  tapCommission: z.string().optional().default("0"),
  netProfit: z.string().optional().default("0"),
  couponCode: z.string().optional(),
  discountAmount: z.string().default("0"),
  items: z.array(z.object({
    productId: z.string(),
    variantSku: z.string(),
    quantity: z.number(),
    price: z.number(),
    cost: z.number(), // Added cost per item at time of purchase
    title: z.string(),
  })),
  shippingMethod: z.enum(["pickup", "delivery"]),
  shippingAddress: z.object({
    city: z.string().optional(),
    street: z.string().optional(),
    district: z.string().optional(),
    country: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  // Customer's pinned location for delivery (so the driver/employee can navigate exactly there)
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  pickupBranch: z.string().optional(),
  pickupCode: z.string().optional(),
  pickupVerified: z.boolean().optional().default(false),
  pickupVerifiedAt: z.date().optional(),
  pickupVerifiedBy: z.string().optional(),
  customerOnWay: z.boolean().optional().default(false),
  customerOnWayAt: z.date().optional(),
  customerOnWayEtaMin: z.number().optional(),
  paymentMethod: z.enum(["cod", "bank_transfer", "apple_pay", "card", "cash", "wallet", "tap", "stc_pay", "tamara", "tabby"]),
  bankTransferReceipt: z.string().optional(),
  shippingCompany: z.string().optional(),
  deliveryAddress: z.string().optional(),
  cashbackAmount: z.string().optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  status: z.enum(orderStatuses).default("new"),
  paymentStatus: z.enum(["pending", "paid", "refunded"]).default("pending"),
  shippingProvider: z.string().optional(),
  trackingNumber: z.string().optional(),
  returnRequest: z.object({
    status: z.enum(["none", "pending", "approved", "rejected"]).default("none"),
    reason: z.string().optional(),
    type: z.enum(["return", "exchange"]).optional(),
    createdAt: z.date().optional(),
  }).optional(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = InsertOrder & {
  _id: string;
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: Date;
  userId?: string;
  deliveryDriver?: {
    name?: string;
    phone?: string;
    assignedAt?: Date;
  };
  statusHistory?: Array<{ status: string; at?: Date; note?: string }>;
};

// Wallet Transaction Schema
export const insertWalletTransactionSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  type: z.enum(["deposit", "withdrawal", "payment", "refund"]),
  description: z.string(),
  reference: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.date().optional(),
});

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = InsertWalletTransaction & { _id: string; id: string; createdAt: Date };

// Branch Schema
export const insertBranchSchema = z.object({
  name: z.string().min(1, "اسم الفرع مطلوب"),
  nameEn: z.string().optional().default(""),
  location: z.string().optional(),
  address: z.string().optional().default(""),
  addressEn: z.string().optional().default(""),
  city: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().optional().default(""),
  hours: z.string().optional().default(""),
  pickupHours: z.string().optional().default(""),
  image: z.string().optional().default(""),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  mapUrl: z.string().optional().default(""),
  isPickupEnabled: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
  isActive: z.boolean().default(true),
});

export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = InsertBranch & { _id: string; id: string };

// Banner Schema
export const insertBannerSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  image: z.string().min(1, "الصورة مطلوبة"),
  video: z.string().optional(),
  mediaType: z.enum(["image", "video"]).default("image"),
  link: z.string().optional(),
  type: z.enum(["banner", "popup", "hero"]).default("banner"),
  isActive: z.boolean().default(true),
});

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = InsertBanner & { _id: string; id: string };

// Branch Inventory Schema
export const insertBranchInventorySchema = z.object({
  branchId: z.string(),
  productId: z.string(),
  variantSku: z.string(),
  stock: z.number().default(0),
  minStockLevel: z.number().default(5),
});

export type InsertBranchInventory = z.infer<typeof insertBranchInventorySchema>;
export type BranchInventory = InsertBranchInventory & { _id: string; id: string; updatedAt: Date };

// Stock Transfer Schema
export const insertStockTransferSchema = z.object({
  fromBranchId: z.string(), // "central" for main warehouse
  toBranchId: z.string(),
  productId: z.string(),
  variantSku: z.string(),
  quantity: z.number().min(1),
  status: z.enum(["pending", "completed", "cancelled"]).default("pending"),
  requestedBy: z.string(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
});

export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;
export type StockTransfer = InsertStockTransfer & { _id: string; id: string; createdAt: Date };

// Shipping Company Schema
export const insertShippingCompanySchema = z.object({
  name: z.string().min(1, "اسم شركة الشحن مطلوب"),
  price: z.number().min(0, "السعر يجب أن يكون موجباً"),
  estimatedDays: z.number().min(1, "عدد الأيام المتوقعة مطلوب"),
  isActive: z.boolean().default(true),
  storageXCode: z.string().optional(),
});

export type InsertShippingCompany = z.infer<typeof insertShippingCompanySchema>;
export type ShippingCompany = InsertShippingCompany & { _id: string; id: string; createdAt: Date };

// Invoice Schema
export const invoiceStatuses = ["draft", "issued", "paid", "void", "refunded"] as const;
export type InvoiceStatus = typeof invoiceStatuses[number];

export const insertInvoiceSchema = z.object({
  userId: z.string(),
  orderId: z.string().optional(),
  invoiceNumber: z.string(),
  issueDate: z.date().default(() => new Date()),
  dueDate: z.date().optional(),
  status: z.enum(invoiceStatuses).default("draft"),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    taxRate: z.number().default(15), // Default Saudi VAT
    taxAmount: z.number(),
    total: z.number(),
  })),
  subtotal: z.number(),
  taxTotal: z.number(),
  total: z.number(),
  notes: z.string().optional(),
  qrCode: z.string().optional(), // ZATCA requirement placeholder
  customerId: z.string().optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = InsertInvoice & { _id: string; id: string; createdAt: Date };

// Flash Deals Schema
export const insertFlashDealSchema = z.object({
  productId: z.string(),
  title: z.string().default(""),
  titleEn: z.string().default(""),
  discountPercent: z.number().min(1).max(99).default(20),
  discountAmount: z.number().default(0),
  startTime: z.string(),
  endTime: z.string(),
  maxQuantity: z.number().default(0),
  soldCount: z.number().default(0),
  isActive: z.boolean().default(true),
  badgeColor: z.string().default("#ef4444"),
});
export type InsertFlashDeal = z.infer<typeof insertFlashDealSchema>;
export type FlashDeal = InsertFlashDeal & { _id: string; id: string; createdAt: Date };

// ─── Bundle Offers (e.g. "3 perfumes for 149", "6 perfumes for 299") ───
export const bundleScopeOptions = ["all", "categories", "products"] as const;
export type BundleScope = typeof bundleScopeOptions[number];

export const insertBundleOfferSchema = z.object({
  title: z.string().min(1),
  titleEn: z.string().default(""),
  description: z.string().default(""),
  descriptionEn: z.string().default(""),
  // Tier examples: [{ quantity: 3, price: 149 }, { quantity: 6, price: 299 }]
  tiers: z.array(z.object({
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    label: z.string().default(""),
    labelEn: z.string().default(""),
  })).min(1),
  // Which products qualify: "all", specific categories/products, or items at a specific price
  scope: z.enum([...bundleScopeOptions, "price"] as [string, ...string[]]).default("all"),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  triggerItemPrice: z.number().min(0).default(0), // 0 = no price filter
  // Display
  bannerImage: z.string().default(""),
  badgeText: z.string().default(""),
  badgeColor: z.string().default("#850935"),
  showOnHome: z.boolean().default(true),
  // Time window (ISO strings, optional — empty means always)
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  // Limits
  maxUsesTotal: z.number().int().min(0).default(0), // 0 = unlimited
  maxUsesPerCustomer: z.number().int().min(0).default(0),
  // State
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0), // higher = applied first
});
export type InsertBundleOffer = z.infer<typeof insertBundleOfferSchema>;
export type BundleOffer = InsertBundleOffer & {
  _id: string;
  id: string;
  usageCount: number;
  createdAt: Date;
  createdBy?: string;
  createdByName?: string;
};

// Return Request Schema
export const returnStatuses = ["pending", "approved", "rejected", "completed"] as const;
export type ReturnStatus = typeof returnStatuses[number];
export const insertReturnRequestSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    title: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  reason: z.string().min(1),
  reasonDetail: z.string().default(""),
  status: z.enum(returnStatuses).default("pending"),
  refundAmount: z.number().default(0),
  refundMethod: z.enum(["wallet", "original"]).default("wallet"),
  adminNote: z.string().default(""),
  images: z.array(z.string()).default([]),
});
export type InsertReturnRequest = z.infer<typeof insertReturnRequestSchema>;
export type ReturnRequest = InsertReturnRequest & { _id: string; id: string; createdAt: Date };

// Vendor / Multi-Seller Schema
export const vendorStatuses = ["pending", "active", "suspended"] as const;
export type VendorStatus = typeof vendorStatuses[number];

export const insertVendorSchema = z.object({
  userId: z.string(),
  storeName: z.string().min(1, "اسم المتجر مطلوب"),
  storeNameEn: z.string().default(""),
  description: z.string().default(""),
  logo: z.string().default(""),
  coverImage: z.string().default(""),
  status: z.enum(vendorStatuses).default("pending"),
  commissionRate: z.number().default(10),
  phone: z.string().default(""),
  email: z.string().default(""),
  bankIBAN: z.string().default(""),
  totalSales: z.number().default(0),
  pendingPayout: z.number().default(0),
  rating: z.number().default(0),
  reviewCount: z.number().default(0),
  tags: z.array(z.string()).default([]),
});
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = InsertVendor & { _id: string; id: string; createdAt: Date };

// Wishlist Schema
export const insertWishlistItemSchema = z.object({
  userId: z.string(),
  productId: z.string(),
});
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = InsertWishlistItem & { _id: string; id: string; createdAt: Date };

// Product Review Schema
export const insertProductReviewSchema = z.object({
  productId: z.string(),
  userId: z.string(),
  userName: z.string().default(""),
  rating: z.number().min(1).max(5),
  comment: z.string().default(""),
});
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = InsertProductReview & { _id: string; id: string; createdAt: Date };

// ─── Cart Session (for abandoned-cart tracking) ────────────────────────────
export const insertCartSessionSchema = z.object({
  userId: z.string().optional(),       // Logged-in user (preferred)
  sessionId: z.string().optional(),    // Anonymous session (fallback)
  items: z.array(z.object({
    productId: z.string(),
    variantSku: z.string().optional(),
    title: z.string(),
    image: z.string().optional(),
    price: z.number(),
    quantity: z.number(),
  })),
  total: z.number(),
  // Lifecycle
  reminderSent: z.boolean().default(false),
  reminderSentAt: z.date().optional(),
  manualReminderCount: z.number().default(0),
  convertedToOrderId: z.string().optional(),
  // Customer snapshot (for offline notifications by employees)
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
});
export type InsertCartSession = z.infer<typeof insertCartSessionSchema>;
export type CartSession = InsertCartSession & {
  _id: string; id: string;
  createdAt: Date; updatedAt: Date;
};

// ─── Cancellation & Refund Policy (admin configurable) ─────────────────────
export const insertCancellationPolicySchema = z.object({
  // Which order statuses allow customer-initiated cancellation
  customerCancelStatuses: z.array(z.enum(orderStatuses))
    .default(["new", "pending_payment", "processing"]),
  // Whether to allow cancellation up until shipping (out_for_delivery still cancelable)
  allowCancelUntilShipping: z.boolean().default(true),
  // Auto-refund target when paid online
  refundTarget: z.enum(["wallet", "original"]).default("wallet"),
  // Auto-restore stock when cancelled
  autoRestoreStock: z.boolean().default(true),
  // Notify customer + admin on cancellation
  notifyCustomer: z.boolean().default(true),
  notifyAdmin: z.boolean().default(true),
  // Returns / refund window after delivery (days)
  returnWindowDays: z.number().min(0).default(7),
  // Allow returns at all
  allowReturns: z.boolean().default(true),
  // Optional restocking fee on customer cancellations (percent)
  cancellationFeePercent: z.number().min(0).max(100).default(0),
});
export type InsertCancellationPolicy = z.infer<typeof insertCancellationPolicySchema>;
export type CancellationPolicy = InsertCancellationPolicy & { _id: string; id: string };

// API Types
export type LoginRequest = { username: string; password: string };
export type AuthResponse = User;
