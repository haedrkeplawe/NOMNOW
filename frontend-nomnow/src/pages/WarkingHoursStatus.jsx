import { FiUser } from "react-icons/fi";
import { FaPowerOff } from "react-icons/fa6";
import { useRestaurant } from "../context/RestaurantContext";
import { useTranslation } from "react-i18next";

const WarkingHoursStatus = () => {
  const { restaurant, toggleStatus } = useRestaurant();
  const { t } = useTranslation();

  const isOpen = restaurant?.status === "open";

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
    </div>
  );
};

export default WarkingHoursStatus;
