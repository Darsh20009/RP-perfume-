/**
 * Order cancellation + auto-refund + stock restore.
 * Used by both customer-initiated cancellation and admin actions.
 */
import {
  OrderModel, ProductModel, UserModel,
  WalletTransactionModel, NotificationModel,
  CancellationPolicyModel,
} from "./models";
import { sendEmail } from "./email";
import { sendPushToUser, pushToUser } from "./notifications";

export async function getPolicy() {
  let policy: any = await CancellationPolicyModel.findOne({ key: "main" }).lean();
  if (!policy) {
    policy = await CancellationPolicyModel.create({ key: "main" });
    policy = policy.toObject();
  }
  return policy;
}

export interface CancelOptions {
  orderId: string;
  reason?: string;
  initiatedBy: "customer" | "admin" | "system";
  actorName?: string;
  bypassPolicy?: boolean; // admin can override
}

export async function cancelOrder(opts: CancelOptions) {
  const order: any = await OrderModel.findById(opts.orderId);
  if (!order) throw new Error("الطلب غير موجود");
  if (order.status === "cancelled") return { ok: true, alreadyCancelled: true, order };
  if (order.status === "completed" || order.status === "returned") {
    throw new Error("لا يمكن إلغاء طلب مكتمل أو مرتجع — استخدم خيار الاسترجاع");
  }

  const policy = await getPolicy();

  // Customer permission gating
  if (opts.initiatedBy === "customer" && !opts.bypassPolicy) {
    const allowed: string[] = policy.customerCancelStatuses || [];
    const stillAllowed = allowed.includes(order.status) ||
      (policy.allowCancelUntilShipping && order.status === "out_for_delivery");
    if (!stillAllowed) {
      throw new Error(`لا يمكن إلغاء الطلب وهو في حالة "${order.status}". تواصل مع خدمة العملاء.`);
    }
  }

  const previousStatus = order.status;
  const wasPaid = order.paymentStatus === "paid";

  // Optional cancellation fee (only for customer cancellations)
  const fee = (opts.initiatedBy === "customer" && policy.cancellationFeePercent > 0)
    ? Math.round(parseFloat(order.total) * policy.cancellationFeePercent) / 100
    : 0;

  // 1) Restore stock — atomic $inc to avoid lost-update races
  if (policy.autoRestoreStock !== false) {
    for (const item of (order.items || [])) {
      try {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        // Try to increment the matching variant's stock atomically
        const matched = await ProductModel.updateOne(
          { _id: item.productId, "variants.sku": item.variantSku },
          { $inc: { "variants.$.stock": qty } } as any
        );
        // Fallback: no variant matched (e.g., variantSku missing) — increment first variant
        if (!(matched as any).matchedCount && !(matched as any).nModified) {
          await ProductModel.updateOne(
            { _id: item.productId, "variants.0": { $exists: true } },
            { $inc: { "variants.0.stock": qty } } as any
          );
        }
      } catch (e: any) {
        console.error(`[Cancel] Could not restore stock for ${item.productId}:`, e?.message);
      }
    }
  }

  // 2) Refund (wallet credit) when paid and amount > 0
  let refundAmount = 0;
  if (wasPaid) {
    refundAmount = Math.max(0, parseFloat(order.total) - fee);
    if (refundAmount > 0 && order.userId) {
      try {
        const user: any = await UserModel.findById(order.userId);
        if (user) {
          const currentBalance = parseFloat(String(user.walletBalance || "0"));
          const newBalance = (currentBalance + refundAmount).toFixed(2);
          user.walletBalance = newBalance;
          await user.save();
          await WalletTransactionModel.create({
            userId: String(order.userId),
            amount: refundAmount,
            type: "refund",
            description: `استرداد طلب #${String(order._id).slice(-6).toUpperCase()}${fee > 0 ? ` (بعد رسوم إلغاء ${fee.toFixed(2)} ر.س)` : ""}`,
            reference: String(order._id),
            status: "completed",
          });
          order.paymentStatus = "refunded";
        }
      } catch (e: any) {
        console.error(`[Cancel] Refund failed:`, e?.message);
      }
    }
  }

  // 3) Update order status + history
  order.status = "cancelled";
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status: "cancelled",
    at: new Date(),
    note: `[${opts.initiatedBy}${opts.actorName ? `:${opts.actorName}` : ""}] ${opts.reason || ""}`.trim(),
  });
  await order.save();

  const ref = String(order._id).slice(-6).toUpperCase();

  // 4) Notifications (customer)
  if (policy.notifyCustomer !== false && order.userId) {
    try {
      await NotificationModel.create({
        userId: String(order.userId),
        type: refundAmount > 0 ? "success" : "info",
        title: "❌ تم إلغاء طلبك",
        body: refundAmount > 0
          ? `طلبك #${ref} أُلغي. تم استرداد ${refundAmount.toFixed(2)} ر.س لمحفظتك.`
          : `طلبك #${ref} أُلغي.${opts.reason ? ` السبب: ${opts.reason}` : ""}`,
        link: "/orders",
        icon: "❌",
      });
      await sendPushToUser(String(order.userId), {
        title: "تم إلغاء طلبك",
        body: refundAmount > 0
          ? `استُرد مبلغ ${refundAmount.toFixed(2)} ر.س لمحفظتك`
          : `طلبك #${ref}`,
        url: "/orders",
      });
      pushToUser(String(order.userId), {
        type: "order_status",
        orderId: String(order._id),
        status: "cancelled",
        refundAmount,
      });

      // Email
      const user: any = await UserModel.findById(order.userId).lean();
      if (user?.email) {
        const html = `
          <h2 style="color:#1a2744;margin:0 0 12px">تم إلغاء طلبك #${ref}</h2>
          <p style="color:#1a1a1a;line-height:1.8">مرحباً ${user.name || ""}،<br/>تم إلغاء طلبك بنجاح${opts.reason ? ` — السبب: <b>${opts.reason}</b>` : ""}.</p>
          ${refundAmount > 0 ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0"><b style="color:#166534">تم استرداد ${refundAmount.toFixed(2)} ر.س</b> إلى محفظتك.${fee > 0 ? `<br/><small>تم خصم ${fee.toFixed(2)} ر.س كرسوم إلغاء.</small>` : ""}</div>` : ""}
          <p style="color:#555;font-size:13px">إن كان لديك أي استفسار، تواصل معنا في أي وقت.</p>
        `;
        await sendEmail({
          to: user.email,
          toName: user.name,
          subject: `تم إلغاء طلبك #${ref} — رفيف العود`,
          html,
        }).catch(() => {});
      }
    } catch (e: any) {
      console.error("[Cancel] Notification error:", e?.message);
    }
  }

  return {
    ok: true,
    order,
    refundAmount,
    fee,
    restocked: policy.autoRestoreStock !== false,
    previousStatus,
  };
}

/** Returns true if customer can cancel this order right now. */
export async function canCustomerCancel(order: any): Promise<{ allowed: boolean; reason?: string }> {
  if (!order) return { allowed: false, reason: "الطلب غير موجود" };
  if (order.status === "cancelled") return { allowed: false, reason: "الطلب ملغى مسبقاً" };
  if (order.status === "completed") return { allowed: false, reason: "تم تسليم الطلب" };
  if (order.status === "returned") return { allowed: false, reason: "تم استرجاع الطلب" };
  if (order.status === "shipped") return { allowed: false, reason: "تم الشحن — لا يمكن الإلغاء" };
  const policy = await getPolicy();
  const allowed: string[] = policy.customerCancelStatuses || [];
  if (allowed.includes(order.status)) return { allowed: true };
  if (policy.allowCancelUntilShipping && order.status === "out_for_delivery") {
    return { allowed: true };
  }
  return { allowed: false, reason: "حالة الطلب لا تسمح بالإلغاء" };
}
