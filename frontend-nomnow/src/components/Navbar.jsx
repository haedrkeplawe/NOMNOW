import { useState, useRef, useEffect } from "react";
import { GiKnifeFork } from "react-icons/gi";
import { useTheme } from "../context/ThemeContext";
import { MdOutlineWbSunny } from "react-icons/md";
import { IoMoon } from "react-icons/io5";
import { useRestaurant } from "../context/RestaurantContext";
import { useAuth } from "../context/AuthContext";
import {
  FiUser,
  FiSettings,
  FiLogOut,
  FiChevronDown,
  FiX,
  FiCamera,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

// ─── Logout Confirm Modal ────────────────────────────────────
const LogoutModal = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <div className="nb-overlay" onClick={onCancel}>
      <div className="nb-logout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nb-logout-modal__icon">
          <FiLogOut size={22} />
        </div>
        <h3>{t("auth.confirmLogout")}</h3>
        <p>{t("auth.logoutQuestion")}</p>
        <div className="nb-logout-modal__actions">
          <button className="nb-btn nb-btn--ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button className="nb-btn nb-btn--danger" onClick={onConfirm}>
            {t("auth.confirmLogout")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Profile Modal ───────────────────────────────────────────
const ProfileModal = ({ onClose, api, user, updateUser }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || "");
  const [imgPreview, setImgPreview] = useState(user?.img?.url || null);
  const [imgFile, setImgFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) return setError(t("nav.nameRequired"));
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (imgFile) formData.append("image", imgFile);
      const res = await api.patch("/restaurant/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ name: res.data.user.name, img: res.data.user.img });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t("nav.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nb-overlay" onClick={onClose}>
      <div className="nb-profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="nb-profile-modal__header">
          <h3>{t("nav.profile")}</h3>
          <button className="nb-profile-modal__close" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div className="nb-profile-modal__avatar-wrap">
          <div className="nb-profile-modal__avatar">
            {imgPreview ? (
              <img src={imgPreview} alt="avatar" />
            ) : (
              <span>{user?.name?.charAt(0).toUpperCase() || "U"}</span>
            )}
            <button
              className="nb-profile-modal__cam"
              onClick={() => fileRef.current.click()}
            >
              <FiCamera size={13} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImage}
          />
          <p className="nb-profile-modal__avatar-hint">
            {t("nav.changePhoto")}
          </p>
        </div>

        {/* Fields */}
        <div className="nb-profile-modal__fields">
          <div className="nb-profile-modal__field">
            <label>{t("nav.fullName")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("nav.fullNamePlaceholder")}
            />
          </div>
          <div className="nb-profile-modal__field">
            <label>{t("common.email")}</label>
            <input value={user?.email || "—"} disabled />
          </div>
          <div className="nb-profile-modal__field">
            <label>{t("common.phone")}</label>
            <input value={user?.phone || "—"} disabled />
          </div>
          <div className="nb-profile-modal__field">
            <label>{t("nav.role")}</label>
            <input value={user?.role || "—"} disabled />
          </div>
        </div>

        {error && <p className="nb-profile-modal__error">{error}</p>}

        {/* Actions */}
        <div className="nb-profile-modal__actions">
          <button className="nb-btn nb-btn--ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="nb-btn nb-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("common.saving") : t("nav.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Navbar ──────────────────────────────────────────────────
const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { restaurant } = useRestaurant();
  const { user, logout, updateUser, api } = useAuth();
  const { t } = useTranslation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="logo">
          <img src="/NOMNOWBG.png" alt="NOMNOW" />
        </div>
        <div className="menu">
          <div className="left">
            <h2>{restaurant?.name || "Restaurant"}</h2>
            {restaurant?.status === "open" ? (
              <div className="condition green">{t("common.open")}</div>
            ) : (
              <div className="condition red">{t("common.closed")}</div>
            )}
          </div>
          <div className="right">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggle */}
            <button onClick={toggleTheme} className="theme-toggle">
              {theme === "dark" ? <IoMoon /> : <MdOutlineWbSunny />}
            </button>

            {/* User Menu */}
            <div className="nb-user" ref={dropdownRef}>
              <button
                className="nb-user__trigger"
                onClick={() => setDropdownOpen((p) => !p)}
              >
                <div className="nb-user__avatar">
                  {user?.img?.url ? (
                    <img src={user.img.url} alt="avatar" />
                  ) : (
                    <span>{user?.name?.charAt(0).toUpperCase() || "A"}</span>
                  )}
                </div>
                <span className="nb-user__name">{user?.name || "Admin"}</span>
                <FiChevronDown
                  size={14}
                  className={`nb-user__chevron ${dropdownOpen ? "open" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="nb-dropdown">
                  <button
                    className="nb-dropdown__item"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowProfile(true);
                    }}
                  >
                    <FiUser size={14} />
                    {t("nav.profile")}
                  </button>
                  <button className="nb-dropdown__item nb-dropdown__item--disabled">
                    <FiSettings size={14} />
                    {t("nav.settings")}
                  </button>
                  <div className="nb-dropdown__divider" />
                  <button
                    className="nb-dropdown__item nb-dropdown__item--danger"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowLogout(true);
                    }}
                  >
                    <FiLogOut size={14} />
                    {t("auth.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          api={api}
          user={user}
          updateUser={updateUser}
        />
      )}

      {showLogout && (
        <LogoutModal
          onConfirm={() => {
            setShowLogout(false);
            logout();
          }}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </>
  );
};

export default Navbar;
