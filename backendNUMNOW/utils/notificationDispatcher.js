// v3.7 — الطبقة الوسطى الموحّدة للإشعارات (مستخدم + سائق معاً)
// كل خدمات الإشعارات (notification.service.js لليوزر،
// driverNotification.service.js للسائق) لازم تمر من هون بدل ما
// تتعامل مباشرة مع sendPushNotification أو admin.messaging() —
// هيك أي منطق مشترك (جلب التوكن، تنظيف التوكنات الغير صالحة، ولاحقاً
// التخزين بقاعدة البيانات) موجود بمكان وحيد بدل ما يتكرر بكل خدمة.
const { sendPushNotification } = require("./pushNotification");
const User = require("../models/User");
const Driver = require("../models/Driver");

// ─── تحديد "أحداث" الإشعارات يلي بتنخزن بقاعدة البيانات ────────
// فاضية حالياً = ولا حدث بينخزن، كل الإشعارات ترسل مباشرة بس.
//
// هون التحكم مو على مستوى "type" العام (متل "order:statusUpdated")،
// وإنما على مستوى الحدث المحدّد جواه — عشان تقدر تقول مثلاً "بدي
// أخزّن بس لما الطلب يوصل delivered" بدون ما تخزّن كل تحديثات
// الحالة التانية (accepted/ready/on_the_way...).
//
// كل استدعاء بيحدد persistKey خاص فيه (بمكان تعريف الإشعار نفسه —
// راجع notification.service.js / driverNotification.service.js)،
// وهون بس بتحدد أي مفاتيح من هدول فعلاً بدها تتخزن.
//
// أمثلة المفاتيح الموجودة حالياً بالنظام:
//   "order:statusUpdated:accepted"
//   "order:statusUpdated:ready"
//   "order:statusUpdated:picked_up"
//   "order:statusUpdated:on_the_way"
//   "order:statusUpdated:delivered"
//   "order:statusUpdated:cancelled"
//   "order:driverRequest"           (السائق — ما إلها حالات فرعية)
//   "custom"                        (أي إشعار عام)
//
// مثال تفعيل — تخزين إشعار "تم التسليم" بس وترك الباقي بدون تخزين:
//   const PERSISTED_NOTIFICATION_KEYS = new Set(["order:statusUpdated:delivered"]);
const PERSISTED_NOTIFICATION_KEYS = new Set([]);

// نأخذ الموديل بشكل كسول (lazy) حتى ما نحمّله إذا التخزين معطّل
let NotificationModel = null;
const getNotificationModel = () => {
  if (!NotificationModel) {
    NotificationModel = require("../models/notification");
  }
  return NotificationModel;
};

const RECIPIENT_MODELS = { user: User, driver: Driver };
const RECIPIENT_MODEL_NAMES = { user: "User", driver: "Driver" };

/**
 * نقطة الإرسال المركزية الوحيدة لأي إشعار بالنظام (مستخدم أو سائق).
 * مصممة إنها ما ترمي أي error للخارج أبداً — فشل الإشعار ما لازم
 * يوقف تدفق العملية الأساسية يلي استدعتها.
 *
 * @param {"user"|"driver"} recipientType
 * @param {string} recipientId
 * @param {string} title
 * @param {string} body
 * @param {Object} [data] - بيانات إضافية (orderId, orderNumber...)
 * @param {string} type - نوع الحدث العام، يُخزّن بالـ DB ويُستخدم بتوجيه الفرونت
 * @param {string} [persistKey] - مفتاح دقيق لقرار التخزين تحديداً
 *   (مثلاً "order:statusUpdated:delivered")؛ إذا ما تحدد بيستخدم
 *   قيمة type نفسها كـ fallback
 */
const dispatchNotification = async ({
  recipientType,
  recipientId,
  title,
  body,
  data = {},
  type,
  persistKey,
}) => {
  try {
    if (!recipientId) return null;

    const Model = RECIPIENT_MODELS[recipientType];
    if (!Model) {
      console.error(
        `dispatchNotification: unknown recipientType "${recipientType}"`,
      );
      return null;
    }

    const recipient = await Model.findById(recipientId).select("fcmToken");

    let result = null;
    if (recipient?.fcmToken) {
      result = await sendPushNotification([recipient.fcmToken], {
        title,
        body,
        data: { ...data, type },
      });

      if (result?.invalidTokens?.length > 0) {
        await Model.findByIdAndUpdate(recipientId, { fcmToken: null });
      }
    }

    // التخزين بقاعدة البيانات — بيصير بس إذا مفتاح هالحدث بالتحديد
    // موجود بـ PERSISTED_NOTIFICATION_KEYS بالأعلى
    await persistNotification({
      recipientType,
      recipientId,
      title,
      body,
      data,
      type,
      persistKey: persistKey || type,
    });

    return result;
  } catch (err) {
    console.error(
      `dispatchNotification error [${recipientType}/${type}]:`,
      err,
    );
    return null;
  }
};

const persistNotification = async ({
  recipientType,
  recipientId,
  title,
  body,
  data,
  type,
  persistKey,
}) => {
  if (!PERSISTED_NOTIFICATION_KEYS.has(persistKey)) return;
  try {
    const Notification = getNotificationModel();
    await Notification.create({
      recipientType,
      recipientModel: RECIPIENT_MODEL_NAMES[recipientType],
      recipientId,
      type,
      title,
      body,
      data,
    });
  } catch (err) {
    console.error("persistNotification error:", err);
  }
};

module.exports = { dispatchNotification };
