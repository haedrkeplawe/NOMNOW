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

// ─────────────────────────────────────────────────────────────
// USER & DRIVER TRANSLATIONS
// مُضاف منفصلاً حتى لو تشابهت النصوص مع المطعم
// ─────────────────────────────────────────────────────────────

translations.en.user = {
  auth: {
    userNotFound: "User not found",
    resetLinkSent: "Reset link sent to email",
    resetEmailFailed: "Failed to send reset email. Please try again.",
    invalidOrExpiredToken: "Invalid or expired token",
    passwordResetSuccess: "Password reset successful",
    missingFields: "Missing required fields",
    invalidDePhone: "Invalid German phone number. Must start with +49",
    invalidSyPhone: "Invalid Syrian phone number. Must start with +963",
    invalidPhone: "Phone must start with +49 (Germany) or +963 (Syria)",
    emailUsed: "Email already used",
    phoneUsed: "Phone already used",
    userCreated: "User created successfully",
    invalidPhoneOrPass: "Invalid phone or password",
    accountBlocked: "Your account has been blocked. Please contact support.",
    otpSent: "OTP sent",
    phoneNotFound: "Phone not found",
    invalidOtp: "Invalid OTP",
    otpExpired: "OTP expired",
    otpSentEmail: "OTP sent to your email",
    invalidEmailOrPass: "Invalid email or password",
    emailNotFound: "Email not found",
    invalidGender: "Invalid gender value",
    profileUpdated: "Profile updated successfully",
  },
  address: {
    missingFields: "Missing required address or location fields",
    userNotFound: "User not found",
    maxAddresses: "Maximum 5 addresses allowed",
    idRequired: "Address ID is required",
    notFound: "Address not found",
    updated: "Address updated successfully",
    defaultUpdated: "Default address updated successfully",
    cannotDeleteOnly: "Cannot delete your only address",
    added: "Address added successfully",
    deleted: "Address deleted successfully",
  },
  favorite: {
    foodIdRequired: "foodId is required",
    userNotFound: "User not found",
    foodAdded: "Food added to favorites",
    foodRemoved: "Food removed from favorites",
    restaurantIdRequired: "restaurantId is required",
    restaurantAdded: "Restaurant added to favorites",
    restaurantRemoved: "Restaurant removed from favorites",
  },
  rating: {
    invalidFoodId: "Invalid foodId",
    invalidRating: "Rating must be between 1 and 5",
    foodNotFound: "Food not found",
    rated: "Food rated successfully",
  },
  cart: {
    invalidQuantity: "Quantity must be a positive integer",
    foodNotAvailable: "Food not available",
    sizeRequired: "This item requires a size selection",
    invalidSize: "Invalid size selected",
    noSizes: "This item does not have sizes",
    differentRestaurant: "Cart belongs to another restaurant",
    added: "Added to cart successfully",
    cartNotFound: "Cart not found",
    itemNotFound: "Item not found in cart",
    cleared: "Cart cleared",
    itemRemoved: "Item removed from cart",
    fetchFailed: "Failed to fetch cart",
    removeFailed: "Failed to remove item",
  },
  payment: {
    germanOnly: "Payment intent is only for German users",
    cartEmpty: "Cart is empty",
    restaurantNotFound: "Restaurant not found",
  },
  order: {
    accountBlocked: "Your account is blocked",
    cartEmpty: "Cart is empty",
    restaurantNotFound: "Restaurant not found",
    restaurantClosed: "Restaurant is currently closed",
    differentCountry:
      "You cannot order from a restaurant in a different country",
    paymentNotAccepted:
      'Payment method "{{method}}" is not accepted by this restaurant',
    created: "Order created successfully",
    orderIdRequired: "orderId is required",
    notFound: "Order not found",
    cannotCancel: "Cannot cancel order with status: {{status}}",
    deleted: "Order deleted successfully",
    cancelled: "Order cancelled successfully",
  },
  ad: {
    adIdRequired: "adId is required",
    notFound: "Ad not found",
  },
  general: {
    serverError: "Server error",
  },
};

translations.ar.user = {
  auth: {
    userNotFound: "المستخدم غير موجود",
    resetLinkSent: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني",
    resetEmailFailed: "فشل إرسال البريد الإلكتروني. يرجى المحاولة مجدداً.",
    invalidOrExpiredToken: "الرابط غير صالح أو منتهي الصلاحية",
    passwordResetSuccess: "تم إعادة تعيين كلمة المرور بنجاح",
    missingFields: "حقول مطلوبة مفقودة",
    invalidDePhone: "رقم هاتف ألماني غير صالح. يجب أن يبدأ بـ +49",
    invalidSyPhone: "رقم هاتف سوري غير صالح. يجب أن يبدأ بـ +963",
    invalidPhone: "يجب أن يبدأ الهاتف بـ +49 (ألمانيا) أو +963 (سوريا)",
    emailUsed: "البريد الإلكتروني مستخدم بالفعل",
    phoneUsed: "رقم الهاتف مستخدم بالفعل",
    userCreated: "تم إنشاء الحساب بنجاح",
    invalidPhoneOrPass: "رقم الهاتف أو كلمة المرور غير صحيحة",
    accountBlocked: "تم حظر حسابك. يرجى التواصل مع الدعم.",
    otpSent: "تم إرسال رمز التحقق",
    phoneNotFound: "رقم الهاتف غير موجود",
    invalidOtp: "رمز التحقق غير صحيح",
    otpExpired: "انتهت صلاحية رمز التحقق",
    otpSentEmail: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
    invalidEmailOrPass: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    emailNotFound: "البريد الإلكتروني غير موجود",
    invalidGender: "قيمة الجنس غير صالحة",
    profileUpdated: "تم تحديث الملف الشخصي بنجاح",
  },
  address: {
    missingFields: "حقول العنوان أو الموقع مفقودة",
    userNotFound: "المستخدم غير موجود",
    maxAddresses: "الحد الأقصى 5 عناوين فقط",
    idRequired: "معرّف العنوان مطلوب",
    notFound: "العنوان غير موجود",
    updated: "تم تحديث العنوان بنجاح",
    defaultUpdated: "تم تحديث العنوان الافتراضي بنجاح",
    cannotDeleteOnly: "لا يمكن حذف عنوانك الوحيد",
    added: "تم إضافة العنوان بنجاح",
    deleted: "تم حذف العنوان بنجاح",
  },
  favorite: {
    foodIdRequired: "معرّف الطعام مطلوب",
    userNotFound: "المستخدم غير موجود",
    foodAdded: "تمت إضافة الطعام إلى المفضلة",
    foodRemoved: "تمت إزالة الطعام من المفضلة",
    restaurantIdRequired: "معرّف المطعم مطلوب",
    restaurantAdded: "تمت إضافة المطعم إلى المفضلة",
    restaurantRemoved: "تمت إزالة المطعم من المفضلة",
  },
  rating: {
    invalidFoodId: "معرّف الطعام غير صالح",
    invalidRating: "يجب أن يكون التقييم بين 1 و 5",
    foodNotFound: "الطعام غير موجود",
    rated: "تم تقييم الطعام بنجاح",
  },
  cart: {
    invalidQuantity: "يجب أن تكون الكمية عدداً صحيحاً موجباً",
    foodNotAvailable: "الطعام غير متاح",
    sizeRequired: "يجب اختيار حجم لهذه الوجبة",
    invalidSize: "الحجم المختار غير صالح",
    noSizes: "هذه الوجبة لا تحتوي على أحجام",
    differentRestaurant: "السلة تخص مطعماً آخر",
    added: "تمت الإضافة إلى السلة بنجاح",
    cartNotFound: "السلة غير موجودة",
    itemNotFound: "العنصر غير موجود في السلة",
    cleared: "تم تفريغ السلة",
    itemRemoved: "تمت إزالة العنصر من السلة",
    fetchFailed: "فشل في جلب السلة",
    removeFailed: "فشل في إزالة العنصر",
  },
  payment: {
    germanOnly: "الدفع الإلكتروني متاح للمستخدمين الألمان فقط",
    cartEmpty: "السلة فارغة",
    restaurantNotFound: "المطعم غير موجود",
  },
  order: {
    accountBlocked: "حسابك محظور",
    cartEmpty: "السلة فارغة",
    restaurantNotFound: "المطعم غير موجود",
    restaurantClosed: "المطعم مغلق حالياً",
    differentCountry: "لا يمكنك الطلب من مطعم في بلد مختلف",
    paymentNotAccepted: 'طريقة الدفع "{{method}}" غير مقبولة في هذا المطعم',
    created: "تم إنشاء الطلب بنجاح",
    orderIdRequired: "معرّف الطلب مطلوب",
    notFound: "الطلب غير موجود",
    cannotCancel: "لا يمكن إلغاء طلب بحالة: {{status}}",
    deleted: "تم حذف الطلب بنجاح",
    cancelled: "تم إلغاء الطلب بنجاح",
  },
  ad: {
    adIdRequired: "معرّف الإعلان مطلوب",
    notFound: "الإعلان غير موجود",
  },
  general: {
    serverError: "خطأ في الخادم",
  },
};

translations.de.user = {
  auth: {
    userNotFound: "Benutzer nicht gefunden",
    resetLinkSent: "Zurücksetzungslink wurde per E-Mail gesendet",
    resetEmailFailed:
      "E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.",
    invalidOrExpiredToken: "Ungültiger oder abgelaufener Link",
    passwordResetSuccess: "Passwort erfolgreich zurückgesetzt",
    missingFields: "Pflichtfelder fehlen",
    invalidDePhone: "Ungültige deutsche Telefonnummer. Muss mit +49 beginnen",
    invalidSyPhone: "Ungültige syrische Telefonnummer. Muss mit +963 beginnen",
    invalidPhone:
      "Telefon muss mit +49 (Deutschland) oder +963 (Syrien) beginnen",
    emailUsed: "E-Mail wird bereits verwendet",
    phoneUsed: "Telefonnummer wird bereits verwendet",
    userCreated: "Konto erfolgreich erstellt",
    invalidPhoneOrPass: "Ungültige Telefonnummer oder Passwort",
    accountBlocked: "Dein Konto wurde gesperrt. Bitte kontaktiere den Support.",
    otpSent: "Bestätigungscode gesendet",
    phoneNotFound: "Telefonnummer nicht gefunden",
    invalidOtp: "Ungültiger Bestätigungscode",
    otpExpired: "Bestätigungscode abgelaufen",
    otpSentEmail: "Bestätigungscode wurde an deine E-Mail gesendet",
    invalidEmailOrPass: "Ungültige E-Mail oder Passwort",
    emailNotFound: "E-Mail nicht gefunden",
    invalidGender: "Ungültiger Geschlechtswert",
    profileUpdated: "Profil erfolgreich aktualisiert",
  },
  address: {
    missingFields: "Adress- oder Standortfelder fehlen",
    userNotFound: "Benutzer nicht gefunden",
    maxAddresses: "Maximal 5 Adressen erlaubt",
    idRequired: "Adress-ID ist erforderlich",
    notFound: "Adresse nicht gefunden",
    updated: "Adresse erfolgreich aktualisiert",
    defaultUpdated: "Standardadresse erfolgreich aktualisiert",
    cannotDeleteOnly: "Die einzige Adresse kann nicht gelöscht werden",
    added: "Adresse erfolgreich hinzugefügt",
    deleted: "Adresse erfolgreich gelöscht",
  },
  favorite: {
    foodIdRequired: "Speisen-ID ist erforderlich",
    userNotFound: "Benutzer nicht gefunden",
    foodAdded: "Speise zu Favoriten hinzugefügt",
    foodRemoved: "Speise aus Favoriten entfernt",
    restaurantIdRequired: "Restaurant-ID ist erforderlich",
    restaurantAdded: "Restaurant zu Favoriten hinzugefügt",
    restaurantRemoved: "Restaurant aus Favoriten entfernt",
  },
  rating: {
    invalidFoodId: "Ungültige Speisen-ID",
    invalidRating: "Bewertung muss zwischen 1 und 5 liegen",
    foodNotFound: "Speise nicht gefunden",
    rated: "Speise erfolgreich bewertet",
  },
  cart: {
    invalidQuantity: "Menge muss eine positive ganze Zahl sein",
    foodNotAvailable: "Speise nicht verfügbar",
    sizeRequired: "Bitte Größe für diesen Artikel auswählen",
    invalidSize: "Ungültige Größenauswahl",
    noSizes: "Dieser Artikel hat keine Größenoptionen",
    differentRestaurant: "Warenkorb gehört zu einem anderen Restaurant",
    added: "Erfolgreich zum Warenkorb hinzugefügt",
    cartNotFound: "Warenkorb nicht gefunden",
    itemNotFound: "Artikel nicht im Warenkorb gefunden",
    cleared: "Warenkorb geleert",
    itemRemoved: "Artikel aus dem Warenkorb entfernt",
    fetchFailed: "Warenkorb konnte nicht geladen werden",
    removeFailed: "Artikel konnte nicht entfernt werden",
  },
  payment: {
    germanOnly: "Elektronische Zahlung ist nur für deutsche Benutzer verfügbar",
    cartEmpty: "Warenkorb ist leer",
    restaurantNotFound: "Restaurant nicht gefunden",
  },
  order: {
    accountBlocked: "Dein Konto ist gesperrt",
    cartEmpty: "Warenkorb ist leer",
    restaurantNotFound: "Restaurant nicht gefunden",
    restaurantClosed: "Das Restaurant ist derzeit geschlossen",
    differentCountry:
      "Du kannst nicht bei einem Restaurant in einem anderen Land bestellen",
    paymentNotAccepted:
      'Zahlungsmethode "{{method}}" wird von diesem Restaurant nicht akzeptiert',
    created: "Bestellung erfolgreich erstellt",
    orderIdRequired: "Bestell-ID ist erforderlich",
    notFound: "Bestellung nicht gefunden",
    cannotCancel:
      "Bestellung mit Status {{status}} kann nicht storniert werden",
    deleted: "Bestellung erfolgreich gelöscht",
    cancelled: "Bestellung erfolgreich storniert",
  },
  ad: {
    adIdRequired: "Anzeigen-ID ist erforderlich",
    notFound: "Anzeige nicht gefunden",
  },
  general: {
    serverError: "Serverfehler",
  },
};

// ─── DRIVER ───────────────────────────────────────────────────

translations.en.driver = {
  auth: {
    missingFields: "Missing required fields",
    invalidDePhone: "Invalid German phone number. Must start with +49",
    invalidSyPhone: "Invalid Syrian phone number. Must start with +963",
    invalidPhone: "Phone must start with +49 (Germany) or +963 (Syria)",
    invalidVehicleType: "Invalid vehicle type",
    emailOrPhoneExists: "Email or phone already exists",
    driverCreated: "Driver created successfully",
    invalidPhoneOrPass: "Invalid phone or password",
    accountBlocked: "Your account has been blocked",
    accountRejected: "Your account has been rejected",
    otpSent: "OTP sent",
    phoneNotFound: "Phone not found",
    noOtpRequested: "No OTP was requested",
    otpExpired: "OTP expired",
    invalidOtp: "Invalid OTP",
    emailNotFound: "Email not found",
    resetLinkSent: "A password reset link has been sent to your email",
    resetEmailFailed: "Failed to send reset email. Please try again.",
    invalidOrExpiredToken: "Invalid or expired token",
    passwordResetSuccess: "Password reset successful",
  },
  info: {
    notFound: "Driver not found",
    nameEmpty: "Name cannot be empty",
    invalidVehicleType: "Invalid vehicle type",
    plateEmpty: "Vehicle plate cannot be empty",
    documentNotFound: "{{type}} document not found",
    updated: "Updated successfully",
    passwordRequired: "currentPassword and newPassword are required",
    passwordTooShort: "New password must be at least 6 characters",
    passwordSame: "New password must be different from current password",
    incorrectPassword: "Current password is incorrect",
    passwordUpdated: "Password updated successfully",
  },
  order: {
    notFound: "Order not found",
    fcmRequired: "fcmToken is required",
    fcmUpdated: "FCM token updated",
  },
  general: {
    serverError: "Server error",
  },
};

translations.ar.driver = {
  auth: {
    missingFields: "حقول مطلوبة مفقودة",
    invalidDePhone: "رقم هاتف ألماني غير صالح. يجب أن يبدأ بـ +49",
    invalidSyPhone: "رقم هاتف سوري غير صالح. يجب أن يبدأ بـ +963",
    invalidPhone: "يجب أن يبدأ الهاتف بـ +49 (ألمانيا) أو +963 (سوريا)",
    invalidVehicleType: "نوع المركبة غير صالح",
    emailOrPhoneExists: "البريد الإلكتروني أو الهاتف مستخدم بالفعل",
    driverCreated: "تم تسجيل السائق بنجاح",
    invalidPhoneOrPass: "رقم الهاتف أو كلمة المرور غير صحيحة",
    accountBlocked: "تم حظر حسابك",
    accountRejected: "تم رفض حسابك",
    otpSent: "تم إرسال رمز التحقق",
    phoneNotFound: "رقم الهاتف غير موجود",
    noOtpRequested: "لم يتم طلب رمز تحقق",
    otpExpired: "انتهت صلاحية رمز التحقق",
    invalidOtp: "رمز التحقق غير صحيح",
    emailNotFound: "البريد الإلكتروني غير موجود",
    resetLinkSent: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني",
    resetEmailFailed: "فشل إرسال البريد الإلكتروني. يرجى المحاولة مجدداً.",
    invalidOrExpiredToken: "الرابط غير صالح أو منتهي الصلاحية",
    passwordResetSuccess: "تم إعادة تعيين كلمة المرور بنجاح",
  },
  info: {
    notFound: "السائق غير موجود",
    nameEmpty: "الاسم لا يمكن أن يكون فارغاً",
    invalidVehicleType: "نوع المركبة غير صالح",
    plateEmpty: "لوحة المركبة لا يمكن أن تكون فارغة",
    documentNotFound: "وثيقة {{type}} غير موجودة",
    updated: "تم التحديث بنجاح",
    passwordRequired: "كلمة المرور الحالية والجديدة مطلوبتان",
    passwordTooShort: "يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل",
    passwordSame: "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
    incorrectPassword: "كلمة المرور الحالية غير صحيحة",
    passwordUpdated: "تم تحديث كلمة المرور بنجاح",
  },
  order: {
    notFound: "الطلب غير موجود",
    fcmRequired: "رمز FCM مطلوب",
    fcmUpdated: "تم تحديث رمز FCM بنجاح",
  },
  general: {
    serverError: "خطأ في الخادم",
  },
};

translations.de.driver = {
  auth: {
    missingFields: "Pflichtfelder fehlen",
    invalidDePhone: "Ungültige deutsche Telefonnummer. Muss mit +49 beginnen",
    invalidSyPhone: "Ungültige syrische Telefonnummer. Muss mit +963 beginnen",
    invalidPhone:
      "Telefon muss mit +49 (Deutschland) oder +963 (Syrien) beginnen",
    invalidVehicleType: "Ungültiger Fahrzeugtyp",
    emailOrPhoneExists: "E-Mail oder Telefonnummer bereits vergeben",
    driverCreated: "Fahrer erfolgreich registriert",
    invalidPhoneOrPass: "Ungültige Telefonnummer oder Passwort",
    accountBlocked: "Dein Konto wurde gesperrt",
    accountRejected: "Dein Konto wurde abgelehnt",
    otpSent: "Bestätigungscode gesendet",
    phoneNotFound: "Telefonnummer nicht gefunden",
    noOtpRequested: "Kein Bestätigungscode angefordert",
    otpExpired: "Bestätigungscode abgelaufen",
    invalidOtp: "Ungültiger Bestätigungscode",
    emailNotFound: "E-Mail nicht gefunden",
    resetLinkSent:
      "Ein Passwort-Zurücksetzungslink wurde an deine E-Mail gesendet",
    resetEmailFailed:
      "E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.",
    invalidOrExpiredToken: "Ungültiger oder abgelaufener Link",
    passwordResetSuccess: "Passwort erfolgreich zurückgesetzt",
  },
  info: {
    notFound: "Fahrer nicht gefunden",
    nameEmpty: "Name darf nicht leer sein",
    invalidVehicleType: "Ungültiger Fahrzeugtyp",
    plateEmpty: "Kennzeichen darf nicht leer sein",
    documentNotFound: "Dokument {{type}} nicht gefunden",
    updated: "Erfolgreich aktualisiert",
    passwordRequired: "Aktuelles und neues Passwort sind erforderlich",
    passwordTooShort: "Neues Passwort muss mindestens 6 Zeichen haben",
    passwordSame: "Neues Passwort muss sich vom aktuellen unterscheiden",
    incorrectPassword: "Aktuelles Passwort ist falsch",
    passwordUpdated: "Passwort erfolgreich aktualisiert",
  },
  order: {
    notFound: "Bestellung nicht gefunden",
    fcmRequired: "FCM-Token ist erforderlich",
    fcmUpdated: "FCM-Token erfolgreich aktualisiert",
  },
  general: {
    serverError: "Serverfehler",
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
