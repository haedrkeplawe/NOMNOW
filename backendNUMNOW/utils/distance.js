// utils/distance.js
// v4.9 — حساب المسافة بالخط المستقيم (Haversine) بين نقطتين جغرافيتين.
// مستخدمة لحساب أجرة التوصيل بالمسافة (سوريا فقط — راجع نطاق العمل بملف
// القرارات). حساب رياضي فوري بدون أي تبعية خارجية أو نداء API — بنفس روح
// اعتماد المشروع أصلاً على $geoNear لعمليات المسافة الجغرافية.
//
// ملاحظة معمارية: هاد بديل بسيط وسريع عن مسافة الطريق الفعلية (كانت
// مطروحة سابقاً عبر Google Routes API وانحطت "مؤجلة لحد قرار معماري").
// لو لاحقاً ظهرت حاجة لدقة أعلى (مسافة طريق فعلية بدل خط مستقيم)، تبديل
// المصدر هون بس كافي — الحقل المخزَّن على الطلب (deliveryDistanceKm)
// ما بيحتاج يتغيّر شكله.

const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * المسافة بالكيلومتر بين نقطتين، كل وحدة بصيغة GeoJSON المعتمدة بالمشروع:
 * [lng, lat] (لاحظ الترتيب — lng أولاً، متل باقي حقول location بكل الموديلات)
 * @param {[number, number]} coordsA - [lng, lat]
 * @param {[number, number]} coordsB - [lng, lat]
 * @returns {number} المسافة بالكيلومتر (رقم عشري، غير مقرَّب)
 */
function distanceKm(coordsA, coordsB) {
  const [lngA, latA] = coordsA;
  const [lngB, latB] = coordsB;

  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

module.exports = { distanceKm };
