// === ADMIN ===
import { useEffect, useState } from "react";
import { FaRegTrashAlt, FaTag, FaTruck } from "react-icons/fa";
import { FiEdit, FiPlus } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";
import CreatePromotion from "../components/CreatePromotion";
import EditPromotion from "../components/EditPromotion";

// ── حساب حالة العرض من التواريخ ──────────────────────────────
const getPromotionStatus = (startDate, endDate, isActive) => {
  if (!isActive) return "inactive";
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return "scheduled";
  if (now >= start && now <= end) return "active";
  return "expired";
};

const statusFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
  { key: "inactive", label: "Inactive" },
];

const PromotionsManager = () => {
  const { api } = useAuth();

  const [promotions, setPromotions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState(null); // null | "create" | "edit"
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── جلب العروض ───────────────────────────────────────────────
  const fetchPromotions = async () => {
    try {
      const res = await api.get("/admin/promotions");
      const withStatus = res.data.promotions.map((p) => ({
        ...p,
        status: getPromotionStatus(p.startDate, p.endDate, p.isActive),
      }));
      setPromotions(withStatus);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  // ── حذف عرض ──────────────────────────────────────────────────
  const handleDelete = async (promotion) => {
    const foodName = promotion.foodId?.name || "this item";
    const confirmDelete = window.confirm(
      `Delete the ${
        promotion.type === "discount"
          ? `${promotion.discountValue}% discount`
          : "free delivery"
      } promotion on "${foodName}"?`,
    );
    if (!confirmDelete) return;

    try {
      await api.delete("/admin/promotions", {
        data: { promotionId: promotion._id },
      });
      toast.success("Promotion deleted");
      fetchPromotions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── فلترة ────────────────────────────────────────────────────
  const filtered =
    filter === "all"
      ? promotions
      : promotions.filter((p) => p.status === filter);

  if (loading)
    return (
      <div className="promotions-page page-loader">
        <div className="page-loader__spinner" />
        <p>Loading promotions...</p>
      </div>
    );

  return (
    <div className="promotions-page">
      <HeadCreateAndDetails
        text1="Promotions"
        text2="Manage discounts and free delivery offers"
        text3="Create Promotion"
        setType={setType}
      />

      {/* ── فلاتر الحالة ─────────────────────────────────────── */}
      <div className="globale-menu">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? "active" : ""}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── الجدول ───────────────────────────────────────────── */}
      <div className="menu-items">
        <div className="head promo-grid">
          <h3>Food</h3>
          <h3>Type</h3>
          <h3>Value</h3>
          <h3>Country</h3>
          <h3>Duration</h3>
          <h3>Status</h3>
          <h3>Actions</h3>
        </div>

        {filtered.length === 0 && (
          <div className="item item-empty">
            <p>No promotions found</p>
          </div>
        )}

        {filtered.map((promo) => (
          <div className="item promo-grid" key={promo._id}>
            {/* صورة واسم الطعام */}
            <div className="promo-food">
              {promo.foodId?.image?.url && (
                <img src={promo.foodId.image.url} alt={promo.foodId.name} />
              )}
              <span>{promo.foodId?.name || "—"}</span>
            </div>

            {/* نوع العرض */}
            <span className={`promo-type ${promo.type}`}>
              {promo.type === "discount" ? (
                <>
                  <FaTag /> Discount
                </>
              ) : (
                <>
                  <FaTruck /> Free Delivery
                </>
              )}
            </span>

            {/* قيمة الخصم */}
            <span className="promo-value">
              {promo.type === "discount" ? `${promo.discountValue}%` : "—"}
            </span>

            {/* البلد */}
            <span className="promo-country">{promo.country}</span>

            {/* التواريخ */}
            <div className="promo-dates">
              <span>{new Date(promo.startDate).toLocaleDateString()}</span>
              <span className="dash">→</span>
              <span>{new Date(promo.endDate).toLocaleDateString()}</span>
            </div>

            {/* الحالة */}
            <span className={`status ${promo.status}`}>{promo.status}</span>

            {/* الإجراءات */}
            <div className="action">
              <FiEdit
                className="icon edit"
                onClick={() => {
                  setSelectedPromotion(promo);
                  setType("edit");
                }}
              />
              <FaRegTrashAlt
                className="icon delete"
                onClick={() => handleDelete(promo)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Panel ─────────────────────────────────────── */}
      {type === "create" && (
        <>
          <div className="back" onClick={() => setType(null)} />
          <CreatePromotion
            api={api}
            onClose={() => setType(null)}
            onSuccess={() => {
              setType(null);
              fetchPromotions();
            }}
          />
        </>
      )}

      {/* ── Edit Panel ───────────────────────────────────────── */}
      {type === "edit" && selectedPromotion && (
        <>
          <div className="back" onClick={() => setType(null)} />
          <EditPromotion
            api={api}
            promotion={selectedPromotion}
            onClose={() => setType(null)}
            onSuccess={() => {
              setType(null);
              fetchPromotions();
            }}
          />
        </>
      )}
    </div>
  );
};

export default PromotionsManager;
