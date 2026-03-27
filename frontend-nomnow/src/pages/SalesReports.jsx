import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FiDollarSign,
  FiShoppingBag,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiXCircle,
} from "react-icons/fi";
import { MdOutlineFastfood } from "react-icons/md";

// ── Status colours ────────────────────────────────────────────
const STATUS_COLOR = {
  pending: "#f59e0b",
  accepted: "#1447e6",
  preparing: "#a21caf",
  ready: "#00a63e",
  picked_up: "#0891b2",
  on_the_way: "#f54900",
  delivered: "#16a34a",
  cancelled: "#e7000b",
};
const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked Up",
  on_the_way: "On the Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// ── Stat Card meta ────────────────────────────────────────────
const CARD_META = {
  totalRevenue: { bg: "#f0fdf4", color: "#00a63e", Icon: FiDollarSign },
  totalOrders: { bg: "#eff6ff", color: "#1447e6", Icon: FiShoppingBag },
  avgOrderValue: { bg: "#fdf4ff", color: "#a21caf", Icon: FiActivity },
  netProfit: { bg: "#fff7ed", color: "#ea6f00", Icon: FiTrendingUp },
};

// ── helpers ───────────────────────────────────────────────────
const fmt = (n, cur) =>
  `${cur} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Tooltip ───────────────────────────────────────────────────
const ChartTip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="sr-tip">
      <p className="sr-tip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontSize: 12 }}>
          {p.name}: {p.dataKey === "revenue" ? fmt(p.value, currency) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────
const StatCard = ({ id, label, value, change, currency, isAmount }) => {
  const { bg, color, Icon } = CARD_META[id];
  const isPos = change >= 0;
  return (
    <div className="sr-stat">
      <div className="sr-stat__top">
        <div className="sr-stat__icon" style={{ background: bg, color }}>
          <Icon size={17} />
        </div>
        <span className={`sr-stat__change ${isPos ? "pos" : "neg"}`}>
          {isPos ? <FiTrendingUp size={10} /> : <FiTrendingDown size={10} />}
          {isPos ? "+" : ""}
          {change}%
        </span>
      </div>
      <p className="sr-stat__label">{label}</p>
      <h2 className="sr-stat__value">
        {isAmount ? fmt(value, currency) : value.toLocaleString()}
      </h2>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────
const PERIODS = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const SalesReports = () => {
  const { api } = useAuth();
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(
    async (p) => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/restaurant/sales/reports?period=${p}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load sales data");
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    fetchData(period);
  }, [period]);

  // ── Loading ────────────────────────────────────────────────
  if (loading)
    return (
      <div className="sr-page">
        <div className="sr-center">
          <div className="sr-spinner" />
          <span>Loading sales reports…</span>
        </div>
      </div>
    );

  // ── Error ──────────────────────────────────────────────────
  if (error)
    return (
      <div className="sr-page">
        <div className="sr-center">
          <FiXCircle size={28} color="#e7000b" />
          <span className="sr-error">{error}</span>
        </div>
      </div>
    );

  const { summary, charts, currency, commissionRate, netProfitTotal } = data;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label;

  return (
    <div className="sr-page">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="sr-header">
        <div className="sr-header__left">
          <h2>Sales Reports</h2>
          <p>Detailed analytics and insights</p>
        </div>
        <div className="sr-filter">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={period === p.key ? "active" : ""}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="sr-stats">
        <StatCard
          id="totalRevenue"
          label="Total Revenue"
          value={summary.totalRevenue.value}
          change={summary.totalRevenue.change}
          currency={currency}
          isAmount
        />
        <StatCard
          id="totalOrders"
          label="Total Orders"
          value={summary.totalOrders.value}
          change={summary.totalOrders.change}
          currency={currency}
        />
        <StatCard
          id="avgOrderValue"
          label="Avg Order Value"
          value={summary.avgOrderValue.value}
          change={summary.avgOrderValue.change}
          currency={currency}
          isAmount
        />
        <StatCard
          id="netProfit"
          label="Net Profit"
          value={summary.netProfit.value}
          change={summary.netProfit.change}
          currency={currency}
          isAmount
        />
      </div>

      {/* ── Sales & Orders + Orders by Hour ────────────── */}
      <div className="sr-row">
        {/* Bar Chart */}
        <div className="sr-card">
          <div className="sr-card__head">
            <div>
              <p className="sr-card__title">Daily Sales & Orders</p>
              <p className="sr-card__sub">{periodLabel} performance</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.salesAndOrders} barGap={4}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--secondary-border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--secondary-text)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--secondary-text)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--secondary-text)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<ChartTip currency={currency} />} />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                name="Sales"
                fill="#f54900"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                yAxisId="right"
                dataKey="orders"
                name="Orders"
                fill="#1447e6"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="sr-legend">
            <div className="sr-legend__item">
              <div
                className="sr-legend__dot"
                style={{ background: "#f54900" }}
              />
              Sales ({currency})
            </div>
            <div className="sr-legend__item">
              <div
                className="sr-legend__dot"
                style={{ background: "#1447e6" }}
              />
              Orders
            </div>
          </div>
        </div>

        {/* Line Chart */}
        <div className="sr-card">
          <div className="sr-card__head">
            <div>
              <p className="sr-card__title">Orders by Hour</p>
              <p className="sr-card__sub">Peak hours analysis</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts.ordersByHour}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--secondary-border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--secondary-text)" }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--secondary-text)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<ChartTip currency={currency} />} />
              <Line
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#f54900"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Order Statuses + Top Selling ───────────────── */}
      <div className="sr-row">
        {/* Pie Chart */}
        <div className="sr-card">
          <div className="sr-card__head">
            <div>
              <p className="sr-card__title">Order Status Breakdown</p>
              <p className="sr-card__sub">{periodLabel} distribution</p>
            </div>
          </div>
          {charts.orderStatuses.length === 0 ? (
            <div className="sr-center" style={{ minHeight: 180 }}>
              <p style={{ fontSize: 13 }}>No orders in this period</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={charts.orderStatuses}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {charts.orderStatuses.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLOR[entry.status] || "#aaa"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, STATUS_LABEL[n] || n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="sr-pie-legend">
                {charts.orderStatuses.map((s) => (
                  <div key={s.status} className="sr-pie-legend__item">
                    <div className="sr-pie-legend__left">
                      <div
                        className="sr-legend__dot"
                        style={{ background: STATUS_COLOR[s.status] || "#aaa" }}
                      />
                      {STATUS_LABEL[s.status] || s.status}
                    </div>
                    <span className="sr-pie-legend__pct">
                      {s.count} ({s.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top Selling */}
        <div className="sr-card">
          <div className="sr-card__head">
            <div>
              <p className="sr-card__title">Top Selling Items</p>
              <p className="sr-card__sub">Best performers this {period}</p>
            </div>
          </div>
          {charts.topSellingItems.length === 0 ? (
            <div className="sr-center" style={{ minHeight: 180 }}>
              <p style={{ fontSize: 13 }}>No data for this period</p>
            </div>
          ) : (
            <div className="sr-top-items">
              {charts.topSellingItems.map((item, i) => (
                <div key={i} className="sr-top-item">
                  <span className="sr-top-item__rank">#{i + 1}</span>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="sr-top-item__img"
                    />
                  ) : (
                    <div className="sr-top-item__img-placeholder">
                      <MdOutlineFastfood />
                    </div>
                  )}
                  <div className="sr-top-item__info">
                    <p className="sr-top-item__name">{item.name}</p>
                    <p className="sr-top-item__qty">{item.quantity} orders</p>
                  </div>
                  <span className="sr-top-item__revenue">
                    {fmt(item.revenue, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Net Profit Bar ─────────────────────────────── */}
      <div className="sr-profit-bar">
        <div className="sr-profit-bar__left">
          <h4>
            Net Profit — {periodLabel} (after {commissionRate}% commission)
          </h4>
          <h2>{fmt(netProfitTotal, currency)}</h2>
        </div>
        <div className="sr-profit-bar__right">
          <FiTrendingUp size={15} />
          {summary.netProfit.change >= 0 ? "+" : ""}
          {summary.netProfit.change}% vs last {period}
        </div>
      </div>
    </div>
  );
};

export default SalesReports;
