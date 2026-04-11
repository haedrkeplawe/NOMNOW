// === ADMIN ===
import { FiPhone, FiUser, FiRefreshCw, FiTrendingUp } from "react-icons/fi";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
import { LuShoppingBag } from "react-icons/lu";
import { CiCalendar } from "react-icons/ci";
import { BsThreeDotsVertical } from "react-icons/bs";
import ShowCustomer from "../components/ShowCustomer";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

// ── Status badge ──────────────────────────────────────────────
const StatusBadge = ({ status }) =>
  status === "blocked" ? (
    <span className="cust-badge cust-badge--blocked">Blocked</span>
  ) : (
    <span className="cust-badge cust-badge--active">Active</span>
  );

const fmtMoney = (n) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const timeAgo = (date) => {
  if (!date) return "—";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const Customers = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();

  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    usersThisWeek: 0,
    activeThisMonth: 0,
    avgOrderValue: 0,
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/customer?${countryParam}`);
      setCustomers(res.data.customer);
      if (res.data.summary) setSummary(res.data.summary);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [api, countryParam]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="customers-page">
      {loading && (
        <div className="globale-loader">
          <div className="spinner" />
        </div>
      )}

      <HeadCreateAndDetails
        text1={"Customers"}
        text2={"Manage customer accounts and activity"}
        text3={null}
        setType={setType}
      />

      {/* ── Summary ─────────────────────────────────────────── */}
      <div className="summary">
        <div>
          <FiUser className="icon" />
          <p>Total Customers</p>
          <h2>{summary.totalUsers}</h2>
        </div>
        <div>
          <LuShoppingBag className="icon" />
          <p>Active This Month</p>
          <h2>{summary.activeThisMonth}</h2>
        </div>
        <div>
          <FiTrendingUp className="icon" />
          <p>Avg Order Value</p>
          <h2>{fmtMoney(summary.avgOrderValue)}</h2>
        </div>
        <div>
          <CiCalendar className="icon" />
          <p>New This Week</p>
          <h2>{summary.usersThisWeek}</h2>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="globale-search">
        <input
          type="text"
          placeholder="Search by name, email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="globale-menu">
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "blocked", label: "Blocked" },
        ].map((s) => (
          <button
            key={s.key}
            className={statusFilter === s.key ? "active" : ""}
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label}
          </button>
        ))}
        <button className="drv-refresh" onClick={fetchCustomers}>
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="menu-items">
        <div className="head">
          <h3>Customer</h3>
          <h3>Contact</h3>
          <h3>Orders</h3>
          <h3>Total Spent</h3>
          <h3>Last Order</h3>
          <h3>Status</h3>
          <h3>Actions</h3>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="item item-empty">
            <p>No customers found</p>
          </div>
        )}

        {filtered.map((customer) => (
          <div className="item" key={customer._id}>
            <div className="customer">
              <div className="img">
                {customer.img?.url ? (
                  <img src={customer.img.url} alt={customer.name} />
                ) : (
                  <FiUser className="icon" />
                )}
              </div>
              <div className="text">
                <h4>{customer.name}</h4>
                <p>
                  {new Date(customer.createdAt)
                    .toLocaleDateString("en-GB")
                    .replaceAll("/", "-")}
                </p>
              </div>
            </div>

            <div className="contact">
              <div>
                <FiUser className="icon" />
                <p>{customer.email}</p>
              </div>
              <div>
                <FiPhone className="icon" />
                <p>{customer.phone}</p>
              </div>
            </div>

            <div className="orders">{customer.totalOrders ?? 0}</div>

            <div className="spend">{fmtMoney(customer.totalSpent ?? 0)}</div>

            <div className="cust-last-order">
              {timeAgo(customer.lastOrderAt)}
            </div>

            <StatusBadge status={customer.status} />

            <div className="actions">
              <BsThreeDotsVertical
                className="icon"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setType("show");
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {(type === "show" || type === "block" || type === "unblock") &&
        selectedCustomer && (
          <ShowCustomer
            selectedCustomer={selectedCustomer}
            api={api}
            type={type}
            setType={setType}
            setCustomers={setCustomers}
            setSelectedCustomer={setSelectedCustomer}
          />
        )}
    </div>
  );
};

export default Customers;
