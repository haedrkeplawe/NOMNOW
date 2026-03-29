// === ADMIN ===
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
import { toast } from "react-hot-toast";
import {
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { BsShop } from "react-icons/bs";

// ─── تنسيق الأرقام ────────────────────────────────────────────
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
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Helper: جمع المبالغ حسب العملة ─────────────────────────
const groupByCurrency = (list) => {
  const map = {};
  list.forEach((s) => {
    const cur = s.restaurantId?.currency || "SYP";
    map[cur] = (map[cur] || 0) + s.amount;
  });
  return map; // e.g. { SYP: 50000, EUR: 1200 }
};

const fmtByCurrency = (byCurrency) => {
  if (!byCurrency || Object.keys(byCurrency).length === 0) return "0";
  return Object.entries(byCurrency)
    .map(([cur, amt]) => fmt(amt, cur))
    .join(" · ");
};
const StatusBadge = ({ status }) => {
  const map = {
    pending: { label: "Pending", cls: "set-badge set-badge--yellow" },
    approved: { label: "Approved", cls: "set-badge set-badge--green" },
    rejected: { label: "Rejected", cls: "set-badge set-badge--red" },
  };
  const { label, cls } = map[status] || { label: status, cls: "set-badge" };
  return <span className={cls}>{label}</span>;
};

// ─── Summary Card ─────────────────────────────────────────────
const SummaryCard = ({
  label,
  value,
  Icon,
  iconBg,
  iconColor,
  badge,
  badgeCls,
}) => (
  <div className="set-summary-card">
    <div className="set-summary-card__top">
      <div
        className="set-summary-card__icon"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={18} />
      </div>
      {badge && <span className={`set-badge ${badgeCls}`}>{badge}</span>}
    </div>
    <p className="set-summary-card__label">{label}</p>
    <h2 className="set-summary-card__value">{value}</h2>
  </div>
);

// ─── Reject Modal ─────────────────────────────────────────────
const RejectModal = ({ settlement, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState("");
  return (
    <div className="set-overlay" onClick={onClose}>
      <div className="set-modal" onClick={(e) => e.stopPropagation()}>
        <div className="set-modal__header">
          <h3>Reject Withdrawal Request</h3>
          <button className="set-modal__close" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>
        <div className="set-modal__body">
          <div className="set-modal__info">
            <BsShop size={16} />
            <span>{settlement.restaurantId?.name || "Restaurant"}</span>
            <strong style={{ marginLeft: "auto" }}>
              {fmt(
                settlement.amount,
                settlement.restaurantId?.currency || "SYP",
              )}
            </strong>
          </div>
          <label className="set-modal__label">Reason for Rejection *</label>
          <textarea
            className="set-modal__textarea"
            placeholder="Enter rejection reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>
        <div className="set-modal__footer">
          <button className="set-btn set-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="set-btn set-btn--danger"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
          >
            {loading ? "Rejecting…" : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
const Settlements = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [summary, setSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    pendingByCurrency: {},
    approvedByCurrency: {},
  });

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const statusQ = filter !== "all" ? `status=${filter}&` : "";
      const res = await api.get(
        `/admin/settlements?${statusQ}limit=100${countryParam}`,
      );
      const list = res.data.settlements || [];
      setSettlements(list);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const cp = countryParam;
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        api.get(`/admin/settlements?status=pending&limit=200${cp}`),
        api.get(`/admin/settlements?status=approved&limit=200${cp}`),
        api.get(`/admin/settlements?status=rejected&limit=200${cp}`),
      ]);
      const pendingList = pendingRes.data.settlements || [];
      const approvedList = approvedRes.data.settlements || [];
      const rejectedList = rejectedRes.data.settlements || [];

      setSummary({
        pending: pendingList.length,
        approved: approvedList.length,
        rejected: rejectedList.length,
        // نجمع المبالغ حسب العملة
        pendingByCurrency: groupByCurrency(pendingList),
        approvedByCurrency: groupByCurrency(approvedList),
        // للتوافق مع الكود القديم
        pendingAmount: pendingList.reduce((s, x) => s + x.amount, 0),
        approvedAmount: approvedList.reduce((s, x) => s + x.amount, 0),
      });
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [filter, countryParam]);
  useEffect(() => {
    fetchSummary();
  }, [countryParam]);

  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      await api.patch(`/admin/settlements/${id}/approve`, {
        resolvedBy: "admin",
      });
      toast.success("Settlement approved successfully");
      fetchSettlements();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async (reason) => {
    try {
      setActionLoading(true);
      await api.patch(`/admin/settlements/${rejectTarget._id}/reject`, {
        rejectionReason: reason,
        resolvedBy: "admin",
      });
      toast.success("Settlement rejected");
      setRejectTarget(null);
      fetchSettlements();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  // فلترة البحث
  const filtered = settlements.filter((s) => {
    const name = s.restaurantId?.name?.toLowerCase() || "";
    return name.includes(search.toLowerCase());
  });

  const tabs = [
    { key: "pending", label: "Pending", count: summary.pending },
    { key: "approved", label: "Approved", count: summary.approved },
    { key: "rejected", label: "Rejected", count: summary.rejected },
    {
      key: "all",
      label: "All",
      count: summary.pending + summary.approved + summary.rejected,
    },
  ];

  return (
    <div className="set-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="set-header">
        <div>
          <h2>Withdrawal Requests</h2>
          <p>Manage restaurant settlement requests</p>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────── */}
      <div className="set-summary">
        <SummaryCard
          label="Pending Requests"
          value={summary.pending}
          Icon={FiClock}
          iconBg="#fffbeb"
          iconColor="#b45309"
          badge="Action Needed"
          badgeCls="set-badge--yellow"
        />
        <SummaryCard
          label="Pending Amount"
          value={fmtByCurrency(summary.pendingByCurrency)}
          Icon={FiDollarSign}
          iconBg="#fff7ed"
          iconColor="#ea6f00"
        />
        <SummaryCard
          label="Total Approved"
          value={summary.approved}
          Icon={FiCheckCircle}
          iconBg="#f0fdf4"
          iconColor="#00a63e"
          badge="Paid Out"
          badgeCls="set-badge--green"
        />
        <SummaryCard
          label="Total Paid Out"
          value={fmtByCurrency(summary.approvedByCurrency)}
          Icon={FiDollarSign}
          iconBg="#f0fdf4"
          iconColor="#00a63e"
        />
      </div>

      {/* ── Tabs + Search ────────────────────────────────────── */}
      <div className="set-toolbar">
        <div className="set-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`set-tab ${filter === t.key ? "active" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <span className="set-tab__count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="set-search">
          <FiSearch size={15} />
          <input
            placeholder="Search by restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="set-table-wrap">
        {loading ? (
          <div className="set-center">
            <div className="set-spinner" />
            <span>Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="set-center">
            <FiDollarSign size={36} style={{ opacity: 0.25 }} />
            <span>No withdrawal requests found</span>
          </div>
        ) : (
          <table className="set-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Restaurant</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Status</th>
                <th>Rejection Reason</th>
                <th>Requested At</th>
                <th>Resolved At</th>
                {filter === "pending" || filter === "all" ? (
                  <th>Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s._id}>
                  <td className="set-table__num">{i + 1}</td>
                  <td>
                    <div className="set-restaurant-cell">
                      <div className="set-restaurant-cell__icon">
                        <BsShop size={14} />
                      </div>
                      <span>{s.restaurantId?.name || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <strong className="set-amount">
                      {fmt(s.amount, s.restaurantId?.currency || "SYP")}
                    </strong>
                  </td>
                  <td className="set-table__note">{s.note || "—"}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="set-table__reason">
                    {s.rejectionReason || "—"}
                  </td>
                  <td className="set-table__date">{fmtDate(s.createdAt)}</td>
                  <td className="set-table__date">
                    {s.resolvedAt ? fmtDate(s.resolvedAt) : "—"}
                  </td>
                  {filter === "pending" || filter === "all" ? (
                    <td>
                      {s.status === "pending" ? (
                        <div className="set-actions">
                          <button
                            className="set-btn set-btn--approve"
                            onClick={() => handleApprove(s._id)}
                            disabled={actionLoading}
                          >
                            <FiCheckCircle size={14} /> Approve
                          </button>
                          <button
                            className="set-btn set-btn--reject"
                            onClick={() => setRejectTarget(s)}
                            disabled={actionLoading}
                          >
                            <FiXCircle size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "var(--secondary-text)",
                            fontSize: 13,
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Reject Modal ────────────────────────────────────── */}
      {rejectTarget && (
        <RejectModal
          settlement={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default Settlements;
