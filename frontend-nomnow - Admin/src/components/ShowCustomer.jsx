// === ADMIN ===
import {
  FiUser,
  FiCheckCircle,
  FiShoppingBag,
  FiDollarSign,
} from "react-icons/fi";
import { LuMail, LuPhone, LuMapPin } from "react-icons/lu";
import { MdOutlineFastfood } from "react-icons/md";
import { useEffect, useState } from "react";
import { BiError } from "react-icons/bi";
import { toast } from "react-hot-toast";

// ── تنسيق ──────────────────────────────────────────────────
const fmtMoney = (n, currency = "SYP") =>
  `${currency} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const ShowCustomer = ({
  api,
  selectedCustomer,
  setSelectedCustomer,
  type,
  setType,
  setCustomers,
}) => {
  const [error, setError] = useState(null);
  const [reasonForBlock, setReasonForBlock] = useState("");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── جلب الإحصائيات ────────────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer?._id) return;
    setLoadingStats(true);
    api
      .get(`/admin/customers/${selectedCustomer._id}/stats`)
      .then((res) => setStats(res.data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [selectedCustomer?._id]);

  // ── Unblock ───────────────────────────────────────────────
  const handleUnBlock = async () => {
    try {
      const res = await api.patch("admin/user-unblock", {
        userId: selectedCustomer._id,
      });
      const updated = res.data.user;
      setCustomers((prev) =>
        prev.map((c) => (c._id === updated._id ? updated : c)),
      );
      setSelectedCustomer(updated);
      toast.success(`Customer ${selectedCustomer.name} unblocked`);
      setType("show");
    } catch (err) {
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setError(msg);
    }
  };

  // ── Block ─────────────────────────────────────────────────
  const handleBlock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/user-block", {
        userId: selectedCustomer._id,
        reasonForBlock,
      });
      const updated = res.data.user;
      setCustomers((prev) =>
        prev.map((c) => (c._id === updated._id ? updated : c)),
      );
      setSelectedCustomer(updated);
      toast.success(`Customer ${selectedCustomer.name} blocked`);
      setType("show");
    } catch (err) {
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setError(msg);
    }
  };

  return (
    <>
      {/* ── Show ──────────────────────────────────────────── */}
      {type === "show" && (
        <div>
          <div className="popp showcustomer globale-popp">
            <div className="container">
              {/* Header */}
              <div className="one">
                <div className="img">
                  {selectedCustomer.img?.url ? (
                    <img
                      src={selectedCustomer.img.url}
                      alt={selectedCustomer.name}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 11,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <FiUser size={30} className="icon" />
                  )}
                </div>
                <div className="text">
                  <h2>{selectedCustomer.name}</h2>
                  <p>Customer Profile</p>
                  <div className={"status " + selectedCustomer.status}>
                    <span>{selectedCustomer.status}</span>
                    <p>
                      Joined{" "}
                      {new Date(selectedCustomer.createdAt).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="tow">
                <div className="order">
                  <FiShoppingBag className="icon" />
                  <p>Total Orders</p>
                  <h2>{loadingStats ? "…" : stats?.totalOrders ?? 0}</h2>
                </div>
                <div className="total">
                  <FiDollarSign className="icon" />
                  <p>Total Spent</p>
                  <h2>
                    {loadingStats
                      ? "…"
                      : fmtMoney(
                          stats?.totalSpent ?? 0,
                          stats?.currency ?? "SYP",
                        )}
                  </h2>
                </div>
                <div className="rating">
                  <MdOutlineFastfood className="icon" />
                  <p>Fav Restaurant</p>
                  <h2 style={{ fontSize: 14 }}>
                    {loadingStats ? "…" : stats?.favoriteRestaurant ?? "—"}
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
                      <h4>{selectedCustomer.phone}</h4>
                    </div>
                  </div>
                  <div className="item">
                    <LuMail className="icon" />
                    <div>
                      <p>Email</p>
                      <h4>{selectedCustomer.email}</h4>
                    </div>
                  </div>
                  {selectedCustomer.addresses?.length > 0 && (
                    <div className="item">
                      <LuMapPin className="icon" />
                      <div>
                        <p>Default Address</p>
                        <h4>
                          {selectedCustomer.addresses.find((a) => a.isDefault)
                            ?.fullAddress ||
                            selectedCustomer.addresses[0]?.fullAddress ||
                            "—"}
                        </h4>
                      </div>
                    </div>
                  )}
                </div>
                <div className="right">
                  <h2>Account Details</h2>
                  <div>
                    <p>Country</p>
                    <h4>
                      {selectedCustomer.country === "DE"
                        ? "🇩🇪 Germany"
                        : "🇸🇾 Syria"}
                    </h4>
                  </div>
                  <div>
                    <p>Gender</p>
                    <h4 style={{ textTransform: "capitalize" }}>
                      {selectedCustomer.gender || "—"}
                    </h4>
                  </div>
                  <div>
                    <p>Last Order</p>
                    <h4>{loadingStats ? "…" : fmtDate(stats?.lastOrderAt)}</h4>
                  </div>
                  <div>
                    <p>Account Status</p>
                    <div className={"status " + selectedCustomer.status}>
                      <span>{selectedCustomer.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="fore">
                {selectedCustomer.status === "blocked" ? (
                  <button
                    className="approve unblocked-restaurant"
                    onClick={() => setType("unblock")}
                  >
                    Unblock Customer
                  </button>
                ) : (
                  <button
                    className="suspend blocked-restaurant"
                    onClick={() => setType("block")}
                  >
                    Block Customer
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
          {/* Unblock */}
          {type === "unblock" && (
            <div className="popp globale-approve globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>Unblock Customer</h2>
                <h3>{selectedCustomer.name}</h3>
                <p>Are you sure you want to unblock this customer?</p>
                <h3>
                  Their account will be reactivated and they can place orders
                  again.
                </h3>
                {error && <div className="error">{error}</div>}
                <div className="buttons">
                  <button onClick={() => setType("show")}>Cancel</button>
                  <button className="approve" onClick={handleUnBlock}>
                    Unblock Customer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Block */}
          {type === "block" && (
            <div className="popp globale-approve globale-suspend globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Block Customer</h2>
                <h3>{selectedCustomer.name}</h3>
                <p>Are you sure you want to block this customer?</p>
                <h3>They will not be able to place new orders.</h3>
                <form onSubmit={handleBlock}>
                  <div className="input">
                    <label>Reason for Block *</label>
                    <textarea
                      value={reasonForBlock}
                      onChange={(e) => setReasonForBlock(e.target.value)}
                      placeholder="Enter the reason for blocking..."
                      required
                    />
                  </div>
                  {error && <div className="error">{error}</div>}
                  <div className="buttons">
                    <button type="button" onClick={() => setType("show")}>
                      Cancel
                    </button>
                    <button className="suspend">Block Customer</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="back" onClick={() => setType("show")} />
        </div>
      )}
    </>
  );
};

export default ShowCustomer;
