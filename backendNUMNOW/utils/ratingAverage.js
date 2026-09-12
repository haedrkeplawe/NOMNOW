// utils/ratingAverage.js
// v4.0 — دالة مشتركة لسياسة "آخر تقييم لكل مستخدم"، منقولة من المنطق
// المكرر أصلاً في rateFood/rateOrder/updateRestaurantRating (user_controller.js)
// وموسّعة الآن لتغطي rateDriver وadmin_controller.js أيضاً.
//
// الزبون اللي قيّم نفس السائق/الصنف عدة مرات (طلبات مختلفة) بيُحتسب مرة
// واحدة بآخر تقييم كتبه، وإلا تضاعف وزنه بعدد طلباته بالمتوسط.
//
// "آخر" تُقاس بـ updatedAt إذا موجود وإلا createdAt: تعديل تقييم قديم
// (push جديد ما بيصير، نفس الـ subdocument بينعدّل) بيحدّث updatedAt فقط،
// فلازم نعتمده حتى ينعكس آخر رأي فعلي للمستخدم بالمتوسط.

/**
 * متوسط التقييمات باحتساب آخر تقييم لكل مستخدم فقط.
 * @param {Array<{userId: any, rating: number, createdAt?: Date, updatedAt?: Date}>} ratings
 * @returns {number} المتوسط مقرّب لمنزلة عشرية واحدة، أو 0 إذا لا يوجد تقييمات
 */
function averageLatestPerUser(ratings = []) {
  const latest = latestPerUserMap(ratings);
  const values = Object.values(latest);
  if (!values.length) return 0;

  const sum = values.reduce((acc, r) => acc + r.rating, 0);
  return Number((sum / values.length).toFixed(1));
}

/**
 * عدد المُقيِّمين المميّزين (عدد المستخدمين لا عدد المدخلات/التوصيلات).
 * @param {Array<{userId: any}>} ratings
 * @returns {number}
 */
function distinctRaterCount(ratings = []) {
  return Object.keys(latestPerUserMap(ratings)).length;
}

/**
 * يبني خريطة userId -> آخر تقييم لهذا المستخدم (بحسب updatedAt ?? createdAt).
 * دالة داخلية مشتركة بين averageLatestPerUser وdistinctRaterCount حتى
 * ما يتكرر منطق المقارنة الزمنية بمكانين.
 */
function latestPerUserMap(ratings = []) {
  const map = {};
  for (const r of ratings) {
    if (!r || !r.userId) continue;
    const uid = r.userId.toString();
    const current = map[uid];
    const rTime = new Date(r.updatedAt ?? r.createdAt ?? 0);
    if (!current) {
      map[uid] = r;
      continue;
    }
    const currentTime = new Date(current.updatedAt ?? current.createdAt ?? 0);
    if (rTime > currentTime) {
      map[uid] = r;
    }
  }
  return map;
}

module.exports = { averageLatestPerUser, distinctRaterCount };
