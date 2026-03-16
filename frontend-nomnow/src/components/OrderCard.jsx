import { useRestaurant } from "../context/RestaurantContext";
import { FaRegUser } from "react-icons/fa";
import { LuCar } from "react-icons/lu";
import { FaStar } from "react-icons/fa6";
import { useState, useEffect } from "react";

const STATUS_STYLES = {
  pending: {
    label: "Pending",
    color: "#b45309",
    bg: "#fef9c3",
    border: "#fde68a",
  },
  accepted: {
    label: "Accepted",
    color: "#1447e6",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  preparing: {
    label: "Preparing",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  ready: { label: "Ready", color: "#008236", bg: "#f0fdf4", border: "#bbf7d0" },
  picked_up: {
    label: "Picked Up",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  on_the_way: {
    label: "On The Way",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  delivered: {
    label: "Delivered",
    color: "#008236",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  cancelled: {
    label: "Cancelled",
    color: "#e7000b",
    bg: "#fef2f2",
    border: "#fecaca",
  },
};

const OrderCard = ({ order }) => {
  const [loading, setLoading] = useState(false);
  const status = STATUS_STYLES[order.orderStatus] || {};
  const { socket, driverAlerts } = useRestaurant();

  // ✅ اجلب الـ alert من Context مباشرة
  const driverAlert =
    driverAlerts[order._id?.toString()] ||
    (order.driverSearchStatus === "searching"
      ? "searching"
      : order.driverSearchStatus === "failed"
      ? "noDriver"
      : null);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleUpdateStatus = (newStatus) => {
    if (!socket || loading) return;
    setLoading(true);
    socket.emit("order:updateStatus", {
      orderId: order._id,
      status: newStatus,
    });
  };

  useEffect(() => {
    if (!socket) return;

    const onUpdated = ({ order: updated }) => {
      if (updated._id.toString() === order._id.toString()) setLoading(false);
    };
    const onError = () => setLoading(false);

    socket.on("order:updated", onUpdated);
    socket.on("order:error", onError);

    return () => {
      socket.off("order:updated", onUpdated);
      socket.off("order:error", onError);
    };
  }, [socket, order._id]);

  return (
    <div className="order-card">
      {/* Header */}
      <div className="order-card-header">
        <div className="order-card-header-left">
          <span className="order-number">{order.orderNumber}</span>
          <span className="order-time">{formatTime(order.createdAt)}</span>
        </div>
        <span
          className="order-status"
          style={{
            color: status.color,
            background: status.bg,
            border: `1px solid ${status.border}`,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Customer */}
      <div className="order-customer">
        <div className="order-customer-avatar">
          {order.userId?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div>
          <p className="order-customer-name">
            {order.userId?.name || "Unknown"}
          </p>
          <p className="order-customer-phone">{order.userId?.phone || ""}</p>
        </div>
      </div>

      {/* Items */}
      <div className="order-items">
        <h4>Order Items</h4>
        {order.items.map((item, i) => (
          <div key={i} className="order-item">
            <div className="order-item-left">
              <span className="order-item-qty">{item.quantity}×</span>
              <span className="order-item-name">{item.name}</span>
              {item.extras && item.extras.length > 0 && (
                <div className="order-item-extras">
                  {item.extras.map((extra, j) => (
                    <span key={j} className="extra-tag">
                      + {extra.name} (${extra.price})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="order-item-price">${item.totalPrice}</span>
          </div>
        ))}
        {order.notes && (
          <div className="order-notes">
            <h4>Notes</h4>
            <p>{order.notes}</p>
          </div>
        )}
      </div>

      {/* Customer Information */}
      <div className="customer-information">
        <div className="user">
          <FaRegUser className="icon" /> <h4>Customer Information</h4>
        </div>
        <div className="info">
          <div>
            <h4>Name :</h4>
            <p className="name">{order.userId.name}</p>
          </div>
          <div>
            <h4>Phone :</h4>
            <p className="phone">{order.userId.phone}</p>
          </div>
          <div>
            <h4>Address :</h4>
            <p className="address">{order.deliveryAddress.fullAddress}</p>
          </div>
        </div>
      </div>

      {/* Driver Information */}
      <div className="driver-information">
        <div className="user">
          <LuCar className="icon" /> <h4>Driver Information</h4>
        </div>

        {/* السائق موجود */}
        {order.driverId && typeof order.driverId === "object" ? (
          <>
            <div className="info-1">
              <div className="img">
                {order.driverId.name?.charAt(0).toUpperCase()}
              </div>
              <div className="info">
                <h3>{order.driverId.name}</h3>
                <div>
                  <p>
                    <FaStar className="icon" /> {order.driverId.rating}
                  </p>
                  <span>{order.driverId.vehicletype}</span>
                </div>
              </div>
            </div>
            <div className="info-2">
              <div>
                <h4>Phone :</h4>
                <p>{order.driverId.phone}</p>
              </div>
              <div>
                <h4>Vehicle Plate :</h4>
                <p>{order.driverId.vehicleplate}</p>
              </div>
            </div>
          </>
        ) : driverAlert === "searching" ? (
          <div className="driver-alert searching">
            🔍 Searching for a driver...
          </div>
        ) : driverAlert === "noDriver" ? (
          <div className="driver-alert noDriver">
            <p>❌ No driver found — Please handle manually</p>
            <button
              className="search-again-btn"
              onClick={() => {
                socket.emit("order:searchDriverAgain", { orderId: order._id });
              }}
            >
              🔄 Search Again
            </button>
          </div>
        ) : order.orderStatus === "pending" ? (
          <p>
            Driver information will appear here. A driver will be automatically
            assigned by the system upon order acceptance.
          </p>
        ) : null}
      </div>

      {/* Footer */}
      <div className="order-card-footer">
        <div className="order-payment">
          <span className="order-payment-method">{order.paymentMethod}</span>
        </div>
        <div className="order-total">
          <span className="order-total-label">Total</span>
          <span className="order-total-price">${order.totalPrice}</span>
        </div>
      </div>

      {order.orderStatus === "pending" && (
        <div className="order-card-actions">
          <button
            className="action-btn accept"
            onClick={() => handleUpdateStatus("accepted")}
            disabled={loading}
          >
            {loading ? "..." : "Accept"}
          </button>
          <button
            className="action-btn reject"
            onClick={() => handleUpdateStatus("cancelled")}
            disabled={loading}
          >
            {loading ? "..." : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
