import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { LuUpload } from "react-icons/lu";
import { MdOutlineEdit, MdDeleteOutline } from "react-icons/md";
import { VscSend } from "react-icons/vsc";
import { useAuth } from "../context/AuthContext";
import { IoMdClose } from "react-icons/io";
import { toast } from "react-hot-toast";
import { GiKnifeFork } from "react-icons/gi";

const UpdateFood = ({ food, category, setType, setFoods }) => {
  const { api } = useAuth();

  const [ingredientsInput, setIngredientsInput] = useState("");
  const [extrasInput, setExtrasInput] = useState({ name: "", price: "" });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    time: "",
    ingredients: [],
    extras: [],
    sizes: [],
    status: "available",
    categoryId: "",
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
      categoryId: food.categoryId?._id || "",
    });
  }, [food]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🟢 INGREDIENTS
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
  // 🟢 EXTRAS
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

  // 🟢 SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();

      data.append("foodId", food._id);
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "ingredients" || key === "extras" || key === "sizes") {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value);
        }
      });

      if (image) data.append("image", image);

      const res = await api.patch("/restaurant/food", data);

      // 🟢 تحديث العنصر مباشرة
      setFoods((prev) =>
        prev.map((f) => (f._id === food._id ? res.data.food : f)),
      );

      setType("");
      toast.success(`Food ${formData.name} Updated`);
    } catch (err) {
      console.error(err.response?.data?.message || err.message);
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="create-food globale-popp">
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <GiKnifeFork size={30} />
            </div>
            <div>
              <h3>Add New Menu Item</h3>
              <p>Fill in the details below</p>
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
          {/* IMAGE */}
          <div>
            <label>item image</label>
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
                    <span>Upload image</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* BASIC INPUTS */}
          {["name", "description", "time"].map((field) => (
            <div key={field}>
              <label>{field}</label>
              <input
                type={field === "time" ? "number" : "text"}
                name={field}
                value={formData[field]}
                onChange={handleChange}
              />
            </div>
          ))}

          {/* SIZES */}
          <div className="sizes-box">
            <label>Item sizes (optional)</label>
            <p className="sizes-hint">
              If sizes are added, they replace the single price
            </p>
            <div className="sizes-row">
              {["small", "medium", "large"].map((s) => {
                const existing = formData.sizes.find((x) => x.name === s);
                return (
                  <div key={s} className="size-input">
                    <label className="size-label">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
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

          {/* PRICE — يظهر فقط إذا ما في أحجام */}
          {formData.sizes.length === 0 && (
            <div>
              <label>price</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                min="1"
              />
            </div>
          )}

          {/* INGREDIENTS */}
          <div className="ingredients-box">
            <label>Item ingredients</label>
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

          {/* EXTRAS */}
          <div className="extras-box ingredients-box">
            <label>Item extras</label>
            <div className="input-row">
              <input
                placeholder="Name"
                value={extrasInput.name}
                onChange={(e) =>
                  setExtrasInput({ ...extrasInput, name: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Price"
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

          {/* CATEGORY */}
          <div className="category-select">
            <label>Item category</label>
            <div className="select-box" onClick={() => setOpen(!open)}>
              <span>
                {category.find((c) => c._id === formData.categoryId)?.name ||
                  "Select category"}
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

          {/* STATUS */}
          <div className="status-toggle">
            <label>Item status</label>
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
              <span className="text">{formData.status}</span>
            </button>
          </div>

          <div className="button">
            <button type="button" onClick={() => setType("")}>
              Cancel
            </button>
            <button className="orange" disabled={loading}>
              {loading ? "Saving..." : "Update Food"}
            </button>
          </div>
        </form>
      </div>
      <div
        className="back"
        onClick={() => {
          setType("");
        }}
      ></div>
    </div>
  );
};

export default UpdateFood;
