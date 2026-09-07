// === ADMIN ===
import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { FaTag, FaTruck } from "react-icons/fa";
import { toast } from "react-hot-toast";

const EditPromotion = ({ api, promotion, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    discountValue: promotion.discountValue || "",
    startDate: promotion.startDate
      ? new Date(promotion.startDate).toISOString().slice(0, 16)
      : "",
    endDate: promotion.endDate
      ? new Date(promotion.endDate).toISOString().slice(0, 16)
      : "",
    country: promotion.country || "ALL",
    isActive: promotion.isActive,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate)
      return toast.error("Please set start and end dates");
    if (new Date(form.startDate) >= new Date(form.endDate))
      return toast.error("Start date must be before end date");
    if (
      promotion.type === "discount" &&
      (form.discountValue < 1 || form.discountValue > 99)
    )
      return toast.error("Discount value must be between 1 and 99");

    setSubmitting(true);
    try {
      await api.patch("/admin/promotions", {
        promotionId: promotion._id,
        discountValue:
          promotion.type === "discount"
            ? Number(form.discountValue)
            : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        country: form.country,
        isActive: form.isActive,
      });
      toast.success("Promotion updated successfully");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update promotion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="globale-popp popp-promotion">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="globale-close">
        <div className="left">
          <div
            className="icon"
            style={{
              background: "linear-gradient(182deg, #f54900, #ff6900)",
              color: "white",
            }}
          >
            {promotion.type === "discount" ? <FaTag /> : <FaTruck />}
          </div>
          <div>
            <h3>Edit Promotion</h3>
            <p>
              {promotion.type === "discount"
                ? `${promotion.discountValue}% discount`
                : "Free delivery"}{" "}
              on "{promotion.foodId?.name}"
            </p>
          </div>
        </div>
        <div className="right">
          <IoClose
            className="icon"
            onClick={onClose}
            style={{ fontSize: 22 }}
          />
        </div>
      </div>

      {/* ── معاينة الطعام ────────────────────────────────────── */}
      <div className="promo-food-preview">
        {promotion.foodId?.image?.url && (
          <img src={promotion.foodId.image.url} alt={promotion.foodId.name} />
        )}
        <div>
          <strong>{promotion.foodId?.name}</strong>
          <span className={`promo-type ${promotion.type}`}>
            {promotion.type === "discount" ? (
              <>
                <FaTag /> Discount
              </>
            ) : (
              <>
                <FaTruck /> Free Delivery
              </>
            )}
          </span>
        </div>
      </div>

      <div className="form">
        {/* قيمة الخصم — فقط لو discount */}
        {promotion.type === "discount" && (
          <div className="input">
            <label>Discount Value (%)</label>
            <div className="promo-discount-input">
              <input
                type="number"
                min={1}
                max={99}
                value={form.discountValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountValue: e.target.value }))
                }
              />
              <span className="percent-badge">%</span>
            </div>
          </div>
        )}

        {/* التواريخ */}
        <div className="inputs">
          <div className="input">
            <label>Start Date</label>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </div>
          <div className="input">
            <label>End Date</label>
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </div>
        </div>

        {/* البلد */}
        <div className="input">
          <label>Country</label>
          <select
            value={form.country}
            onChange={(e) =>
              setForm((f) => ({ ...f, country: e.target.value }))
            }
          >
            <option value="ALL">All Countries</option>
            <option value="SY">Syria (SY)</option>
            <option value="DE">Germany (DE)</option>
          </select>
        </div>

        {/* تفعيل/تعطيل */}
        <div className="promo-toggle-row">
          <label>Active</label>
          <label className="promo-switch">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            <span className="promo-slider" />
          </label>
        </div>

        {/* أزرار */}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPromotion;
