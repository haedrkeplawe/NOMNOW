import { CiDeliveryTruck } from "react-icons/ci";
import { FiUser, FiCheckCircle, FiShoppingBag } from "react-icons/fi";
import { FaStar } from "react-icons/fa6";
import { FaDollarSign } from "react-icons/fa";
import { LuMail, LuPhone } from "react-icons/lu";
import {
  MdAccessTime,
  MdLocationPin,
  MdOutlineCheckCircle,
} from "react-icons/md";
import { useEffect, useState } from "react";
import { BiError } from "react-icons/bi";
import { IoMdClose } from "react-icons/io";
import { IoDocumentTextOutline } from "react-icons/io5";
import { GiMoneyStack } from "react-icons/gi";
import { toast } from "react-hot-toast";

const ShowDriver = ({
  api,
  type,
  setType,
  setDrivers,
  selectedDriver,
  setSelectedDriver,
}) => {
  const [error, setError] = useState(null);
  const [reasonForSuspension, setReasonForSuspension] = useState("");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Cash system state ──────────────────────────────────────
  const [cashOrders, setCashOrders] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [loadingCash, setLoadingCash] = useState(false);
  const [cashLimitInput, setCashLimitInput] = useState("");
  const [settlingCash, setSettlingCash] = useState(false);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [cashOrderFilter, setCashOrderFilter] = useState("all");
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [confirmLimitUpdate, setConfirmLimitUpdate] = useState(false);
  const [expandedCashOrder, setExpandedCashOrder] = useState(null);
  const isSyrian = selectedDriver?.country === "SY";

  // ── جلب إحصائيات السائق عند الفتح ────────────────────────
  useEffect(() => {
    if (!selectedDriver?._id) return;
    setLoadingStats(true);
    api
      .get(`/admin/drivers/${selectedDriver._id}/stats`)
      .then((res) => setStats(res.data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [selectedDriver?._id]);

  // ── جلب بيانات الكاش للسائق السوري ───────────────────────
  useEffect(() => {
    if (!selectedDriver?._id || selectedDriver.country !== "SY") return;
    setCashLimitInput(selectedDriver.cashCreditLimit ?? 0);
    setLoadingCash(true);
    api
      .get(`/admin/drivers/${selectedDriver._id}/cash-orders`)
      .then((res) => {
        setCashOrders(res.data.orders || []);
        setCashSummary(res.data.summary || null);
      })
      .catch(() => {
        setCashOrders([]);
        setCashSummary(null);
      })
      .finally(() => setLoadingCash(false));
  }, [selectedDriver?._id]);

  // ── Cash: تحديث الحد ──────────────────────────────────────
  const handleUpdateCashLimit = async () => {
    const val = Number(cashLimitInput);
    if (isNaN(val) || val < 0) {
      return toast.error("Please enter a valid amount");
    }
    // فتح confirm dialog
    setConfirmLimitUpdate(true);
  };

  const confirmUpdateCashLimit = async () => {
    const val = Number(cashLimitInput);
    setConfirmLimitUpdate(false);
    setUpdatingLimit(true);
    try {
      const res = await api.patch(
        `/admin/drivers/${selectedDriver._id}/cash-limit`,
        { cashCreditLimit: val },
      );
      const updated = res.data.driver;
      setDrivers((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDriver(updated);
      toast.success("Cash limit updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating cash limit");
    } finally {
      setUpdatingLimit(false);
    }
  };

  // ── Cash: تسوية كاملة ─────────────────────────────────────
  const handleSettleCash = async () => {
    // فتح confirm dialog
    setConfirmSettle(true);
  };

  const confirmSettleCash = async () => {
    setConfirmSettle(false);
    setSettlingCash(true);
    try {
      const res = await api.patch(
        `/admin/drivers/${selectedDriver._id}/cash-settle`,
      );
      const updated = res.data.driver;
      setDrivers((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDriver(updated);
      const ordersRes = await api.get(
        `/admin/drivers/${selectedDriver._id}/cash-orders`,
      );
      setCashOrders(ordersRes.data.orders || []);
      setCashSummary(ordersRes.data.summary || null);
      toast.success("Cash settled successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Error settling cash");
    } finally {
      setSettlingCash(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────
  const handleApprove = async () => {
    try {
      const res = await api.patch("admin/drivers-verified", {
        driverId: selectedDriver._id,
      });
      const updated = res.data.driver;
      setDrivers((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDriver(updated);
      toast.success(`Driver ${selectedDriver.name} approved`);
      setType("show");
    } catch (err) {
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setError(msg);
    }
  };

  // ── Suspend ───────────────────────────────────────────────
  const handleSuspend = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/drivers-suspend", {
        driverId: selectedDriver._id,
        reasonForSuspension,
      });
      const updated = res.data.driver;
      setDrivers((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDriver(updated);
      toast.success(`Driver ${selectedDriver.name} suspended`);
      setType("show");
    } catch (err) {
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setError(msg);
    }
  };

  // ── Update Document ───────────────────────────────────────
  const updateDocumentStatus = async (driverId, documentId, status) => {
    try {
      let rejectionReason = "";
      if (status === "rejected") {
        rejectionReason = prompt("Enter rejection reason:");
        if (!rejectionReason) return;
      }
      const res = await api.patch(
        `/admin/drivers/${driverId}/documents/${documentId}`,
        { status, rejectionReason },
      );
      const updated = res.data.driver;
      setDrivers((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDriver(updated);
      toast.success("Document updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating document");
    }
  };

  const fmt = (n, currency = "SYP") =>
    `${currency} ${Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  return (
    <>
      {/* ── Show ──────────────────────────────────────────── */}
      {type === "show" && (
        <div>
          <div className="popp showdriver globale-popp">
            <div className="container">
              {/* Header */}
              <div className="one">
                <div className="img">
                  {selectedDriver.driverImage?.url ? (
                    <img
                      src={selectedDriver.driverImage.url}
                      alt={selectedDriver.name}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 11,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <CiDeliveryTruck size={30} className="icon" />
                  )}
                </div>
                <div className="text">
                  <h2>{selectedDriver.name}</h2>
                  <p>Driver Profile</p>
                  <div className="status">
                    <span className={selectedDriver.status}>
                      {selectedDriver.status}
                    </span>
                    <p>
                      Joined{" "}
                      {new Date(selectedDriver.createdAt).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats — من الـ API */}
              <div className="tow">
                <div className="order">
                  <FiShoppingBag className="icon" />
                  <p>Total Orders</p>
                  <h2>{loadingStats ? "…" : stats?.totalOrders ?? 0}</h2>
                </div>
                <div className="rating">
                  <FaStar className="icon" />
                  <p>Rating</p>
                  <h2>
                    {loadingStats
                      ? "…"
                      : stats?.rating > 0
                      ? stats.rating.toFixed(1)
                      : "—"}
                  </h2>
                </div>
                <div className="total">
                  <FaDollarSign className="icon" />
                  <p>Total Earnings</p>
                  <h2>
                    {loadingStats
                      ? "…"
                      : fmt(
                          stats?.totalEarnings ?? 0,
                          stats?.currency ?? "SYP",
                        )}
                  </h2>
                </div>
              </div>

              {/* Contact + Details */}
              <div className="three">
                <div className="left">
                  <h2>Contact Information</h2>
                  <div className="item">
                    <LuPhone className="icon" />
                    <div>
                      <p>Phone</p>
                      <h4>{selectedDriver.phone}</h4>
                    </div>
                  </div>
                  <div className="item">
                    <LuMail className="icon" />
                    <div>
                      <p>Email</p>
                      <h4>{selectedDriver.email}</h4>
                    </div>
                  </div>
                  <div className="item">
                    <MdLocationPin className="icon" />
                    <div>
                      <p>Assigned Zone</p>
                      <h4>{selectedDriver.zone}</h4>
                    </div>
                  </div>
                </div>
                <div className="right">
                  <h2>Driver Details</h2>
                  <div>
                    <p>Vehicle Type</p>
                    <h4>{selectedDriver.vehicletype}</h4>
                  </div>
                  <div>
                    <p>Documents Status</p>
                    {selectedDriver.isDocumentsVerified ? (
                      <div className="documents approved">
                        <MdOutlineCheckCircle className="icon" />
                        <p>Verified</p>
                      </div>
                    ) : (
                      <div className="documents">
                        <MdAccessTime className="icon" />
                        <p>Not Verified</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p>Vehicle Plate</p>
                    <h4>{selectedDriver.vehicleplate}</h4>
                  </div>
                  <div>
                    <p>Country</p>
                    <h4>{selectedDriver.country}</h4>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="fore">
                <button
                  className="document"
                  onClick={() => setType("document")}
                >
                  View Documents
                </button>
                {isSyrian && (
                  <button className="cash" onClick={() => setType("cash")}>
                    Cash Management
                  </button>
                )}
                {selectedDriver.status !== "approved" && (
                  <button
                    className="approve"
                    onClick={() => setType("approve")}
                  >
                    Approve Driver
                  </button>
                )}
                {selectedDriver.status !== "blocked" && (
                  <button
                    className="suspend"
                    onClick={() => setType("suspend")}
                  >
                    Suspend Driver
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="back" onClick={() => setType("")} />
        </div>
      )}

      {/* ── Sub-modals ────────────────────────────────────── */}
      {type !== "show" && (
        <div>
          {/* Approve */}
          {type === "approve" && (
            <div className="popp globale-approve globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>Approve Driver</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to approve?</p>
                <h3>
                  This will activate their account and allow them to accept
                  orders.
                </h3>
                <div className="info">
                  <p>✓ All documents verified</p>
                  <p>✓ Background check completed</p>
                  <p>✓ Training completed</p>
                </div>
                {error && <div className="error">{error}</div>}
                <div className="buttons">
                  <button onClick={() => setType("show")}>Cancel</button>
                  <button className="approve" onClick={handleApprove}>
                    Approve Driver
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suspend */}
          {type === "suspend" && (
            <div className="popp globale-approve globale-suspend globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Suspend Driver</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to suspend?</p>
                <h3>They will not be able to accept new orders.</h3>
                <form onSubmit={handleSuspend}>
                  <div className="input">
                    <label>Reason for Suspension *</label>
                    <textarea
                      value={reasonForSuspension}
                      onChange={(e) => setReasonForSuspension(e.target.value)}
                      placeholder="Enter the reason for suspension..."
                      required
                    />
                  </div>
                  {error && <div className="error">{error}</div>}
                  <div className="buttons">
                    <button type="button" onClick={() => setType("show")}>
                      Cancel
                    </button>
                    <button className="suspend">Suspend Driver</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Cash Management */}
          {type === "cash" && (
            <div className="popp globale-popp drv-cash-modal">
              <div className="container">
                {/* Header */}
                <div className="one globale-close">
                  <div className="left">
                    <div className="icon">
                      <GiMoneyStack size={28} />
                    </div>
                    <div>
                      <h3>Cash Management</h3>
                      <p>{selectedDriver.name} — Collected Cash</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => setType("show")}
                    />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="drv-cash-progress-wrap">
                  <div className="drv-cash-progress-labels">
                    <span>
                      Collected:{" "}
                      <strong>
                        {Number(
                          selectedDriver.cashCollected ?? 0,
                        ).toLocaleString()}{" "}
                        SYP
                      </strong>
                    </span>
                    <span>
                      Limit:{" "}
                      <strong>
                        {Number(
                          selectedDriver.cashCreditLimit ?? 0,
                        ).toLocaleString()}{" "}
                        SYP
                      </strong>
                    </span>
                  </div>
                  <div className="drv-cash-bar-bg">
                    <div
                      className="drv-cash-bar-fill"
                      style={{
                        width:
                          selectedDriver.cashCreditLimit > 0
                            ? `${Math.min(
                                100,
                                ((selectedDriver.cashCollected ?? 0) /
                                  selectedDriver.cashCreditLimit) *
                                  100,
                              )}%`
                            : "0%",
                        background:
                          (selectedDriver.cashCollected ?? 0) >=
                            selectedDriver.cashCreditLimit &&
                          selectedDriver.cashCreditLimit > 0
                            ? "#e7000b"
                            : "var(--primary-orange-gradient)",
                      }}
                    />
                  </div>
                  {selectedDriver.cashCreditLimit > 0 && (
                    <p className="drv-cash-bar-pct">
                      {Math.min(
                        100,
                        Math.round(
                          ((selectedDriver.cashCollected ?? 0) /
                            selectedDriver.cashCreditLimit) *
                            100,
                        ),
                      )}
                      % used
                    </p>
                  )}
                </div>

                {/* Summary cards */}
                {cashSummary && (
                  <div className="drv-cash-cards">
                    <div className="drv-cash-card pending">
                      <p>Pending Collection</p>
                      <h2>
                        {Number(cashSummary.totalPending).toLocaleString()} SYP
                      </h2>
                      {cashSummary.pendingDeliveryFee > 0 && (
                        <div className="drv-cash-card-sub">
                          <span>Driver's Cut</span>
                          <span className="drv-cash-card-sub-val">
                            {Number(
                              cashSummary.pendingDeliveryFee,
                            ).toLocaleString()}{" "}
                            SYP
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="drv-cash-card settled">
                      <p>Total Settled</p>
                      <h2>
                        {Number(cashSummary.totalSettled).toLocaleString()} SYP
                      </h2>
                      {cashSummary.settledDeliveryFee > 0 && (
                        <div className="drv-cash-card-sub">
                          <span>Driver's Cut</span>
                          <span className="drv-cash-card-sub-val">
                            {Number(
                              cashSummary.settledDeliveryFee,
                            ).toLocaleString()}{" "}
                            SYP
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Update limit + Settle button */}
                <div className="drv-cash-controls">
                  <div className="drv-cash-limit-row">
                    <label>Cash Credit Limit (SYP)</label>
                    <div className="drv-cash-limit-input-row">
                      <input
                        type="number"
                        min="0"
                        value={cashLimitInput}
                        onChange={(e) => setCashLimitInput(e.target.value)}
                        placeholder="e.g. 5000"
                      />
                      <button
                        className="drv-cash-btn-update"
                        onClick={handleUpdateCashLimit}
                        disabled={updatingLimit}
                      >
                        {updatingLimit ? "Saving…" : "Save Limit"}
                      </button>
                    </div>
                  </div>

                  <button
                    className="drv-cash-btn-settle"
                    onClick={handleSettleCash}
                    disabled={
                      settlingCash || (selectedDriver.cashCollected ?? 0) === 0
                    }
                  >
                    {settlingCash ? "Processing…" : "✓ Confirm Cash Received"}
                  </button>
                </div>

                {/* Orders table */}
                <div className="drv-cash-orders">
                  <div className="drv-cash-orders-head">
                    <h4>Cash Orders</h4>
                    <div className="drv-cash-filter-tabs">
                      {["all", "pending", "settled"].map((f) => (
                        <button
                          key={f}
                          className={cashOrderFilter === f ? "active" : ""}
                          onClick={() => setCashOrderFilter(f)}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingCash ? (
                    <div className="drv-cash-center">
                      <div className="drv-cash-spinner" />
                    </div>
                  ) : (
                    <table className="drv-cash-table">
                      <thead>
                        <tr>
                          <th style={{ width: 32 }} />
                          <th>Order #</th>
                          <th>Customer</th>
                          <th>Restaurant</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashOrders
                          .filter(
                            (o) =>
                              cashOrderFilter === "all" ||
                              o.driverPaymentStatus === cashOrderFilter,
                          )
                          .map((o) => {
                            const isExpanded = expandedCashOrder === o._id;
                            return (
                              <>
                                <tr
                                  key={o._id}
                                  className={
                                    isExpanded ? "drv-cash-row-active" : ""
                                  }
                                >
                                  <td>
                                    <button
                                      className="drv-cash-expand-btn"
                                      onClick={() =>
                                        setExpandedCashOrder(
                                          isExpanded ? null : o._id,
                                        )
                                      }
                                    >
                                      {isExpanded ? "▲" : "▼"}
                                    </button>
                                  </td>
                                  <td className="drv-cash-ordnum">
                                    #{o.orderNumber}
                                  </td>
                                  <td>{o.userId?.name || "—"}</td>
                                  <td>{o.restaurantId?.name || "—"}</td>
                                  <td className="drv-cash-amount">
                                    {Number(o.totalPrice).toLocaleString()} SYP
                                  </td>
                                  <td>
                                    {new Date(o.createdAt).toLocaleDateString(
                                      "en-GB",
                                    )}
                                  </td>
                                  <td>
                                    <span
                                      className={`drv-cash-status ${o.driverPaymentStatus}`}
                                    >
                                      {o.driverPaymentStatus === "pending"
                                        ? "Pending"
                                        : "Settled"}
                                    </span>
                                  </td>
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
                                            <strong>
                                              {o.userId?.phone || "—"}
                                            </strong>
                                          </div>
                                          <div className="drv-cash-exp-item">
                                            <span>Payment Method</span>
                                            <strong
                                              style={{
                                                textTransform: "capitalize",
                                              }}
                                            >
                                              {o.paymentMethod || "—"}
                                            </strong>
                                          </div>
                                          <div className="drv-cash-exp-item">
                                            <span>Items Price</span>
                                            <strong>
                                              {Number(
                                                o.itemsPrice || 0,
                                              ).toLocaleString()}{" "}
                                              SYP
                                            </strong>
                                          </div>
                                          <div className="drv-cash-exp-item">
                                            <span>Delivery Fee</span>
                                            <strong>
                                              {Number(
                                                o.deliveryFee || 0,
                                              ).toLocaleString()}{" "}
                                              SYP
                                            </strong>
                                          </div>
                                          {o.taxPrice > 0 && (
                                            <div className="drv-cash-exp-item">
                                              <span>Tax</span>
                                              <strong>
                                                {Number(
                                                  o.taxPrice,
                                                ).toLocaleString()}{" "}
                                                SYP
                                              </strong>
                                            </div>
                                          )}
                                          <div className="drv-cash-exp-item">
                                            <span>Time</span>
                                            <strong>
                                              {new Date(
                                                o.createdAt,
                                              ).toLocaleTimeString("en-GB", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </strong>
                                          </div>
                                          {o.restaurantId?.address
                                            ?.fullAddress && (
                                            <div
                                              className="drv-cash-exp-item"
                                              style={{ gridColumn: "1 / -1" }}
                                            >
                                              <span>Restaurant Address</span>
                                              <strong>
                                                {
                                                  o.restaurantId.address
                                                    .fullAddress
                                                }
                                              </strong>
                                            </div>
                                          )}
                                          {o.deliveryAddress?.fullAddress && (
                                            <div
                                              className="drv-cash-exp-item"
                                              style={{ gridColumn: "1 / -1" }}
                                            >
                                              <span>Delivery Address</span>
                                              <strong>
                                                {o.deliveryAddress.fullAddress}
                                              </strong>
                                            </div>
                                          )}
                                          <div className="drv-cash-exp-item drv-cash-exp-total">
                                            <span>Total Price</span>
                                            <strong>
                                              {Number(
                                                o.totalPrice,
                                              ).toLocaleString()}{" "}
                                              SYP
                                            </strong>
                                          </div>
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
                                                  {item.size?.name && (
                                                    <em> · {item.size.name}</em>
                                                  )}
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
                                                  {Number(
                                                    item.totalPrice,
                                                  ).toLocaleString()}{" "}
                                                  SYP
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
                          })}
                        {cashOrders.filter(
                          (o) =>
                            cashOrderFilter === "all" ||
                            o.driverPaymentStatus === cashOrderFilter,
                        ).length === 0 && (
                          <tr>
                            <td colSpan={7} className="drv-cash-empty">
                              No orders found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Confirm: Settle Cash */}
          {confirmSettle && (
            <div className="popp globale-approve globale-popp drv-confirm-overlay">
              <div className="container">
                <GiMoneyStack className="icon drv-confirm-icon--settle" />
                <h2>Confirm Cash Settlement</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to confirm receiving the cash?</p>
                <div className="drv-confirm-info">
                  <p>
                    ✓ Driver's collected balance will reset to{" "}
                    <strong>0 SYP</strong>
                  </p>
                  <p>
                    ✓ All <strong>pending</strong> orders will be marked as{" "}
                    <strong>settled</strong>
                  </p>
                  <p>⚠ This action cannot be undone</p>
                </div>
                <div className="buttons">
                  <button onClick={() => setConfirmSettle(false)}>
                    Cancel
                  </button>
                  <button
                    className="approve drv-confirm-btn--settle"
                    onClick={confirmSettleCash}
                  >
                    Yes, Confirm Receipt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm: Update Cash Limit */}
          {confirmLimitUpdate && (
            <div className="popp globale-approve globale-popp drv-confirm-overlay">
              <div className="container">
                <GiMoneyStack className="icon drv-confirm-icon--limit" />
                <h2>Update Cash Limit</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to update the cash credit limit?</p>
                <div className="drv-confirm-info">
                  <p>
                    ✓ New limit will be set to{" "}
                    <strong>
                      {Number(cashLimitInput).toLocaleString()} SYP
                    </strong>
                  </p>
                  <p>
                    ✓ Driver will only be able to accept orders up to this
                    amount
                  </p>
                  <p>
                    ✓ Current collected balance remains{" "}
                    <strong>
                      {Number(
                        selectedDriver.cashCollected ?? 0,
                      ).toLocaleString()}{" "}
                      SYP
                    </strong>
                  </p>
                </div>
                <div className="buttons">
                  <button onClick={() => setConfirmLimitUpdate(false)}>
                    Cancel
                  </button>
                  <button className="approve" onClick={confirmUpdateCashLimit}>
                    Yes, Update Limit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {type === "document" && (
            <div className="popp globale-popp document">
              <div className="container">
                <div className="one globale-close">
                  <div className="left">
                    <div className="icon">
                      <IoDocumentTextOutline size={30} />
                    </div>
                    <div>
                      <h3>Driver Documents</h3>
                      <p>{selectedDriver.name} — Verification Documents</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => setType("show")}
                    />
                  </div>
                </div>
                <div className="carts">
                  {selectedDriver?.documents?.map((doc) => (
                    <div className="cart" key={doc._id}>
                      <span className={doc.status}>{doc.status}</span>
                      <img src={doc.image?.url} alt={doc.type} />
                      <div>
                        <div className="text">
                          <h2>
                            {doc.type === "id" && "National ID Card"}
                            {doc.type === "driving_license" &&
                              "Driving License"}
                            {doc.type === "vehicle_registration" &&
                              "Vehicle Registration"}
                          </h2>
                        </div>
                        <div className="buttons">
                          <button
                            onClick={() =>
                              updateDocumentStatus(
                                selectedDriver._id,
                                doc._id,
                                "approved",
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="reject"
                            onClick={() =>
                              updateDocumentStatus(
                                selectedDriver._id,
                                doc._id,
                                "rejected",
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!selectedDriver?.documents?.length && (
                    <p
                      style={{
                        color: "var(--secondary-text)",
                        textAlign: "center",
                        padding: "24px 0",
                      }}
                    >
                      No documents uploaded yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="back" onClick={() => setType("show")} />
        </div>
      )}
    </>
  );
};

export default ShowDriver;
