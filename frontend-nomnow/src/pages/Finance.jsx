import { useEffect, useState } from "react";
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
} from "react-icons/fi";

// ─── تنسيق الأرقام ───────────────────────────────────────────
const fmt = (n, currency = "SYP") =>
  `${currency} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── بيانات الكروت ────────────────────────────────────────────
const buildCards = (data) => {
  const { overview, currency, commissionRate, settlementDays, counts } = data;
  return [
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
      label: "Net Restaurant Profit",
      value: fmt(overview.netProfit, currency),
      sub: "After platform commission",
      badge: "+Net",
      badgeClass: "green",
      iconBg: "#f0fdf4",
      iconColor: "#00a63e",
      Icon: FiTrendingUp,
    },
    {
      id: "availableToSettle",
      label: "Available to Withdraw",
      value: fmt(overview.availableToSettle, currency),
      sub: `Orders older than ${settlementDays} days`,
      badge: "Ready",
      badgeClass: "orange",
      iconBg: "#fff7ed",
      iconColor: "#ea6f00",
      Icon: FiCheckCircle,
    },
    {
      id: "pendingWithdrawal",
      label: "Pending Withdrawal Request",
      value: fmt(overview.pendingWithdrawal, currency),
      sub: `${counts.pendingRequests} request awaiting admin`,
      badge: "Awaiting",
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: FiClock,
    },
    {
      id: "totalWithdrawn",
      label: "Total Withdrawn",
      value: fmt(overview.totalWithdrawn, currency),
      sub: `${counts.totalSettlements} approved withdrawals`,
      badge: "Paid",
      badgeClass: "purple",
      iconBg: "#fdf4ff",
      iconColor: "#a21caf",
      Icon: FiCheckCircle,
    },
    {
      id: "pendingSettlement",
      label: "Pending Settlement",
      value: fmt(overview.pendingSettlement, currency),
      sub: `Orders within last ${settlementDays} days`,
      badge: "Pending",
      badgeClass: "yellow",
      iconBg: "#fffbeb",
      iconColor: "#b45309",
      Icon: FiClock,
    },
    {
      id: "cancelledLoss",
      label: "Cancelled Orders Value",
      value: fmt(overview.cancelledLoss, currency),
      sub: `${counts.cancelledOrders} cancelled orders`,
      badge: "-Loss",
      badgeClass: "red",
      iconBg: "#fef2f2",
      iconColor: "#e7000b",
      Icon: FiXCircle,
    },
  ];
};

// ─── Card Component ───────────────────────────────────────────
const FinCard = ({
  label,
  value,
  sub,
  badge,
  badgeClass,
  iconBg,
  iconColor,
  Icon,
}) => (
  <div className="fin-card">
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

// ─── Badge حالة السحب ─────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending: { label: "Pending", cls: "yellow" },
    approved: { label: "Approved", cls: "green" },
    rejected: { label: "Rejected", cls: "red" },
  };
  const { label, cls } = map[status] || { label: status, cls: "blue" };
  return <span className={`fin-card__badge ${cls}`}>{label}</span>;
};

// ─── Main Component ───────────────────────────────────────────
const Finance = () => {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // modal
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // history
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchOverview = async () => {
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
  };

  useEffect(() => {
    fetchOverview();
  }, [api]);

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

  const handleOpenHistory = () => {
    setShowHistory(true);
    fetchHistory();
  };

  const handleSubmitRequest = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    const num = parseFloat(amount);

    if (!num || num <= 0) return setSubmitError("Please enter a valid amount");

    if (num > data.overview.availableToSettle)
      return setSubmitError(
        `Amount exceeds available balance (${fmt(
          data.overview.availableToSettle,
          data.currency,
        )})`,
      );

    try {
      setSubmitting(true);
      await api.post("/restaurant/settlement/request", {
        amount: num,
        note: note || undefined,
      });
      setSubmitSuccess(
        "Withdrawal request submitted! Waiting for admin approval.",
      );
      setAmount("");
      setNote("");
      await fetchOverview(); // تحديث الأرقام
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fin-page">
        <div className="fin-center">
          <div className="fin-spinner" />
          <span>Loading financial overview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fin-page">
        <div className="fin-center">
          <FiXCircle size={28} color="#e7000b" />
          <span className="fin-error">{error}</span>
        </div>
      </div>
    );
  }

  const cards = buildCards(data);

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
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="fin-header__badge">
            <FiInfo size={14} />
            Commission Rate: {data.commissionRate}%
          </div>
          <button
            className="fin-btn fin-btn--ghost"
            onClick={handleOpenHistory}
          >
            <FiList size={14} /> History
          </button>
          <button
            className="fin-btn fin-btn--primary"
            onClick={() => {
              setShowModal(true);
              setSubmitError(null);
              setSubmitSuccess(null);
            }}
            disabled={
              data.overview.availableToSettle <= 0 ||
              data.counts.pendingRequests > 0
            }
          >
            <FiSend size={14} />
            {data.counts.pendingRequests > 0
              ? "Request Pending…"
              : "Request Withdrawal"}
          </button>
        </div>
      </div>

      {/* ── Cards ──────────────────────────────────────────── */}
      <div className="fin-grid">
        {cards.map((card) => (
          <FinCard key={card.id} {...card} />
        ))}
      </div>

      {/* ── Info Note ──────────────────────────────────────── */}
      <div className="fin-info">
        <div className="fin-info__icon">
          <FiInfo size={16} />
        </div>
        <div className="fin-info__text">
          <h4>Settlement Policy</h4>
          <p>
            Profits from completed orders become available for settlement after{" "}
            <strong>{data.settlementDays} days</strong> from the order
            completion date. The platform commission of{" "}
            <strong>{data.commissionRate}%</strong> is deducted from the food
            items price only — delivery fees are not included. Once a withdrawal
            is requested, the amount is reserved until admin approval.
          </p>
        </div>
      </div>

      {/* ── Withdrawal Request Modal ────────────────────────── */}
      {showModal && (
        <div className="fin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fin-modal__header">
              <h3>Request Withdrawal</h3>
              <button
                className="fin-modal__close"
                onClick={() => setShowModal(false)}
              >
                <FiXCircle size={20} />
              </button>
            </div>

            <div className="fin-modal__body">
              <div className="fin-modal__available">
                <span>Available Balance</span>
                <strong>
                  {fmt(data.overview.availableToSettle, data.currency)}
                </strong>
              </div>

              <label className="fin-modal__label">Amount</label>
              <div className="fin-modal__input-wrap">
                <span className="fin-modal__currency">{data.currency}</span>
                <input
                  type="number"
                  className="fin-modal__input"
                  placeholder="0.00"
                  value={amount}
                  min="1"
                  max={data.overview.availableToSettle}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button
                  className="fin-modal__max"
                  onClick={() => setAmount(data.overview.availableToSettle)}
                >
                  MAX
                </button>
              </div>

              <label className="fin-modal__label" style={{ marginTop: 12 }}>
                Note (optional)
              </label>
              <textarea
                className="fin-modal__textarea"
                placeholder="Add a note for the admin..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />

              {submitError && <p className="fin-modal__error">{submitError}</p>}
              {submitSuccess && (
                <p className="fin-modal__success">{submitSuccess}</p>
              )}
            </div>

            <div className="fin-modal__footer">
              <button
                className="fin-btn fin-btn--ghost"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="fin-btn fin-btn--primary"
                onClick={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Request"}
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
                      <th>Requested At</th>
                      <th>Resolved At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s, i) => (
                      <tr key={s._id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{fmt(s.amount, data.currency)}</strong>
                        </td>
                        <td>
                          <StatusBadge status={s.status} />
                        </td>
                        <td>{s.note || "—"}</td>
                        <td>{s.rejectionReason || "—"}</td>
                        <td>
                          {new Date(s.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td>
                          {s.resolvedAt
                            ? new Date(s.resolvedAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : "—"}
                        </td>
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
