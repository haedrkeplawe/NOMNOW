import { useRestaurant } from "../context/RestaurantContext";
import { FaRegUser } from "react-icons/fa";
import { LuCar } from "react-icons/lu";
import { FaStar } from "react-icons/fa6";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const STATUS_STYLES = {
  pending: {
    labelKey: "orders.status.pending",
    color: "#b45309",
    bg: "#fef9c3",
    border: "#fde68a",
  },
  accepted: {
    labelKey: "orders.status.accepted",
    color: "#1447e6",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  preparing: {
    labelKey: "orders.status.preparing",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  ready: {
    labelKey: "orders.status.ready",
    color: "#008236",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  picked_up: {
    labelKey: "orders.status.picked_up",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  on_the_way: {
    labelKey: "orders.status.on_the_way",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  delivered_by_driver: {
    labelKey: "orders.status.delivered_by_driver",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  delivered: {
    labelKey: "orders.status.delivered",
    color: "#008236",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  cancelled: {
    labelKey: "orders.status.cancelled",
    color: "#e7000b",
    bg: "#fef2f2",
    border: "#fecaca",
  },
};

const PAYMENT_STATUS_META = {
  paid: { labelKey: "orders.payment.paid", cls: "paid" },
  pending: { labelKey: "orders.payment.pending", cls: "pending" },
  awaiting_payment: {
    labelKey: "orders.payment.awaiting_payment",
    cls: "pending",
  },
  failed: { labelKey: "orders.payment.failed", cls: "failed" },
  refunded: { labelKey: "orders.payment.refunded", cls: "failed" },
};

// v4.4 — نفس قائمة RESTAURANT_CANCEL_REASON_CODES الموجودة بالباك اند
// (restaurant.socket.js) — أي تعديل بالقائمتين لازم يصير بالاثنين مع بعض
const CANCEL_REASONS = [
  { code: "item_unavailable", labelKey: "orders.reasonItemUnavailable" },
  { code: "kitchen_overloaded", labelKey: "orders.reasonKitchenOverloaded" },
  { code: "closing_soon", labelKey: "orders.reasonClosingSoon" },
  { code: "no_driver_found", labelKey: "orders.reasonNoDriverFound" },
  { code: "invalid_order_info", labelKey: "orders.reasonInvalidOrderInfo" },
  { code: "other", labelKey: "orders.reasonOther" },
];

const OrderCard = ({ order }) => {
  const [loading, setLoading] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const timeoutRef = useRef(null);
  const status = STATUS_STYLES[order.orderStatus] || {};
  const { socket, driverAlerts, currency, emitOrQueue, isConnected } =
    useRestaurant();
  const { t } = useTranslation();
  const [pendingSince, setPendingSince] = useState(null);

  // v4.4 — حالة نافذة سبب الإلغاء (مشتركة بين الرفض من pending، والإلغاء
  // أثناء البحث، والإلغاء من بانر "ما لقينا سائق" — نفس النافذة للثلاثة)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReasonCode, setSelectedReasonCode] = useState(null);
  const [reasonNoteInput, setReasonNoteInput] = useState("");
  const [reasonError, setReasonError] = useState(null);

  const driverAlert =
    driverAlerts[order._id?.toString()] ||
    (order.driverSearchStatus === "searching"
      ? "searching"
      : order.driverSearchStatus === "failed"
      ? "noDriver"
      : null);

  const formatDateTime = (date) =>
    new Date(date).toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleUpdateStatus = (newStatus, extra = {}) => {
    if (loading) return;
    setLoading(true);
    setUpdateError(null);

    emitOrQueue("order:updateStatus", {
      orderId: order._id,
      status: newStatus,
      ...extra,
    });

    // لو متصل → timeout عادي
    // لو منقطع → نبين pending badge بدل timeout
    if (isConnected) {
      timeoutRef.current = setTimeout(() => {
        setLoading(false);
        setUpdateError("Update timed out. Please try again.");
      }, 10000);
    } else {
      setPendingSince(new Date());
      setLoading(false);
    }
  };

  // وصل order:updated من الـ socket → نلغي الـ timeout ونصفّي الـ loading
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoading(false);
    setUpdateError(null);
    setPendingSince(null);
    // v4.4 — لو الطلب فعليًا صار cancelled، سكّر النافذة (لو كانت مفتوحة)
    setShowCancelModal(false);
  }, [order.orderStatus]);

  // v4.4 — فتح نافذة سبب الإلغاء (نفسها لأي زر إلغاء/رفض بالكرت)
  const openCancelModal = () => {
    if (loading) return;
    setSelectedReasonCode(null);
    setReasonNoteInput("");
    setReasonError(null);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (!selectedReasonCode) {
      setReasonError(t("orders.cancelReasonRequired"));
      return;
    }
    if (selectedReasonCode === "other" && !reasonNoteInput.trim()) {
      setReasonError(t("orders.cancelReasonNoteRequired"));
      return;
    }
    handleUpdateStatus("cancelled", {
      reasonCode: selectedReasonCode,
      reasonNote: reasonNoteInput.trim() || undefined,
    });
  };

  // تنظيف عند الـ unmount لمنع memory leak
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const deliveryFee = order.deliveryFee ?? 0;
  const taxPrice = order.taxPrice ?? 0;
  const totalPrice = order.totalPrice ?? 0;
  const paymentMeta = PAYMENT_STATUS_META[order.paymentStatus] || {
    labelKey: "orders.payment.pending",
    cls: "pending",
  };

  return (
    <div className="order-card">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="order-card-header">
        <div className="order-card-header-left">
          <span className="order-number">{order.orderNumber}</span>
          <span className="order-time">{formatDateTime(order.createdAt)}</span>
        </div>
        <span
          className="order-status"
          style={{
            color: status.color,
            background: status.bg,
            border: `1px solid ${status.border}`,
          }}
        >
          {t(status.labelKey)}
        </span>
      </div>

      {/* ── Customer ────────────────────────────────────── */}
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

      {/* ── Items ───────────────────────────────────────── */}
      <div className="order-items">
        <h4>{t("orders.orderItems")}</h4>
        {order.items.map((item, i) => (
          <div key={i} className="order-item">
            <div className="order-item-left">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="order-item-img"
                />
              )}
              <span className="order-item-qty">{item.quantity}×</span>
              <span className="order-item-name">{item.name}</span>
              {item.size?.name && (
                <span className="order-item-size">{item.size.name}</span>
              )}
              {item.extras?.length > 0 && (
                <div className="order-item-extras">
                  {item.extras.map((extra, j) => (
                    <span key={j} className="extra-tag">
                      + {extra.name} ({extra.price} {currency})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="order-item-price">
              {item.totalPrice} {currency}
            </span>
          </div>
        ))}

        {/* Delivery Fee & Tax */}
        {deliveryFee > 0 && (
          <div className="order-item order-item-fee">
            <span className="order-item-fee-label">
              {t("orders.deliveryFee")}
            </span>
            <span className="order-item-price">
              {deliveryFee.toFixed(2)} {currency}
            </span>
          </div>
        )}
        {/* DE — تفصيل الضريبة إذا كان موجوداً، وإلا اعرض taxPrice مجمّعاً */}
        {order.taxBreakdown ? (
          <>
            <div className="order-item order-item-fee">
              <span className="order-item-fee-label">
                {t("orders.foodTax")} ({order.taxBreakdown.foodTaxRate}% MwSt)
              </span>
              <span className="order-item-price">
                {order.taxBreakdown.foodTax.toFixed(2)} {currency}
              </span>
            </div>
            <div className="order-item order-item-fee">
              <span className="order-item-fee-label">
                {t("orders.deliveryTax")} ({order.taxBreakdown.deliveryTaxRate}%
                MwSt)
              </span>
              <span className="order-item-price">
                {order.taxBreakdown.deliveryTax.toFixed(2)} {currency}
              </span>
            </div>
          </>
        ) : (
          taxPrice > 0 && (
            <div className="order-item order-item-fee">
              <span className="order-item-fee-label">{t("orders.tax")}</span>
              <span className="order-item-price">
                {taxPrice.toFixed(2)} {currency}
              </span>
            </div>
          )
        )}

        {order.notes && (
          <div className="order-notes">
            <h4>{t("orders.notes")}</h4>
            <p>{order.notes}</p>
          </div>
        )}
      </div>

      {/* ── Customer Information ─────────────────────────── */}
      <div className="customer-information">
        <div className="user">
          <FaRegUser className="icon" /> <h4>{t("orders.customerInfo")}</h4>
        </div>
        <div className="info">
          <div>
            <h4>{t("orders.name")} :</h4>{" "}
            <p className="name">{order.userId?.name}</p>
          </div>
          <div>
            <h4>{t("orders.phone")} :</h4>{" "}
            <p className="phone">{order.userId?.phone}</p>
          </div>
          <div>
            <h4>{t("orders.address")} :</h4>{" "}
            <p className="address">{order.deliveryAddress?.fullAddress}</p>
          </div>
        </div>
      </div>

      {/* ── Driver Information ───────────────────────────── */}
      <div className="driver-information">
        <div className="user">
          <LuCar className="icon" /> <h4>{t("orders.driverInfo")}</h4>
        </div>
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
                <h4>{t("orders.phone")} :</h4> <p>{order.driverId.phone}</p>
              </div>
              <div>
                <h4>{t("orders.vehiclePlate")} :</h4>{" "}
                <p>{order.driverId.vehicleplate}</p>
              </div>
            </div>
          </>
        ) : driverAlert === "searching" ? (
          <div className="driver-alert searching">
            <div className="driver-alert-message">
              🔍 <p>{t("orders.searchingDriver")}</p>
            </div>
            <div className="driver-alert-actions">
              <button
                className="search-again-btn"
                onClick={() => {
                  socket.emit("order:searchDriverAgain", {
                    orderId: order._id,
                  });
                  setLoading(true);
                  setTimeout(() => setLoading(false), 2000);
                }}
                disabled={loading}
              >
                {loading
                  ? `⏳ ${t("orders.restarting")}`
                  : `🔄 ${t("orders.restartSearch")}`}
              </button>
              {/* v4.3.2 — زر إلغاء أثناء البحث النشط: كان غايب من هالحالة
                  تحديدًا رغم إنو الباك اند مصمم أصلاً يدعمها بالكامل
                  (order:updateStatus مسموحة من حالة accepted، وstopActiveSearch
                  بتوقف جولة البحث وتبلّغ السواق المنتظرين فورًا) */}
              <button
                className="cancel-order-btn"
                onClick={openCancelModal}
                disabled={loading}
              >
                {loading ? "..." : t("orders.cancelOrder")}
              </button>
            </div>
          </div>
        ) : driverAlert === "noDriver" ? (
          <div className="driver-alert noDriver">
            <div className="driver-alert-message">
              ❌ <p>{t("orders.noDriverFound")}</p>
            </div>
            <div className="driver-alert-actions">
              <button
                className="search-again-btn"
                onClick={() =>
                  socket.emit("order:searchDriverAgain", {
                    orderId: order._id,
                  })
                }
              >
                🔄 {t("orders.searchAgain")}
              </button>
              <button
                className="cancel-order-btn"
                onClick={openCancelModal}
                disabled={loading}
              >
                {loading ? "..." : t("orders.cancelOrder")}
              </button>
            </div>
          </div>
        ) : order.orderStatus === "pending" ? (
          <p>{t("orders.driverAutoAssigned")}</p>
        ) : null}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div className="order-card-footer">
        <div className="order-footer-left">
          <span className="order-payment-method">{order.paymentMethod}</span>
          <span className={`order-meta__badge ${paymentMeta.cls}`}>
            {t(paymentMeta.labelKey)}
          </span>
        </div>
        <div className="order-total">
          <span className="order-total-label">{t("orders.total")}</span>
          <span className="order-total-price">
            {totalPrice.toFixed(2)} {currency}
          </span>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────── */}
      {order.orderStatus === "pending" && (
        <div className="order-card-actions">
          {pendingSince && (
            <div className="order-pending-sync">
              ⏳ {t("orders.pendingSync")}
            </div>
          )}
          <button
            className="action-btn accept"
            onClick={() => handleUpdateStatus("accepted")}
            disabled={loading || !!pendingSince}
          >
            {loading ? "..." : t("orders.accept")}
          </button>
          <button
            className="action-btn reject"
            onClick={openCancelModal}
            disabled={loading || !!pendingSince}
          >
            {loading ? "..." : t("orders.reject")}
          </button>
          {updateError && <p className="order-update-error">{updateError}</p>}
        </div>
      )}

      {/* v4.4 — نافذة سبب الإلغاء/الرفض، مشتركة لكل أزرار الإلغاء بالكرت */}
      {showCancelModal && (
        <div
          className="cancel-reason-overlay"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="cancel-reason-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t("orders.cancelReasonTitle")}</h3>
            <p className="cancel-reason-subtitle">
              {t("orders.cancelReasonSubtitle")}
            </p>

            <div className="cancel-reason-options">
              {CANCEL_REASONS.map((reason) => (
                <button
                  key={reason.code}
                  type="button"
                  className={`cancel-reason-option${
                    selectedReasonCode === reason.code ? " selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedReasonCode(reason.code);
                    setReasonError(null);
                  }}
                >
                  {t(reason.labelKey)}
                </button>
              ))}
            </div>

            {selectedReasonCode === "other" && (
              <textarea
                className="cancel-reason-note"
                placeholder={t("orders.cancelReasonNotePlaceholder")}
                value={reasonNoteInput}
                onChange={(e) => {
                  setReasonNoteInput(e.target.value);
                  setReasonError(null);
                }}
                rows={3}
              />
            )}

            {reasonError && (
              <p className="cancel-reason-error">{reasonError}</p>
            )}

            <div className="cancel-reason-actions">
              <button
                type="button"
                className="cancel-reason-close-btn"
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
              >
                {t("orders.cancelReasonClose")}
              </button>
              <button
                type="button"
                className="cancel-reason-confirm-btn"
                onClick={confirmCancel}
                disabled={loading}
              >
                {loading ? "..." : t("orders.cancelReasonConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
