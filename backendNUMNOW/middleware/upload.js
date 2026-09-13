const multer = require("multer");
const { getMessages } = require("../utils/messages");

// v2.0 — B3: رفعنا الحد من 2MB إلى 5MB (يطابق ما يعرضه التطبيق فعلياً
// للسائق)، وحوّلنا أخطاء multer من 500 عام إلى ردود مترجمة 400/413
// عبر upload.safe بدل ما توصل كما هي لمعالج الأخطاء العام بـserver.js

const MAX_FILE_SIZE_MB = 5;

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) return cb(null, true);
  const err = new Error("Only image files are allowed!");
  err.code = "INVALID_FILE_TYPE";
  err.field = file.fieldname;
  cb(err, false);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

// يحدد شكل خطأ multer (status/code/field) بمعزل عن نص الرسالة، حتى
// upload.safe (مترجم EN/AR/DE) وupload.safeEn (إنكليزي ثابت — للوحات
// بلا i18n متل الأدمن) يشاركوا نفس منطق التصنيف بلا تكرار
const classifyMulterError = (err) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return { status: 413, code: "FILE_TOO_LARGE", field: err.field };
  }
  if (err.code === "INVALID_FILE_TYPE") {
    return { status: 400, code: "INVALID_FILE_TYPE", field: err.field };
  }
  if (err instanceof multer.MulterError) {
    return { status: 400, code: err.code, field: err.field };
  }
  return null; // مو خطأ نعرفه — يمرّ لمعالج الأخطاء العام بـserver.js
};

// يغلّف أي middleware من multer (upload.single / upload.fields) ويحوّل
// أخطاءه إلى 400/413 مترجمة (en/ar/de حسب Accept-Language) بدل ما تمر
// كـ500 عام لمعالج الأخطاء العام. للراوتات يلي عندها مستخدم متعدد اللغة
// (السائق حالياً).
upload.safe = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (!err) return next();
    const info = classifyMulterError(err);
    if (!info) return next(err);

    const m = getMessages(req).upload;
    const message =
      info.code === "FILE_TOO_LARGE"
        ? m.fileTooLarge.replace("{{max}}", MAX_FILE_SIZE_MB)
        : info.code === "INVALID_FILE_TYPE"
          ? m.invalidFileType
          : m.invalidUpload;

    res.status(info.status).json({ ...info, message });
  });

// نفس التصنيف بس برسالة إنكليزية ثابتة — للوحات يلي ما عندها i18n
// أصلاً (الأدمن حالياً، ورده بالمطعم/اليوزر بالمستقبل لو احتاجوا).
upload.safeEn = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (!err) return next();
    const info = classifyMulterError(err);
    if (!info) return next(err);

    const message =
      info.code === "FILE_TOO_LARGE"
        ? `Image is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB`
        : info.code === "INVALID_FILE_TYPE"
          ? "Only image files are allowed"
          : "Invalid file upload";

    res.status(info.status).json({ ...info, message });
  });

module.exports = upload;
