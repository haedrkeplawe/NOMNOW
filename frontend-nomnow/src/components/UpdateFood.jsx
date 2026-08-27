import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { LuUpload } from "react-icons/lu";
import { MdOutlineEdit, MdDeleteOutline } from "react-icons/md";
import { VscSend } from "react-icons/vsc";
import { useAuth } from "../context/AuthContext";
import { IoMdClose } from "react-icons/io";
import { toast } from "react-hot-toast";
import { GiKnifeFork } from "react-icons/gi";
import { useTranslation } from "react-i18next";

const UpdateFood = ({ food, category, mainCategories, setType, setFoods }) => {
  const { api } = useAuth();
  const { t } = useTranslation();

  const [ingredientsInput, setIngredientsInput] = useState("");
  const [extrasInput, setExtrasInput] = useState({ name: "", price: "" });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [openMainCategory, setOpenMainCategory] = useState(false); // v3.7

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
    mainCategoryId: "", // v3.7
  });

  useEffect(() => {
    if (!food) return;
    setFormData({
      name: food.name || "",
      description: food.description || "",
      price: food.price || "",
      time: food.time || "",
      ingredients: food.ingredients || [],
      extras: food.extras || [],
      sizes: food.sizes || [],
      status: food.status || "available",
      isFeatured: food.isFeatured || false,
      categoryId: food.categoryId?._id || "",
      mainCategoryId: food.mainCategoryId?._id || "", // v3.7
    });
  }, [food]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addIngredient = () => {
    if (!ingredientsInput.trim()) return;
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, ingredientsInput.trim()],
    });
    setIngredientsInput("");
  };
  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };
  const editIngredient = (index) => {
    setIngredientsInput(formData.ingredients[index]);
    removeIngredient(index);
  };

  const addExtra = () => {
    if (!extrasInput.name || !extrasInput.price) return;
    setFormData({
      ...formData,
      extras: [
        ...formData.extras,
        { name: extrasInput.name, price: Number(extrasInput.price) },
      ],
    });
    setExtrasInput({ name: "", price: "" });
  };
  const removeExtra = (index) => {
    setFormData({
      ...formData,
      extras: formData.extras.filter((_, i) => i !== index),
    });
  };
  const editExtra = (index) => {
    setExtrasInput(formData.extras[index]);
    removeExtra(index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append("foodId", food._id);
      Object.entries(formData).forEach(([key, value]) => {
        if (["ingredients", "extras", "sizes"].includes(key)) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value);
        }
      });
      if (image) data.append("image", image);

      const res = await api.patch("/restaurant/food", data);
      setFoods((prev) =>
        prev.map((f) => (f._id === food._id ? res.data.food : f)),
      );
      setType("");
      toast.success(t("menu.toasts.foodUpdated", { name: formData.name }));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

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
            <IoMdClose className="icon" onClick={() => setType("")} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Image */}
          <div>
            <label>{t("menu.itemImage").replace(" *", "")}</label>
            <div className="image-upload">
              <input
                type="file"
                accept="image/*"
                hidden
                id="food-image"
                onChange={(e) => setImage(e.target.files[0])}
              />
              <label htmlFor="food-image" className="upload-box">
                {image ? (
                  <img src={URL.createObjectURL(image)} alt="" />
                ) : (
                  <img src={food.image?.url} alt="" />
                )}
                {!image && !food.image?.url && (
                  <div className="placeholder">
                    <LuUpload size={24} />
                    <span>{t("menu.uploadItemImage")}</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Name, Description, Time */}
          {["name", "description", "time"].map((field) => (
            <div key={field}>
              <label>
                {field === "name"
                  ? t("menu.itemNameLabel").replace(" *", "")
                  : field === "description"
                  ? t("menu.itemDescription")
                  : t("menu.itemTime").replace(" *", "")}
              </label>
              <input
                type={field === "time" ? "number" : "text"}
                name={field}
                value={formData[field]}
                onChange={handleChange}
              />
            </div>
          ))}

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
              <label>{t("menu.itemPrice").replace(" *", "")}</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                min="1"
              />
            </div>
          )}

          {/* Ingredients */}
          <div className="ingredients-box">
            <label>{t("menu.ingredients")}</label>
            <div className="input-row">
              <input
                value={ingredientsInput}
                onChange={(e) => setIngredientsInput(e.target.value)}
              />
              <button type="button" onClick={addIngredient}>
                <VscSend className="icon" />
              </button>
            </div>
            <ul className="ingredients-list">
              {formData.ingredients.map((item, i) => (
                <li key={i}>
                  <span>{item}</span>
                  <div className="actions">
                    <button onClick={() => editIngredient(i)} type="button">
                      <MdOutlineEdit />
                    </button>
                    <button onClick={() => removeIngredient(i)} type="button">
                      <MdDeleteOutline />
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
            <ul className="ingredients-list">
              {formData.extras.map((ex, i) => (
                <li key={i}>
                  <span>
                    {ex.name} ({ex.price})
                  </span>
                  <div className="actions">
                    <button onClick={() => editExtra(i)} type="button">
                      <MdOutlineEdit />
                    </button>
                    <button onClick={() => removeExtra(i)} type="button">
                      <MdDeleteOutline />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Category */}
          <div className="category-select">
            <label>{t("menu.itemCategory").replace(" *", "")}</label>
            <div className="select-box" onClick={() => setOpen(!open)}>
              <span>
                {category.find((c) => c._id === formData.categoryId)?.name ||
                  t("menu.selectCategory")}
              </span>
              <FaChevronDown className={open ? "rotate" : ""} />
            </div>
            {open && (
              <ul className="options">
                {category.map((cat) => (
                  <li
                    key={cat._id}
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

          {/* v3.7 — Main Category (اختياري، يديره الأدمن) */}
          <div className="category-select">
            <label>{t("menu.itemMainCategory")}</label>
            <div
              className="select-box"
              onClick={() => setOpenMainCategory(!openMainCategory)}
            >
              <span>
                {mainCategories?.find((c) => c._id === formData.mainCategoryId)
                  ?.name || t("menu.selectMainCategory")}
              </span>
              <FaChevronDown className={openMainCategory ? "rotate" : ""} />
            </div>
            {openMainCategory && (
              <ul className="options">
                <li
                  className={formData.mainCategoryId === "" ? "active" : ""}
                  onClick={() => {
                    setFormData({ ...formData, mainCategoryId: "" });
                    setOpenMainCategory(false);
                  }}
                >
                  {t("menu.noMainCategory")}
                </li>
                {mainCategories?.map((cat) => (
                  <li
                    key={cat._id}
                    className={
                      formData.mainCategoryId === cat._id ? "active" : ""
                    }
                    onClick={() => {
                      setFormData({ ...formData, mainCategoryId: cat._id });
                      setOpenMainCategory(false);
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
            <button type="button" onClick={() => setType("")}>
              {t("common.cancel")}
            </button>
            <button className="orange" disabled={loading}>
              {loading ? t("common.saving") : t("menu.updateFood")}
            </button>
          </div>
        </form>
      </div>
      <div className="back" onClick={() => setType("")} />
    </div>
  );
};

export default UpdateFood;
