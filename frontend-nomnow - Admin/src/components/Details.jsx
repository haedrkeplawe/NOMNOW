// === ADMIN ===
import {
  FiCheckCircle,
  FiPhone,
  FiUser,
  FiDollarSign,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { MdOutlineEmail } from "react-icons/md";
import { LuMapPin, LuShoppingBag } from "react-icons/lu";
import { FaRegStar } from "react-icons/fa6";
import { FaRegClock } from "react-icons/fa6";
import { FaDollarSign } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { HiMiniArrowTrendingUp } from "react-icons/hi2";
import { TiStarOutline } from "react-icons/ti";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BiError } from "react-icons/bi";
import { BsShop } from "react-icons/bs";
import { toast } from "react-hot-toast";
import RestaurantMapShow from "./RestaurantMapShow";

// ─── تنسيق الأرقام ────────────────────────────────────────────
const fmt = (n, currency = "SYP") =>
  `${currency} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Financial Mini Card ──────────────────────────────────────
const FinMiniCard = ({
  label,
  value,
  Icon,
  iconBg,
  iconColor,
  badge,
  badgeCls,
}) => (
  <div className="det-fin-card">
    <div className="det-fin-card__top">
      <div
        className="det-fin-card__icon"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={15} />
      </div>
      {badge && <span className={`det-fin-badge ${badgeCls}`}>{badge}</span>}
    </div>
    <p className="det-fin-card__label">{label}</p>
    <h3 className="det-fin-card__value">{value}</h3>
  </div>
);

const Details = ({
  restaurantChossen,
  setRestaurantChossen,
  type,
  setType,
  api,
  restaurants,
  setRestaurants,
}) => {
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState(null);
  const [reasonForBlock, setReasonForBlock] = useState([]);
  const [loadingMenue, setLoadingMenue] = useState(true);
  const [commission, setCommission] = useState(restaurantChossen.commission);
  const [taxRate, setTaxRate] = useState(restaurantChossen.taxRate ?? 7);
  const isGerman = restaurantChossen.country === "DE";
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const navigate = useNavigate();

  // ── Financial Summary State ────────────────────────────────
  const [financial, setFinancial] = useState(null);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  // جلب الإحصائيات
  useEffect(() => {
    if (!restaurantChossen?._id) return;
    setLoadingStats(true);
    api
      .get(`/admin/restaurant/${restaurantChossen._id}/stats`)
      .then((res) => setStats(res.data.stats))
      .catch((err) => console.error(err))
      .finally(() => setLoadingStats(false));
  }, [restaurantChossen?._id]);

  // جلب الملخص المالي عند فتح Analytics
  useEffect(() => {
    if (type === "analytics" && restaurantChossen?._id) {
      setLoadingFinancial(true);
      api
        .get(`/admin/restaurant/${restaurantChossen._id}/financial-summary`)
        .then((res) => setFinancial(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoadingFinancial(false));
    }
  }, [type, restaurantChossen?._id]);

  useEffect(() => {
    if (type === "menu" && restaurantChossen?._id) {
      setLoadingMenue(true);
      api
        .get(`/admin/getfoodfromrestaurant/${restaurantChossen._id}`)
        .then((res) => setFoods(res.data.foods))
        .catch((err) =>
          setError(err.response?.data?.message || "Something went wrong"),
        )
        .finally(() => setLoadingMenue(false));
    }
  }, [type, restaurantChossen?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        restaurantId: restaurantChossen?._id,
        commission,
        // DE — أرسل taxRate فقط إذا كان المطعم ألمانياً
        ...(isGerman && { taxRate: Number(taxRate) }),
      };
      const res = await api.patch("/admin/restaurant", payload);
      const updatedRestaurant = res.data.restaurant;
      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((restaurant) =>
          restaurant._id === updatedRestaurant._id
            ? updatedRestaurant
            : restaurant,
        ),
      );
      setRestaurantChossen(updatedRestaurant);
      setType("details");
      toast.success(
        `Restaurant ${restaurantChossen.name} Updated Successfully`,
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  const handleUnBlocked = async () => {
    try {
      const res = await api.patch("admin/restaurant-unblock", {
        restaurantId: restaurantChossen._id,
      });
      const updatedRestaurant = res.data.restaurant;
      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((restaurant) =>
          restaurant._id === updatedRestaurant._id
            ? updatedRestaurant
            : restaurant,
        ),
      );
      setRestaurantChossen(updatedRestaurant);
      toast.success(
        `Restaurant ${restaurantChossen.name} UnBlocked Successfully`,
      );
      setType("show");
    } catch (err) {
      setError(err.response.data.message);
    }
  };

  const handleBlocked = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/restaurant-block", {
        restaurantId: restaurantChossen._id,
        reasonForBlock,
      });
      const updatedRestaurant = res.data.restaurant;
      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((restaurant) =>
          restaurant._id === updatedRestaurant._id
            ? updatedRestaurant
            : restaurant,
        ),
      );
      setRestaurantChossen(updatedRestaurant);
      toast.success(
        `Restaurant ${restaurantChossen.name} Blocked Successfully`,
      );
      setType("show");
    } catch (err) {
      setError(err.response.data.message);
    }
  };

  return (
    <>
      {type === "details" && (
        <div>
          <div className="popp details globale-popp">
            <div className="detail-card" key={restaurantChossen._id}>
              <div className="one globale-close">
                <div className="left">
                  <div className="img">
                    {restaurantChossen.image ? (
                      <img
                        src={restaurantChossen.image.url}
                        alt=""
                        className="avatar"
                      />
                    ) : (
                      <BsShop className="icon" />
                    )}
                  </div>
                  <div>
                    <h3>{restaurantChossen.name}</h3>
                    <p>Restaurant Profile</p>
                  </div>
                </div>
                <div className="right">
                  <p
                    className={
                      restaurantChossen.status === "open" ? "green" : "red"
                    }
                  >
                    {restaurantChossen.status}
                  </p>
                </div>
              </div>

              <div className="infos">
                <div className="left">
                  <h2>Contact Information</h2>

                  {/* ── Restaurant Contact ── */}
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--secondary-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      margin: "4px 0 8px",
                    }}
                  >
                    Restaurant
                  </p>
                  <div className="info">
                    <FiPhone className="icon" />
                    <div>
                      <p>Phone</p>
                      <h4>{restaurantChossen.phone || "—"}</h4>
                    </div>
                  </div>
                  <div className="info">
                    <MdOutlineEmail className="icon" />
                    <div>
                      <p>Email</p>
                      <h4>{restaurantChossen.email || "—"}</h4>
                    </div>
                  </div>
                  <div
                    className="info"
                    onClick={() =>
                      restaurantChossen.location?.coordinates?.length &&
                      setShowMap(true)
                    }
                    style={{
                      cursor: restaurantChossen.location?.coordinates?.length
                        ? "pointer"
                        : "default",
                    }}
                    title={
                      restaurantChossen.location?.coordinates?.length
                        ? "View on map"
                        : ""
                    }
                  >
                    <LuMapPin className="icon" />
                    <div>
                      <p>Location</p>
                      <h4>
                        {restaurantChossen.address.country} —{" "}
                        {restaurantChossen.address.city}
                      </h4>
                    </div>
                  </div>

                  {/* ── Owner Contact ── */}
                  {restaurantChossen.owner && (
                    <>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--secondary-text)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          margin: "16px 0 8px",
                        }}
                      >
                        Owner — {restaurantChossen.owner.name}
                      </p>
                      <div className="info">
                        <FiPhone className="icon" />
                        <div>
                          <p>Phone</p>
                          <h4>{restaurantChossen.owner.phone || "—"}</h4>
                        </div>
                      </div>
                      <div className="info">
                        <MdOutlineEmail className="icon" />
                        <div>
                          <p>Email</p>
                          <h4>{restaurantChossen.owner.email || "—"}</h4>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="right">
                  <h2>Performance Metrics</h2>
                  {loadingStats ? (
                    <p style={{ color: "var(--secondary-text)", fontSize: 13 }}>
                      Loading...
                    </p>
                  ) : (
                    <>
                      <div className="info">
                        <LuShoppingBag className="icon" />
                        <div>
                          <p>Total Orders</p>
                          <h4>{stats?.totalOrders ?? 0}</h4>
                        </div>
                      </div>
                      <div className="info">
                        <FaRegStar className="icon" />
                        <div>
                          <p>Rating</p>
                          <h4>{stats?.rating ?? 0}</h4>
                        </div>
                      </div>
                      <div className="info">
                        <FaRegClock className="icon" />
                        <div>
                          <p>Avg. Prep Time</p>
                          <h4>{stats?.avgPrepTime ?? 0} min</h4>
                        </div>
                      </div>
                      <div className="info">
                        <FaDollarSign className="icon" />
                        <div>
                          <p>Commission Rate</p>
                          <h4>{restaurantChossen.commission}%</h4>
                        </div>
                      </div>
                      {/* DE — عرض نسبة الضريبة للألماني فقط */}
                      {isGerman && (
                        <div className="info">
                          <FaDollarSign className="icon" />
                          <div>
                            <p>Tax Rate (VAT)</p>
                            <h4>{restaurantChossen.taxRate ?? 7}%</h4>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="buttons">
                <button className="edit" onClick={() => setType("edit")}>
                  Edit Restaurant
                </button>
                <button className="view" onClick={() => setType("menu")}>
                  View Menu
                </button>
                {restaurantChossen.status === "blocked" ? (
                  <button
                    className="unblocked-restaurant"
                    onClick={() => setType("unblock")}
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    className="blocked-restaurant"
                    onClick={() => setType("block")}
                  >
                    Block
                  </button>
                )}
                <button
                  className="analytics"
                  onClick={() => setType("analytics")}
                >
                  Analytics
                </button>
              </div>
            </div>
          </div>
          <div
            className="back"
            onClick={() => {
              setRestaurantChossen([]);
              setType("show");
            }}
          ></div>
        </div>
      )}

      {type !== "details" && (
        <div>
          {type === "edit" && (
            <div className="popp form globale-popp">
              <div className="globale-close one">
                <div className="left">
                  <div className="icon">
                    <BsShop size={26} />
                  </div>
                  <div>
                    <h3>Update Restaurant</h3>
                    <p>Update restaurant details</p>
                  </div>
                </div>
                <div className="right">
                  <IoMdClose
                    className="icon"
                    onClick={() => setType("details")}
                  />
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="inputs">
                  <div className="input">
                    <label>Commission Rate (%) *</label>
                    <input
                      type="number"
                      name="commission"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      required
                    />
                  </div>
                  {/* DE — حقل تعديل الضريبة للألماني فقط */}
                  {isGerman ? (
                    <div className="input">
                      <label>Tax Rate (%) — German restaurants only</label>
                      <input
                        type="number"
                        name="taxRate"
                        value={taxRate}
                        min="0"
                        max="100"
                        step="0.1"
                        onChange={(e) => setTaxRate(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="input"></div>
                  )}
                  <button
                    type="button"
                    className="cancel"
                    onClick={() => setType("details")}
                  >
                    Cancel
                  </button>
                  <button type="submit">Update Restaurant</button>
                </div>
              </form>
            </div>
          )}

          {/* ── Analytics ── */}
          {type === "analytics" && (
            <div className="popp resaurant-analytics globale-popp">
              <div className="container">
                <div className="globale-close one">
                  <div className="left">
                    <div className="icon">
                      <HiMiniArrowTrendingUp size={26} />
                    </div>
                    <div>
                      <h3>{restaurantChossen.name} Analytics</h3>
                      <p>Performance metrics and financial overview</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => setType("details")}
                    />
                  </div>
                </div>

                {/* Performance Stats */}
                {loadingStats ? (
                  <p
                    style={{
                      color: "var(--secondary-text)",
                      fontSize: 13,
                      marginTop: 20,
                    }}
                  >
                    Loading...
                  </p>
                ) : (
                  <div className="summary">
                    <div className="orders">
                      <div>
                        <LuShoppingBag className="icon" size={20} />
                        <p>Total Orders</p>
                      </div>
                      <h2>{stats?.totalOrders ?? 0}</h2>
                      <p>Today: {stats?.todayOrders ?? 0}</p>
                    </div>
                    <div className="revenue">
                      <div>
                        <FaDollarSign className="icon" size={20} />
                        <p>Revenue</p>
                      </div>
                      <h2>
                        {stats?.totalRevenue ?? 0} {stats?.currency}
                      </h2>
                      <p>
                        Commission: {stats?.commission ?? 0} {stats?.currency}
                      </p>
                    </div>
                    <div className="rating">
                      <div>
                        <TiStarOutline className="icon" size={20} />
                        <p>Rating</p>
                      </div>
                      <h2>{stats?.rating ?? 0}</h2>
                      <p>Avg Prep: {stats?.avgPrepTime ?? 0} min</p>
                    </div>
                    <div className="customers">
                      <div>
                        <FiUser className="icon" size={20} />
                        <p>Menu Items</p>
                      </div>
                      <h2>{stats?.foodCount ?? 0}</h2>
                      <p>Total items</p>
                    </div>
                  </div>
                )}

                {/* ── Financial Summary ── */}
                <div className="det-fin-section">
                  <div className="det-fin-section__header">
                    <FiDollarSign size={16} />
                    <h4>Financial Summary</h4>
                    {financial && (
                      <span className="det-fin-currency">
                        {financial.currency} · Commission{" "}
                        {restaurantChossen.commission}%
                      </span>
                    )}
                  </div>

                  {loadingFinancial ? (
                    <div className="det-fin-loading">
                      <div className="det-fin-spinner" />
                      <span>Loading financial data...</span>
                    </div>
                  ) : financial ? (
                    <div className="det-fin-grid">
                      <FinMiniCard
                        label="Net Profit"
                        value={fmt(
                          financial.financial.netProfit,
                          financial.currency,
                        )}
                        Icon={FiTrendingUp}
                        iconBg="#f0fdf4"
                        iconColor="#00a63e"
                        badge="+Net"
                        badgeCls="det-fin-badge--green"
                      />
                      <FinMiniCard
                        label="Platform Commission"
                        value={fmt(
                          financial.financial.totalCommission,
                          financial.currency,
                        )}
                        Icon={FiTrendingDown}
                        iconBg="#eff6ff"
                        iconColor="#1447e6"
                      />
                      <FinMiniCard
                        label="Available to Withdraw"
                        value={fmt(
                          financial.financial.availableToSettle,
                          financial.currency,
                        )}
                        Icon={FiCheckCircle}
                        iconBg="#fff7ed"
                        iconColor="#ea6f00"
                        badge="Ready"
                        badgeCls="det-fin-badge--orange"
                      />
                      <FinMiniCard
                        label="Total Withdrawn"
                        value={fmt(
                          financial.financial.totalWithdrawn,
                          financial.currency,
                        )}
                        Icon={FiDollarSign}
                        iconBg="#fdf4ff"
                        iconColor="#a21caf"
                        badge="Paid"
                        badgeCls="det-fin-badge--purple"
                      />
                      <FinMiniCard
                        label="Pending Withdrawal"
                        value={fmt(
                          financial.financial.pendingWithdrawal,
                          financial.currency,
                        )}
                        Icon={FiClock}
                        iconBg="#fffbeb"
                        iconColor="#b45309"
                        badge={
                          financial.financial.pendingCount > 0
                            ? `${financial.financial.pendingCount} request`
                            : null
                        }
                        badgeCls="det-fin-badge--yellow"
                      />
                    </div>
                  ) : (
                    <p style={{ color: "var(--secondary-text)", fontSize: 13 }}>
                      Failed to load financial data.
                    </p>
                  )}
                </div>

                {/* ── View Orders Button ── */}
                <button
                  className="det-view-orders-btn"
                  onClick={() =>
                    navigate("/orders", {
                      state: {
                        restaurantId: restaurantChossen._id,
                        restaurantName: restaurantChossen.name,
                      },
                    })
                  }
                >
                  <LuShoppingBag size={15} />
                  View All Orders
                </button>
              </div>
            </div>
          )}

          {type === "menu" && (
            <div className="popp resaurant-menu globale-popp">
              <div className="container">
                <div className="globale-close one">
                  <div className="left">
                    <div className="icon">
                      <HiMiniArrowTrendingUp size={26} />
                    </div>
                    <div>
                      <h3>{restaurantChossen.name} Menu</h3>
                      <p>Manage restaurant menu items</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => setType("details")}
                    />
                  </div>
                </div>
                {foods.map((food) => (
                  <div className="cart" key={food._id}>
                    <div className="left">
                      {food.image && (
                        <img src={food.image.url} alt="" className="avatar" />
                      )}
                      <div>
                        <div className="info">
                          <h2>{food.name}</h2>
                          <p>{food.categoryId.name}</p>
                        </div>
                        <div className="price">
                          {food.sizes && food.sizes.length > 0
                            ? `From ${Math.min(
                                ...food.sizes.map((s) => s.price),
                              )} ${restaurantChossen.currency}`
                            : `${food.price} ${restaurantChossen.currency}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {foods.length === 0 && !loadingMenue && (
                  <div className="no-foods">
                    <p>No menu items found.</p>
                  </div>
                )}
              </div>
              {loadingMenue && (
                <div className="globale-loader-small">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
          )}

          {type === "unblock" && (
            <div className="popp globale-approve globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>Unblock Restaurant</h2>
                <h3>{restaurantChossen.name}</h3>
                <p>Are you sure you want to Unblock?</p>
                <div className="error">{error}</div>
                <div className="buttons">
                  <button onClick={() => setType("details")}>Cancel</button>
                  <button className="approve" onClick={handleUnBlocked}>
                    Unblock Restaurant
                  </button>
                </div>
              </div>
            </div>
          )}

          {type === "block" && (
            <div className="popp globale-approve globale-suspend globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Block Restaurant</h2>
                <h3>{restaurantChossen.name}</h3>
                <p>Are you sure you want to Block?</p>
                <form onSubmit={handleBlocked}>
                  <div className="input">
                    <label>Reason for Block *</label>
                    <textarea
                      onChange={(e) => setReasonForBlock(e.target.value)}
                      placeholder="Enter the reason for blocking..."
                      required
                    ></textarea>
                  </div>
                  <div className="error">{error}</div>
                  <div className="buttons">
                    <button type="button" onClick={() => setType("details")}>
                      Cancel
                    </button>
                    <button className="suspend">Block Restaurant</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="back" onClick={() => setType("details")}></div>
        </div>
      )}
      {/* ── Map Modal ── */}
      {showMap && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowMap(false)}
          >
            <div
              style={{
                background: "var(--primary-background)",
                borderRadius: "12px",
                padding: "20px",
                width: "90%",
                maxWidth: "700px",
                zIndex: 201,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ color: "var(--primary-text)", fontSize: "16px" }}>
                  📍 {restaurantChossen.name}
                </h3>
                <IoMdClose
                  size={22}
                  style={{ cursor: "pointer", color: "var(--primary-text)" }}
                  onClick={() => setShowMap(false)}
                />
              </div>
              <RestaurantMapShow initialLocation={restaurantChossen.location} />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Details;
