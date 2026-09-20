import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

const CreateAndUpdateCategory = ({
  api,
  selectedCategory,
  setSelectedCategory,
  setType,
  setCategory,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ category: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCategory) return;
    setFormData({ category: selectedCategory.name || "" });
  }, [selectedCategory]);

  const handleClose = () => {
    setType("");
    setSelectedCategory(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedCategory) {
        const res = await api.patch(
          `/restaurant/category/${selectedCategory._id}`,
          {
            name: formData.category,
          },
        );
        setCategory((prev) =>
          prev.map((cat) =>
            cat._id === selectedCategory._id ? res.data.category : cat,
          ),
        );
        toast.success(
          t("menu.toasts.categoryUpdated", { name: formData.category }),
        );
      } else {
        const res = await api.post("/restaurant/category", {
          name: formData.category,
        });
        setCategory((prev) => [...prev, res.data.category]);
        toast.success(
          t("menu.toasts.categoryCreated", { name: formData.category }),
        );
      }
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
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
              <h3>{t("menu.createCategory")}</h3>
              <p>{t("menu.createNewCategory")}</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={handleClose} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input">
            <label>{t("menu.categoryLabel")}</label>
            <input
              type="text"
              placeholder={t("menu.categoryPlaceholder")}
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            />
          </div>
          <div className="inputs">
            <button type="button" className="cancel" onClick={handleClose}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={loading}>
              {loading
                ? t("common.saving")
                : selectedCategory
                ? t("common.update")
                : t("common.create")}
            </button>
          </div>
        </form>
      </div>
      <div className="back" onClick={handleClose} />
    </div>
  );
};

export default CreateAndUpdateCategory;
