// utils/eta.js
// v4.10 — حساب تقدير وقت وصول الطلب (estimatedDeliveryAt) على 3 مراحل
// تدريجية، كل مرحلة أدق من يلي قبلها لأنها مبنية على معلومة حقيقية أكتر:
//
//   1) estimateAtCreation      — وقت تأكيد الطلب (لا سائق معروف بعد)
//   2) estimateAtDriverAssigned — لحظة تعيين سائق فعلي (موقعه الحقيقي)
//   3) estimateOnTheWay        — لحظة "طلع بالتوصيل" فعلياً (بس الطريق المتبقي)
//
// ما في شغل على ألمانيا هون تحديداً (لا فرع خاص فيها) — الصيغة عامة
// ومبنية على المسافة/الوقت فقط، ما في اعتماد على أي منطق مالي/ضريبي
// خاص بدولة معيّنة، فتشتغل بنفس الطريقة لأي طلب عنده مطعم+عنوان توصيل.

/**
 * تحويل مسافة (كم) لوقت (دقائق) بافتراض سرعة متوسطة
 * @param {number} km
 * @param {number} avgSpeedKmh
 * @returns {number}
 */
function kmToMinutes(km, avgSpeedKmh) {
  return (km / avgSpeedKmh) * 60;
}

/**
 * أطول وقت تحضير بين أصناف الطلب (المطبخ بيحضّر بالتوازي مو بالتتابع)
 * @param {Array<{prepTimeMinutes?: number}>} items
 * @returns {number}
 */
function basePrepMinutes(items) {
  if (!items || items.length === 0) return 0;
  return Math.max(...items.map((i) => i.prepTimeMinutes || 0));
}

/**
 * المرحلة 1 — وقت تأكيد الطلب. تقدير تقريبي: زمن تنسيق ثابت (قبول
 * المطعم + بحث/تعيين سائق) + أطول وقت تحضير + وقت الطريق للزبون.
 */
function estimateAtCreation({
  items,
  deliveryDistanceKm,
  avgSpeedKmh,
  bufferMinutes,
}) {
  const prep = basePrepMinutes(items);
  const travel =
    deliveryDistanceKm != null
      ? kmToMinutes(deliveryDistanceKm, avgSpeedKmh)
      : 0;
  const totalMinutes = bufferMinutes + prep + travel;
  return new Date(Date.now() + totalMinutes * 60 * 1000);
}

/**
 * المرحلة 2 — لحظة تعيين سائق فعلي. منستبدل زمن التنسيق الافتراضي بموقع
 * السائق الحقيقي، ومنحسب الوقت المتبقي الفعلي للتحضير (صفر لو الطلب
 * وصل "ready" أصلاً، وإلا الفرق بين وقت التحضير الكامل والوقت المنقضي
 * فعلياً منذ القبول). الطلب بيطلع بالتوصيل لما الأطول من الاثنين
 * (تحضير متبقي / وصول السائق للمطعم) يخلص، وبعدها وقت الطريق للزبون.
 */
function estimateAtDriverAssigned({
  items,
  acceptedAt,
  readyAt,
  driverToRestaurantKm,
  deliveryDistanceKm,
  avgSpeedKmh,
}) {
  const prep = basePrepMinutes(items);

  let remainingPrep;
  if (readyAt) {
    remainingPrep = 0;
  } else {
    const elapsedSinceAccepted = acceptedAt
      ? (Date.now() - new Date(acceptedAt).getTime()) / 60000
      : 0;
    remainingPrep = Math.max(0, prep - elapsedSinceAccepted);
  }

  const driverTravel =
    driverToRestaurantKm != null
      ? kmToMinutes(driverToRestaurantKm, avgSpeedKmh)
      : 0;

  const readyAndDriverArrived = Math.max(remainingPrep, driverTravel);

  const finalLeg =
    deliveryDistanceKm != null
      ? kmToMinutes(deliveryDistanceKm, avgSpeedKmh)
      : 0;

  const totalMinutes = readyAndDriverArrived + finalLeg;
  return new Date(Date.now() + totalMinutes * 60 * 1000);
}

/**
 * المرحلة 3 — لحظة "طلع بالتوصيل" فعلياً. أدق تقدير: بس وقت الطريق
 * المتبقي من المطعم للزبون، starting من هالثانية بالضبط.
 */
function estimateOnTheWay({ deliveryDistanceKm, avgSpeedKmh }) {
  const finalLeg =
    deliveryDistanceKm != null
      ? kmToMinutes(deliveryDistanceKm, avgSpeedKmh)
      : 0;
  return new Date(Date.now() + finalLeg * 60 * 1000);
}

module.exports = {
  basePrepMinutes,
  estimateAtCreation,
  estimateAtDriverAssigned,
  estimateOnTheWay,
};
