// === ADMIN ===
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiTag,
  FiUsers,
  FiCalendar,
  FiSearch,
  FiCheck,
} from "react-icons/fi";

// ─── Type meta (لون + تسمية لكل نوع كوبون) ──────────────────────
const TYPE_META = {
  percentage: { label: "Percentage", color: "#1447e6", bg: "#eff6ff" },
  fixed: { label: "Fixed Amount", color: "#7e22ce", bg: "#faf5ff" },
  free_delivery: { label: "Free Delivery", color: "#008236", bg: "#f0fdf4" },
};

const emptyForm = {
  code: "",
  type: "fixed",
  value: "",
  maxDiscountAmount: "",
  minOrderValue: "",
  audience: "all",
  allowedUserIds: [],
  hasExpiry: false,
  startDate: "",
  endDate: "",
  maxTotalUses: "",
  maxUsesPerUser: "",
  note: "",
  isActive: true,
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// ─── Badge ───────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const m = TYPE_META[type] || { label: type, color: "#888", bg: "#eee" };
  return (
    <span className="cpn-badge" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
};

// ─── Coupon row ──────────────────────────────────────────────
const CouponRow = ({ coupon, onEdit, onToggleActive, onDelete }) => {
  const usageLabel = () => {
    const used = coupon.usedCount || 0;
    if (coupon.maxTotalUses) return `${used} / ${coupon.maxTotalUses}`;
    return `${used} used`;
  };

  return (
    <tr className={!coupon.isActive ? "cpn-row--inactive" : ""}>
      <td>
        <span className="cpn-code">{coupon.code}</span>
        {coupon.note && <p className="cpn-note">{coupon.note}</p>}
      </td>
      <td>
        <TypeBadge type={coupon.type} />
      </td>
      <td>
        {coupon.type === "free_delivery"
          ? "—"
          : coupon.type === "percentage"
          ? `${coupon.value}%`
          : coupon.value}
      </td>
      <td>
        <span className="cpn-audience">
          <FiUsers size={12} />
          {coupon.audience === "all"
            ? "All users"
            : `${coupon.allowedUserIds?.length || 0} user(s)`}
        </span>
      </td>
      <td>{usageLabel()}</td>
      <td>
        {coupon.hasExpiry ? (
          <span className="cpn-expiry">
            <FiCalendar size={12} />
            {fmtDate(coupon.endDate)}
          </span>
        ) : (
          <span className="cpn-expiry cpn-expiry--none">No expiry</span>
        )}
      </td>
      <td>
        <button
          className={`cpn-status-toggle ${coupon.isActive ? "active" : ""}`}
          onClick={() => onToggleActive(coupon)}
        >
          {coupon.isActive ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="cpn-actions">
        <button onClick={() => onEdit(coupon)} title="Edit">
          <FiEdit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(coupon)}
          title="Delete"
          className="cpn-danger"
        >
          <FiTrash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

// ─── User picker (multi-select with search, لـ specific_users) ──
const UserPicker = ({ customers, selectedIds, onChange }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q),
    );
  }, [customers, search]);

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="cpn-picker">
      <div className="cpn-picker__search">
        <FiSearch size={13} />
        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="cpn-picker__list">
        {filtered.length === 0 ? (
          <p className="cpn-picker__empty">No matching customers</p>
        ) : (
          filtered.slice(0, 100).map((c) => {
            const checked = selectedIds.includes(c._id);
            return (
              <div
                key={c._id}
                className={`cpn-picker__item ${checked ? "checked" : ""}`}
                onClick={() => toggle(c._id)}
              >
                <span className="cpn-picker__check">
                  {checked && <FiCheck size={12} />}
                </span>
                <span className="cpn-picker__name">{c.name}</span>
                <span className="cpn-picker__phone">{c.phone}</span>
              </div>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="cpn-picker__count">{selectedIds.length} selected</p>
      )}
    </div>
  );
};

// ─── Create/Edit form modal ──────────────────────────────────
const CouponFormModal = ({
  initial,
  customers,
  onClose,
  onSave,
  saving,
  error,
}) => {
  const [form, setForm] = useState(initial);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="cpn-modal-overlay" onClick={onClose}>
      <div className="cpn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cpn-modal__head">
          <h3>{initial._id ? "Edit Coupon" : "New Coupon"}</h3>
          <button onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <form className="cpn-modal__body" onSubmit={handleSubmit}>
          {error && <div className="cpn-form-error">{error}</div>}

          <div className="cpn-field-row">
            <label>
              Code
              <input
                type="text"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. ORDER50"
                required
                disabled={Boolean(initial._id)}
              />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
                <option value="free_delivery">Free Delivery</option>
              </select>
            </label>
          </div>

          {form.type !== "free_delivery" && (
            <div className="cpn-field-row">
              <label>
                Value {form.type === "percentage" ? "(%)" : ""}
                <input
                  type="number"
                  min="0"
                  max={form.type === "percentage" ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  required
                />
              </label>
              {form.type === "percentage" && (
                <label>
                  Max Discount Amount (optional)
                  <input
                    type="number"
                    min="0"
                    value={form.maxDiscountAmount}
                    onChange={(e) => set("maxDiscountAmount", e.target.value)}
                    placeholder="No cap"
                  />
                </label>
              )}
            </div>
          )}

          <div className="cpn-field-row">
            <label>
              Minimum Order Value
              <input
                type="number"
                min="0"
                value={form.minOrderValue}
                onChange={(e) => set("minOrderValue", e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Audience
              <select
                value={form.audience}
                onChange={(e) => set("audience", e.target.value)}
              >
                <option value="all">All users</option>
                <option value="specific_users">Specific users</option>
              </select>
            </label>
          </div>

          {form.audience === "specific_users" && (
            <UserPicker
              customers={customers}
              selectedIds={form.allowedUserIds}
              onChange={(ids) => set("allowedUserIds", ids)}
            />
          )}

          <div className="cpn-field-row">
            <label>
              Max Total Uses (optional)
              <input
                type="number"
                min="1"
                value={form.maxTotalUses}
                onChange={(e) => set("maxTotalUses", e.target.value)}
                placeholder="Unlimited"
              />
            </label>
            <label>
              Max Uses Per User (optional)
              <input
                type="number"
                min="1"
                value={form.maxUsesPerUser}
                onChange={(e) => set("maxUsesPerUser", e.target.value)}
                placeholder="Unlimited"
              />
            </label>
          </div>

          <label className="cpn-checkbox-row">
            <input
              type="checkbox"
              checked={form.hasExpiry}
              onChange={(e) => set("hasExpiry", e.target.checked)}
            />
            Has an expiry date
          </label>

          {form.hasExpiry && (
            <div className="cpn-field-row">
              <label>
                Start Date
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  required={form.hasExpiry}
                />
              </label>
              <label>
                End Date
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => set("endDate", e.target.value)}
                  required={form.hasExpiry}
                />
              </label>
            </div>
          )}

          <label>
            Internal Note (optional)
            <input
              type="text"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="What is this coupon for?"
            />
          </label>

          <label className="cpn-checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Active
          </label>

          <div className="cpn-modal__footer">
            <button
              type="button"
              className="cpn-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="cpn-btn-primary" disabled={saving}>
              {saving
                ? "Saving…"
                : initial._id
                ? "Save Changes"
                : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const CouponsManager = () => {
  const { api } = useAuth();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  const [customers, setCustomers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null); // null = create mode
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all")
        params.set("isActive", statusFilter === "active");
      const res = await api.get(`/admin/coupons?${params.toString()}`);
      setCoupons(res.data.coupons || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // نجيب لستة الزبائن السوريين مرة وحدة بس (الكوبونات مقتصرة على
  // السوري حالياً — راجع ملاحظات نظام الكوبونات بالباك اند)
  useEffect(() => {
    api
      .get("/admin/customer?country=SY")
      .then((res) => setCustomers(res.data.customer || []))
      .catch(() => {});
  }, [api]);

  const openCreate = () => {
    setEditingCoupon(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCoupon(null);
    setFormError(null);
  };

  const handleSave = async (form) => {
    setSaving(true);
    setFormError(null);

    const payload = {
      type: form.type,
      value: form.type === "free_delivery" ? null : Number(form.value),
      maxDiscountAmount: form.maxDiscountAmount
        ? Number(form.maxDiscountAmount)
        : null,
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
      audience: form.audience,
      allowedUserIds:
        form.audience === "specific_users" ? form.allowedUserIds : [],
      hasExpiry: form.hasExpiry,
      startDate: form.hasExpiry ? form.startDate : null,
      endDate: form.hasExpiry ? form.endDate : null,
      maxTotalUses: form.maxTotalUses ? Number(form.maxTotalUses) : null,
      maxUsesPerUser: form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
      note: form.note,
      isActive: form.isActive,
    };

    try {
      if (editingCoupon) {
        await api.patch("/admin/coupons", {
          couponId: editingCoupon._id,
          ...payload,
        });
      } else {
        await api.post("/admin/coupons", { code: form.code, ...payload });
      }
      closeForm();
      fetchCoupons();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      await api.patch("/admin/coupons", {
        couponId: coupon._id,
        isActive: !coupon.isActive,
      });
      fetchCoupons();
    } catch {
      // silent
    }
  };

  const handleDelete = async (coupon) => {
    if (
      !window.confirm(`Delete coupon "${coupon.code}"? This can't be undone.`)
    )
      return;
    try {
      await api.delete("/admin/coupons", { data: { couponId: coupon._id } });
      fetchCoupons();
    } catch {
      // silent
    }
  };

  const formInitial = editingCoupon
    ? {
        _id: editingCoupon._id,
        code: editingCoupon.code,
        type: editingCoupon.type,
        value: editingCoupon.value ?? "",
        maxDiscountAmount: editingCoupon.maxDiscountAmount ?? "",
        minOrderValue: editingCoupon.minOrderValue ?? "",
        audience: editingCoupon.audience,
        allowedUserIds: (editingCoupon.allowedUserIds || []).map(
          (u) => u._id || u,
        ),
        hasExpiry: editingCoupon.hasExpiry,
        startDate: editingCoupon.startDate
          ? editingCoupon.startDate.slice(0, 10)
          : "",
        endDate: editingCoupon.endDate
          ? editingCoupon.endDate.slice(0, 10)
          : "",
        maxTotalUses: editingCoupon.maxTotalUses ?? "",
        maxUsesPerUser: editingCoupon.maxUsesPerUser ?? "",
        note: editingCoupon.note || "",
        isActive: editingCoupon.isActive,
      }
    : emptyForm;

  return (
    <div className="cpn-page">
      <div className="cpn-header">
        <div>
          <h2>Coupons</h2>
          <p>
            Manage discount codes — currently available for Syrian (cash) orders
            only
          </p>
        </div>
        <button className="cpn-btn-primary" onClick={openCreate}>
          <FiPlus size={14} />
          New Coupon
        </button>
      </div>

      <div className="cpn-tabs">
        {["all", "active", "inactive"].map((tab) => (
          <button
            key={tab}
            className={`cpn-tab ${statusFilter === tab ? "active" : ""}`}
            onClick={() => setStatusFilter(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="cpn-table-wrap">
        {loading ? (
          <div className="cpn-center">
            <div className="cpn-spinner" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="cpn-center">
            <FiTag size={28} style={{ opacity: 0.2 }} />
            <span>No coupons yet</span>
          </div>
        ) : (
          <table className="cpn-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Audience</th>
                <th>Usage</th>
                <th>Expiry</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <CouponRow
                  key={c._id}
                  coupon={c}
                  onEdit={openEdit}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CouponFormModal
          initial={formInitial}
          customers={customers}
          onClose={closeForm}
          onSave={handleSave}
          saving={saving}
          error={formError}
        />
      )}
    </div>
  );
};

export default CouponsManager;
