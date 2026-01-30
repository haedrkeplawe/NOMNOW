import { FiUser } from "react-icons/fi";
import { FaPowerOff } from "react-icons/fa6";
import { useRestaurant } from "../context/RestaurantContext";

const WarkingHoursStatus = () => {
  const { restaurant, toggleStatus, loading } = useRestaurant();

  return (
    <div className="warking-hours-page">
      <div className="text">
        <div>
          <h2>Restaurant Status & Hours</h2>
          <p>Manage your restaurant availability and working hours</p>
        </div>
      </div>
      {restaurant && (
        <div
          className={`status ${restaurant?.status === "open" ? "on" : "off"}`}
        >
          <div className="top">
            <div className="left">
              <div>
                <FaPowerOff size={23} />
                <h3>Restaurant Status</h3>
              </div>
              <p>
                Your restaurant is currently {restaurant?.status} for orders
              </p>
            </div>
            <div className="right">
              <div className="status-toggle">
                <button
                  className={`toggle ${
                    restaurant?.status === "open" ? "on" : "off"
                  }`}
                  onClick={toggleStatus}
                >
                  <span className="circle" />
                </button>
              </div>
            </div>
          </div>
          <div className="bottom">
            <FiUser />
            <p>
              Turn {restaurant?.status === "open" ? "off" : "on"} to{" "}
              {restaurant?.status === "open" ? "stop" : "start"} accepting
              orders
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarkingHoursStatus;
