// backfill-display-working-hours.js
//
// v4.6.3 — Migration اختيارية لمرة وحدة (راجع النقاش: ملاحظات فريق
// فلاتر على سبب الإلغاء وساعات العمل، بند #5).
//
// المشكلة: مطاعم اتسجّلت قبل ميزة "عرض ساعات العمل" (v4.7) ما عندها
// حقل displayWorkingHours بالداتابيز إطلاقاً. لما نجيبها عبر .lean()
// أو aggregate (متل معظم مسارات المستخدم)، الحقل بيرجع غايب كليًا —
// بعكس لما نجيبها بدون lean، وقتها Mongoose بيطبّق الـ default
// ({is24Hours:false, openTime:null, closeTime:null}) تلقائيًا.
// نفس الـ API فعليًا بيرجّع شكلين مختلفين حسب المسار.
//
// هاد Migration مش إجباري — تطبيق فلاتر عندهم معالجة دفاعية للشكلين
// أصلاً. بس تشغيله مرة وحدة بيوحّد البيانات ويسهّل أي استعلام مباشر
// مستقبلي على قاعدة البيانات (تقارير، أدوات إدارية...).
//
// التشغيل:
//   node backfill-display-working-hours.js
//
// بيحتاج متغيّر البيئة MONGO_URI (أو عدّل السطر تحت مباشرة لو مختلف
// عندك بمشروعك الأصلي).

const mongoose = require("mongoose");
const Restaurant = require("./models/restaurant");

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI environment variable is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const result = await Restaurant.updateMany(
    { displayWorkingHours: { $exists: false } },
    {
      $set: {
        displayWorkingHours: {
          is24Hours: false,
          openTime: null,
          closeTime: null,
        },
      },
    },
  );

  console.log(
    `Done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
