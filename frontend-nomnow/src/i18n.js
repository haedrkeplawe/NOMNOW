import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ar from "./locales/ar.json";
import de from "./locales/de.json";

const STORAGE_KEY = "nomnow_lang";
const RTL_LANGS = ["ar"];

// ─── قراءة اللغة المحفوظة أو الافتراضية ────────────────────
const savedLang = localStorage.getItem(STORAGE_KEY) || "en";

// ─── تطبيق اتجاه الصفحة فوراً قبل أي render ───────────────
document.documentElement.dir = RTL_LANGS.includes(savedLang) ? "rtl" : "ltr";
document.documentElement.lang = savedLang;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    de: { translation: de },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React يتولى الـ XSS بنفسه
  },
});

// ─── دالة مساعدة: تغيير اللغة وتطبيق RTL/LTR ───────────────
export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
};

export default i18n;
