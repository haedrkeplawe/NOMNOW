import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiSend,
  FiList,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { MdOutlineHourglassEmpty } from "react-icons/md";

// ─── تنسيق ────────────────────────────────────────────────────
const fmt = (n, currency = "SYP") =>
  `${currency} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Badges meta ──────────────────────────────────────────────
const ORDER_STATUS = {
  pending: { label: "Pending", color: "#b45309", bg: "#fffbeb" },
  accepted: { label: "Accepted", color: "#1447e6", bg: "#eff6ff" },
  preparing: { label: "Preparing", color: "#7e22ce", bg: "#faf5ff" },
  ready: { label: "Ready", color: "#008236", bg: "#f0fdf4" },
  picked_up: { label: "Picked Up", color: "#0369a1", bg: "#f0f9ff" },
  on_the_way: { label: "On the Way", color: "#f54900", bg: "#fff3ef" },
  delivered_by_driver: {
    label: "At Customer",
    color: "#0369a1",
    bg: "#f0f9ff",
  },
  delivered: { label: "Delivered", color: "#008236", bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: "#e7000b", bg: "#fef2f2" },
};
const PAYMENT_STATUS = {
  pending: { label: "Unpaid", color: "#b45309", bg: "#fffbeb" },
  awaiting_payment: { label: "Awaiting", color: "#b45309", bg: "#fffbeb" },
  paid: { label: "Paid", color: "#008236", bg: "#f0fdf4" },
  failed: { label: "Failed", color: "#e7000b", bg: "#fef2f2" },
  refunded: { label: "Refunded", color: "#e7000b", bg: "#fef2f2" },
};
const SETTLE_STATUS = {
  pending_settlement: { label: "Maturing", color: "#b45309", bg: "#fffbeb" },
  available: { label: "Available", color: "#ea6f00", bg: "#fff7ed" },
  withdrawal_pending: { label: "Requested", color: "#1447e6", bg: "#eff6ff" },
  withdrawn: { label: "Paid Out", color: "#008236", bg: "#f0fdf4" },
  not_applicable: { label: null, color: "", bg: "" },
};

const Pill = ({ meta, value }) => {
  const m = meta[value];
  if (!m || !m.label)
    return <span style={{ color: "var(--secondary-text)" }}>—</span>;
  return (
    <span className="fin-pill" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
};

// ─── Status Badge (withdrawal history) ───────────────────────
const WithdrawBadge = ({ status }) => {
  const map = {
    pending: { label: "Pending", cls: "yellow" },
    approved: { label: "Approved", cls: "green" },
    rejected: { label: "Rejected", cls: "red" },
  };
  const { label, cls } = map[status] || { label: status, cls: "blue" };
  return <span className={`fin-card__badge ${cls}`}>{label}</span>;
};

// ─── Summary Card ─────────────────────────────────────────────
const FinCard = ({
  label,
  value,
  sub,
  badge,
  badgeClass,
  iconBg,
  iconColor,
  Icon,
  highlight,
}) => (
  <div className={`fin-card ${highlight ? "fin-card--highlight" : ""}`}>
    <div className="fin-card__top">
      <div
        className="fin-card__icon"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={18} />
      </div>
      {badge && (
        <span className={`fin-card__badge ${badgeClass}`}>{badge}</span>
      )}
    </div>
    <p className="fin-card__label">{label}</p>
    <h2 className="fin-card__value">{value}</h2>
    {sub && <p className="fin-card__sub">{sub}</p>}
  </div>
);

// ─── Order Row (expandable) ───────────────────────────────────
const OrderRow = ({ order, currency }) => {
  const [expanded, setExpanded] = useState(false);
  const netProfit = order.netProfit ?? null;

  return (
    <>
      <tr className={`fin-ord-row ${expanded ? "expanded" : ""}`}>
        {/* Order ID */}
        <td>
          <div className="fin-ord-id">#{order.orderNumber}</div>
          <div className="fin-ord-date">{fmtDateTime(order.createdAt)}</div>
        </td>

        {/* Meal(s) */}
        <td>
          <div className="fin-ord-meal">
            {order.items?.[0]?.image && (
              <img src={order.items[0].image} alt="" className="fin-ord-img" />
            )}
            <div>
              <div className="fin-ord-meal-name">
                {order.items?.[0]?.name || "—"}
                {order.items?.length > 1 && (
                  <span className="fin-ord-more">
                    +{order.items.length - 1} more
                  </span>
                )}
              </div>
              <div className="fin-ord-qty">
                Qty: {order.items?.reduce((s, i) => s + i.quantity, 0)}
              </div>
            </div>
          </div>
        </td>

        {/* Customer */}
        <td>
          <div className="fin-ord-name">{order.userId?.name || "—"}</div>
          <div className="fin-ord-phone">{order.userId?.phone || ""}</div>
        </td>

        {/* Driver */}
        <td>
          {order.driverId ? (
            <>
              <div className="fin-ord-name">{order.driverId.name}</div>
              <div className="fin-ord-phone">{order.driverId.phone}</div>
            </>
          ) : (
            <span className="fin-ord-na">Not assigned</span>
          )}
        </td>

        {/* Status */}
        <td>
          <Pill meta={ORDER_STATUS} value={order.orderStatus} />
        </td>

        {/* Payment method + status */}
        <td>
          <div className="fin-ord-pay-method">{order.paymentMethod}</div>
          <Pill meta={PAYMENT_STATUS} value={order.paymentStatus} />
        </td>

        {/* Total */}
        <td className="fin-ord-amount">{fmt(order.itemsPrice, currency)}</td>

        {/* Commission */}
        <td className="fin-ord-commission" style={{ color: "#e7000b" }}>
          {order.commission !== null ? fmt(order.commission, currency) : "—"}
        </td>

        {/* Net Revenue */}
        <td className="fin-ord-net" style={{ color: "#00a63e" }}>
          {netProfit !== null ? fmt(netProfit, currency) : "—"}
        </td>

        {/* Settlement */}
        <td>
          <Pill meta={SETTLE_STATUS} value={order.settlementStatus} />
        </td>

        {/* Expand */}
        <td>
          <button
            className="fin-ord-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
            Details
          </button>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="fin-ord-expanded">
          <td colSpan={11}>
            <div className="fin-ord-detail">
              <div className="fin-ord-detail__items">
                <h5>Items</h5>
                {order.items?.map((item, i) => (
                  <div key={i} className="fin-ord-detail__item">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="fin-ord-detail__img"
                      />
                    )}
                    <span className="fin-ord-detail__item-name">
                      {item.quantity}× {item.name}
                      {item.size?.name && (
                        <span className="fin-ord-detail__size">
                          {" "}
                          ({item.size.name})
                        </span>
                      )}
                    </span>
                    <span className="fin-ord-detail__item-price">
                      {fmt(item.totalPrice, currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="fin-ord-detail__summary">
                <div>
                  <span>Items Price</span>
                  <span>{fmt(order.itemsPrice, currency)}</span>
                </div>
                {order.deliveryFee > 0 && (
                  <div>
                    <span>Delivery Fee</span>
                    <span>{fmt(order.deliveryFee, currency)}</span>
                  </div>
                )}
                {order.taxPrice > 0 && (
                  <div>
                    <span>Tax</span>
                    <span>{fmt(order.taxPrice, currency)}</span>
                  </div>
                )}
                <div className="fin-ord-detail__total">
                  <span>Total</span>
                  <span>{fmt(order.totalPrice, currency)}</span>
                </div>
                {order.notes && (
                  <div className="fin-ord-detail__notes">📝 {order.notes}</div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Pagination Controls ──────────────────────────────────────
const Pagination = ({ page, totalPages, onPageChange, loading }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="fin-pagination">
      <button
        className="fin-pagination__btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loading}
      >
        <FiChevronLeft size={15} />
        Prev
      </button>
      <span className="fin-pagination__info">
        Page {page} of {totalPages}
      </span>
      <button
        className="fin-pagination__btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
      >
        Next
        <FiChevronRight size={15} />
      </button>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const Finance = () => {
  const { api, accessToken } = useAuth();

  // ── Overview state ────────────────────────────────────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Withdrawal modal ──────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // ── History modal ─────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Orders state ──────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  // ── Filters + pagination ──────────────────────────────────
  const [settleFilter, setSettleFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState(""); // قيمة الـ input (فورية)
  const [debouncedSearch, setDebouncedSearch] = useState(""); // القيمة المرسلة للـ API
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const debounceRef = useRef(null);

  // ── Debounce البحث 400ms ──────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(orderSearch);
      setPage(1); // نرجع للصفحة الأولى عند تغيير البحث
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [orderSearch]);

  // ── إعادة الصفحة عند تغيير الفلتر ───────────────────────
  const handleFilterChange = (key) => {
    setSettleFilter(key);
    setPage(1);
  };

  // ── جلب الـ overview ─────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/restaurant/financial/overview");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load financial data");
    } finally {
      setLoading(false);
    }
  }, [api]);

  // ── جلب الأوردرات (server-side) ──────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);

      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", 30);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (settleFilter && settleFilter !== "all")
        params.set("settlementStatus", settleFilter);

      const res = await api.get(
        `/restaurant/financial/orders?${params.toString()}`,
      );
      setOrders(res.data.orders || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalOrders(res.data.total || 0);
    } catch (err) {
      setOrdersError(err.response?.data?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [api, page, debouncedSearch, settleFilter]);

  // ── التحميل الأولي ───────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    fetchOverview();
  }, [accessToken, fetchOverview]);

  // ── إعادة الجلب عند تغيير أي فلتر أو صفحة ───────────────
  useEffect(() => {
    if (!accessToken) return;
    fetchOrders();
  }, [accessToken, fetchOrders]);

  // ── جلب السجل ────────────────────────────────────────────
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get("/restaurant/settlement/history?limit=20");
      setHistory(res.data.settlements || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── تقديم طلب السحب ──────────────────────────────────────
  const handleSubmitRequest = async () => {
    setSubmitError(null);
    try {
      setSubmitting(true);
      await api.post("/restaurant/settlement/request", {
        note: note || undefined,
      });
      setShowConfirm(false);
      setNote("");
      await fetchOverview();
      await fetchOrders();
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error الرئيسي ───────────────────────────────
  if (loading)
    return (
      <div className="fin-page fin-center">
        <div className="fin-spinner" />
        <span>Loading financial overview...</span>
      </div>
    );
  if (error)
    return (
      <div className="fin-page fin-center">
        <FiXCircle size={28} color="#e7000b" />
        <span className="fin-error">{error}</span>
      </div>
    );

  const {
    overview,
    currency = "SYP",
    commissionRate = 0,
    settlementDays,
    counts,
    pendingWithdrawalRequest,
  } = data;
  const hasPending = !!pendingWithdrawalRequest;
  const canWithdraw = overview.availableNet > 0 && !hasPending;

  const cards = [
    {
      id: "totalRevenue",
      label: "Total Revenue",
      value: fmt(overview.totalRevenue, currency),
      sub: `${counts.deliveredOrders} completed orders`,
      badge: null,
      badgeClass: "green",
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
      Icon: FiDollarSign,
    },
    {
      id: "totalCommission",
      label: "Platform Commission",
      value: fmt(overview.totalCommission, currency),
      sub: `${commissionRate}% of total revenue`,
      badge: `${commissionRate}%`,
      badgeClass: "blue",
      iconBg: "#eff6ff",
      iconColor: "#1447e6",
      Icon: FiTrendingDown,
    },
    {
      id: "netProfit",
      label: "Net Profit",
      value: fmt(overview.netProfit, currency),
      sub: "After platform commission",
      badge: "+Net",
      badgeClass: "green",
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
      Icon: FiTrendingUp,
    },
    {
      id: "pendingSettlement",
      label: "Maturing",
      value: fmt(overview.pendingSettlementNet, currency),
      sub: `${counts.pendingSettlementOrders} orders within ${settlementDays} days`,
      badge: "Maturing",
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: MdOutlineHourglassEmpty,
    },
    {
      id: "availableNet",
      label: "Available to Withdraw",
      value: fmt(overview.availableNet, currency),
      sub: `${counts.availableOrders} orders ready`,
      badge: "Ready",
      badgeClass: "orange",
      iconBg: "#fff7ed",
      iconColor: "#ea6f00",
      Icon: FiCheckCircle,
      highlight: canWithdraw,
    },
    {
      id: "withdrawalPending",
      label: "Pending Approval",
      value: fmt(overview.withdrawalPendingNet, currency),
      sub: `${counts.withdrawalPendingOrders} orders awaiting admin`,
      badge: "Awaiting",
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: FiClock,
    },
    {
      id: "withdrawn",
      label: "Total Withdrawn",
      value: fmt(overview.withdrawnNet, currency),
      sub: `${counts.withdrawnOrders} orders paid out`,
      badge: "Paid",
      badgeClass: "purple",
      iconBg: "#fdf4ff",
      iconColor: "#a21caf",
      Icon: FiCheckCircle,
    },
    {
      id: "cancelledLoss",
      label: "Cancelled Orders",
      value: fmt(overview.cancelledLoss, currency),
      sub: `${counts.cancelledOrders} cancelled`,
      badge: "-Loss",
      badgeClass: "red",
      iconBg: "#fef2f2",
      iconColor: "#e7000b",
      Icon: FiXCircle,
    },
  ];

  return (
    <div className="fin-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="fin-header">
        <div className="fin-header__left">
          <h2>Financial Overview</h2>
          <p>Complete financial summary — all time</p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="fin-header__badge">
            <FiInfo size={14} />
            Commission: {commissionRate}%
          </div>
          <button
            className="fin-btn fin-btn--ghost"
            onClick={() => {
              setShowHistory(true);
              fetchHistory();
            }}
          >
            <FiList size={14} /> History
          </button>
          <button
            className="fin-btn fin-btn--primary"
            onClick={() => {
              setShowConfirm(true);
              setSubmitError(null);
            }}
            disabled={!canWithdraw}
          >
            <FiSend size={14} />
            {hasPending ? "Request Pending…" : "Request Withdrawal"}
          </button>
        </div>
      </div>

      {/* ── Pending Alert ───────────────────────────────────── */}
      {hasPending && (
        <div className="fin-alert">
          <FiAlertCircle size={16} />
          <div>
            <strong>Withdrawal request pending</strong>
            <p>
              {fmt(pendingWithdrawalRequest.amount, currency)} submitted on{" "}
              {fmtDate(pendingWithdrawalRequest.createdAt)} — awaiting admin
              approval.
            </p>
          </div>
        </div>
      )}

      {/* ── Summary Cards ───────────────────────────────────── */}
      <div className="fin-grid">
        {cards.map((c) => (
          <FinCard key={c.id} {...c} />
        ))}
      </div>

      {/* ── Info ────────────────────────────────────────────── */}
      <div className="fin-info">
        <div className="fin-info__icon">
          <FiInfo size={16} />
        </div>
        <div className="fin-info__text">
          <h4>Settlement Policy</h4>
          <p>
            Orders become available for withdrawal after{" "}
            <strong>{settlementDays} days</strong> from completion. Commission
            of <strong>{commissionRate}%</strong> is deducted from food items
            only. When you request withdrawal, the{" "}
            <strong>full available balance</strong> is submitted — partial
            withdrawals are not supported. If rejected, the balance returns
            automatically.
          </p>
        </div>
      </div>

      {/* ── Orders Table ────────────────────────────────────── */}
      <div className="fin-orders-card">
        <div className="fin-orders-head">
          <div>
            <h3>Orders</h3>
            <p>
              {totalOrders > 0
                ? `${totalOrders} orders total`
                : "All orders with financial breakdown"}
            </p>
          </div>
          <div className="fin-orders-controls">
            <div className="fin-orders-tabs">
              {[
                { key: "all", label: "All" },
                { key: "pending_settlement", label: "Maturing" },
                { key: "available", label: "Available" },
                { key: "withdrawal_pending", label: "Requested" },
                { key: "withdrawn", label: "Paid Out" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={settleFilter === t.key ? "active" : ""}
                  onClick={() => handleFilterChange(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              className="fin-orders-search"
              placeholder="Search by order # or customer..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="fin-orders-wrap">
          {ordersLoading ? (
            <div className="fin-center" style={{ minHeight: 140 }}>
              <div className="fin-spinner" />
            </div>
          ) : ordersError ? (
            <div className="fin-center" style={{ minHeight: 140 }}>
              <FiXCircle size={24} color="#e7000b" />
              <span style={{ color: "#e7000b", fontSize: 13 }}>
                {ordersError}
              </span>
            </div>
          ) : (
            <table className="fin-ord-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Meal(s)</th>
                  <th>Customer</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Commission</th>
                  <th>Net Revenue</th>
                  <th>Settlement</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="fin-ord-empty">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <OrderRow key={o._id} order={o} currency={currency} />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ──────────────────────────────────── */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={ordersLoading}
        />
      </div>

      {/* ── Confirm Withdrawal Modal ─────────────────────────── */}
      {showConfirm && (
        <div
          className="fin-modal-overlay"
          onClick={() => setShowConfirm(false)}
        >
          <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fin-modal__header">
              <h3>Confirm Withdrawal Request</h3>
              <button
                className="fin-modal__close"
                onClick={() => setShowConfirm(false)}
              >
                <FiXCircle size={20} />
              </button>
            </div>
            <div className="fin-modal__body">
              <div className="fin-modal__available">
                <span>Full Withdrawal Amount</span>
                <strong>{fmt(overview.availableNet, currency)}</strong>
              </div>
              <div className="fin-modal__confirm-info">
                <FiInfo size={14} />
                <p>
                  The full available balance of{" "}
                  <strong>{fmt(overview.availableNet, currency)}</strong> will
                  be requested. Covers <strong>{counts.availableOrders}</strong>{" "}
                  orders.
                </p>
              </div>
              <label className="fin-modal__label" style={{ marginTop: 8 }}>
                Note for admin (optional)
              </label>
              <textarea
                className="fin-modal__textarea"
                placeholder="Add a note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              {submitError && <p className="fin-modal__error">{submitError}</p>}
            </div>
            <div className="fin-modal__footer">
              <button
                className="fin-btn fin-btn--ghost"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="fin-btn fin-btn--primary"
                onClick={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ───────────────────────────────────── */}
      {showHistory && (
        <div
          className="fin-modal-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="fin-modal fin-modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fin-modal__header">
              <h3>Withdrawal History</h3>
              <button
                className="fin-modal__close"
                onClick={() => setShowHistory(false)}
              >
                <FiXCircle size={20} />
              </button>
            </div>
            <div className="fin-modal__body">
              {historyLoading ? (
                <div className="fin-center" style={{ minHeight: 120 }}>
                  <div className="fin-spinner" />
                </div>
              ) : history.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--secondary-text)",
                    padding: "24px 0",
                  }}
                >
                  No withdrawal requests yet.
                </p>
              ) : (
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Note</th>
                      <th>Rejection Reason</th>
                      <th>Requested</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s, i) => (
                      <tr key={s._id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{fmt(s.amount, currency)}</strong>
                        </td>
                        <td>
                          <WithdrawBadge status={s.status} />
                        </td>
                        <td>{s.note || "—"}</td>
                        <td>{s.rejectionReason || "—"}</td>
                        <td>{fmtDate(s.createdAt)}</td>
                        <td>{s.resolvedAt ? fmtDate(s.resolvedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
