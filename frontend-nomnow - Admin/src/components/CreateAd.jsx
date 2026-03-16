import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import { toast } from "react-hot-toast";
import { FaChevronDown } from "react-icons/fa";

const CreateAd = ({ api, setType, refreshAds }) => {
  const [formData, setFormData] = useState({
    title: "",
    adtype: "",
    target: "",
    startDate: "",
    endDate: "",
    priority: 5,
  });

  const [types, setTypes] = useState([
    "Banner",
    "Popup",
    "Featured",
    "Category",
  ]);

  const [open, setOpen] = useState(false);

  const resetForm = () => {
    setFormData({
      title: "",
      adtype: "",
      target: "",
      startDate: "",
      endDate: "",
      priority: 5,
    });
    setImage(null);
  };

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

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
      data.append("title", formData.title.trim());
      data.append("adtype", formData.adtype.trim());
      data.append("target", formData.target);
      data.append("startDate", formData.startDate);
      data.append("endDate", formData.endDate);
      data.append("priority", Number(formData.priority));

      // إرسال الصورة فقط إذا تم اختيارها
      if (image) data.append("image", image);

      await api.post("/admin/ads", data);
      refreshAds();
      setImage(null);

      resetForm();
      setType(""); // إغلاق المودال
      toast.success(`Ad ${formData.title} Created Successfully`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
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
              <h3>Create New Ad Campaign</h3>
              <p>Set up a new advertising campaign</p>
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
          <div>
            <label htmlFor="">Ad Image *</label>
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
          <div className="input">
            <label>Campaign Title *</label>
            <input
              name="title"
              value={formData.title}
              placeholder="title"
              onChange={handleChange}
            />
          </div>
          <div className="inputs">
            <div className="input">
              <label>Ad Type *</label>
              <div className="type-select">
                <div className="select-box" onClick={() => setOpen(!open)}>
                  <span>{formData.adtype || "Select type"}</span>
                  <FaChevronDown className={open ? "rotate" : ""} />
                </div>

                {open && (
                  <ul className="options">
                    {types.map((type) => (
                      <li
                        key={type}
                        className={formData.adtype === type ? "active" : ""}
                        onClick={() => {
                          setFormData({ ...formData, adtype: type });
                          setOpen(false);
                        }}
                      >
                        {type}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="input">
              <label>Target Audience</label>
              <input
                name="target"
                value={formData.target}
                placeholder="Target"
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                max={formData.endDate || undefined}
                required
              />
            </div>
            <div className="input">
              <label>End Date *</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate || undefined}
                required
              />
            </div>
          </div>
          <div className="input range-input">
            <label>Priority Level ({formData.priority} / 10)</label>

            <div className="range-wrapper">
              <span className="range-label low">Low</span>

              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: Number(e.target.value) })
                }
              />

              <span className="range-label high">High</span>
            </div>
          </div>

          <div className="inputs">
            <button
              type="button"
              className="cancel"
              onClick={() => setType("")}
            >
              Cancel
            </button>

            <button type="submit">Create Campaign</button>
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

export default CreateAd;
