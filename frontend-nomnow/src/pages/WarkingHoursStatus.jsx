import { FiUser, FiClock } from "react-icons/fi";
import { FaPowerOff } from "react-icons/fa6";
import { useState, useEffect } from "react";
import { useRestaurant } from "../context/RestaurantContext";
import { useTranslation } from "react-i18next";

const WarkingHoursStatus = () => {
  const { restaurant, toggleStatus, updateDisplayWorkingHours } =
    useRestaurant();
  const { t } = useTranslation();

  const isOpen = restaurant?.status === "open";

  // v4.7 — راجع النقاش الكامل: عرض ساعات العمل
  const [is24Hours, setIs24Hours] = useState(false);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hoursError, setHoursError] = useState(null);

  // نعبّي الحقول من بيانات المطعم أول ما توصل/تتغيّر
  useEffect(() => {
    if (!restaurant?.displayWorkingHours) return;
    setIs24Hours(!!restaurant.displayWorkingHours.is24Hours);
    if (restaurant.displayWorkingHours.openTime) {
      setOpenTime(restaurant.displayWorkingHours.openTime);
    }
    if (restaurant.displayWorkingHours.closeTime) {
      setCloseTime(restaurant.displayWorkingHours.closeTime);
    }
  }, [restaurant?.displayWorkingHours]);

  const handleSaveHours = async () => {
    setSaving(true);
    setHoursError(null);
    setSaved(false);
    try {
      await updateDisplayWorkingHours(
        is24Hours
          ? { is24Hours: true }
          : { is24Hours: false, openTime, closeTime },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setHoursError(
        err.response?.data?.message || t("hours.displayHoursSaveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="warking-hours-page">
      <div className="text">
        <div>
          <h2>{t("hours.title")}</h2>
          <p>{t("hours.subtitle")}</p>
        </div>
      </div>

      {restaurant && (
        <div className={`status ${isOpen ? "on" : "off"}`}>
          <div className="top">
            <div className="left">
              <div>
                <FaPowerOff size={23} />
                <h3>{t("hours.restaurantStatus")}</h3>
              </div>
              <p>
                {t("hours.currentlyStatus", {
                  status: isOpen ? t("common.open") : t("common.closed"),
                })}
              </p>
            </div>
            <div className="right">
              <div className="status-toggle">
                <button
                  className={`toggle ${isOpen ? "on" : "off"}`}
                  onClick={toggleStatus}
                >
                  <span className="circle" />
                </button>
              </div>
            </div>
          </div>
          <div className="bottom">
            <FiUser />
            <p>{isOpen ? t("hours.turnOff") : t("hours.turnOn")}</p>
          </div>
        </div>
      )}

      {/* v4.7 — راجع النقاش الكامل: عرض ساعات العمل. قيمة عرض فقط، ما
          إلها أي علاقة بمفتاح الفتح/الإغلاق الفعلي فوق. */}
      {restaurant && (
        <div className="display-hours-card">
          <div className="display-hours-card__head">
            <FiClock size={22} />
            <div>
              <h3>{t("hours.displayHoursTitle")}</h3>
              <p>{t("hours.displayHoursSubtitle")}</p>
            </div>
          </div>

          <div className="display-hours-card__24">
            <span>{t("hours.open24")}</span>
            <button
              type="button"
              className={`toggle small ${is24Hours ? "on" : "off"}`}
              onClick={() => setIs24Hours((v) => !v)}
            >
              <span className="circle" />
            </button>
          </div>

          {!is24Hours && (
            <div className="display-hours-card__times">
              <div>
                <label>{t("hours.openTime")}</label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div>
                <label>{t("hours.closeTime")}</label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {hoursError && (
            <p className="display-hours-card__error">{hoursError}</p>
          )}

          <button
            type="button"
            className="display-hours-card__save"
            onClick={handleSaveHours}
            disabled={saving}
          >
            {saving
              ? t("hours.saving")
              : saved
              ? t("hours.saved")
              : t("hours.saveHours")}
          </button>
        </div>
      )}
    </div>
  );
};

export default WarkingHoursStatus;
