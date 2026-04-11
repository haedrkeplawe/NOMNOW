// === ADMIN ===
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
import {
  FiSearch,
  FiX,
  FiShoppingBag,
  FiUser,
  FiTruck,
  FiRefreshCw,
} from "react-icons/fi";
import { BsShop } from "react-icons/bs";
import { FaStar } from "react-icons/fa";
import { LuCar, LuMapPin } from "react-icons/lu";

// ─── Status meta ──────────────────────────────────────────────
const STATUS_META = {
  pending: {
    label: "Pending",
    color: "#b45309",
    bg: "#fffbeb",
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
    label: "On the Way",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  delivered_by_driver: {
    label: "At Customer",
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

const PAYMENT_META = {
  paid: { label: "Paid", cls: "aord-pay--green" },
  pending: { label: "Pending", cls: "aord-pay--yellow" },
  awaiting_payment: { label: "Awaiting", cls: "aord-pay--yellow" },
  failed: { label: "Failed", cls: "aord-pay--red" },
  refunded: { label: "Refunded", cls: "aord-pay--red" },
};

const SETTLE_META = {
  pending_settlement: { label: "Maturing", color: "#b45309", bg: "#fffbeb" },
  available: { label: "Available", color: "#ea6f00", bg: "#fff7ed" },
  withdrawal_pending: { label: "Requested", color: "#1447e6", bg: "#eff6ff" },
  withdrawn: { label: "Paid Out", color: "#008236", bg: "#f0fdf4" },
  not_applicable: { label: "—", color: "#888", bg: "transparent" },
};

const SettleBadge = ({ status }) => {
  const m = SETTLE_META[status] || SETTLE_META.not_applicable;
  if (m.label === "—")
    return <span style={{ color: "var(--secondary-text)" }}>—</span>;
  return (
    <span
      className="aord-status-badge"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.bg}` }}
    >
      {m.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || {
    label: status,
    color: "#888",
    bg: "#eee",
    border: "#ddd",
  };
  return (
    <span
      className="aord-status-badge"
      style={{
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.border}`,
      }}
    >
      {m.label}
    </span>
  );
};

// ─── Summary Card ─────────────────────────────────────────────
const SummaryCard = ({
  label,
  value,
  Icon,
  iconBg,
  iconColor,
  active,
  onClick,
}) => (
  <div className={`aord-sum-card ${active ? "active" : ""}`} onClick={onClick}>
    <div
      className="aord-sum-card__icon"
      style={{ background: iconBg, color: iconColor }}
    >
      <Icon size={18} />
    </div>
    <p className="aord-sum-card__label">{label}</p>
    <h2 className="aord-sum-card__value">{value.toLocaleString()}</h2>
  </div>
);

// ─── timeAgo ──────────────────────────────────────────────────
const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ─── Order Detail Modal ───────────────────────────────────────
const OrderModal = ({ order, onClose }) => {
  if (!order) return null;
  const currency = order.restaurantId?.currency || "SYP";

  return (
    <div className="aord-overlay" onClick={onClose}>
      <div className="aord-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="aord-modal__header">
          <div>
            <h3>Order #{order.orderNumber}</h3>
            <p>{timeAgo(order.createdAt)}</p>
          </div>
          <div className="aord-modal__header-right">
            <StatusBadge status={order.orderStatus} />
            <button className="aord-modal__close" onClick={onClose}>
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="aord-modal__body">
          {/* Three columns: Customer / Restaurant / Driver */}
          <div className="aord-modal__parties">
            {/* Customer */}
            <div className="aord-party">
              <div className="aord-party__head">
                <FiUser size={14} />
                <span>Customer</span>
              </div>
              <div className="aord-party__avatar">
                {order.userId?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <p className="aord-party__name">{order.userId?.name || "—"}</p>
              <p className="aord-party__sub">{order.userId?.phone || "—"}</p>
              {order.deliveryAddress?.fullAddress && (
                <p className="aord-party__addr">
                  <LuMapPin size={11} />
                  {order.deliveryAddress.fullAddress}
                </p>
              )}
            </div>

            {/* Restaurant */}
            <div className="aord-party">
              <div className="aord-party__head">
                <BsShop size={14} />
                <span>Restaurant</span>
              </div>
              <div className="aord-party__avatar aord-party__avatar--orange">
                <BsShop size={18} />
              </div>
              <p className="aord-party__name">
                {order.restaurantId?.name || "—"}
              </p>
              <p className="aord-party__sub">{currency}</p>
            </div>

            {/* Driver */}
            <div className="aord-party">
              <div className="aord-party__head">
                <LuCar size={14} />
                <span>Driver</span>
              </div>
              {order.driverId ? (
                <>
                  <div className="aord-party__avatar aord-party__avatar--blue">
                    {order.driverId.name?.charAt(0).toUpperCase()}
                  </div>
                  <p className="aord-party__name">{order.driverId.name}</p>
                  <p className="aord-party__sub">{order.driverId.phone}</p>
                  <p className="aord-party__sub">
                    <FaStar style={{ color: "#f0b100", marginRight: 3 }} />
                    {order.driverId.rating > 0
                      ? order.driverId.rating.toFixed(1)
                      : "—"}
                    &nbsp;·&nbsp;{order.driverId.vehicletype}
                  </p>
                </>
              ) : (
                <p className="aord-party__sub aord-party__sub--na">
                  Not assigned
                </p>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="aord-modal__items">
            <h4>Order Items</h4>
            {order.items.map((item, i) => (
              <div key={i} className="aord-item-row">
                <div className="aord-item-row__left">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="aord-item-row__img"
                    />
                  )}
                  <div>
                    <span className="aord-item-row__name">
                      <span className="aord-item-row__qty">
                        {item.quantity}×
                      </span>
                      {item.name}
                    </span>
                    {item.size?.name && (
                      <span className="aord-item-row__size">
                        {item.size.name}
                      </span>
                    )}
                    {item.extras?.length > 0 && (
                      <div className="aord-item-row__extras">
                        {item.extras.map((e, j) => (
                          <span key={j} className="aord-extra-tag">
                            +{e.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="aord-item-row__price">
                  {item.totalPrice} {currency}
                </span>
              </div>
            ))}

            {/* Subtotal / Delivery / Tax / Total */}
            <div className="aord-totals">
              <div className="aord-totals__row">
                <span>Subtotal</span>
                <span>
                  {order.itemsPrice?.toFixed(2)} {currency}
                </span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="aord-totals__row">
                  <span>Delivery Fee</span>
                  <span>
                    {order.deliveryFee?.toFixed(2)} {currency}
                  </span>
                </div>
              )}
              {order.taxPrice > 0 && (
                <div className="aord-totals__row">
                  <span>Tax</span>
                  <span>
                    {order.taxPrice?.toFixed(2)} {currency}
                  </span>
                </div>
              )}
              <div className="aord-totals__row aord-totals__row--total">
                <span>Total</span>
                <span>
                  {order.totalPrice?.toFixed(2)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="aord-modal__notes">
              <span>📝</span> {order.notes}
            </div>
          )}

          {/* Payment */}
          <div className="aord-modal__payment">
            <span className="aord-pay-method">{order.paymentMethod}</span>
            <span
              className={`aord-pay-badge ${
                PAYMENT_META[order.paymentStatus]?.cls || ""
              }`}
            >
              {PAYMENT_META[order.paymentStatus]?.label || order.paymentStatus}
            </span>
            <SettleBadge status={order.settlementStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const TABS = [
  { key: "all", label: "All Orders" },
  { key: "pending,accepted,preparing,ready", label: "Active" },
  { key: "picked_up,on_the_way,delivered_by_driver", label: "In Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const AdminOrders = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    active: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 600);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // handle multi-status tab
      const statusParam = activeTab.includes(",")
        ? activeTab
            .split(",")
            .map((s) => `status[]=${s}`)
            .join("&")
        : `status=${activeTab}`;

      const res = await api.get(
        `/admin/orders?${statusParam}&search=${dSearch}&page=${page}&limit=30${
          countryParam ? `&${countryParam}` : ""
        }`,
      );
      setOrders(res.data.orders);
      setSummary(res.data.summary);
      setTotalPages(res.data.pagination.pages);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [api, activeTab, dSearch, page, countryParam]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, dSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const summaryCards = [
    {
      key: "all",
      label: "Total Orders",
      value: summary.totalOrders,
      Icon: FiShoppingBag,
      iconBg: "#fff3ef",
      iconColor: "#f54900",
    },
    {
      key: "pending,accepted,preparing,ready",
      label: "Active",
      value: summary.active,
      Icon: FiRefreshCw,
      iconBg: "#fdf4ff",
      iconColor: "#a21caf",
    },
    {
      key: "picked_up,on_the_way,delivered_by_driver",
      label: "In Delivery",
      value: summary.inTransit,
      Icon: FiTruck,
      iconBg: "#eff6ff",
      iconColor: "#1447e6",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: summary.delivered,
      Icon: FiShoppingBag,
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      value: summary.cancelled,
      Icon: FiX,
      iconBg: "#fef2f2",
      iconColor: "#e7000b",
    },
  ];

  return (
    <div className="aord-page">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="aord-header">
        <div>
          <h2>Orders Management</h2>
          <p>Track and manage all customer orders</p>
        </div>
        <button className="aord-refresh" onClick={fetchOrders}>
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ───────────────────────────────────── */}
      <div className="aord-summary">
        {summaryCards.map((c) => (
          <SummaryCard
            key={c.key}
            label={c.label}
            value={c.value}
            Icon={c.Icon}
            iconBg={c.iconBg}
            iconColor={c.iconColor}
            active={activeTab === c.key}
            onClick={() => setActiveTab(c.key)}
          />
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="aord-toolbar">
        <div className="aord-search">
          <FiSearch size={14} />
          <input
            placeholder="Search by order ID, restaurant, driver or customer ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <FiX size={13} />
            </button>
          )}
        </div>
        <div className="aord-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={activeTab === t.key ? "active" : ""}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="aord-table-wrap">
        {loading ? (
          <div className="aord-center">
            <div className="aord-spinner" />
            <span>Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="aord-center">
            <FiShoppingBag size={36} style={{ opacity: 0.2 }} />
            <span>No orders found</span>
          </div>
        ) : (
          <table className="aord-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Time</th>
                <th>Total</th>
                <th>Settlement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="aord-table__id">#{o.orderNumber}</td>

                  <td>
                    <div className="aord-person-cell">
                      <div className="aord-person-cell__av">
                        {o.userId?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="aord-person-cell__name">
                          {o.userId?.name || "—"}
                        </p>
                        <p className="aord-person-cell__sub">
                          {o.userId?.phone || ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="aord-restaurant-cell">
                      <BsShop size={13} />
                      {o.restaurantId?.name || "—"}
                    </div>
                  </td>

                  <td>
                    {o.driverId ? (
                      <span className="aord-driver-name">
                        {o.driverId.name}
                      </span>
                    ) : (
                      <span className="aord-na">Not assigned</span>
                    )}
                  </td>

                  <td>
                    <StatusBadge status={o.orderStatus} />
                  </td>

                  <td className="aord-table__time">{timeAgo(o.createdAt)}</td>

                  <td className="aord-table__total">
                    {o.totalPrice?.toFixed(2)} {o.restaurantId?.currency || ""}
                  </td>

                  <td>
                    <SettleBadge status={o.settlementStatus} />
                  </td>

                  <td>
                    <button
                      className="aord-view-btn"
                      onClick={() => setSelectedOrder(o)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="aord-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* ── Order Modal ──────────────────────────────────────── */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default AdminOrders;
