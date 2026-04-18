import mongoose, { Schema } from "mongoose";
import type { User, Product, Order, Category, WalletTransaction, ActivityLog, Coupon, Branch, Banner, CashShift, ShippingCompany, AuditLog, Role, StockTransfer, Invoice } from "@shared/schema";

const userSchema = new Schema<User>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, default: "" },
    role: { type: String, enum: ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "customer", "support", "cashier", "vendor"], default: "customer" },
    permissions: [String],
    branchId: { type: String },
    loginType: { type: String, enum: ["dashboard", "pos", "both"], default: "dashboard" },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    walletBalance: { type: String, default: "0" },
    addresses: [{
      id: String,
      name: String,
      city: String,
      district: String,
      street: String,
      building: String,
      floor: String,
      apartment: String,
      phone: String,
      notes: String,
      isDefault: { type: Boolean, default: false },
    }],
    loyaltyPoints: { type: Number, default: 0 },
    loyaltyTier: { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
    totalSpent: { type: Number, default: 0 },

    // ── Account activation (employees) ──
    activationToken: { type: String, index: true, sparse: true },
    activationExpires: { type: Date },

    // ── Password reset (customers + employees) ──
    passwordResetCode: { type: String },        // 6-digit OTP (email path)
    passwordResetCodeExpires: { type: Date },
    passwordResetToken: { type: String, index: true, sparse: true }, // single-use token after verify
    passwordResetTokenExpires: { type: Date },
    passwordResetAttempts: { type: Number, default: 0 }, // throttle brute force on OTP / verify
  },
  { timestamps: true }
);

const cashShiftSchema = new Schema<CashShift>(
  {
    branchId: { type: String, required: true },
    cashierId: { type: String, required: true },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    openingBalance: { type: Number, required: true },
    closingBalance: Number,
    actualCash: Number,
    difference: Number,
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
  },
  { timestamps: true }
);

const vendorSchema = new Schema(
  {
    userId: { type: String, required: true },
    storeName: { type: String, required: true },
    storeNameEn: { type: String, default: "" },
    description: { type: String, default: "" },
    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
    commissionRate: { type: Number, default: 10 },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    bankIBAN: { type: String, default: "" },
    totalSales: { type: Number, default: 0 },
    pendingPayout: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: String, required: true },
    cost: { type: String, required: true },
    images: [String],
    categoryId: { type: String, default: "" },
    categoryIds: { type: [String], default: [] },
    vendorId: { type: String, default: null },
    variants: [{
      color: String,
      size: String,
      sku: String,
      stock: Number,
      cost: { type: Number, default: 0 },
      image: String,
    }],
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const orderSchema = new Schema<Order>(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: ["online", "pos"], default: "online" },
    branchId: String,
    cashierId: String,
    status: { type: String, enum: ["new", "pending_payment", "processing", "out_for_delivery", "shipped", "completed", "cancelled"], default: "new" },
    total: { type: String, required: true },
    subtotal: { type: String, required: true },
    vatAmount: { type: String, required: true },
    shippingCost: { type: String, required: true },
    tapCommission: { type: String, required: true },
    netProfit: { type: String, required: true },
    couponCode: String,
    discountAmount: { type: String, default: "0" },
    items: [{
      productId: String,
      variantSku: String,
      quantity: Number,
      price: Number,
      cost: Number,
      title: String,
    }],
    shippingMethod: { type: String, enum: ["pickup", "delivery"], required: true },
    shippingAddress: {
      city: String,
      street: String,
      country: String,
    },
    pickupBranch: String,
    paymentMethod: { type: String, enum: ["cod", "bank_transfer", "apple_pay", "card", "cash", "wallet", "tap", "stc_pay", "tamara", "tabby"], required: true },
    bankTransferReceipt: String,
    paymentStatus: { type: String, default: "pending" },
    shippingProvider: { type: String },
    trackingNumber: { type: String },
    deliveryDriver: {
      name: String,
      phone: String,
      assignedAt: Date,
    },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
    returnRequest: {
      status: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
      reason: String,
      type: { type: String, enum: ["return", "exchange"] },
      createdAt: Date,
    },
  },
  { timestamps: true }
);

const categorySchema = new Schema<Category>(
  {
    name: { type: String, required: true },
    nameAr: { type: String },
    slug: { type: String, required: true, unique: true },
    image: { type: String },
    description: { type: String },
    parentId: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: false }
);

const walletTransactionSchema = new Schema<WalletTransaction>(
  {
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["deposit", "withdrawal", "payment", "refund"], required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

const activityLogSchema = new Schema<ActivityLog>(
  {
    employeeId: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: String,
    details: String,
  },
  { timestamps: true }
);

const couponSchema = new Schema<Coupon>(
  {
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ["percentage", "fixed", "cashback"], required: true },
    value: { type: Number, required: true },
    maxCashback: Number,
    description: String,
    expiryDate: Date,
    usageLimit: Number,
    perUserLimit: { type: Number, default: 1 },
    minOrderAmount: Number,
    targetCategoryIds: [String],
    targetProductIds: [String],
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const branchSchema = new Schema<Branch>(
  {
    name: { type: String, required: true },
    location: String,
    phone: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const bannerSchema = new Schema<Banner>(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    link: String,
    type: { type: String, enum: ["banner", "popup"], default: "banner" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const shippingCompanySchema = new Schema<ShippingCompany>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    estimatedDays: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    storageXCode: String,
  },
  { timestamps: true }
);

const auditLogSchema = new Schema<AuditLog>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: String,
    changes: { type: Schema.Types.Mixed },
    details: String,
    ipAddress: String,
  },
  { timestamps: true }
);

const roleSchema = new Schema<Role>(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    permissions: [String],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const stockTransferSchema = new Schema<StockTransfer>(
  {
    fromBranchId: { type: String, required: true },
    toBranchId: { type: String, required: true },
    productId: { type: String, required: true },
    variantSku: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending" },
    requestedBy: { type: String, required: true },
    approvedBy: String,
    notes: String,
  },
  { timestamps: true }
);

const invoiceSchema = new Schema<Invoice>(
  {
    userId: { type: String, required: true },
    orderId: String,
    invoiceNumber: { type: String, required: true, unique: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, enum: ["draft", "issued", "paid", "void", "refunded"], default: "draft" },
    items: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      taxRate: { type: Number, default: 15 },
      taxAmount: Number,
      total: Number,
    }],
    subtotal: Number,
    taxTotal: Number,
    total: Number,
    notes: String,
    qrCode: String,
  },
  { timestamps: true }
);

// Notification Model
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: "" },
    icon: { type: String, default: "🔔" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Push Subscription Model (Web Push VAPID)
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<User>("User", userSchema);
export const ProductModel = mongoose.model<Product>("Product", productSchema);
export const OrderModel = mongoose.model<Order>("Order", orderSchema);
export const CategoryModel = mongoose.model<Category>("Category", categorySchema);
export const WalletTransactionModel = mongoose.model<WalletTransaction>("WalletTransaction", walletTransactionSchema);
export const ActivityLogModel = mongoose.model<ActivityLog>("ActivityLog", activityLogSchema);
export const CouponModel = mongoose.model<Coupon>("Coupon", couponSchema);
export const BranchModel = mongoose.model<Branch>("Branch", branchSchema);
export const BannerModel = mongoose.model<Banner>("Banner", bannerSchema);
export const CashShiftModel = mongoose.model<CashShift>("CashShift", cashShiftSchema);
export const ShippingCompanyModel = mongoose.model<ShippingCompany>("ShippingCompany", shippingCompanySchema);
export const AuditLogModel = mongoose.model<AuditLog>("AuditLog", auditLogSchema);
export const RoleModel = mongoose.model<Role>("Role", roleSchema);
export const StockTransferModel = mongoose.model<StockTransfer>("StockTransfer", stockTransferSchema);
export const InvoiceModel = mongoose.model<Invoice>("Invoice", invoiceSchema);
const storeSettingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    storeName: { type: String, default: "رفيف العود" },
    storeNameAr: { type: String, default: "رفيف العود" },
    storePhone: { type: String, default: "" },
    storeEmail: { type: String, default: "rf-purfume@outlook.com" },
    storeAddress: { type: String, default: "" },
    vatNumber: { type: String, default: "" },
    crNumber: { type: String, default: "0000203202" },
    // Bank transfer details
    bankName: { type: String, default: "مصرف الراجحي" },
    bankAccountHolder: { type: String, default: "رفيف العود" },
    bankIBAN: { type: String, default: "SA6280000501608016226411" },
    bankAccountNumber: { type: String, default: "501000010006086226411" },
    bankLogo: { type: String, default: "" },
    // Payment methods toggle
    paymentMethods: {
      wallet: { type: Boolean, default: true },
      tap: { type: Boolean, default: true },
      stc_pay: { type: Boolean, default: true },
      apple_pay: { type: Boolean, default: true },
      bank_transfer: { type: Boolean, default: true },
      tamara: { type: Boolean, default: true },
      tabby: { type: Boolean, default: true },
    },
    // Shipping settings
    freeShippingThreshold: { type: Number, default: 0 },
    // Special section images (Sale / Best Sellers / New Arrivals icons)
    saleSectionImage: { type: String, default: "" },
    bestSellersSectionImage: { type: String, default: "" },
    newArrivalsSectionImage: { type: String, default: "" },
    // Social links
    instagramUrl: { type: String, default: "" },
    twitterUrl: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

const wishlistItemSchema = new Schema(
  {
    userId: { type: String, required: true },
    productId: { type: String, required: true },
  },
  { timestamps: true }
);

const productReviewSchema = new Schema(
  {
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

const flashDealSchema = new Schema(
  {
    productId: { type: String, required: true },
    title: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    discountPercent: { type: Number, default: 20 },
    discountAmount: { type: Number, default: 0 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    maxQuantity: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    badgeColor: { type: String, default: "#ef4444" },
  },
  { timestamps: true }
);

const returnRequestSchema = new Schema(
  {
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    items: [{
      productId: String,
      title: String,
      quantity: Number,
      price: Number,
    }],
    reason: { type: String, required: true },
    reasonDetail: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "completed"], default: "pending" },
    refundAmount: { type: Number, default: 0 },
    refundMethod: { type: String, enum: ["wallet", "original"], default: "wallet" },
    adminNote: { type: String, default: "" },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const FlashDealModel = mongoose.model("FlashDeal", flashDealSchema);
export const ReturnRequestModel = mongoose.model("ReturnRequest", returnRequestSchema);
export const VendorModel = mongoose.model("Vendor", vendorSchema);
export const WishlistItemModel = mongoose.model("WishlistItem", wishlistItemSchema);
export const ProductReviewModel = mongoose.model("ProductReview", productReviewSchema);
export const NotificationModel = mongoose.model("Notification", notificationSchema);
export const PushSubscriptionModel = mongoose.model("PushSubscription", pushSubscriptionSchema);
export const StoreSettingsModel = mongoose.model("StoreSettings", storeSettingsSchema);

const marketingCampaignSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["banner", "popup", "notification", "discount"], default: "banner" },
    title: { type: String, default: "" },
    titleAr: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    link: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
    targetAudience: { type: String, default: "all" },
  },
  { timestamps: true }
);

export const MarketingCampaignModel = mongoose.model("MarketingCampaign", marketingCampaignSchema);

// ─── Cart Session (abandoned cart tracking) ───────────────────────────────
const cartSessionSchema = new Schema(
  {
    userId: { type: String, index: true },
    sessionId: { type: String, index: true },
    items: [{
      productId: String,
      variantSku: String,
      title: String,
      image: String,
      price: Number,
      quantity: Number,
    }],
    total: { type: Number, default: 0 },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: Date,
    manualReminderCount: { type: Number, default: 0 },
    convertedToOrderId: String,
    customerName: String,
    customerPhone: String,
    customerEmail: String,
  },
  { timestamps: true }
);
cartSessionSchema.index({ updatedAt: 1, reminderSent: 1, convertedToOrderId: 1 });
export const CartSessionModel = mongoose.model("CartSession", cartSessionSchema);

// ─── Cancellation & Refund Policy ─────────────────────────────────────────
const cancellationPolicySchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    customerCancelStatuses: {
      type: [String],
      default: ["new", "pending_payment", "processing"],
    },
    allowCancelUntilShipping: { type: Boolean, default: true },
    refundTarget: { type: String, enum: ["wallet", "original"], default: "wallet" },
    autoRestoreStock: { type: Boolean, default: true },
    notifyCustomer: { type: Boolean, default: true },
    notifyAdmin: { type: Boolean, default: true },
    returnWindowDays: { type: Number, default: 7 },
    allowReturns: { type: Boolean, default: true },
    cancellationFeePercent: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const CancellationPolicyModel = mongoose.model("CancellationPolicy", cancellationPolicySchema);

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 PERFORMANCE INDEXES — defined together for clarity
// Created automatically by Mongoose on model init (background: true by default).
// Tuned for the hottest queries in this app:
//   • orders by user, by status, by date, by branch
//   • products by category, by featured, full-text search-friendly
//   • notifications by user (paginated by createdAt desc)
//   • activity / audit logs by employee + date
//   • cart sessions by phase + updatedAt (already partially defined above)
// ═══════════════════════════════════════════════════════════════════════════

// Users — phone is the de-facto login key
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// Products
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ name: "text", description: "text", brand: "text" } as any, { weights: { name: 5, brand: 3, description: 1 } } as any);
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });

// Orders — biggest hot table
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ branchId: 1, type: 1, createdAt: -1 });
orderSchema.index({ trackingNumber: 1 }, { sparse: true });

// Notifications — listed often per user, ordered desc
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

// Activity / Audit logs
activityLogSchema.index({ employeeId: 1, createdAt: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ employeeId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Wallet & invoices
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ orderId: 1 });

// Coupons (lookup by code is unique; usage by user not modelled here)
couponSchema.index({ isActive: 1, expiryDate: 1 });

// Reviews / wishlist
productReviewSchema.index({ productId: 1, createdAt: -1 });
wishlistItemSchema.index({ userId: 1 });

// Banners / categories ordering
bannerSchema.index({ isActive: 1, type: 1 });
categorySchema.index({ parentId: 1, sortOrder: 1 });

// Marketing campaigns
marketingCampaignSchema.index({ status: 1, scheduledFor: 1 });

// Stock transfers
stockTransferSchema.index({ status: 1, createdAt: -1 });

// Push subscriptions — userId already indexed inline on schema definition

