import { useState, useCallback } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { LuUpload } from "react-icons/lu";
import { MdOutlineEdit } from "react-icons/md";
import { MdDeleteOutline } from "react-icons/md";
import { VscSend } from "react-icons/vsc";
import { IoMdClose } from "react-icons/io";
import { CiDeliveryTruck } from "react-icons/ci";
import { toast } from "react-hot-toast";
import { GiKnifeFork } from "react-icons/gi";

const CreateFood = ({ category, setType, setFoods }) => {
  const { api } = useAuth();

  const [ingredientsInput, setIngredientsInput] = useState("");
  const [extrasInput, setExtrasInput] = useState({ name: "", price: "" });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    time: "",
    ingredients: [],
    extras: [],
    status: "available",
    categoryId: "",
  });
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      time: "",
      ingredients: [],
      extras: [],
      status: "available",
      categoryId: "",
    });
    setIngredientsInput("");
    setExtrasInput({ name: "", price: "" });
    setImage(null);
    setOpen(false);
  };

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();

      // ✅ التأكد من تحويل price و time إلى أرقام
      data.append("name", formData.name.trim());
      data.append("description", formData.description.trim());
      data.append("price", Number(formData.price));
      data.append("time", Number(formData.time));
      data.append("status", formData.status);
      data.append("categoryId", formData.categoryId);

      // ✅ تصفية المكونات الفارغة قبل الإرسال
      const filteredIngredients = formData.ingredients.filter(
        (i) => i.trim() !== "",
      );
      const filteredExtras = formData.extras.filter(
        (e) => e.name.trim() !== "" && e.price > 0,
      );

      data.append("ingredients", JSON.stringify(filteredIngredients));
      data.append("extras", JSON.stringify(filteredExtras));

      // إرسال الصورة فقط إذا تم اختيارها
      if (image) data.append("image", image);

      const res = await api.post("/restaurant/food", data);

      setFoods((prev) => [res.data.foodData, ...prev]);

      // إعادة تعيين الحقول بعد الإضافة
      setFormData({
        name: "",
        description: "",
        price: "",
        time: "",
        ingredients: [],
        extras: [],
        status: "available",
        categoryId: "",
      });
      setIngredientsInput("");
      setExtrasInput({ name: "", price: "" });
      setImage(null);

      resetForm();
      setType(""); // إغلاق المودال
      toast.success(`Food ${formData.name} Created`);
    } catch (err) {
      console.error(err.response?.data?.message || err.message);
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // داخل المكون CreateFood
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
      const value = formData.extras[index];
      setExtrasInput({ name: value.name, price: value.price });
      setFormData((prev) => ({
        ...prev,
        extras: prev.extras.filter((_, i) => i !== index),
      }));
    },
    [formData.extras],
  );

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
        <form onSubmit={handleSubmit} className="">
          <div>
            <label htmlFor="">item image *</label>
            <div className="image-upload">
              <input
                type="file"
                accept="image/*"
                id="food-image"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setImage(file);
                  }
                }}
              />
              <label htmlFor="food-image" className="upload-box">
                {image ? (
                  <img src={URL.createObjectURL(image)} alt="Food preview" />
                ) : (
                  <div className="placeholder">
                    <LuUpload size={24} />
                    <span>Click to upload image</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="">item name * </label>
            <input
              type="text"
              name="name"
              placeholder="Food name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="">item description </label>
            <input
              type="text"
              name="description"
              placeholder="Food Description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="">item price *</label>
            <input
              type="number"
              name="price"
              placeholder="Price"
              value={formData.price}
              onChange={handleChange}
              min="1" // ✅ منع القيم السالبة
              required
            />
          </div>

          <div>
            <label htmlFor="">item time *</label>
            <input
              type="number"
              name="time"
              placeholder="Preparation time (minutes)"
              value={formData.time}
              onChange={handleChange}
              min="1" // ✅ الحد الأدنى دقيقة واحدة
              required
            />
          </div>

          <div className="ingredients-box">
            <label>Item ingredients</label>

            <div className="input-row">
              <input
                type="text"
                placeholder="Add ingredient"
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

          <div className="extras-box ingredients-box">
            <label>Item extras</label>

            <div className="input-row">
              <input
                type="text"
                placeholder="Extra name"
                value={extrasInput.name}
                onChange={(e) =>
                  setExtrasInput({
                    ...extrasInput,
                    name: e.target.value,
                  })
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

            <ul className="extras-list ingredients-list">
              {formData.extras.map((item, index) => (
                <li key={index}>
                  <span>
                    {item.name} {`(${item.price})`}
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

          <div className="category-select">
            <label>Item category *</label>
            <div className="select-box" onClick={() => setOpen(!open)}>
              <span>
                {category?.find((c) => c._id === formData.categoryId)?.name ||
                  "Select category"}
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
              <span className="text">
                {formData.status === "available" ? "Available" : "Unavailable"}
              </span>
            </button>
          </div>

          <div className="button">
            <button
              type="button"
              onClick={() => {
                resetForm(); // ✅ إعادة تعيين النموذج
                setType("");
              }}
            >
              Cansel
            </button>

            <button className="orange" type="submit" disabled={loading}>
              {loading ? "Saving..." : <>Add Food</>}
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

export default CreateFood;
