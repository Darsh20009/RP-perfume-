/**
 * Pickup-order expiry worker.
 *
 * Pickup orders that remain uncollected for `EXPIRE_AFTER_MS` are
 * automatically cancelled and their reserved stock is released
 * back to the originating product variant. The customer is
 * notified once when the expiry is processed.
 */
import { OrderModel, ProductModel } from "./models";
import { fireNotify, fireNotifyAdmins } from "./notifications";

const EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const TICK_MS = 60 * 60 * 1000;

async function tick() {
  try {
    const cutoff = new Date(Date.now() - EXPIRE_AFTER_MS);
    const stale = await OrderModel.find({
      shippingMethod: "pickup",
      pickupVerified: { $ne: true },
      status: { $in: ["new", "processing", "ready_for_pickup"] },
      createdAt: { $lt: cutoff },
    }).limit(50).lean();

    for (const order of stale) {
      try {
        // Restore stock for each line item
        for (const item of (order as any).items || []) {
          if (!item.productId || !item.variantSku) continue;
          await ProductModel.findOneAndUpdate(
            { _id: item.productId, "variants.sku": item.variantSku },
            { $inc: { "variants.$.stock": Number(item.quantity || 0) } }
          ).catch(() => {});
        }

        await OrderModel.updateOne(
          { _id: (order as any)._id },
          {
            $set: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancellationReason: "انتهت مهلة الاستلام (7 أيام)",
            },
          }
        );

        // Notify customer
        if ((order as any).userId) {
          await fireNotify(
            String((order as any).userId),
            "❌ انتهت مهلة استلام طلبك",
            `طلبك #${String((order as any)._id).slice(-6).toUpperCase()} لم يتم استلامه خلال 7 أيام، تم إلغاؤه وإرجاع المنتجات للمخزون.`,
            { type: "warning", link: "/orders", icon: "⏰", webPush: true }
          ).catch(() => {});
        }

        // Notify admins
        await fireNotifyAdmins(
          "⏰ إلغاء استلام منتهي",
          `طلب #${String((order as any)._id).slice(-6).toUpperCase()} ألغي تلقائياً بعد 7 أيام بدون استلام.`,
          { type: "info", link: "/admin", icon: "⏰" }
        ).catch(() => {});

        console.log(`[PickupExpiry] cancelled stale pickup order ${(order as any)._id}`);
      } catch (err: any) {
        console.error(`[PickupExpiry] failed for ${(order as any)._id}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.error("[PickupExpiry] tick error:", err?.message);
  }
}

export function startPickupExpiryWorker() {
  console.log(`[PickupExpiry] worker started (expire>=${EXPIRE_AFTER_MS / (24 * 3600 * 1000)}d, tick=${TICK_MS / 60000}m)`);
  tick().catch(() => {});
  setInterval(() => tick().catch(() => {}), TICK_MS);
}
