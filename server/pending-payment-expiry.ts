/**
 * Pending-payment auto-expiry worker.
 *
 * Orders that were created with status `pending_payment` (i.e. waiting for an
 * external gateway like Tabby/Tamara/Paymob/Apple Pay/Tap to confirm payment)
 * are auto-cancelled if the payment is not confirmed within
 * `EXPIRE_AFTER_MS`. On expiry we:
 *   1. Atomically flip status → "cancelled" (only if still pending_payment)
 *   2. Restore the reserved stock for every line item back to its variant
 *   3. Refund any wallet/cashback that was applied at checkout
 *   4. Notify the customer (and admins) once
 *
 * This prevents the "ghost order" problem where a user opens the gateway,
 * closes it without paying, and the order sits forever locking inventory.
 */
import { OrderModel, ProductModel, UserModel, WalletTransactionModel } from "./models";
import { fireNotify, fireNotifyAdmins } from "./notifications";

const EXPIRE_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const TICK_MS = 5 * 60 * 1000; // every 5 minutes
const GATEWAY_METHODS = ["tap", "apple_pay", "tabby", "tamara", "paymob"];

async function tick() {
  try {
    const cutoff = new Date(Date.now() - EXPIRE_AFTER_MS);
    const stale = await OrderModel.find({
      status: "pending_payment",
      paymentMethod: { $in: GATEWAY_METHODS },
      paymentStatus: { $ne: "paid" },
      createdAt: { $lt: cutoff },
    })
      .limit(50)
      .lean();

    for (const order of stale) {
      const orderId = String((order as any)._id);
      const shortRef = orderId.slice(-6).toUpperCase();
      try {
        // ── 1) Atomic guard: only act if still pending_payment.
        // This prevents racing with a webhook that confirms payment in the
        // same window the worker is processing.
        const updated = await OrderModel.findOneAndUpdate(
          { _id: (order as any)._id, status: "pending_payment" },
          {
            $set: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancellationReason: `لم يكتمل الدفع خلال ${EXPIRE_AFTER_MS / 60000} دقيقة — تم الإلغاء التلقائي`,
            },
            $push: {
              statusHistory: {
                status: "cancelled",
                at: new Date(),
                note: `[auto-expiry] gateway payment never confirmed within ${EXPIRE_AFTER_MS / 60000}min`,
              },
            },
          },
          { new: false } // return previous doc so we know we won the race
        );
        if (!updated) continue;

        // ── 2) Restore stock for every line item.
        for (const item of (order as any).items || []) {
          if (!item.productId || !item.variantSku) continue;
          await ProductModel.findOneAndUpdate(
            { _id: item.productId, "variants.sku": item.variantSku },
            { $inc: { "variants.$.stock": Number(item.quantity || 0) } }
          ).catch(() => {});
        }

        // ── 3) Refund any wallet/cashback applied at checkout.
        const walletApplied = Number((order as any).walletAmountApplied || 0);
        if (walletApplied > 0 && (order as any).userId) {
          await UserModel.findByIdAndUpdate((order as any).userId, {
            $inc: { walletBalance: walletApplied },
          }).catch(() => {});
          await WalletTransactionModel.create({
            userId: (order as any).userId,
            type: "refund",
            amount: walletApplied,
            description: `استرجاع رصيد المحفظة بعد إلغاء الطلب #${shortRef} (انتهت مهلة الدفع)`,
            orderId,
          }).catch(() => {});
        }

        // ── 4) One-shot customer notification.
        if ((order as any).userId) {
          await fireNotify(
            String((order as any).userId),
            "❌ تم إلغاء طلبك تلقائياً",
            `طلبك #${shortRef} لم يكتمل الدفع خلال ${EXPIRE_AFTER_MS / 60000} دقيقة، فتم إلغاؤه وإرجاع المنتجات للمخزون. يمكنك إعادة الطلب في أي وقت.`,
            { type: "warning", link: "/orders", icon: "⏰", webPush: true }
          ).catch(() => {});
        }

        // ── 5) Admin heads-up (silent — no push).
        await fireNotifyAdmins(
          "⏰ إلغاء تلقائي لطلب غير مدفوع",
          `طلب #${shortRef} (${(order as any).paymentMethod}) ألغي تلقائياً بعد ${EXPIRE_AFTER_MS / 60000} دقيقة بدون تأكيد دفع.`,
          { type: "info", link: "/admin", icon: "⏰" }
        ).catch(() => {});

        console.log(
          `[PendingPaymentExpiry] cancelled stale order ${orderId} (method=${(order as any).paymentMethod})`
        );
      } catch (err: any) {
        console.error(`[PendingPaymentExpiry] failed for ${orderId}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.error("[PendingPaymentExpiry] tick error:", err?.message);
  }
}

export function startPendingPaymentExpiryWorker() {
  console.log(
    `[PendingPaymentExpiry] worker started (expire>=${EXPIRE_AFTER_MS / 60000}min, tick=${TICK_MS / 60000}min)`
  );
  tick().catch(() => {});
  setInterval(() => tick().catch(() => {}), TICK_MS);
}
