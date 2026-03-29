// === ADMIN ===
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
