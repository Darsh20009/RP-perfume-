/**
 * Abandoned cart tracking & automatic email/push reminders.
 *
 * Flow:
 *  - Client posts cart updates to /api/cart/sync (created on first sync, updated thereafter).
 *  - When an order is created, the matching cart is marked converted (not reminded).
 *  - A background loop (every 60s) finds carts idle for >= 5 minutes that
 *    haven't been reminded yet AND have a logged-in user with email/phone
 *    AND were not converted, and sends a single auto-reminder.
 *  - Employees can manually re-notify any abandoned cart with optional discount.
 */
import { CartSessionModel, UserModel, OrderModel, CouponModel } from "./models";
import { sendEmail } from "./email";
import { pushToUser, fireNotify } from "./notifications";

const ABANDON_AFTER_MS = 5 * 60 * 1000;       // 5 minutes
const TICK_MS = 60 * 1000;                    // run every 60s
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days → cleanup

function ref(c: any) { return String(c._id).slice(-6).toUpperCase(); }

function buildReminderHtml(opts: {
  customerName?: string;
  items: any[];
  total: number;
  discountCode?: string;
  discountPercent?: number;
}) {
  const lines = (opts.items || [])
    .slice(0, 6)
    .map(i => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee">
          <div style="font-weight:700;color:#1a1a1a">${i.title}</div>
          <div style="color:#888;font-size:12px">الكمية: ${i.quantity}</div>
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;color:#1a2744;font-weight:700">
          ${(i.price * i.quantity).toFixed(2)} ر.س
        </td>
      </tr>`).join("");

  const couponBlock = opts.discountCode ? `
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px dashed #c9a96e;border-radius:12px;padding:18px;margin:18px 0;text-align:center">
      <div style="font-size:12px;color:#78350f;font-weight:700;letter-spacing:.2em">🎁 خصم خاص لك</div>
      <div style="font-size:32px;color:#1a2744;font-weight:900;margin:8px 0">${opts.discountPercent}%</div>
      <div style="font-family:monospace;font-size:18px;font-weight:900;color:#1a2744;background:#fff;padding:8px 16px;border-radius:8px;display:inline-block;letter-spacing:.15em">${opts.discountCode}</div>
      <div style="font-size:11px;color:#92400e;margin-top:8px">استخدم الكود عند إتمام الطلب</div>
    </div>` : "";

  return `
    <h2 style="color:#1a2744;margin:0 0 12px;font-size:22px">سلتك تنتظرك 🌸</h2>
    <p style="color:#1a1a1a;line-height:1.8;margin:0 0 16px">
      مرحباً ${opts.customerName || "صديقنا الكريم"}،<br/>
      لاحظنا أنك تركت بعض العطور الفاخرة في سلتك. هي بانتظارك!
    </p>
    ${couponBlock}
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fafafa;border-radius:8px;overflow:hidden">
      ${lines}
      <tr>
        <td style="padding:12px;font-weight:900;color:#1a2744">الإجمالي</td>
        <td style="padding:12px;text-align:left;font-weight:900;color:#c9a96e;font-size:18px">${opts.total.toFixed(2)} ر.س</td>
      </tr>
    </table>
    <div style="text-align:center;margin:24px 0">
      <a href="/cart" style="background:linear-gradient(135deg,#1a2744,#243154);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;display:inline-block;font-weight:700;letter-spacing:.05em">إكمال الطلب الآن →</a>
    </div>
    <p style="color:#888;font-size:11px;text-align:center;margin-top:20px">
      كميات محدودة من العطور الفاخرة • التوصيل لجميع مناطق المملكة
    </p>
  `;
}

/** Send a reminder (email + push + notification) for one cart. */
async function sendReminder(cart: any, opts: {
  customDiscountPercent?: number;
  customMessage?: string;
  manual?: boolean;
} = {}) {
  if (!cart.userId) return { ok: false, reason: "no-user" };
  const user: any = await UserModel.findById(cart.userId).lean();
  if (!user) return { ok: false, reason: "user-not-found" };

  // Generate one-time coupon if discount requested
  let discountCode: string | undefined;
  let discountPercent: number | undefined;
  if (opts.customDiscountPercent && opts.customDiscountPercent > 0) {
    discountPercent = Math.min(50, Math.round(opts.customDiscountPercent));
    discountCode = `RF${ref(cart)}${Math.floor(Math.random() * 90 + 10)}`;
    try {
      await CouponModel.create({
        code: discountCode,
        discountType: "percentage",
        discountValue: discountPercent,
        minPurchase: 0,
        maxUses: 1,
        usageCount: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        userId: String(cart.userId), // restricts to this user (if schema supports)
      } as any);
    } catch (e: any) {
      console.error("[CartReminder] coupon create failed:", e?.message);
    }
  }

  const itemCount = (cart.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);

  // Unified 3-layer notification (DB + WS + Web Push)
  try {
    await fireNotify(
      String(cart.userId),
      discountCode ? `🎁 خصم ${discountPercent}% لإكمال طلبك` : "🌸 سلتك تنتظرك",
      discountCode
        ? `استخدم الكود ${discountCode} للحصول على خصم ${discountPercent}% — ${itemCount} منتجات بانتظارك`
        : `${itemCount} منتجات في سلتك بقيمة ${cart.total.toFixed(2)} ر.س`,
      { type: "info", link: "/cart", icon: discountCode ? "🎁" : "🛒" }
    );
    // Extra real-time payload (lets the cart icon badge update live)
    pushToUser(String(cart.userId), {
      type: "cart_reminder",
      itemCount,
      total: cart.total,
      discountCode,
    });
  } catch {}

  // Email
  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: discountCode
          ? `🎁 خصم ${discountPercent}% خاص — عطور آر اف`
          : "🌸 سلتك تنتظرك — عطور آر اف",
        html: (opts.customMessage ? `<p style="background:#f5f5f0;padding:12px;border-right:3px solid #c9a96e;color:#1a2744">${opts.customMessage}</p>` : "") +
              buildReminderHtml({
                customerName: user.name,
                items: cart.items,
                total: cart.total,
                discountCode,
                discountPercent,
              }),
      });
    } catch (e: any) {
      console.error("[CartReminder] email failed:", e?.message);
    }
  }

  // Mark
  cart.reminderSent = true;
  cart.reminderSentAt = new Date();
  if (opts.manual) cart.manualReminderCount = (cart.manualReminderCount || 0) + 1;
  await CartSessionModel.updateOne({ _id: cart._id }, {
    $set: {
      reminderSent: true,
      reminderSentAt: cart.reminderSentAt,
    },
    $inc: opts.manual ? { manualReminderCount: 1 } : {},
  });

  return { ok: true, discountCode, discountPercent, channel: user.email ? "email+push" : "push" };
}

/** Background tick: find idle carts and remind. */
async function tick() {
  try {
    const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
    const stale = new Date(Date.now() - STALE_AFTER_MS);

    // Cleanup very old carts
    await CartSessionModel.deleteMany({ updatedAt: { $lt: stale } }).catch(() => {});

    // Find candidates: idle ≥5min, not reminded yet, not converted, has user
    const candidates = await CartSessionModel.find({
      updatedAt: { $lt: cutoff },
      reminderSent: { $ne: true },
      $or: [{ convertedToOrderId: { $exists: false } }, { convertedToOrderId: null }, { convertedToOrderId: "" }],
      userId: { $exists: true, $ne: null },
      "items.0": { $exists: true },
    } as any).limit(30).lean();

    let sent = 0;
    for (const cart of candidates) {
      try {
        // Atomic claim — prevents duplicate sends across overlapping ticks
        const claim = await CartSessionModel.findOneAndUpdate(
          { _id: cart._id, reminderSent: { $ne: true } },
          { $set: { reminderSent: true, reminderSentAt: new Date() } },
          { new: true }
        ).lean();
        if (!claim) continue; // someone else claimed it
        await sendReminder(claim);
        sent++;
      } catch (e: any) {
        console.error(`[CartTick] reminder failed for ${cart._id}:`, e?.message);
      }
    }
    if (sent > 0) {
      console.log(`[CartTick] Sent ${sent} cart reminders`);
    }
  } catch (e: any) {
    console.error("[CartTick] error:", e?.message);
  }
}

let started = false;
export function startAbandonedCartWorker() {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS);
  console.log(`[AbandonedCarts] worker started (idle≥${ABANDON_AFTER_MS / 1000}s, tick=${TICK_MS / 1000}s)`);
}

// Manual reminder for employee panel
export async function notifyCart(cartId: string, opts: {
  customDiscountPercent?: number;
  customMessage?: string;
}) {
  const cart: any = await CartSessionModel.findById(cartId);
  if (!cart) throw new Error("السلة غير موجودة");
  if (cart.convertedToOrderId) throw new Error("هذه السلة تحوّلت إلى طلب بالفعل");
  return await sendReminder(cart, { ...opts, manual: true });
}

// When an order is created — link & mark converted
export async function markCartConverted(userId: string | undefined, orderId: string) {
  if (!userId) return;
  try {
    await CartSessionModel.updateMany(
      { userId, $or: [{ convertedToOrderId: { $exists: false } }, { convertedToOrderId: null }, { convertedToOrderId: "" }] } as any,
      { $set: { convertedToOrderId: orderId } }
    );
  } catch {}
}
