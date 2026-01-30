const multer = require("multer");

// نخزن الصورة مؤقتًا بالذاكرة
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed!"), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 ميغا بايت
  fileFilter,
});

module.exports = upload;
