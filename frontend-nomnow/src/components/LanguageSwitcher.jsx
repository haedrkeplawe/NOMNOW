import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../i18n";

const LANGUAGES = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "ar", label: "AR", flag: "🇸🇾" },
  { code: "de", label: "DE", flag: "🇩🇪" },
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  // إغلاق عند الضغط خارج المكون
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (code) => {
    changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-switcher__trigger"
        onClick={() => setOpen((p) => !p)}
        title="Change Language"
      >
        <span className="lang-switcher__flag">{current.flag}</span>
        <span className="lang-switcher__label">{current.label}</span>
        <svg
          className={`lang-switcher__chevron ${open ? "open" : ""}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="lang-switcher__dropdown">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-switcher__option ${
                i18n.language === lang.code ? "active" : ""
              }`}
              onClick={() => handleSelect(lang.code)}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;