// v4.11 — إدارة عدّاد استخدام الكوبون (Coupon.usedCount) بمكان واحد.
//
// القاعدة الجديدة (قرار هندسي):
//   الاستخدام بيُحسب لحظة التأكيد الفعلي للطلب (order:send: not_confirmed →
//   pending) مو لحظة إنشائه، وبيُعاد (يتنقص) لما الطلب بينلغي من أي جهة
//   (المستخدم / المطعم / الأدمن). يعني usedCount = عدد الطلبات الفعلية
//   الحيّة يلي استعملت الكوبون، مش عدد محاولات الإتمام.
//
// الضمانات:
//   - claimCouponUse: زيادة شرطية وذرّية (ما بتتخطى maxTotalUses حتى تحت
//     التزامن). بتشتغل جوا معاملة order:send حتى تتراجع مع حجز الطلب.
//   - releaseCouponUseForOrder: idempotent — بتستعمل علامة order.couponCounted
//     (حقل داخلي select:false) فما بتنقص أكتر من مرة لنفس الطلب حتى لو
//     وصل إلغاءان بنفس اللحظة، وما بتنقص لطلبات ما انحسب استخدامها أصلاً
//     (طلبات قديمة قبل هالتعديل، أو كوبون انحذف).
//   - ما بترمي أخطاء: فشل إعادة الاستخدام ما لازم يفشّل عملية الإلغاء.
//     بيتسجّل بالـ log وسكربت scripts/recomputeCouponUsage.js بيصحّح أي انحراف.

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");

/**
 * يحجز استخدام واحد من الكوبون إذا لسا ما وصل حده.
 *
 * @param {string} couponCode  الكود المخزّن على الطلب (order.couponCode)
 * @param {ClientSession} [session]  معاملة order:send
 * @returns {Promise<{ ok: boolean, counted: boolean }>}
 *   ok=false  → الكوبون وصل maxTotalUses (لازم المعاملة تتراجع)
 *   ok=true, counted=true  → انزاد العدّاد
 *   ok=true, counted=false → الكوبون انحذف من الداتابيز بعد إنشاء الطلب؛
 *     ما منوقف الطلب بسببه (الخصم أصلاً محسوب ومخزّن عليه) وما في شي نحسبه
 */
const claimCouponUse = async (couponCode, session = null) => {
  const options = session ? { session } : {};

  const claimed = await Coupon.findOneAndUpdate(
    {
      code: couponCode,
      $or: [
        // بدون حد إجمالي: منزيد العدّاد للإحصاء بس
        { maxTotalUses: { $in: [null, 0] } },
        // مع حد: منزيد فقط إذا لسا تحت الحد (الفحص والزيادة بعملية وحدة)
        { $expr: { $lt: ["$usedCount", "$maxTotalUses"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    options,
  );

  if (claimed) return { ok: true, counted: true };

  // ما انحجز: يا الكوبون وصل حده، يا الكوبون ما عاد موجود
  let existsQuery = Coupon.exists({ code: couponCode });
  if (session) existsQuery = existsQuery.session(session);
  const stillExists = await existsQuery;

  return stillExists
    ? { ok: false, counted: false }
    : { ok: true, counted: false };
};

/**
 * يعيد استخدام الكوبون لطلب انلغى. آمن للاستدعاء أكتر من مرة ولأي طلب
 * (لو ما كان محسوب أو أُعيد قبل، ما بيعمل شي).
 *
 * @param {string|ObjectId} orderId
 * @returns {Promise<boolean>} true إذا فعلاً انتقص العدّاد
 */
const releaseCouponUseForOrder = async (orderId) => {
  const session = await mongoose.startSession();
  try {
    let released = false;
    await session.withTransaction(async () => {
      released = false; // المعاملة ممكن تتكرر
      // نقلب العلامة ذرّياً: يلي بينجح بقلبها هو الوحيد يلي بينقص العدّاد
      const marked = await Order.findOneAndUpdate(
        { _id: orderId, couponCounted: true },
        { $set: { couponCounted: false } },
        { session, projection: { couponCode: 1 } },
      );
      if (!marked || !marked.couponCode) return;

      await Coupon.updateOne(
        { code: marked.couponCode, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      );
      released = true;
    });
    return released;
  } catch (err) {
    console.error(
      `releaseCouponUseForOrder failed for order ${orderId}:`,
      err.message,
    );
    return false;
  } finally {
    session.endSession();
  }
};

module.exports = { claimCouponUse, releaseCouponUseForOrder };
