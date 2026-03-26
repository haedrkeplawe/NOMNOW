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
} from "react-icons/fi";

// ─── مساعد: تنسيق الأرقام ────────────────────────────────────
const fmt = (n, currency = "SAR") =>
  `${currency} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── بيانات كل كارت ──────────────────────────────────────────
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
      label: "Available to Settle",
      value: fmt(overview.availableToSettle, currency),
      sub: `Orders older than ${settlementDays} days`,
      badge: "Ready",
      badgeClass: "orange",
      iconBg: "#fff7ed",
      iconColor: "#ea6f00",
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

// ─── Main Component ───────────────────────────────────────────
const Finance = () => {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/restaurant/financial/overview");
        setData(res.data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load financial data",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [api]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fin-page">
        <div className="fin-center" style={{ display: "flex" }}>
          <div className="fin-spinner" />
          <span>Loading financial overview...</span>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="fin-page">
        <div className="fin-center" style={{ display: "flex" }}>
          <FiXCircle size={28} color="#e7000b" />
          <span className="fin-error">{error}</span>
        </div>
      </div>
    );
  }

  const cards = buildCards(data);

  return (
    <div className="fin-page">
      {/* Header */}
      <div className="fin-header">
        <div className="fin-header__left">
          <h2>Financial Overview</h2>
          <p>Complete financial summary — all time</p>
        </div>
        <div className="fin-header__badge">
          <FiInfo size={14} />
          Commission Rate: {data.commissionRate}%
        </div>
      </div>

      {/* Cards */}
      <div className="fin-grid">
        {cards.map((card) => (
          <FinCard key={card.id} {...card} />
        ))}
      </div>

      {/* Info Note */}
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
            items price only — delivery fees are not included.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Finance;
