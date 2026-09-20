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
import { useTranslation } from "react-i18next";

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

// ─── Pill (badge) ─────────────────────────────────────────────
const makePillMeta = (t) => ({
  ORDER_STATUS: {
    pending: {
      label: t("orders.status.pending"),
      color: "#b45309",
      bg: "#fffbeb",
    },
    accepted: {
      label: t("orders.status.accepted"),
      color: "#1447e6",
      bg: "#eff6ff",
    },
    preparing: {
      label: t("orders.status.preparing"),
      color: "#7e22ce",
      bg: "#faf5ff",
    },
    ready: { label: t("orders.status.ready"), color: "#008236", bg: "#f0fdf4" },
    picked_up: {
      label: t("orders.status.picked_up"),
      color: "#0369a1",
      bg: "#f0f9ff",
    },
    on_the_way: {
      label: t("orders.status.on_the_way"),
      color: "#f54900",
      bg: "#fff3ef",
    },
    delivered_by_driver: {
      label: t("orders.status.delivered_by_driver"),
      color: "#0369a1",
      bg: "#f0f9ff",
    },
    delivered: {
      label: t("orders.status.delivered"),
      color: "#008236",
      bg: "#f0fdf4",
    },
    cancelled: {
      label: t("orders.status.cancelled"),
      color: "#e7000b",
      bg: "#fef2f2",
    },
  },
  PAYMENT_STATUS: {
    pending: {
      label: t("orders.payment.pending"),
      color: "#b45309",
      bg: "#fffbeb",
    },
    awaiting_payment: {
      label: t("orders.payment.awaiting_payment"),
      color: "#b45309",
      bg: "#fffbeb",
    },
    paid: { label: t("orders.payment.paid"), color: "#008236", bg: "#f0fdf4" },
    failed: {
      label: t("orders.payment.failed"),
      color: "#e7000b",
      bg: "#fef2f2",
    },
    refunded: {
      label: t("orders.payment.refunded"),
      color: "#e7000b",
      bg: "#fef2f2",
    },
  },
  SETTLE_STATUS: {
    pending_settlement: {
      label: t("finance.settle.maturing"),
      color: "#b45309",
      bg: "#fffbeb",
    },
    available: {
      label: t("finance.settle.available"),
      color: "#ea6f00",
      bg: "#fff7ed",
    },
    withdrawal_pending: {
      label: t("finance.settle.requested"),
      color: "#1447e6",
      bg: "#eff6ff",
    },
    withdrawn: {
      label: t("finance.settle.paidOut"),
      color: "#008236",
      bg: "#f0fdf4",
    },
    not_applicable: { label: null, color: "", bg: "" },
  },
});

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

// ─── WithdrawBadge ────────────────────────────────────────────
const WithdrawBadge = ({ status, t }) => {
  const map = {
    pending: { label: t("finance.withdraw.pending"), cls: "yellow" },
    approved: { label: t("finance.withdraw.approved"), cls: "green" },
    rejected: { label: t("finance.withdraw.rejected"), cls: "red" },
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
const OrderRow = ({ order, currency, pillMeta, t }) => {
  const [expanded, setExpanded] = useState(false);
  const netProfit = order.netProfit ?? null;

  return (
    <>
      <tr className={`fin-ord-row ${expanded ? "expanded" : ""}`}>
        <td>
          <div className="fin-ord-id">#{order.orderNumber}</div>
          <div className="fin-ord-date">{fmtDateTime(order.createdAt)}</div>
        </td>
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
                    {t("finance.table.more", { count: order.items.length - 1 })}
                  </span>
                )}
              </div>
              <div className="fin-ord-qty">
                {t("finance.table.qty")}{" "}
                {order.items?.reduce((s, i) => s + i.quantity, 0)}
              </div>
            </div>
          </div>
        </td>
        <td>
          <div className="fin-ord-name">{order.userId?.name || "—"}</div>
          <div className="fin-ord-phone">{order.userId?.phone || ""}</div>
        </td>
        <td>
          {order.driverId ? (
            <>
              <div className="fin-ord-name">{order.driverId.name}</div>
              <div className="fin-ord-phone">{order.driverId.phone}</div>
            </>
          ) : (
            <span className="fin-ord-na">{t("finance.table.notAssigned")}</span>
          )}
        </td>
        <td>
          <Pill meta={pillMeta.ORDER_STATUS} value={order.orderStatus} />
        </td>
        <td>
          <div className="fin-ord-pay-method">{order.paymentMethod}</div>
          <Pill meta={pillMeta.PAYMENT_STATUS} value={order.paymentStatus} />
        </td>
        <td className="fin-ord-amount">{fmt(order.itemsPrice, currency)}</td>
        <td className="fin-ord-commission" style={{ color: "#e7000b" }}>
          {order.commission !== null ? fmt(order.commission, currency) : "—"}
        </td>
        <td className="fin-ord-net" style={{ color: "#00a63e" }}>
          {netProfit !== null ? fmt(netProfit, currency) : "—"}
        </td>
        <td>
          <Pill meta={pillMeta.SETTLE_STATUS} value={order.settlementStatus} />
        </td>
        <td>
          <button
            className="fin-ord-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
            {t("common.details")}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="fin-ord-expanded">
          <td colSpan={11}>
            <div className="fin-ord-detail">
              <div className="fin-ord-detail__items">
                <h5>{t("orders.orderItems")}</h5>
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
                  <span>{t("finance.table.itemsPrice")}</span>
                  <span>{fmt(order.itemsPrice, currency)}</span>
                </div>
                {order.deliveryFee > 0 && (
                  <div>
                    <span>{t("finance.table.deliveryFee")}</span>
                    <span>{fmt(order.deliveryFee, currency)}</span>
                  </div>
                )}
                {/* Tax breakdown (DE) or simple tax */}
                {order.taxBreakdown ? (
                  <>
                    <div>
                      <span>
                        {t("finance.table.foodTax", {
                          rate: order.taxBreakdown.foodTaxRate,
                        })}
                      </span>
                      <span>{fmt(order.taxBreakdown.foodTax, currency)}</span>
                    </div>
                    <div>
                      <span>
                        {t("finance.table.deliveryTax", {
                          rate: order.taxBreakdown.deliveryTaxRate,
                        })}
                      </span>
                      <span>
                        {fmt(order.taxBreakdown.deliveryTax, currency)}
                      </span>
                    </div>
                  </>
                ) : (
                  order.taxPrice > 0 && (
                    <div>
                      <span>{t("finance.table.tax")}</span>
                      <span>{fmt(order.taxPrice, currency)}</span>
                    </div>
                  )
                )}
                <div className="fin-ord-detail__total">
                  <span>{t("common.total")}</span>
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

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ page, totalPages, onPageChange, loading, t }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="fin-pagination">
      <button
        className="fin-pagination__btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loading}
      >
        <FiChevronLeft size={15} />
        {t("common.prev")}
      </button>
      <span className="fin-pagination__info">
        {t("common.page")} {page} {t("common.of")} {totalPages}
      </span>
      <button
        className="fin-pagination__btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
      >
        {t("common.next")}
        <FiChevronRight size={15} />
      </button>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const Finance = () => {
  const { api, accessToken } = useAuth();
  const { t } = useTranslation();

  const pillMeta = makePillMeta(t);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  const [settleFilter, setSettleFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(orderSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [orderSearch]);

  const handleFilterChange = (key) => {
    setSettleFilter(key);
    setPage(1);
  };

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/restaurant/financial/overview");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

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
      setOrdersError(err.response?.data?.message || t("common.error"));
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [api, page, debouncedSearch, settleFilter, t]);

  useEffect(() => {
    if (!accessToken) return;
    fetchOverview();
  }, [accessToken, fetchOverview]);
  useEffect(() => {
    if (!accessToken) return;
    fetchOrders();
  }, [accessToken, fetchOrders]);

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
      setSubmitError(err.response?.data?.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="fin-page page-loader">
        <div className="page-loader__spinner" />
        <span>{t("finance.loadingFinancial")}</span>
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

  const FILTER_TABS = [
    { key: "all", label: t("finance.filters.all") },
    { key: "pending_settlement", label: t("finance.filters.maturing") },
    { key: "available", label: t("finance.filters.available") },
    { key: "withdrawal_pending", label: t("finance.filters.requested") },
    { key: "withdrawn", label: t("finance.filters.paidOut") },
  ];

  const cards = [
    {
      id: "totalRevenue",
      label: t("finance.cards.totalRevenue"),
      value: fmt(overview.totalRevenue, currency),
      sub: t("finance.cards.completedOrders", {
        count: counts.deliveredOrders,
      }),
      badge: null,
      badgeClass: "green",
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
      Icon: FiDollarSign,
    },
    {
      id: "totalCommission",
      label: t("finance.cards.commission"),
      value: fmt(overview.totalCommission, currency),
      sub: t("finance.cards.commissionRate", { rate: commissionRate }),
      badge: `${commissionRate}%`,
      badgeClass: "blue",
      iconBg: "#eff6ff",
      iconColor: "#1447e6",
      Icon: FiTrendingDown,
    },
    {
      id: "netProfit",
      label: t("finance.cards.netProfit"),
      value: fmt(overview.netProfit, currency),
      sub: t("finance.cards.afterCommission"),
      badge: "+Net",
      badgeClass: "green",
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
      Icon: FiTrendingUp,
    },
    {
      id: "pendingSettlement",
      label: t("finance.cards.maturing"),
      value: fmt(overview.pendingSettlementNet, currency),
      sub: t("finance.cards.maturingOrders", {
        count: counts.pendingSettlementOrders,
        days: settlementDays,
      }),
      badge: t("finance.settle.maturing"),
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: MdOutlineHourglassEmpty,
    },
    {
      id: "availableNet",
      label: t("finance.cards.available"),
      value: fmt(overview.availableNet, currency),
      sub: t("finance.cards.availableOrders", {
        count: counts.availableOrders,
      }),
      badge: t("finance.settle.available"),
      badgeClass: "orange",
      iconBg: "#fff7ed",
      iconColor: "#ea6f00",
      Icon: FiCheckCircle,
      highlight: canWithdraw,
    },
    {
      id: "withdrawalPending",
      label: t("finance.cards.pendingApproval"),
      value: fmt(overview.withdrawalPendingNet, currency),
      sub: t("finance.cards.awaitingAdmin", {
        count: counts.withdrawalPendingOrders,
      }),
      badge: t("finance.withdraw.pending"),
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: FiClock,
    },
    {
      id: "withdrawn",
      label: t("finance.cards.totalWithdrawn"),
      value: fmt(overview.withdrawnNet, currency),
      sub: t("finance.cards.paidOut", { count: counts.withdrawnOrders }),
      badge: t("finance.withdraw.approved"),
      badgeClass: "purple",
      iconBg: "#fdf4ff",
      iconColor: "#a21caf",
      Icon: FiCheckCircle,
    },
    {
      id: "cancelledLoss",
      label: t("finance.cards.cancelled"),
      value: fmt(overview.cancelledLoss, currency),
      sub: t("finance.cards.cancelledCount", { count: counts.cancelledOrders }),
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
          <h2>{t("finance.title")}</h2>
          <p>{t("finance.subtitle")}</p>
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
            {t("finance.commission")}: {commissionRate}%
          </div>
          <button
            className="fin-btn fin-btn--ghost"
            onClick={() => {
              setShowHistory(true);
              fetchHistory();
            }}
          >
            <FiList size={14} /> {t("finance.history")}
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
            {hasPending
              ? t("finance.requestPending")
              : t("finance.requestWithdrawal")}
          </button>
        </div>
      </div>

      {/* ── Pending Alert ───────────────────────────────────── */}
      {hasPending && (
        <div className="fin-alert">
          <FiAlertCircle size={16} />
          <div>
            <strong>{t("finance.withdrawalPending")}</strong>
            <p>
              {t("finance.withdrawalPendingDesc", {
                amount: fmt(pendingWithdrawalRequest.amount, currency),
                date: fmtDate(pendingWithdrawalRequest.createdAt),
              })}
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
          <h4>{t("finance.settlementPolicy")}</h4>
          <p>
            {t("finance.settlementPolicyDesc", {
              days: settlementDays,
              rate: commissionRate,
            })}
          </p>
        </div>
      </div>

      {/* ── Orders Table ────────────────────────────────────── */}
      <div className="fin-orders-card">
        <div className="fin-orders-head">
          <div>
            <h3>{t("orders.title")}</h3>
            <p>
              {totalOrders > 0
                ? t("finance.table.ordersTotal", { count: totalOrders })
                : t("finance.table.allOrders")}
            </p>
          </div>
          <div className="fin-orders-controls">
            <div className="fin-orders-tabs">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={settleFilter === tab.key ? "active" : ""}
                  onClick={() => handleFilterChange(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              className="fin-orders-search"
              placeholder={t("finance.searchPlaceholder")}
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
                  <th>{t("finance.table.orderId")}</th>
                  <th>{t("finance.table.meals")}</th>
                  <th>{t("finance.table.customer")}</th>
                  <th>{t("finance.table.driver")}</th>
                  <th>{t("finance.table.status")}</th>
                  <th>{t("finance.table.payment")}</th>
                  <th>{t("finance.table.total")}</th>
                  <th>{t("finance.table.commission")}</th>
                  <th>{t("finance.table.netRevenue")}</th>
                  <th>{t("finance.table.settlement")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="fin-ord-empty">
                      {t("finance.table.noOrders")}
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <OrderRow
                      key={o._id}
                      order={o}
                      currency={currency}
                      pillMeta={pillMeta}
                      t={t}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={ordersLoading}
          t={t}
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
              <h3>{t("finance.confirmWithdrawal")}</h3>
              <button
                className="fin-modal__close"
                onClick={() => setShowConfirm(false)}
              >
                <FiXCircle size={20} />
              </button>
            </div>
            <div className="fin-modal__body">
              <div className="fin-modal__available">
                <span>{t("finance.fullWithdrawalAmount")}</span>
                <strong>{fmt(overview.availableNet, currency)}</strong>
              </div>
              <div className="fin-modal__confirm-info">
                <FiInfo size={14} />
                <p>
                  {t("finance.confirmInfo", {
                    amount: fmt(overview.availableNet, currency),
                    count: counts.availableOrders,
                  })}
                </p>
              </div>
              <label className="fin-modal__label" style={{ marginTop: 8 }}>
                {t("finance.noteForAdmin")}
              </label>
              <textarea
                className="fin-modal__textarea"
                placeholder={t("finance.addNote")}
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
                {t("common.cancel")}
              </button>
              <button
                className="fin-btn fin-btn--primary"
                onClick={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting
                  ? t("common.submitting")
                  : t("finance.confirmSubmit")}
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
              <h3>{t("finance.withdrawalHistory")}</h3>
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
                  {t("finance.noWithdrawals")}
                </p>
              ) : (
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>{t("finance.history_table.num")}</th>
                      <th>{t("finance.history_table.amount")}</th>
                      <th>{t("finance.history_table.status")}</th>
                      <th>{t("finance.history_table.note")}</th>
                      <th>{t("finance.history_table.rejection")}</th>
                      <th>{t("finance.history_table.requested")}</th>
                      <th>{t("finance.history_table.resolved")}</th>
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
                          <WithdrawBadge status={s.status} t={t} />
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
