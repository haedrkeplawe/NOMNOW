// utils/driverEarningOf.js
// v4.2 — دالة مشتركة لسياسة "أجر السائق الحقيقي"، منقولة من الصيغة
// المكررة أصلاً بثمانية مواضع (controllers/driver.controller.js,
// sockets/driver.socket.js, sockets/services/order.service.js).
//
// أجر السائق دايماً originalDeliveryFee إذا موجود (يعني قيمة التوصيل
// الأصلية قبل أي عرض توصيل مجاني)، وإلا deliveryFee. هيك لأنو الأدمن
// هو يلي يتحمّل فرق عروض التوصيل المجاني — مو السائق — فأجره يضل
// كامل بكل الحالات. راجع driver.controller.js تعليقات v4.0 للسياسة
// المالية الكاملة.

/**
 * أجر السائق الحقيقي لطلب واحد.
 * @param {{deliveryFee?: number, originalDeliveryFee?: number}} order
 * @returns {number}
 */
function driverEarningOf(order) {
  if (!order) return 0;
  return order.originalDeliveryFee ?? order.deliveryFee ?? 0;
}

module.exports = { driverEarningOf };