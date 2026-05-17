import { useState, useCallback } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { LuUpload } from "react-icons/lu";
import { MdOutlineEdit, MdDeleteOutline } from "react-icons/md";
import { VscSend } from "react-icons/vsc";
import { IoMdClose } from "react-icons/io";
import { toast } from "react-hot-toast";
import { GiKnifeFork } from "react-icons/gi";
import { useTranslation } from "react-i18next";

const CreateFood = ({ category, setType, setFoods }) => {
  const { api } = useAuth();
  const { t } = useTranslation();

  const [ingredientsInput, setIngredientsInput] = useState("");
  const [extrasInput, setExtrasInput] = useState({ name: "", price: "" });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    time: "",
    ingredients: [],
    extras: [],
    sizes: [],
    status: "available",
    isFeatured: false,
    categoryId: "",
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      time: "",
      ingredients: [],
      extras: [],
      sizes: [],
      status: "available",
      isFeatured: false,
      categoryId: "",
    });
    setIngredientsInput("");
    setExtrasInput({ name: "", price: "" });
    setImage(null);
    setOpen(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append("name", formData.name.trim());
      data.append("description", formData.description.trim());
      data.append("price", Number(formData.price));
      data.append("time", Number(formData.time));
      data.append("status", formData.status);
      data.append("isFeatured", formData.isFeatured);
      data.append("categoryId", formData.categoryId);
      data.append(
        "ingredients",
        JSON.stringify(formData.ingredients.filter((i) => i.trim())),
      );
      data.append(
        "extras",
        JSON.stringify(
          formData.extras.filter((e) => e.name.trim() && e.price > 0),
        ),
      );
      data.append("sizes", JSON.stringify(formData.sizes));
      if (image) data.append("image", image);

      const res = await api.post("/restaurant/food", data);
      setFoods((prev) => [res.data.foodData, ...prev]);
      resetForm();
      setType("");
      toast.success(t("menu.toasts.foodCreated", { name: formData.name }));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = useCallback(() => {
    if (!ingredientsInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, ingredientsInput.trim()],
    }));
    setIngredientsInput("");
  }, [ingredientsInput]);

  const removeIngredient = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }, []);

  const editIngredient = useCallback(
    (index) => {
      setIngredientsInput(formData.ingredients[index]);
      setFormData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.filter((_, i) => i !== index),
      }));
    },
    [formData.ingredients],
  );

  const addExtra = useCallback(() => {
    if (!extrasInput.name.trim() || !extrasInput.price) return;
    setFormData((prev) => ({
      ...prev,
      extras: [
        ...prev.extras,
        { ...extrasInput, price: Number(extrasInput.price) },
      ],
    }));
    setExtrasInput({ name: "", price: "" });
  }, [extrasInput]);

  const removeExtra = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }));
  }, []);

  const editExtra = useCallback(
    (index) => {
      setExtrasInput({
        name: formData.extras[index].name,
        price: formData.extras[index].price,
      });
      setFormData((prev) => ({
        ...prev,
        extras: prev.extras.filter((_, i) => i !== index),
      }));
    },
    [formData.extras],
  );

  const SIZE_KEYS = ["small", "medium", "large"];

  return (
    <div>
      <div className="create-food globale-popp">
        {/* Header */}
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <GiKnifeFork size={30} />
            </div>
            <div>
              <h3>{t("menu.addNewMenuItem")}</h3>
              <p>{t("menu.fillDetails")}</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose
              className="icon"
              onClick={() => {
                setType("");
              }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Image */}
          <div>
            <label>{t("menu.itemImage")}</label>
            <div className="image-upload">
              <input
                type="file"
                accept="image/*"
                id="food-image"
                hidden
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) setImage(f);
                }}
              />
              <label htmlFor="food-image" className="upload-box">
                {image ? (
                  <img src={URL.createObjectURL(image)} alt="Food preview" />
                ) : (
                  <div className="placeholder">
                    <LuUpload size={24} />
                    <span>{t("menu.uploadImage")}</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label>{t("menu.itemNameLabel")}</label>
            <input
              type="text"
              name="name"
              placeholder={t("menu.foodNamePlaceholder")}
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label>{t("menu.itemDescription")}</label>
            <input
              type="text"
              name="description"
              placeholder={t("menu.foodDescPlaceholder")}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          {/* Sizes */}
          <div className="sizes-box">
            <label>{t("menu.itemSizes")}</label>
            <p className="sizes-hint">{t("menu.sizesHint")}</p>
            <div className="sizes-row">
              {SIZE_KEYS.map((s) => {
                const existing = formData.sizes.find((x) => x.name === s);
                return (
                  <div key={s} className="size-input">
                    <label className="size-label">{t(`menu.${s}`)}</label>
                    <input
                      type="number"
                      min="0"
                      placeholder={t("menu.pricePlaceholder")}
                      value={existing?.price ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => {
                          const filtered = prev.sizes.filter(
                            (x) => x.name !== s,
                          );
                          if (val === "" || Number(val) <= 0)
                            return { ...prev, sizes: filtered };
                          return {
                            ...prev,
                            sizes: [
                              ...filtered,
                              { name: s, price: Number(val) },
                            ],
                          };
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price */}
          {formData.sizes.length === 0 && (
            <div>
              <label>{t("menu.itemPrice")}</label>
              <input
                type="number"
                name="price"
                placeholder={t("menu.pricePlaceholder")}
                value={formData.price}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
          )}

          {/* Time */}
          <div>
            <label>{t("menu.itemTime")}</label>
            <input
              type="number"
              name="time"
              placeholder={t("menu.timePlaceholder")}
              value={formData.time}
              onChange={handleChange}
              min="1"
              required
            />
          </div>

          {/* Ingredients */}
          <div className="ingredients-box">
            <label>{t("menu.ingredients")}</label>
            <div className="input-row">
              <input
                type="text"
                placeholder={t("menu.addIngredient")}
                value={ingredientsInput}
                onChange={(e) => setIngredientsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIngredient();
                  }
                }}
              />
              <button type="button" onClick={addIngredient}>
                <VscSend className="icon" />
              </button>
            </div>
            <ul className="ingredients-list">
              {formData.ingredients.map((item, index) => (
                <li key={index}>
                  <span>{item}</span>
                  <div className="actions">
                    <button type="button" onClick={() => editIngredient(index)}>
                      <MdOutlineEdit size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                    >
                      <MdDeleteOutline size={20} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Extras */}
          <div className="extras-box ingredients-box">
            <label>{t("menu.extras")}</label>
            <div className="input-row">
              <input
                type="text"
                placeholder={t("menu.extraName")}
                value={extrasInput.name}
                onChange={(e) =>
                  setExtrasInput({ ...extrasInput, name: e.target.value })
                }
              />
              <input
                type="number"
                placeholder={t("menu.pricePlaceholder")}
                value={extrasInput.price}
                onChange={(e) =>
                  setExtrasInput({ ...extrasInput, price: e.target.value })
                }
              />
              <button type="button" onClick={addExtra}>
                <VscSend className="icon" />
              </button>
            </div>
            <ul className="extras-list ingredients-list">
              {formData.extras.map((item, index) => (
                <li key={index}>
                  <span>
                    {item.name} ({item.price})
                  </span>
                  <div className="actions">
                    <button type="button" onClick={() => editExtra(index)}>
                      <MdOutlineEdit size={20} />
                    </button>
                    <button type="button" onClick={() => removeExtra(index)}>
                      <MdDeleteOutline size={20} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Category */}
          <div className="category-select">
            <label>{t("menu.itemCategory")}</label>
            <div className="select-box" onClick={() => setOpen(!open)}>
              <span>
                {category?.find((c) => c._id === formData.categoryId)?.name ||
                  t("menu.selectCategory")}
              </span>
              <FaChevronDown className={open ? "rotate" : ""} />
            </div>
            {open && (
              <ul className="options">
                {category.map((cat) => (
                  <li
                    key={cat._id}
                    className={formData.categoryId === cat._id ? "active" : ""}
                    onClick={() => {
                      setFormData({ ...formData, categoryId: cat._id });
                      setOpen(false);
                    }}
                  >
                    {cat.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status */}
          <div className="status-toggle">
            <label>{t("menu.itemStatus")}</label>
            <button
              type="button"
              className={`toggle ${
                formData.status === "available" ? "on" : "off"
              }`}
              onClick={() =>
                setFormData({
                  ...formData,
                  status:
                    formData.status === "available"
                      ? "unavailable"
                      : "available",
                })
              }
            >
              <span className="circle" />
              <span className="text">
                {formData.status === "available"
                  ? t("menu.available")
                  : t("menu.unavailable")}
              </span>
            </button>
          </div>

          {/* Featured */}
          <div className="status-toggle">
            <label>{t("menu.featured")}</label>
            <button
              type="button"
              className={`toggle ${formData.isFeatured ? "on" : "off"}`}
              onClick={() =>
                setFormData({ ...formData, isFeatured: !formData.isFeatured })
              }
            >
              <span className="circle" />
              <span className="text">
                {formData.isFeatured
                  ? t("menu.featuredOn")
                  : t("menu.featuredOff")}
              </span>
            </button>
          </div>

          {/* Buttons */}
          <div className="button">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setType("");
              }}
            >
              {t("common.cancel")}
            </button>
            <button className="orange" type="submit" disabled={loading}>
              {loading ? t("common.saving") : t("menu.addFood")}
            </button>
          </div>
        </form>
      </div>
      <div className="back" onClick={() => setType("")} />
    </div>
  );
};

export default CreateFood;
