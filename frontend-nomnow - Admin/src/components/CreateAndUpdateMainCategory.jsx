// === ADMIN ===
import { IoMdClose } from "react-icons/io";
import { MdCategory } from "react-icons/md";
import { LuUpload } from "react-icons/lu";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const CreateAndUpdateMainCategory = ({
  api,
  selectedMainCategory,
  setSelectedMainCategory,
  setType,
  setMainCategories,
}) => {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null); // ملف جديد (File)
  const [existingImageUrl, setExistingImageUrl] = useState(null); // صورة محفوظة سابقاً (تعديل)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedMainCategory) return;
    setName(selectedMainCategory.name || "");
    setExistingImageUrl(selectedMainCategory.image?.url || null);
  }, [selectedMainCategory]);

  const handleClose = () => {
    setType("");
    setSelectedMainCategory(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append("name", name);
      if (image) data.append("image", image);

      if (selectedMainCategory) {
        const res = await api.patch(
          `/admin/main-categories/${selectedMainCategory._id}`,
          data,
        );
        setMainCategories((prev) =>
          prev.map((cat) =>
            cat._id === selectedMainCategory._id ? res.data.mainCategory : cat,
          ),
        );
        toast.success(`"${name}" updated successfully`);
      } else {
        const res = await api.post("/admin/main-categories", data);
        setMainCategories((prev) => [...prev, res.data.mainCategory]);
        toast.success(`"${name}" created successfully`);
      }
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // معاينة الصورة: الملف الجديد إذا اتاخد، وإلا الصورة المحفوظة سابقاً
  const previewSrc = image ? URL.createObjectURL(image) : existingImageUrl;

  return (
    <>
      <div className="popp form globale-popp">
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <MdCategory size={26} />
            </div>
            <div>
              <h3>
                {selectedMainCategory
                  ? "Edit Main Category"
                  : "Add Main Category"}
              </h3>
              <p>
                {selectedMainCategory
                  ? "Update this general category"
                  : "Create a new general category for all restaurants"}
              </p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={handleClose} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label>Category Image</label>
            <div className="image-upload main-category-image-upload">
              <input
                type="file"
                accept="image/*"
                id="main-category-image"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setImage(file);
                }}
              />
              <label htmlFor="main-category-image" className="upload-box">
                {previewSrc ? (
                  <img src={previewSrc} alt="Category preview" />
                ) : (
                  <div className="placeholder">
                    <LuUpload size={22} />
                    <span>Click to upload image</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="input">
            <label>Category Name *</label>
            <input
              type="text"
              placeholder="e.g. Burgers, Drinks, Desserts..."
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="inputs">
            <button type="button" className="cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : selectedMainCategory
                ? "Update"
                : "Create"}
            </button>
          </div>
        </form>
      </div>
      <div className="back" onClick={handleClose} />
    </>
  );
};

export default CreateAndUpdateMainCategory;
