// === ADMIN ===
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
import { FaStar } from "react-icons/fa";
import { FiUser, FiRefreshCw } from "react-icons/fi";
import { BsThreeDotsVertical } from "react-icons/bs";
import CreateDriver from "../components/CreateDriver";
import { MdAccessTime } from "react-icons/md";
import ShowDriver from "../components/ShowDriver";
import { LuCircleCheckBig } from "react-icons/lu";
import { SiAdblock } from "react-icons/si";
import { MdOutlineCheckCircle } from "react-icons/md";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

// ── Availability badge ────────────────────────────────────────
const AVAIL_META = {
  online: { label: "Online", color: "#00a63e", bg: "#f0fdf4" },
  busy: { label: "Busy", color: "#f54900", bg: "#fff3ef" },
  offline: { label: "Offline", color: "#6b7280", bg: "#f3f4f6" },
};

const AvailBadge = ({ value }) => {
  const m = AVAIL_META[value] || AVAIL_META.offline;
  return (
    <span
      className="drv-avail-badge"
      style={{ color: m.color, background: m.bg }}
    >
      <span className="drv-avail-dot" style={{ background: m.color }} />
      {m.label}
    </span>
  );
};

// ── Documents badge ───────────────────────────────────────────
const DocsBadge = ({ verified }) =>
  verified ? (
    <div className="drv-docs verified">
      <MdOutlineCheckCircle size={14} />
      <span>verified</span>
    </div>
  ) : (
    <div className="drv-docs pending">
      <MdAccessTime size={14} />
      <span>pending</span>
    </div>
  );

// ── Main ──────────────────────────────────────────────────────
const Drivers = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();
  const [categoryChosen, setCategoryChosen] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [type, setType] = useState("show");
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    activeNow: 0,
    onDelivery: 0,
    averageRating: 0,
  });
  const [selectedDriver, setSelectedDriver] = useState(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `admin/drivers?${countryParam.replace("&", "")}`,
      );
      setDrivers(res.data.drivers);
      if (res.data.summary) setSummary(res.data.summary);
    } catch {
      toast.error("Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [api, countryParam]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // ── فلترة ─────────────────────────────────────────────────
  const filteredDrivers = drivers.filter((driver) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      driver.name.toLowerCase().includes(term) ||
      driver.zone.toLowerCase().includes(term) ||
      driver.status.toLowerCase().includes(term);

    const matchCategory =
      categoryChosen === "all" ||
      (categoryChosen === "online" && driver.availability === "online") ||
      (categoryChosen === "busy" && driver.availability === "busy") ||
      (categoryChosen === "offline" && driver.availability === "offline") ||
      (categoryChosen === "pending" && driver.status === "pending") ||
      (categoryChosen === "blocked" && driver.status === "blocked");

    return matchSearch && matchCategory;
  });

  const categories = [
    { key: "online", label: "Online" },
    { key: "busy", label: "Busy" },
    { key: "offline", label: "Offline" },
    { key: "pending", label: "Pending" },
    { key: "blocked", label: "Blocked" },
  ];

  return (
    <div className="driver-page">
      {loading && (
        <div className="globale-loader">
          <div className="spinner" />
        </div>
      )}

      <HeadCreateAndDetails
        text1={"Drivers"}
        text2={"Manage delivery drivers and their performance"}
        text3={"Add Driver"}
        setType={setType}
      />

      {/* ── Summary ─────────────────────────────────────────── */}
      <div className="summary">
        <div>
          <p>Total Drivers</p>
          <h2>{summary.total}</h2>
        </div>
        <div>
          <p>Active Now</p>
          <h2 className="active">{summary.activeNow}</h2>
        </div>
        <div>
          <p>On Delivery</p>
          <h2 className="delivery">{summary.onDelivery}</h2>
        </div>
        <div>
          <p>Avg Rating</p>
          <h2 className="rating">{summary.averageRating}</h2>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="globale-search">
        <input
          type="text"
          placeholder="Search by name, zone or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="globale-menu">
        <button
          className={categoryChosen === "all" ? "active" : ""}
          onClick={() => setCategoryChosen("all")}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            className={categoryChosen === cat.key ? "active" : ""}
            onClick={() => setCategoryChosen(cat.key)}
          >
            {cat.label}
          </button>
        ))}
        <button className="drv-refresh" onClick={fetchDrivers}>
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="menu-items">
        <div className="head">
          <h3>Driver</h3>
          <h3>Availability</h3>
          <h3>Zone</h3>
          <h3>Earnings</h3>
          <h3>Orders</h3>
          <h3>Rating</h3>
          <h3>Driver Status</h3>
          <h3>Documents</h3>
          <h3>Actions</h3>
        </div>

        {!loading && filteredDrivers.length === 0 && (
          <div className="item item-empty">
            <p>No drivers found</p>
          </div>
        )}

        {filteredDrivers.map((driver) => (
          <div className="item" key={driver._id}>
            {/* Driver */}
            <div className="driver">
              <div className="img">
                {driver.driverImage?.url ? (
                  <img src={driver.driverImage.url} alt={driver.name} />
                ) : (
                  <FiUser className="icon" />
                )}
              </div>
              <div className="text">
                <h4>{driver.name}</h4>
                <p>{driver.email}</p>
              </div>
            </div>

            {/* Availability */}
            <AvailBadge value={driver.availability} />

            {/* Zone */}
            <p className="zone">{driver.zone}</p>

            {/* Earnings */}
            <div className="earnings">
              $
              {Number(driver.totalEarnings ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: 0,
              })}
            </div>

            {/* Orders */}
            <p className="drv-orders">{driver.totalOrders ?? 0}</p>

            {/* Rating */}
            <div className="rating">
              <FaStar className="icon" />
              {driver.rating > 0 ? driver.rating.toFixed(1) : "0.0"}
            </div>

            {/* Driver Status */}
            <div className={`driverstatus ${driver.status}`}>
              <div className="icon">
                {driver.status === "blocked" && <SiAdblock />}
                {driver.status === "approved" && <LuCircleCheckBig />}
                {driver.status === "pending" && <MdAccessTime />}
              </div>
              <p>{driver.status}</p>
            </div>

            {/* Documents */}
            <DocsBadge verified={driver.isDocumentsVerified} />

            {/* Actions */}
            <div className="actions">
              <BsThreeDotsVertical
                className="icon"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setSelectedDriver(driver);
                  setType("show");
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {type === "create" && (
        <CreateDriver
          api={api}
          setType={setType}
          setLoading={setLoading}
          fetchDrivers={fetchDrivers}
        />
      )}

      {(type === "show" ||
        type === "document" ||
        type === "cash" ||
        type === "approve" ||
        type === "suspend") &&
        selectedDriver && (
          <ShowDriver
            selectedDriver={selectedDriver}
            api={api}
            type={type}
            setType={setType}
            setLoading={setLoading}
            fetchDrivers={fetchDrivers}
            setDrivers={setDrivers}
            setSelectedDriver={setSelectedDriver}
          />
        )}
    </div>
  );
};

export default Drivers;
