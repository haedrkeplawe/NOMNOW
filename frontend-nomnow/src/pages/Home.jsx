import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FiShoppingBag,
  FiClock,
  FiCheckCircle,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { useRestaurant } from "../context/RestaurantContext";

// ─────────────────────────────────────────────────────────────
// بطاقة الإحصاء
// ─────────────────────────────────────────────────────────────
const CARD_META = {
  dailySales: { bg: "#fff3ef", color: "#f54900", Icon: FiDollarSign },
  dailyOrders: { bg: "#eff6ff", color: "#1447e6", Icon: FiShoppingBag },
  avgPrepTime: { bg: "#fdf4ff", color: "#a21caf", Icon: FiClock },
  acceptanceRate: { bg: "#f0fdf4", color: "#00a63e", Icon: FiCheckCircle },
};

const StatCard = ({ id, title, value, change, prefix = "", suffix = "" }) => {
  const isPos = change >= 0;
  const { bg, color, Icon } = CARD_META[id];
  return (
    <div className="hm-stat">
      <div className="hm-stat__top">
        <div className="hm-stat__icon" style={{ background: bg, color }}>
          <Icon size={18} />
        </div>
        <span className={`hm-stat__change ${isPos ? "pos" : "neg"}`}>
          {isPos ? <FiTrendingUp size={11} /> : <FiTrendingDown size={11} />}
          {isPos ? "+" : ""}
          {change}%
        </span>
      </div>
      <p className="hm-stat__label">{title}</p>
      <h2 className="hm-stat__value">
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix}
      </h2>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────
const STATUS_META = {
  pending: { label: "Pending", color: "#f59e0b", bg: "#fffbeb" },
  accepted: { label: "Accepted", color: "#1447e6", bg: "#eff6ff" },
  preparing: { label: "Preparing", color: "#a21caf", bg: "#fdf4ff" },
  ready: { label: "Ready", color: "#00a63e", bg: "#f0fdf4" },
  picked_up: { label: "Picked Up", color: "#0891b2", bg: "#ecfeff" },
  on_the_way: { label: "In Progress", color: "#1447e6", bg: "#eff6ff" },
  delivered: { label: "Completed", color: "#00a63e", bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: "#e7000b", bg: "#fef2f2" },
};
const TYPE_META = {
  delivery: { label: "Delivery", color: "#1447e6", bg: "#eff6ff" },
  pickup: { label: "Pickup", color: "#00a63e", bg: "#f0fdf4" },
  dine_in: { label: "Dine-in", color: "#f59e0b", bg: "#fffbeb" },
};

const Badge = ({ meta, value }) => {
  const s = meta[value] || { label: value, color: "#888", bg: "#eee" };
  return (
    <span className="hm-badge" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Pie colours & labels
// ─────────────────────────────────────────────────────────────
const PIE_COLOR = {
  pending: "#f59e0b",
  accepted: "#1447e6",
  preparing: "#a21caf",
  ready: "#00a63e",
  picked_up: "#0891b2",
  on_the_way: "#f54900",
  delivered: "#16a34a",
  cancelled: "#e7000b",
};
const PIE_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked Up",
  on_the_way: "On the Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// ─────────────────────────────────────────────────────────────
// Tooltips
// ─────────────────────────────────────────────────────────────
const AreaTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="hm-tip">
      <p className="hm-tip__lbl">{label}</p>
      <p style={{ color: "#f54900" }}>
        {Number(payload[0].value).toFixed(2) + " " + currency}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Home Page
// ─────────────────────────────────────────────────────────────
const Home = () => {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currency } = useRestaurant();

  useEffect(() => {
    api
      .get("/restaurant/dashboard/stats")
      .then((r) => setData(r.data))
      .catch(() => setError("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="hm-page hm-center">
        <div className="hm-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  if (error)
    return (
      <div className="hm-page hm-center">
        <p className="hm-error">{error}</p>
      </div>
    );

  const { summary, charts, recentOrders } = data;

  return (
    <div className="hm-page">
      {/* ── Stats ──────────────────────────────────────── */}
      <div className="hm-stats">
        <StatCard
          id="dailySales"
          title="Daily Sales"
          value={Number(summary.dailySales.value.toFixed(2))}
          change={summary.dailySales.change}
          prefix={currency}
        />
        <StatCard
          id="dailyOrders"
          title="Daily Orders"
          value={summary.dailyOrders.value}
          change={summary.dailyOrders.change}
        />
        <StatCard
          id="avgPrepTime"
          title="Avg Prep Time"
          value={summary.avgPrepTime.value}
          change={summary.avgPrepTime.change}
          suffix="m"
        />
        <StatCard
          id="acceptanceRate"
          title="Acceptance Rate"
          value={summary.acceptanceRate.value}
          change={summary.acceptanceRate.change}
          suffix="%"
        />
      </div>

      {/* ── Sales Overview + Order Types ───────────────── */}
      <div className="hm-row">
        <div className="hm-card hm-wide">
          <div className="hm-card-head">
            <div>
              <h3 className="hm-card-title">Sales Overview</h3>
              <p className="hm-card-sub">Hourly sales performance</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={charts.salesByHour}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f54900" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#f54900" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--primary-border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--secondary-text)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fill: "var(--secondary-text)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<AreaTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#f54900"
                strokeWidth={2.5}
                fill="url(#gSales)"
                dot={false}
                activeDot={{ r: 5, fill: "#f54900" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="hm-card hm-narrow">
          <div className="hm-card-head">
            <div>
              <h3 className="hm-card-title">Order Types</h3>
              <p className="hm-card-sub">Distribution today</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={charts.orderTypes}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {charts.orderTypes.map((e) => (
                  <Cell key={e.type} fill={PIE_COLOR[e.type] || "#ccc"} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${v} orders`, PIE_LABEL[n] || n]}
                contentStyle={{
                  background: "var(--primary-background)",
                  border: "1px solid var(--primary-border)",
                  borderRadius: 8,
                  color: "var(--primary-text)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="hm-pie-legend">
            {charts.orderTypes.map((t) => (
              <div key={t.type} className="hm-pie-legend__row">
                <span
                  className="hm-pie-legend__dot"
                  style={{ background: PIE_COLOR[t.type] }}
                />
                <span className="hm-pie-legend__txt">
                  {PIE_LABEL[t.type] || t.type} {t.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Orders + Top Selling ─────────────────── */}
      <div className="hm-row">
        <div className="hm-card hm-wide">
          <div className="hm-card-head">
            <div>
              <h3 className="hm-card-title">Recent Orders</h3>
              <p className="hm-card-sub">Live order updates</p>
            </div>
            <Link to="/orders" className="hm-view-all">
              View All
            </Link>
          </div>
          <div className="hm-tbl-wrap">
            <table className="hm-tbl">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Driver</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="hm-tbl__empty">
                      No orders today
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o._id}>
                      <td className="hm-tbl__id">#{o.orderNumber}</td>
                      <td className="hm-tbl__time">{o.timeAgo}</td>
                      <td>
                        <Badge meta={TYPE_META} value={o.orderType} />
                      </td>
                      <td>{o.itemsCount}</td>
                      <td>
                        {o.driverName || <span className="hm-tbl__na">—</span>}
                      </td>
                      <td>
                        <Badge meta={STATUS_META} value={o.orderStatus} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hm-card hm-narrow">
          <div className="hm-card-head">
            <div className="hm-card-head__icon">
              <FiTrendingUp size={15} />
            </div>
            <div>
              <h3 className="hm-card-title">Top Selling</h3>
              <p className="hm-card-sub">Today's best</p>
            </div>
          </div>
          <div className="hm-top-list">
            {charts.topSelling.length === 0 ? (
              <p className="hm-empty">No sales data yet</p>
            ) : (
              charts.topSelling.slice(0, 5).map((item, i) => (
                <div key={i} className="hm-top-row">
                  <span className={`hm-top-rank r${i + 1}`}>{i + 1}</span>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="hm-top-img"
                    />
                  ) : (
                    <div className="hm-top-img hm-top-img--ph">🍽</div>
                  )}
                  <span className="hm-top-name">{item.name}</span>
                  <span className="hm-top-qty">
                    <FiShoppingBag size={11} /> {item.quantity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
