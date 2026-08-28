// === ADMIN ===
import { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { FaTag, FaTruck } from "react-icons/fa";
import { toast } from "react-hot-toast";

const CreatePromotion = ({ api, onClose, onSuccess }) => {
  // ── State ─────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1: اختيار المطعم، 2: اختيار الطعام، 3: تفاصيل العرض
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchRestaurant, setSearchRestaurant] = useState("");
  const [searchFood, setSearchFood] = useState("");

  const [form, setForm] = useState({
    type: "discount",
    discountValue: 10,
    startDate: "",
    endDate: "",
    country: "ALL",
  });

  // ── جلب المطاعم ───────────────────────────────────────────────
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await api.get("/admin/restaurant");
        setRestaurants(res.data.restaurants || []);
      } catch (err) {
        toast.error("Failed to load restaurants");
      } finally {
        setLoadingRestaurants(false);
      }
    };
    fetchRestaurants();
  }, []);

  // ── جلب أطعمة المطعم المختار ─────────────────────────────────
  const handleSelectRestaurant = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectedFood(null);
    setFoods([]);
    setLoadingFoods(true);
    setStep(2);
    try {
      const res = await api.get(`/admin/restaurants/${restaurant._id}/foods`);
      setFoods(res.data.foods || []);
    } catch (err) {
      toast.error("Failed to load foods");
    } finally {
      setLoadingFoods(false);
    }
  };

  // ── إرسال العرض ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedFood) return toast.error("Please select a food item");
    if (!form.startDate || !form.endDate)
      return toast.error("Please set start and end dates");
    if (new Date(form.startDate) >= new Date(form.endDate))
      return toast.error("Start date must be before end date");
    if (
      form.type === "discount" &&
      (!form.discountValue || form.discountValue < 1 || form.discountValue > 99)
    )
      return toast.error("Discount value must be between 1 and 99");

    setSubmitting(true);
    try {
      await api.post("/admin/promotions", {
        foodId: selectedFood._id,
        type: form.type,
        discountValue:
          form.type === "discount" ? Number(form.discountValue) : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        country: form.country,
      });
      toast.success("Promotion created successfully");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create promotion");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRestaurants = restaurants.filter((r) =>
    r.name?.toLowerCase().includes(searchRestaurant.toLowerCase()),
  );

  const filteredFoods = foods.filter((f) =>
    f.name?.toLowerCase().includes(searchFood.toLowerCase()),
  );

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
            <FaTag />
          </div>
          <div>
            <h3>Create Promotion</h3>
            <p>
              {step === 1 && "Step 1 — Select a restaurant"}
              {step === 2 &&
                `Step 2 — Select a food from ${selectedRestaurant?.name}`}
              {step === 3 &&
                `Step 3 — Set promotion details for "${selectedFood?.name}"`}
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

      {/* ── Step indicator ───────────────────────────────────── */}
      <div className="promo-steps">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`step ${step >= s ? "done" : ""} ${
              step === s ? "active" : ""
            }`}
          >
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* ── Step 1: اختيار المطعم ────────────────────────────── */}
      {step === 1 && (
        <div className="promo-step-content">
          <input
            className="promo-search"
            placeholder="Search restaurants..."
            value={searchRestaurant}
            onChange={(e) => setSearchRestaurant(e.target.value)}
          />
          {loadingRestaurants ? (
            <div className="page-loader" style={{ minHeight: 150 }}>
              <div className="page-loader__spinner" />
            </div>
          ) : (
            <div className="promo-list">
              {filteredRestaurants.map((r) => (
                <div
                  key={r._id}
                  className="promo-list-item"
                  onClick={() => handleSelectRestaurant(r)}
                >
                  {r.image?.url && <img src={r.image.url} alt={r.name} />}
                  <div>
                    <strong>{r.name}</strong>
                    <span>{r.country}</span>
                  </div>
                </div>
              ))}
              {filteredRestaurants.length === 0 && (
                <p className="promo-empty">No restaurants found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: اختيار الطعام ────────────────────────────── */}
      {step === 2 && (
        <div className="promo-step-content">
          <button className="promo-back" onClick={() => setStep(1)}>
            ← Back to restaurants
          </button>
          <input
            className="promo-search"
            placeholder="Search foods..."
            value={searchFood}
            onChange={(e) => setSearchFood(e.target.value)}
          />
          {loadingFoods ? (
            <div className="page-loader" style={{ minHeight: 150 }}>
              <div className="page-loader__spinner" />
            </div>
          ) : (
            <div className="promo-list">
              {filteredFoods.map((f) => (
                <div
                  key={f._id}
                  className={`promo-list-item ${
                    selectedFood?._id === f._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedFood(f);
                    setStep(3);
                  }}
                >
                  {f.image?.url && <img src={f.image.url} alt={f.name} />}
                  <div>
                    <strong>{f.name}</strong>
                    <span>
                      {f.price} — {f.status}
                    </span>
                  </div>
                </div>
              ))}
              {filteredFoods.length === 0 && (
                <p className="promo-empty">No foods found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: تفاصيل العرض ─────────────────────────────── */}
      {step === 3 && selectedFood && (
        <div className="promo-step-content">
          <button className="promo-back" onClick={() => setStep(2)}>
            ← Back to foods
          </button>

          {/* معاينة الطعام المختار */}
          <div className="promo-food-preview">
            {selectedFood.image?.url && (
              <img src={selectedFood.image.url} alt={selectedFood.name} />
            )}
            <div>
              <strong>{selectedFood.name}</strong>
              {selectedFood.sizes && selectedFood.sizes.length > 0 ? (
                <span>
                  {selectedFood.sizes
                    .map((s) => `${s.name}: ${s.price}`)
                    .join(" · ")}
                </span>
              ) : (
                <span>Price: {selectedFood.price}</span>
              )}
            </div>
          </div>

          <div className="form">
            {/* نوع العرض */}
            <div className="promo-type-toggle">
              <button
                className={form.type === "discount" ? "active" : ""}
                onClick={() => setForm((f) => ({ ...f, type: "discount" }))}
              >
                <FaTag /> Discount %
              </button>
              <button
                className={form.type === "free_delivery" ? "active" : ""}
                onClick={() =>
                  setForm((f) => ({ ...f, type: "free_delivery" }))
                }
              >
                <FaTruck /> Free Delivery
              </button>
            </div>

            {/* قيمة الخصم — تظهر فقط عند discount */}
            {form.type === "discount" && (
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

                {/* معاينة السعر بعد الخصم — حسب نوع الطعام */}
                {selectedFood.sizes && selectedFood.sizes.length > 0 ? (
                  <div className="promo-sizes-preview">
                    {selectedFood.sizes.map((s) => (
                      <p key={s.name} className="promo-preview-price">
                        {s.name.charAt(0).toUpperCase() + s.name.slice(1)}:{" "}
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#aaa",
                          }}
                        >
                          {s.price}
                        </span>{" "}
                        →{" "}
                        <strong>
                          {(s.price * (1 - form.discountValue / 100)).toFixed(
                            2,
                          )}
                        </strong>
                      </p>
                    ))}
                  </div>
                ) : selectedFood.price ? (
                  <p className="promo-preview-price">
                    Price after discount:{" "}
                    <span
                      style={{ textDecoration: "line-through", color: "#aaa" }}
                    >
                      {selectedFood.price}
                    </span>{" "}
                    →{" "}
                    <strong>
                      {(
                        selectedFood.price *
                        (1 - form.discountValue / 100)
                      ).toFixed(2)}
                    </strong>
                  </p>
                ) : null}
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

            {/* أزرار */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePromotion;
