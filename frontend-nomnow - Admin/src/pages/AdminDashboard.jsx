// === ADMIN ===
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
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
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
} from "react-icons/fi";
import { BsShop } from "react-icons/bs";
import { FaCar } from "react-icons/fa";

// ─── تنسيق ────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// ─── Stat Card ────────────────────────────────────────────────
const StatCard = ({
  label,
  value,
  sub,
  Icon,
  iconBg,
  iconColor,
  change,
  isAmount,
}) => {
  const hasChange = change !== undefined && change !== null;
  const isPos = change >= 0;
  return (
    <div className="adm-stat">
      <div className="adm-stat__top">
        <div
          className="adm-stat__icon"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={18} />
        </div>
        {hasChange && (
          <span className={`adm-stat__change ${isPos ? "pos" : "neg"}`}>
            {isPos ? <FiTrendingUp size={11} /> : <FiTrendingDown size={11} />}
            {isPos ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <p className="adm-stat__label">{label}</p>
      <h2 className="adm-stat__value">{isAmount ? fmt(value) : value}</h2>
      {sub && <p className="adm-stat__sub">{sub}</p>}
    </div>
  );
};

// ─── Status badge ─────────────────────────────────────────────
const STATUS_META = {
  pending: { label: "Pending", color: "#b45309", bg: "#fffbeb" },
  accepted: { label: "Accepted", color: "#1447e6", bg: "#eff6ff" },
  preparing: { label: "Preparing", color: "#a21caf", bg: "#fdf4ff" },
  ready: { label: "Ready", color: "#00a63e", bg: "#f0fdf4" },
  picked_up: { label: "Picked Up", color: "#0891b2", bg: "#ecfeff" },
  on_the_way: { label: "On the Way", color: "#f54900", bg: "#fff3ef" },
  delivered: { label: "Delivered", color: "#00a63e", bg: "#f0fdf4" },
  delivered_by_driver: { label: "Delivered", color: "#00a63e", bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: "#e7000b", bg: "#fef2f2" },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, color: "#888", bg: "#eee" };
  return (
    <span className="adm-badge" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
};

// ─── Pie colours ──────────────────────────────────────────────
const PIE_COLORS = {
  pending: "#f59e0b",
  accepted: "#1447e6",
  preparing: "#a21caf",
  ready: "#00a63e",
  picked_up: "#0891b2",
  on_the_way: "#f54900",
  delivered: "#16a34a",
  delivered_by_driver: "#16a34a",
  cancelled: "#e7000b",
};

// ─── Custom Tooltip ───────────────────────────────────────────
const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="adm-tip">
      <p className="adm-tip__lbl">{label}</p>
      <p style={{ color: "#f54900" }}>{fmt(payload[0].value)} revenue</p>
      {payload[1] && (
        <p style={{ color: "#1447e6" }}>{payload[1].value} orders</p>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/admin/dashboard?${countryParam}`)
      .then((r) => setData(r.data))
      .catch(() => setError("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [api, countryParam]);

  if (loading)
    return (
      <div className="adm-page adm-center">
        <div className="adm-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );

  if (error)
    return (
      <div className="adm-page adm-center">
        <p className="adm-error">{error}</p>
      </div>
    );

  const { stats, charts, recentOrders } = data;

  return (
    <div className="adm-page">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="adm-header">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Welcome back! Here's what's happening today.</p>
        </div>
        {stats.pendingSettlements > 0 && (
          <Link to="/settlements" className="adm-alert">
            <FiAlertCircle size={15} />
            {stats.pendingSettlements} pending withdrawal
            {stats.pendingSettlements > 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="adm-stats">
        <StatCard
          label="Total Restaurants"
          value={stats.totalRestaurants}
          sub={`${stats.openRestaurants} open now`}
          Icon={BsShop}
          iconBg="#fff3ef"
          iconColor="#f54900"
        />
        <StatCard
          label="Active Drivers"
          value={stats.activeDrivers}
          sub={`${stats.onlineDrivers} online now`}
          Icon={FaCar}
          iconBg="#eff6ff"
          iconColor="#1447e6"
        />
        <StatCard
          label="Total Customers"
          value={stats.totalCustomers}
          Icon={FiUsers}
          iconBg="#fdf4ff"
          iconColor="#a21caf"
        />
        <StatCard
          label="Today's Orders"
          value={stats.todayOrders}
          change={stats.ordersChange}
          sub="vs yesterday"
          Icon={FiShoppingBag}
          iconBg="#f0fdf4"
          iconColor="#00a63e"
        />
        <StatCard
          label="Today's Revenue"
          value={stats.todayRevenue}
          change={stats.revenueChange}
          sub="vs yesterday"
          Icon={FiDollarSign}
          iconBg="#fffbeb"
          iconColor="#b45309"
          isAmount
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="adm-row">
        {/* Revenue + Orders — Last 7 Days */}
        <div className="adm-card adm-wide">
          <div className="adm-card-head">
            <div>
              <h3 className="adm-card-title">Revenue Last 7 Days</h3>
              <p className="adm-card-sub">Daily revenue & order volume</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart
              data={charts.revenueLastWeek}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f54900" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f54900" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1447e6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1447e6" stopOpacity={0} />
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
              />
              <YAxis
                tick={{ fill: "var(--secondary-text)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<AreaTip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f54900"
                strokeWidth={2.5}
                fill="url(#gRev)"
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#1447e6"
                strokeWidth={2}
                fill="url(#gOrd)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="adm-legend">
            <span className="adm-legend__item">
              <span
                className="adm-legend__dot"
                style={{ background: "#f54900" }}
              />
              Revenue
            </span>
            <span className="adm-legend__item">
              <span
                className="adm-legend__dot"
                style={{ background: "#1447e6" }}
              />
              Orders
            </span>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="adm-card adm-narrow">
          <div className="adm-card-head">
            <div>
              <h3 className="adm-card-title">Order Status</h3>
              <p className="adm-card-sub">Distribution today</p>
            </div>
          </div>
          {charts.orderStatusDist.length === 0 ? (
            <div className="adm-empty">No orders today</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={charts.orderStatusDist}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {charts.orderStatusDist.map((e) => (
                      <Cell
                        key={e.status}
                        fill={PIE_COLORS[e.status] || "#ccc"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [
                      `${v} orders`,
                      STATUS_META[n]?.label || n,
                    ]}
                    contentStyle={{
                      background: "var(--primary-background)",
                      border: "1px solid var(--primary-border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--primary-text)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="adm-pie-legend">
                {charts.orderStatusDist.slice(0, 5).map((e) => (
                  <div key={e.status} className="adm-pie-legend__row">
                    <span
                      className="adm-pie-legend__dot"
                      style={{ background: PIE_COLORS[e.status] || "#ccc" }}
                    />
                    <span className="adm-pie-legend__lbl">
                      {STATUS_META[e.status]?.label || e.status}
                    </span>
                    <span className="adm-pie-legend__val">{e.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Recent Orders Table ──────────────────────────────── */}
      <div className="adm-card">
        <div className="adm-card-head">
          <div>
            <h3 className="adm-card-title">Recent Orders</h3>
            <p className="adm-card-sub">
              Latest activity across all restaurants
            </p>
          </div>
        </div>
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Order ID</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="adm-tbl__empty">
                    No recent orders
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => {
                  const isExpanded = expandedOrder === o._id;
                  const cur = o.currency || "SYP";
                  const fmtAmt = (n) =>
                    `${Number(n).toLocaleString("en-US", {
                      minimumFractionDigits: cur === "EUR" ? 2 : 0,
                      maximumFractionDigits: cur === "EUR" ? 2 : 0,
                    })} ${cur}`;
                  return (
                    <>
                      <tr
                        key={o._id}
                        className={isExpanded ? "adm-tbl__row--active" : ""}
                      >
                        <td>
                          <button
                            className="drv-cash-expand-btn"
                            onClick={() =>
                              setExpandedOrder(isExpanded ? null : o._id)
                            }
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </td>
                        <td className="adm-tbl__id">#{o.orderNumber}</td>
                        <td>{o.customerName}</td>
                        <td>
                          <div className="adm-restaurant-cell">
                            <BsShop size={13} />
                            {o.restaurantName}
                          </div>
                        </td>
                        <td className="adm-tbl__amount">{fmtAmt(o.amount)}</td>
                        <td>
                          <StatusBadge status={o.orderStatus} />
                        </td>
                        <td className="adm-tbl__time">{o.timeAgo}</td>
                      </tr>

                      {isExpanded && (
                        <tr
                          key={`${o._id}-exp`}
                          className="drv-cash-expanded-row"
                        >
                          <td colSpan={7}>
                            <div className="drv-cash-expanded">
                              {/* Info grid */}
                              <div className="drv-cash-exp-grid">
                                <div className="drv-cash-exp-item">
                                  <span>Customer Phone</span>
                                  <strong>{o.customerPhone || "—"}</strong>
                                </div>
                                <div className="drv-cash-exp-item">
                                  <span>Payment Method</span>
                                  <strong
                                    style={{ textTransform: "capitalize" }}
                                  >
                                    {o.paymentMethod || "—"}
                                  </strong>
                                </div>
                                <div className="drv-cash-exp-item">
                                  <span>Payment Status</span>
                                  <strong
                                    style={{ textTransform: "capitalize" }}
                                  >
                                    {o.paymentStatus || "—"}
                                  </strong>
                                </div>
                                {o.driverName && (
                                  <div className="drv-cash-exp-item">
                                    <span>Driver</span>
                                    <strong>
                                      {o.driverName} — {o.driverPhone || "—"}
                                    </strong>
                                  </div>
                                )}
                                <div className="drv-cash-exp-item">
                                  <span>Items Price</span>
                                  <strong>{fmtAmt(o.itemsPrice)}</strong>
                                </div>
                                <div className="drv-cash-exp-item">
                                  <span>Delivery Fee</span>
                                  <strong>{fmtAmt(o.deliveryFee)}</strong>
                                </div>
                                {o.taxBreakdown ? (
                                  <>
                                    <div className="drv-cash-exp-item">
                                      <span>
                                        Food Tax ({o.taxBreakdown.foodTaxRate}%
                                        MwSt)
                                      </span>
                                      <strong>
                                        {fmtAmt(o.taxBreakdown.foodTax)}
                                      </strong>
                                    </div>
                                    <div className="drv-cash-exp-item">
                                      <span>
                                        Delivery Tax (
                                        {o.taxBreakdown.deliveryTaxRate}% MwSt)
                                      </span>
                                      <strong>
                                        {fmtAmt(o.taxBreakdown.deliveryTax)}
                                      </strong>
                                    </div>
                                  </>
                                ) : o.taxPrice > 0 ? (
                                  <div className="drv-cash-exp-item">
                                    <span>Tax</span>
                                    <strong>{fmtAmt(o.taxPrice)}</strong>
                                  </div>
                                ) : null}
                                <div className="drv-cash-exp-item drv-cash-exp-total">
                                  <span>Total</span>
                                  <strong>{fmtAmt(o.amount)}</strong>
                                </div>
                                {o.restaurantAddress &&
                                  o.restaurantAddress !== "—" && (
                                    <div
                                      className="drv-cash-exp-item"
                                      style={{ gridColumn: "1 / -1" }}
                                    >
                                      <span>Restaurant Address</span>
                                      <strong>{o.restaurantAddress}</strong>
                                    </div>
                                  )}
                                {o.deliveryAddress &&
                                  o.deliveryAddress !== "—" && (
                                    <div
                                      className="drv-cash-exp-item"
                                      style={{ gridColumn: "1 / -1" }}
                                    >
                                      <span>Delivery Address</span>
                                      <strong>{o.deliveryAddress}</strong>
                                    </div>
                                  )}
                                {o.notes && (
                                  <div
                                    className="drv-cash-exp-item"
                                    style={{ gridColumn: "1 / -1" }}
                                  >
                                    <span>Notes</span>
                                    <strong>{o.notes}</strong>
                                  </div>
                                )}
                              </div>

                              {/* Items list */}
                              {o.items?.length > 0 && (
                                <div className="drv-cash-exp-items">
                                  <p className="drv-cash-exp-items-title">
                                    Order Items
                                  </p>
                                  {o.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="drv-cash-exp-item-row"
                                    >
                                      <span className="drv-cash-exp-item-name">
                                        {item.name}
                                        {item.size && <em> · {item.size}</em>}
                                        {item.extras?.length > 0 && (
                                          <em>
                                            {" "}
                                            ·{" "}
                                            {item.extras
                                              .map((e) => e.name)
                                              .join(", ")}
                                          </em>
                                        )}
                                      </span>
                                      <span className="drv-cash-exp-item-qty">
                                        ×{item.quantity}
                                      </span>
                                      <span className="drv-cash-exp-item-price">
                                        {fmtAmt(item.totalPrice)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
