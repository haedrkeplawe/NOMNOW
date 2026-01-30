import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const CreateAndUpdateCategory = ({
  api,
  selectedCategory,
  setSelectedCategory,
  setType,
  setCategory,
}) => {
  const [formData, setFormData] = useState({
    category: "",
  });

  useEffect(() => {
    if (!selectedCategory) return;

    setFormData({
      category: selectedCategory.name || "",
    });
  }, [selectedCategory]);

  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setType("");
    setSelectedCategory(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedCategory) {
        // ✏️ تعديل
        const res = await api.patch(
          `/restaurant/category/${selectedCategory._id}`,
          {
            name: formData.category,
          },
        );

        // تحديث القائمة
        setCategory((prev) =>
          prev.map((cat) =>
            cat._id === selectedCategory._id ? res.data.category : cat,
          ),
        );
        toast.success(`Category ${formData.category} Updated`);
      } else {
        // ➕ إضافة
        const res = await api.post("/restaurant/category", {
          name: formData.category,
        });

        // تحديث القائمة
        setCategory((prev) => [...prev, res.data.category]);
        toast.success(`Category ${formData.category} Created`);
      }

      handleClose();
    } catch (err) {
      console.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="popp form globale-popp">
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <BsShop size={26} />
            </div>
            <div>
              <h3>Create category </h3>
              <p>Create a new category</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={handleClose} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input">
            <label>Category *</label>
            <input
              type="text"
              placeholder="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            />
          </div>
          <div className="inputs">
            <button type="button" className="cancel" onClick={handleClose}>
              Cancel
            </button>

            <button type="submit">
              {selectedCategory ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>

      <div className="back" onClick={handleClose}></div>
    </div>
  );
};

export default CreateAndUpdateCategory;
