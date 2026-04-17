import type { User, InsertUser, Product, InsertProduct, Order, InsertOrder, Category, InsertCategory, WalletTransaction, InsertWalletTransaction, OrderStatus, ActivityLog, InsertActivityLog, Coupon, InsertCoupon, Branch, InsertBranch, Banner, InsertBanner, CashShift, InsertCashShift, BranchInventory, ShippingCompany, InsertShippingCompany, AuditLog, InsertAuditLog, Role, InsertRole, StockTransfer, InsertStockTransfer, Invoice, InsertInvoice, WishlistItem, InsertWishlistItem, ProductReview, InsertProductReview, Vendor, InsertVendor, FlashDeal, InsertFlashDeal, ReturnRequest, InsertReturnRequest } from "@shared/schema";
import { UserModel, ProductModel, OrderModel, CategoryModel, WalletTransactionModel, ActivityLogModel, CouponModel, BranchModel, BannerModel, CashShiftModel, ShippingCompanyModel, AuditLogModel, RoleModel, StockTransferModel, InvoiceModel, StoreSettingsModel, WishlistItemModel, ProductReviewModel, VendorModel, FlashDealModel, ReturnRequestModel } from "./models";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  verifyUserForReset(phone: string, name: string): Promise<User | undefined>;
  updateUserPassword(id: string, password: string): Promise<void>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, update: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUserAddresses(id: string, addresses: any[]): Promise<User>;
  updateUserWallet(id: string, newBalance: string): Promise<User>;
  
  // Invoices
  getInvoices(userId?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoiceStatus(id: string, status: string): Promise<Invoice>;

  // Activity Logs
  getActivityLogs(): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, update: Partial<InsertCoupon>): Promise<Coupon>;
  deleteCoupon(id: string): Promise<void>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: OrderStatus, shippingInfo?: { provider?: string, tracking?: string, deliveryDriver?: { name: string; phone?: string; assignedAt: Date }, historyNote?: string }): Promise<Order>;
  updateOrderReceipt(id: string, receiptUrl: string): Promise<Order>;
  updateOrderReturn(id: string, returnRequest: any): Promise<Order>;
  updateOrderPaymentStatus(id: string, paymentStatus: "pending" | "paid" | "failed" | "refunded", paymentMethod?: string): Promise<Order>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Wallet Transactions
  getWalletTransactions(userId: string): Promise<WalletTransaction[]>;
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;

  // Branches
  getBranches(): Promise<Branch[]>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, branch: Partial<InsertBranch>): Promise<Branch>;
  deleteBranch(id: string): Promise<void>;

  // Banners
  getBanners(): Promise<Banner[]>;
  createBanner(banner: InsertBanner): Promise<Banner>;
  updateBanner(id: string, banner: Partial<InsertBanner>): Promise<Banner>;
  deleteBanner(id: string): Promise<void>;

  // Cash Shifts
  getCashShifts(branchId?: string): Promise<CashShift[]>;
  createCashShift(shift: InsertCashShift): Promise<CashShift>;
  updateCashShift(id: string, shift: Partial<InsertCashShift>): Promise<CashShift>;
  getActiveShift(cashierId: string): Promise<CashShift | undefined>;
  
  // Branch Inventory
  getBranchInventory(branchId: string): Promise<BranchInventory[]>;
  updateBranchStock(id: string, stock: number): Promise<BranchInventory>;
  
  // Stock Transfers
  getStockTransfers(): Promise<StockTransfer[]>;
  createStockTransfer(transfer: InsertStockTransfer): Promise<StockTransfer>;
  updateStockTransferStatus(id: string, status: string, approvedBy?: string): Promise<StockTransfer>;

  // Shipping Companies
  getShippingCompanies(): Promise<ShippingCompany[]>;
  createShippingCompany(company: InsertShippingCompany): Promise<ShippingCompany>;
  updateShippingCompany(id: string, company: Partial<InsertShippingCompany>): Promise<ShippingCompany>;
  deleteShippingCompany(id: string): Promise<void>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Roles
  getRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: string): Promise<void>;

  // Store Settings
  getStoreSettings(): Promise<any>;
  updateStoreSettings(settings: any): Promise<any>;

  // Wishlist
  getWishlist(userId: string): Promise<WishlistItem[]>;
  getWishlistProductIds(userId: string): Promise<string[]>;
  addToWishlist(userId: string, productId: string): Promise<WishlistItem>;
  removeFromWishlist(userId: string, productId: string): Promise<void>;

  // Product Reviews
  getProductReviews(productId: string): Promise<ProductReview[]>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  getUserReviewForProduct(userId: string, productId: string): Promise<ProductReview | undefined>;

  // Low Stock
  getLowStockProducts(threshold?: number): Promise<Product[]>;

  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  getVendorByUserId(userId: string): Promise<Vendor | undefined>;
  createVendor(data: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, update: Partial<InsertVendor>): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;
  getVendorProducts(vendorId: string): Promise<Product[]>;
  getVendorOrders(vendorId: string): Promise<Order[]>;

  // Flash Deals
  getFlashDeals(activeOnly?: boolean): Promise<FlashDeal[]>;
  getFlashDeal(id: string): Promise<FlashDeal | undefined>;
  createFlashDeal(data: InsertFlashDeal): Promise<FlashDeal>;
  updateFlashDeal(id: string, update: Partial<InsertFlashDeal>): Promise<FlashDeal>;
  deleteFlashDeal(id: string): Promise<void>;
  getActiveFlashDeals(): Promise<FlashDeal[]>;

  // Return Requests
  getReturnRequests(filter?: { userId?: string; status?: string }): Promise<ReturnRequest[]>;
  getReturnRequest(id: string): Promise<ReturnRequest | undefined>;
  createReturnRequest(data: InsertReturnRequest): Promise<ReturnRequest>;
  updateReturnRequest(id: string, update: Partial<InsertReturnRequest>): Promise<ReturnRequest>;
}

export class MongoDBStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const user = await UserModel.findById(id).lean();
    return user ? { ...user, id: user._id.toString() } : undefined;
  }

  async getUserByUsername(phone: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ 
      $or: [
        { phone },
        { username: phone }
      ]
    }).lean();
    return user ? { ...user, id: user._id.toString() } : undefined;
  }

  async getUsers(): Promise<User[]> {
    const users = await UserModel.find().lean();
    return users.map(u => ({ ...u, id: u._id.toString(), permissions: u.permissions || [] }));
  }

  async updateUser(id: string, update: Partial<InsertUser>): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!user) throw new Error("User not found");
    return { ...user, id: user._id.toString(), permissions: user.permissions || [] };
  }

  async resetUserPassword(id: string, password: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { password });
  }

  async deleteUser(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id);
  }

  async verifyUserForReset(phone: string, name: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ phone, name }).lean();
    return user ? { ...user, id: (user as any)._id.toString() } : undefined;
  }

  async updateUserPassword(id: string, password: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { password, mustChangePassword: false });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = await UserModel.create(insertUser);
    return { ...user.toObject(), id: user._id.toString() };
  }

  async updateUserAddresses(id: string, addresses: any[]): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(id, { addresses }, { new: true }).lean();
    if (!user) throw new Error("User not found");
    return { ...user, id: user._id.toString() };
  }

  async updateUserWallet(id: string, newBalance: string): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(id, { walletBalance: newBalance }, { new: true }).lean();
    if (!user) throw new Error("User not found");
    return { ...user, id: user._id.toString() };
  }

  // Invoices
  async getInvoices(userId?: string): Promise<Invoice[]> {
    const query = userId ? { userId } : {};
    const invoices = await InvoiceModel.find(query).sort({ issueDate: -1 }).lean();
    return invoices.map(i => ({ ...i, id: i._id.toString() } as any));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const invoice = await InvoiceModel.findById(id).lean();
    return invoice ? { ...invoice, id: invoice._id.toString() } as any : undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const invoice = await InvoiceModel.create(insertInvoice);
    return { ...invoice.toObject(), id: invoice._id.toString() } as any;
  }

  async updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
    const invoice = await InvoiceModel.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!invoice) throw new Error("Invoice not found");
    return { ...invoice, id: invoice._id.toString() } as any;
  }

  // Activity Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    const logs = await ActivityLogModel.find().sort({ createdAt: -1 }).lean();
    return logs.map(l => ({ ...l, id: (l as any)._id.toString() } as any));
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const log = await ActivityLogModel.create(insertLog);
    return { ...log.toObject(), id: log._id.toString() };
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const coupons = await CouponModel.find().lean();
    return coupons.map(c => ({ ...c, id: (c as any)._id.toString() } as any));
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const coupon = await CouponModel.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') }, 
      isActive: true 
    }).lean();
    
    if (!coupon) return undefined;
    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) return undefined;
    if (coupon.usageLimit !== undefined && coupon.usageLimit !== null && (coupon.usageCount || 0) >= coupon.usageLimit) return undefined;

    return { ...coupon, id: coupon._id.toString() };
  }

  async createCoupon(insertCoupon: InsertCoupon): Promise<Coupon> {
    const coupon = await CouponModel.create(insertCoupon);
    return { ...coupon.toObject(), id: coupon._id.toString(), usageCount: 0 };
  }

  async updateCoupon(id: string, update: Partial<InsertCoupon>): Promise<Coupon> {
    const coupon = await CouponModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!coupon) throw new Error("Coupon not found");
    return { ...coupon, id: coupon._id.toString() };
  }

  async deleteCoupon(id: string): Promise<void> {
    await CouponModel.findByIdAndDelete(id);
  }

  // Products
  async getProducts(): Promise<Product[]> {
    const products = await ProductModel.find().lean();
    return products.map(p => ({ ...p, id: p._id.toString() }));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const product = await ProductModel.findById(id).lean();
    return product ? { ...product, id: product._id.toString() } : undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product = await ProductModel.create(insertProduct);
    return { ...product.toObject(), id: product._id.toString() };
  }

  async updateProduct(id: string, update: Partial<InsertProduct>): Promise<Product> {
    const product = await ProductModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!product) throw new Error("Product not found");
    return { ...product, id: product._id.toString() };
  }

  async deleteProduct(id: string): Promise<void> {
    await ProductModel.findByIdAndDelete(id);
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    const orders = await OrderModel.find().lean();
    return orders.map(o => ({ ...o, id: o._id.toString() }));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // 1. Deduct stock from products
    for (const item of insertOrder.items) {
      try {
        await ProductModel.findOneAndUpdate(
          { _id: item.productId, "variants.sku": item.variantSku },
          { $inc: { "variants.$.stock": -item.quantity } }
        );
      } catch (err) {
        console.error(`[STOCK] Failed to deduct stock:`, err);
      }
    }

    // 2. Handle Loyalty
    if (insertOrder.userId) {
      try {
        const orderTotal = Number(insertOrder.total);
        const pointsEarned = Math.floor(orderTotal / 10);
        await UserModel.findByIdAndUpdate(insertOrder.userId, {
          $inc: { loyaltyPoints: pointsEarned, totalSpent: orderTotal }
        });
      } catch (err) {
        console.error(`[LOYALTY] Failed to update loyalty:`, err);
      }
    }

    const order = await OrderModel.create({
      ...insertOrder,
      status: insertOrder.status || "new",
      paymentStatus: insertOrder.paymentStatus || "pending"
    });
    const result = { ...order.toObject(), id: order._id.toString() } as any;

    await this.createAuditLog({
      employeeId: insertOrder.cashierId || insertOrder.userId || "system",
      employeeName: "Order Placement",
      action: "create",
      targetType: "order",
      targetId: result.id,
      details: `New ${insertOrder.type} order: Total ${insertOrder.total}`
    });

    return result;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const orders = await OrderModel.find({ 
      $or: [{ userId: userId }, { userId: userId.toString() }]
    }).sort({ createdAt: -1 }).lean();
    return orders.map(o => ({ ...o, id: o._id.toString() } as any));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const order = await OrderModel.findById(id).lean();
    return order ? { ...order, id: order._id.toString() } as any : undefined;
  }

  async updateOrderStatus(id: string, status: OrderStatus, shippingInfo?: { provider?: string, tracking?: string, deliveryDriver?: { name: string; phone?: string; assignedAt: Date }, historyNote?: string }): Promise<Order> {
    const update: any = { status };
    if (shippingInfo?.provider) update.shippingProvider = shippingInfo.provider;
    if (shippingInfo?.tracking) update.trackingNumber = shippingInfo.tracking;
    if (shippingInfo?.deliveryDriver) update.deliveryDriver = shippingInfo.deliveryDriver;
    if (status === "completed") update.paymentStatus = "paid";

    const historyEntry = { status, at: new Date(), note: shippingInfo?.historyNote || "" };
    const order = await OrderModel.findByIdAndUpdate(
      id,
      { ...update, $push: { statusHistory: historyEntry } },
      { new: true }
    ).lean();
    if (!order) throw new Error("Order not found");
    return { ...order, id: order._id.toString() } as any;
  }

  async updateOrderReceipt(id: string, receiptUrl: string): Promise<Order> {
    const order = await OrderModel.findByIdAndUpdate(id, { bankTransferReceipt: receiptUrl, status: "pending_payment" }, { new: true }).lean();
    if (!order) throw new Error("Order not found");
    
    await this.createAuditLog({
      employeeId: "system",
      employeeName: "Bank Transfer System",
      action: "update",
      targetType: "order",
      targetId: id,
      details: `Bank transfer receipt uploaded for order ${id}`
    });

    return { ...order, id: order._id.toString() } as any;
  }

  async updateOrderReturn(id: string, returnRequest: any): Promise<Order> {
    const order = await OrderModel.findByIdAndUpdate(id, { returnRequest }, { new: true }).lean();
    if (!order) throw new Error("Order not found");
    return { ...order, id: order._id.toString() } as any;
  }

  async updateOrderPaymentStatus(id: string, paymentStatus: "pending" | "paid" | "failed" | "refunded", paymentMethod?: string): Promise<Order> {
    const update: any = { paymentStatus };
    if (paymentMethod) update.paymentMethod = paymentMethod;
    if (paymentStatus === "paid") update.status = "processing";
    
    const order = await OrderModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!order) throw new Error("Order not found");
    return { ...order, id: order._id.toString() } as any;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const categories = await CategoryModel.find().lean();
    return categories.map(c => ({ ...c, id: (c as any)._id.toString() }));
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const category = await CategoryModel.create(insertCategory);
    return { ...category.toObject(), id: category._id.toString() };
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category> {
    const updated = await CategoryModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    if (!updated) throw new Error("Category not found");
    return { ...updated, id: (updated as any)._id.toString() };
  }

  async deleteCategory(id: string): Promise<void> {
    await CategoryModel.findByIdAndDelete(id);
  }

  // Wallet Transactions
  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    const transactions = await WalletTransactionModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return transactions.map(t => ({
      ...t,
      id: t._id.toString(),
      _id: t._id.toString(),
      userId: t.userId.toString(),
      amount: Number(t.amount),
      type: t.type as any,
      description: t.description,
      createdAt: t.createdAt
    })) as WalletTransaction[];
  }

  async createWalletTransaction(insertTransaction: InsertWalletTransaction): Promise<WalletTransaction> {
    const transaction = await WalletTransactionModel.create(insertTransaction);
    return { ...transaction.toObject(), id: transaction._id.toString() };
  }

  // Branches
  async getBranches(): Promise<Branch[]> {
    const branches = await BranchModel.find().lean();
    return branches.map(b => ({ ...b, id: (b as any)._id.toString() } as any));
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const branch = await BranchModel.create(insertBranch);
    const result = { ...branch.toObject(), id: branch._id.toString() } as any;
    await this.createAuditLog({
      employeeId: "system",
      employeeName: "System",
      action: "create",
      targetType: "branch",
      targetId: result.id,
      details: `Created branch: ${insertBranch.name}`
    });
    return result;
  }

  async updateBranch(id: string, update: Partial<InsertBranch>): Promise<Branch> {
    const branch = await BranchModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!branch) throw new Error("Branch not found");
    return { ...branch, id: branch._id.toString() };
  }

  async deleteBranch(id: string): Promise<void> {
    await BranchModel.findByIdAndDelete(id);
  }

  // Banners
  async getBanners(): Promise<Banner[]> {
    const banners = await BannerModel.find().lean();
    return banners.map(b => ({ ...b, id: (b as any)._id.toString() } as any));
  }

  async createBanner(insertBanner: InsertBanner): Promise<Banner> {
    const banner = await BannerModel.create(insertBanner);
    return { ...banner.toObject(), id: banner._id.toString() };
  }

  async updateBanner(id: string, update: Partial<InsertBanner>): Promise<Banner> {
    const banner = await BannerModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!banner) throw new Error("Banner not found");
    return { ...banner, id: banner._id.toString() };
  }

  async deleteBanner(id: string): Promise<void> {
    await BannerModel.findByIdAndDelete(id);
  }

  // Cash Shifts
  async getCashShifts(branchId?: string): Promise<CashShift[]> {
    const query = branchId ? { branchId } : {};
    const shifts = await CashShiftModel.find(query).sort({ openedAt: -1 }).lean();
    return shifts.map(s => ({ ...s, id: (s as any)._id.toString() } as any));
  }

  async createCashShift(insertShift: InsertCashShift): Promise<CashShift> {
    const shift = await CashShiftModel.create(insertShift);
    return { ...shift.toObject(), id: shift._id.toString() };
  }

  async updateCashShift(id: string, update: Partial<InsertCashShift>): Promise<CashShift> {
    const shift = await CashShiftModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!shift) throw new Error("Shift not found");
    const result = { ...shift, id: shift._id.toString() } as any;

    if (update.status === "closed") {
      await this.createAuditLog({
        employeeId: result.cashierId,
        employeeName: "Cashier",
        action: "update",
        targetType: "cash_shift",
        targetId: result.id,
        details: `Closed shift: Final cash ${result.actualCash}, Mismatch ${result.difference}`
      });
    }
    return result;
  }

  async getActiveShift(cashierId: string): Promise<CashShift | undefined> {
    const shift = await CashShiftModel.findOne({ cashierId, status: "open" }).lean();
    return shift ? { ...shift, id: shift._id.toString() } : undefined;
  }

  // Branch Inventory
  async getBranchInventory(branchId: string): Promise<BranchInventory[]> {
    const products = await this.getProducts();
    const inventory: BranchInventory[] = [];
    for (const product of products) {
      const p = product as any;
      if (p.variants && p.variants.length > 0) {
        for (const variant of p.variants) {
          inventory.push({
            id: `${product.id}-${variant.sku}`,
            _id: `${product.id}-${variant.sku}`,
            branchId,
            productId: product.id,
            variantSku: variant.sku,
            stock: variant.stock,
            minStockLevel: 5,
            updatedAt: new Date()
          });
        }
      }
    }
    return inventory;
  }

  async updateBranchStock(id: string, stock: number): Promise<BranchInventory> {
    const [productId, variantSku] = id.split("-");
    const product = await ProductModel.findOneAndUpdate(
      { _id: productId, "variants.sku": variantSku },
      { $set: { "variants.$.stock": stock } },
      { new: true }
    ).lean();
    if (!product) throw new Error("Product or variant not found");
    const variant = (product as any).variants.find((v: any) => v.sku === variantSku);
    return {
      id: `${product._id}-${variantSku}`,
      _id: `${product._id}-${variantSku}`,
      branchId: "main",
      productId: product._id.toString(),
      variantSku: variantSku,
      stock: variant.stock,
      minStockLevel: 5,
      updatedAt: new Date()
    };
  }

  // Stock Transfers
  async getStockTransfers(): Promise<StockTransfer[]> {
    const transfers = await StockTransferModel.find().sort({ createdAt: -1 }).lean();
    return transfers.map(t => ({ ...t, id: (t as any)._id.toString() } as any));
  }

  async createStockTransfer(insertTransfer: InsertStockTransfer): Promise<StockTransfer> {
    const transfer = await StockTransferModel.create({ ...insertTransfer, createdAt: new Date() });
    return { ...transfer.toObject(), id: transfer._id.toString() };
  }

  async updateStockTransferStatus(id: string, status: string, approvedBy?: string): Promise<StockTransfer> {
    const transfer = await StockTransferModel.findById(id);
    if (!transfer) throw new Error("Transfer not found");
    if (status === "completed" && transfer.status !== "completed") {
      if (transfer.fromBranchId !== "central") {
        await ProductModel.findOneAndUpdate({ _id: transfer.productId, "variants.sku": transfer.variantSku }, { $inc: { "variants.$.stock": -transfer.quantity } });
      }
      if (transfer.toBranchId !== "central") {
        await ProductModel.findOneAndUpdate({ _id: transfer.productId, "variants.sku": transfer.variantSku }, { $inc: { "variants.$.stock": transfer.quantity } });
      }
    }
    const updated = await StockTransferModel.findByIdAndUpdate(id, { status, approvedBy }, { new: true }).lean();
    if (!updated) throw new Error("Update failed");
    return { ...updated, id: (updated as any)._id.toString() } as any;
  }

  // Shipping Companies
  async getShippingCompanies(): Promise<ShippingCompany[]> {
    const companies = await ShippingCompanyModel.find().lean();
    return companies.map(c => ({ ...c, id: (c as any)._id.toString() } as any));
  }

  async createShippingCompany(insertCompany: InsertShippingCompany): Promise<ShippingCompany> {
    const company = await ShippingCompanyModel.create(insertCompany);
    return { ...company.toObject(), id: company._id.toString() } as any;
  }

  async updateShippingCompany(id: string, update: Partial<InsertShippingCompany>): Promise<ShippingCompany> {
    const company = await ShippingCompanyModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!company) throw new Error("Shipping company not found");
    return { ...company, id: (company as any)._id.toString() } as any;
  }

  async deleteShippingCompany(id: string): Promise<void> {
    await ShippingCompanyModel.findByIdAndDelete(id);
  }

  // Audit Logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
    return logs.map(l => ({ ...l, id: (l as any)._id.toString() } as any));
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const log = await AuditLogModel.create(insertLog);
    return { ...log.toObject(), id: (log as any)._id.toString() } as any;
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    const roles = await RoleModel.find().lean();
    return roles.map(r => ({ ...r, id: (r as any)._id.toString() } as any));
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const role = await RoleModel.create(insertRole);
    return { ...role.toObject(), id: (role as any)._id.toString() } as any;
  }

  async updateRole(id: string, update: Partial<InsertRole>): Promise<Role> {
    const role = await RoleModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!role) throw new Error("Role not found");
    return { ...role, id: (role as any)._id.toString() } as any;
  }

  async deleteRole(id: string): Promise<void> {
    await RoleModel.findByIdAndDelete(id);
  }

  async getStoreSettings(): Promise<any> {
    let settings = await StoreSettingsModel.findOne({ key: "main" }).lean();
    if (!settings) {
      const created = await StoreSettingsModel.create({ key: "main" });
      settings = created.toObject() as any;
    }
    return { ...settings, id: (settings as any)._id?.toString() };
  }

  async updateStoreSettings(update: any): Promise<any> {
    const settings = await StoreSettingsModel.findOneAndUpdate(
      { key: "main" },
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    return { ...settings, id: (settings as any)._id?.toString() };
  }

  // Wishlist
  async getWishlist(userId: string): Promise<WishlistItem[]> {
    const items = await WishlistItemModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return items.map(i => ({ ...i, id: (i as any)._id.toString() } as any));
  }

  async getWishlistProductIds(userId: string): Promise<string[]> {
    const items = await WishlistItemModel.find({ userId }, { productId: 1 }).lean();
    return items.map((i: any) => i.productId);
  }

  async addToWishlist(userId: string, productId: string): Promise<WishlistItem> {
    const existing = await WishlistItemModel.findOne({ userId, productId });
    if (existing) return { ...existing.toObject(), id: (existing as any)._id.toString() } as any;
    const item = await WishlistItemModel.create({ userId, productId });
    return { ...item.toObject(), id: (item as any)._id.toString() } as any;
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    await WishlistItemModel.deleteOne({ userId, productId });
  }

  // Product Reviews
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    const reviews = await ProductReviewModel.find({ productId }).sort({ createdAt: -1 }).lean();
    return reviews.map(r => ({ ...r, id: (r as any)._id.toString() } as any));
  }

  async createProductReview(insertReview: InsertProductReview): Promise<ProductReview> {
    const review = await ProductReviewModel.create(insertReview);
    return { ...review.toObject(), id: (review as any)._id.toString() } as any;
  }

  async getUserReviewForProduct(userId: string, productId: string): Promise<ProductReview | undefined> {
    const review = await ProductReviewModel.findOne({ userId, productId }).lean();
    return review ? { ...review, id: (review as any)._id.toString() } as any : undefined;
  }

  // Low Stock
  async getLowStockProducts(threshold: number = 5): Promise<Product[]> {
    const products = await ProductModel.find().lean();
    return products
      .filter(p => {
        const total = ((p as any).variants || []).reduce((s: number, v: any) => s + (v.stock || 0), 0);
        return total <= threshold;
      })
      .map(p => ({ ...p, id: (p as any)._id.toString() } as any));
  }

  // Vendors
  async getVendors(): Promise<Vendor[]> {
    const vendors = await VendorModel.find().sort({ createdAt: -1 }).lean();
    return vendors.map(v => ({ ...v, id: (v as any)._id.toString() } as any));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    try {
      const v = await VendorModel.findById(id).lean();
      return v ? { ...v, id: (v as any)._id.toString() } as any : undefined;
    } catch { return undefined; }
  }

  async getVendorByUserId(userId: string): Promise<Vendor | undefined> {
    const v = await VendorModel.findOne({ userId }).lean();
    return v ? { ...v, id: (v as any)._id.toString() } as any : undefined;
  }

  async createVendor(data: InsertVendor): Promise<Vendor> {
    const v = await VendorModel.create(data);
    return { ...v.toObject(), id: (v as any)._id.toString() } as any;
  }

  async updateVendor(id: string, update: Partial<InsertVendor>): Promise<Vendor> {
    const v = await VendorModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!v) throw new Error("Vendor not found");
    return { ...v, id: (v as any)._id.toString() } as any;
  }

  async deleteVendor(id: string): Promise<void> {
    await VendorModel.findByIdAndDelete(id);
  }

  async getVendorProducts(vendorId: string): Promise<Product[]> {
    const products = await ProductModel.find({ vendorId }).lean();
    return products.map(p => ({ ...p, id: (p as any)._id.toString() } as any));
  }

  async getVendorOrders(vendorId: string): Promise<Order[]> {
    const products = await ProductModel.find({ vendorId }, { _id: 1 }).lean();
    const productIds = products.map(p => (p as any)._id.toString());
    const orders = await OrderModel.find({
      "items.productId": { $in: productIds }
    }).sort({ createdAt: -1 }).lean();
    return orders.map(o => ({ ...o, id: (o as any)._id.toString() } as any));
  }

  // Flash Deals
  async getFlashDeals(activeOnly?: boolean): Promise<FlashDeal[]> {
    const q = activeOnly ? { isActive: true } : {};
    const deals = await FlashDealModel.find(q).sort({ createdAt: -1 }).lean();
    return deals.map(d => ({ ...d, id: (d as any)._id.toString() } as any));
  }

  async getFlashDeal(id: string): Promise<FlashDeal | undefined> {
    try {
      const d = await FlashDealModel.findById(id).lean();
      return d ? { ...d, id: (d as any)._id.toString() } as any : undefined;
    } catch { return undefined; }
  }

  async createFlashDeal(data: InsertFlashDeal): Promise<FlashDeal> {
    const d = await FlashDealModel.create(data);
    return { ...d.toObject(), id: (d as any)._id.toString() } as any;
  }

  async updateFlashDeal(id: string, update: Partial<InsertFlashDeal>): Promise<FlashDeal> {
    const d = await FlashDealModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!d) throw new Error("Flash deal not found");
    return { ...d, id: (d as any)._id.toString() } as any;
  }

  async deleteFlashDeal(id: string): Promise<void> {
    await FlashDealModel.findByIdAndDelete(id);
  }

  async getActiveFlashDeals(): Promise<FlashDeal[]> {
    const now = new Date().toISOString();
    const deals = await FlashDealModel.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
    }).lean();
    return deals.map(d => ({ ...d, id: (d as any)._id.toString() } as any));
  }

  // Return Requests
  async getReturnRequests(filter?: { userId?: string; status?: string }): Promise<ReturnRequest[]> {
    const q: any = {};
    if (filter?.userId) q.userId = filter.userId;
    if (filter?.status) q.status = filter.status;
    const returns = await ReturnRequestModel.find(q).sort({ createdAt: -1 }).lean();
    return returns.map(r => ({ ...r, id: (r as any)._id.toString() } as any));
  }

  async getReturnRequest(id: string): Promise<ReturnRequest | undefined> {
    try {
      const r = await ReturnRequestModel.findById(id).lean();
      return r ? { ...r, id: (r as any)._id.toString() } as any : undefined;
    } catch { return undefined; }
  }

  async createReturnRequest(data: InsertReturnRequest): Promise<ReturnRequest> {
    const r = await ReturnRequestModel.create(data);
    return { ...r.toObject(), id: (r as any)._id.toString() } as any;
  }

  async updateReturnRequest(id: string, update: Partial<InsertReturnRequest>): Promise<ReturnRequest> {
    const r = await ReturnRequestModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!r) throw new Error("Return request not found");
    return { ...r, id: (r as any)._id.toString() } as any;
  }
}

export const storage = new MongoDBStorage();
