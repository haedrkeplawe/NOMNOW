import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import { toast } from "react-hot-toast";
import { FaChevronDown } from "react-icons/fa";

const EditAd = ({ api, ad, setType, refreshAds }) => {
  const [formData, setFormData] = useState({
    title: ad.title,
    adtype: ad.adtype,
    target: ad.target,
    startDate: ad.startDate.slice(0, 10),
    endDate: ad.endDate.slice(0, 10),
    priority: ad.priority,
  });

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [types, setTypes] = useState([
    "Banner",
    "Popup",
    "Featured",
    "Category",
  ]);

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
      data.append("adId", ad._id);
      data.append("title", formData.title.trim());
      data.append("adtype", formData.adtype.trim());
      data.append("target", formData.target);
      data.append("startDate", formData.startDate);
      data.append("endDate", formData.endDate);
      data.append("priority", Number(formData.priority));

      if (image) data.append("image", image);

      await api.put(`/admin/ads`, data);

      refreshAds();
      setType("");
      setImage(null);
      toast.success(`Ad ${formData.title} Updated Successfully`);
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
              <h3>Edit Ad Campaign</h3>
              <p>Update advertising campaign</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={() => setType("")} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Ad Image</label>
          <div className="image-upload">
            <input
              type="file"
              accept="image/*"
              hidden
              id="edit-image"
              onChange={(e) => setImage(e.target.files[0])}
            />
            <label htmlFor="edit-image" className="upload-box">
              {image ? (
                <img src={URL.createObjectURL(image)} alt="preview" />
              ) : ad.image?.url ? (
                <img src={ad.image.url} alt="current" />
              ) : (
                <div className="placeholder">
                  <LuUpload size={24} />
                  <span>Upload image</span>
                </div>
              )}
            </label>
          </div>

          <div className="input">
            <label>Campaign Title</label>
            <input
              name="title"
              value={formData.title}
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
              <label>Target</label>
              <input
                name="target"
                value={formData.target}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="inputs">
            <div className="input">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                max={formData.endDate}
              />
            </div>
            <div className="input">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate}
              />
            </div>
          </div>

          <div className="input range-input">
            <label>Priority ({formData.priority} / 10)</label>
            <div className="range-wrapper">
              <span className="range-label low">Low</span>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: Number(e.target.value),
                  })
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
            <button type="submit" disabled={loading}>
              Update Ad
            </button>
          </div>
        </form>
      </div>

      <div className="back" onClick={() => setType("")}></div>
    </div>
  );
};

export default EditAd;
