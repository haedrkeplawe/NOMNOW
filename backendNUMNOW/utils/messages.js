/**
 * messages.js — ترجمات الباك-إند المركزية
 * الاستخدام: const m = getMessages(req); res.json({ message: m.auth.invalidPassword });
 */

const translations = {
  en: {
    // ── Auth ──────────────────────────────────────────────────
    auth: {
      userNotFound: "User not found",
      phoneNotRegistered: "Phone not registered",
      emailNotRegistered: "Email not registered",
      invalidPassword: "Invalid password",
      invalidOtp: "Invalid OTP",
      otpExpired: "OTP expired",
      phoneNotFound: "Phone not found",
      emailNotFound: "Email not found",
      invalidOrExpiredToken: "Invalid or expired token",
      noRefreshToken: "No refresh token",
      invalidRefreshToken: "Invalid refresh token",
      refreshTokenExpired: "Refresh token expired",
      missingFields: "Missing required fields",
      otpSentPhone: "OTP sent successfully",
      otpSentEmail: "OTP sent to your email",
      passwordResetSuccess: "Password reset successful",
      resetLinkSent: "Reset link sent to email",
      resetEmailFailed: "Failed to send reset email. Please try again.",
      loggedOut: "Logged out",
    },

    // ── Category ──────────────────────────────────────────────
    category: {
      nameRequired: "Category name is required",
      alreadyExists: "Category already exists",
      notFound: "Category not found",
      created: "Category created",
      updated: "Category updated",
      deleted: "Category deleted",
      hasFoods: "Cannot delete category with foods",
    },

    // ── Food ──────────────────────────────────────────────────
    food: {
      missingFields: "Missing required fields",
      invalidPrice: "Price must be a positive number",
      invalidTime: "Time must be a positive number",
      invalidCategory: "Invalid category",
      notFound: "Food not found",
      created: "Food created successfully",
      updated: "Food updated successfully",
      deleted: "Food deleted successfully",
      foodIdRequired: "foodId is required",
    },

    // ── Restaurant ────────────────────────────────────────────
    restaurant: {
      notFound: "Restaurant not found",
      updated: "Restaurant updated successfully",
      statusUpdated: "Restaurant status updated",
      blocked: "Restaurant is blocked and cannot change status",
      serverError: "Server error",
      invalidRestaurantId: "Invalid restaurantId",
    },

    // ── Orders ────────────────────────────────────────────────
    order: {
      notFound: "Order not found",
      allDeleted: "All orders deleted",
    },

    // ── Settlement ────────────────────────────────────────────
    settlement: {
      noAvailableBalance: "No available balance to withdraw",
      pendingExists: "You already have a pending withdrawal request",
      notFound: "Settlement not found",
      created: "Withdrawal request submitted",
      serverError: "Server error",
    },

    // ── Profile ───────────────────────────────────────────────
    profile: {
      notFound: "User not found",
      nothingToUpdate: "Nothing to update",
    },

    // ── General ───────────────────────────────────────────────
    general: {
      serverError: "Server error",
    },
  },

  ar: {
    auth: {
      userNotFound: "المستخدم غير موجود",
      phoneNotRegistered: "رقم الهاتف غير مسجل",
      emailNotRegistered: "البريد الإلكتروني غير مسجل",
      invalidPassword: "كلمة المرور غير صحيحة",
      invalidOtp: "رمز التحقق غير صحيح",
      otpExpired: "انتهت صلاحية رمز التحقق",
      phoneNotFound: "الهاتف غير موجود",
      emailNotFound: "البريد الإلكتروني غير موجود",
      invalidOrExpiredToken: "الرمز غير صالح أو منتهي الصلاحية",
      noRefreshToken: "لا يوجد رمز تحديث",
      invalidRefreshToken: "رمز التحديث غير صالح",
      refreshTokenExpired: "انتهت صلاحية رمز التحديث",
      missingFields: "حقول مطلوبة مفقودة",
      otpSentPhone: "تم إرسال رمز التحقق بنجاح",
      otpSentEmail: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
      passwordResetSuccess: "تم إعادة تعيين كلمة المرور بنجاح",
      resetLinkSent: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني",
      resetEmailFailed: "فشل في إرسال البريد الإلكتروني. يرجى المحاولة مجدداً.",
      loggedOut: "تم تسجيل الخروج",
    },

    category: {
      nameRequired: "اسم التصنيف مطلوب",
      alreadyExists: "التصنيف موجود مسبقاً",
      notFound: "التصنيف غير موجود",
      created: "تم إنشاء التصنيف",
      updated: "تم تحديث التصنيف",
      deleted: "تم حذف التصنيف",
      hasFoods: "لا يمكن حذف تصنيف يحتوي على أطعمة",
    },

    food: {
      missingFields: "حقول مطلوبة مفقودة",
      invalidPrice: "يجب أن يكون السعر رقماً موجباً",
      invalidTime: "يجب أن يكون وقت التحضير رقماً موجباً",
      invalidCategory: "تصنيف غير صالح",
      notFound: "الطعام غير موجود",
      created: "تم إنشاء الطعام بنجاح",
      updated: "تم تحديث الطعام بنجاح",
      deleted: "تم حذف الطعام بنجاح",
      foodIdRequired: "معرّف الطعام مطلوب",
    },

    restaurant: {
      notFound: "المطعم غير موجود",
      updated: "تم تحديث المطعم بنجاح",
      statusUpdated: "تم تحديث حالة المطعم",
      blocked: "المطعم محظور ولا يمكن تغيير حالته",
      serverError: "خطأ في الخادم",
      invalidRestaurantId: "معرّف المطعم غير صالح",
    },

    order: {
      notFound: "الطلب غير موجود",
      allDeleted: "تم حذف جميع الطلبات",
    },

    settlement: {
      noAvailableBalance: "لا يوجد رصيد متاح للسحب",
      pendingExists: "لديك طلب سحب قيد المراجعة بالفعل",
      notFound: "التسوية غير موجودة",
      created: "تم تقديم طلب السحب",
      serverError: "خطأ في الخادم",
    },

    profile: {
      notFound: "المستخدم غير موجود",
      nothingToUpdate: "لا يوجد شيء للتحديث",
    },

    general: {
      serverError: "خطأ في الخادم",
    },
  },

  de: {
    auth: {
      userNotFound: "Benutzer nicht gefunden",
      phoneNotRegistered: "Telefonnummer nicht registriert",
      emailNotRegistered: "E-Mail nicht registriert",
      invalidPassword: "Ungültiges Passwort",
      invalidOtp: "Ungültiger Verifizierungscode",
      otpExpired: "Verifizierungscode abgelaufen",
      phoneNotFound: "Telefonnummer nicht gefunden",
      emailNotFound: "E-Mail nicht gefunden",
      invalidOrExpiredToken: "Ungültiges oder abgelaufenes Token",
      noRefreshToken: "Kein Refresh-Token",
      invalidRefreshToken: "Ungültiges Refresh-Token",
      refreshTokenExpired: "Refresh-Token abgelaufen",
      missingFields: "Pflichtfelder fehlen",
      otpSentPhone: "Verifizierungscode erfolgreich gesendet",
      otpSentEmail: "Verifizierungscode an Ihre E-Mail gesendet",
      passwordResetSuccess: "Passwort erfolgreich zurückgesetzt",
      resetLinkSent: "Zurücksetzungslink an E-Mail gesendet",
      resetEmailFailed:
        "E-Mail konnte nicht gesendet werden. Bitte erneut versuchen.",
      loggedOut: "Abgemeldet",
    },

    category: {
      nameRequired: "Kategoriename ist erforderlich",
      alreadyExists: "Kategorie existiert bereits",
      notFound: "Kategorie nicht gefunden",
      created: "Kategorie erstellt",
      updated: "Kategorie aktualisiert",
      deleted: "Kategorie gelöscht",
      hasFoods: "Kategorie mit Speisen kann nicht gelöscht werden",
    },

    food: {
      missingFields: "Pflichtfelder fehlen",
      invalidPrice: "Preis muss eine positive Zahl sein",
      invalidTime: "Zubereitungszeit muss eine positive Zahl sein",
      invalidCategory: "Ungültige Kategorie",
      notFound: "Speise nicht gefunden",
      created: "Speise erfolgreich erstellt",
      updated: "Speise erfolgreich aktualisiert",
      deleted: "Speise erfolgreich gelöscht",
      foodIdRequired: "Speisen-ID ist erforderlich",
    },

    restaurant: {
      notFound: "Restaurant nicht gefunden",
      updated: "Restaurant erfolgreich aktualisiert",
      statusUpdated: "Restaurantstatus aktualisiert",
      blocked: "Restaurant ist gesperrt und kann den Status nicht ändern",
      serverError: "Serverfehler",
      invalidRestaurantId: "Ungültige Restaurant-ID",
    },

    order: {
      notFound: "Bestellung nicht gefunden",
      allDeleted: "Alle Bestellungen gelöscht",
    },

    settlement: {
      noAvailableBalance: "Kein verfügbares Guthaben zur Auszahlung",
      pendingExists: "Sie haben bereits eine ausstehende Auszahlungsanfrage",
      notFound: "Abrechnung nicht gefunden",
      created: "Auszahlungsanfrage eingereicht",
      serverError: "Serverfehler",
    },

    profile: {
      notFound: "Benutzer nicht gefunden",
      nothingToUpdate: "Nichts zu aktualisieren",
    },

    general: {
      serverError: "Serverfehler",
    },
  },
};

/**
 * استخراج اللغة من الـ request
 * الأولوية: Accept-Language header → "en" افتراضياً
 */
const getMessages = (req) => {
  const header = req?.headers?.["accept-language"] || "en";
  // نأخذ أول لغة فقط (مثلاً "ar-SY,ar;q=0.9" → "ar")
  const lang = header.split(",")[0].split("-")[0].toLowerCase();
  return translations[lang] || translations["en"];
};

module.exports = { getMessages };
