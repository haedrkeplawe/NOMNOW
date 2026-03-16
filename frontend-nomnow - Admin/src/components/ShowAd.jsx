import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useState } from "react";
import { LuUpload } from "react-icons/lu";

const ShowAd = ({ ad, setType }) => {
  const [formData, setFormData] = useState({
    title: ad.title,
    adtype: ad.adtype,
    target: ad.target,
    startDate: ad.startDate.slice(0, 10),
    endDate: ad.endDate.slice(0, 10),
    priority: ad.priority,
  });

  const [image, setImage] = useState(null);
  // const [loading, setLoading] = useState(false);

  return (
    <div>
      <div className="popp form globale-popp">
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <BsShop size={26} />
            </div>
            <div>
              <h3>Show Ad Campaign</h3>
              <p>Show advertising campaign</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={() => setType("")} />
          </div>
        </div>

        <form>
          <label>Ad Image</label>
          <div className="image-upload">
            <input type="file" accept="image/*" hidden id="edit-image" />
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
            <input name="title" value={formData.title} readOnly />
          </div>

          <div className="inputs">
            <div className="input">
              <label>Ad Type</label>
              <input name="adtype" value={formData.adtype} readOnly />
            </div>
            <div className="input">
              <label>Target</label>
              <input name="target" value={formData.target} readOnly />
            </div>
          </div>

          <div className="inputs">
            <div className="input">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                max={formData.endDate}
                readOnly
              />
            </div>
            <div className="input">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                min={formData.startDate}
                readOnly
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
                readOnly
              />
              <span className="range-label high">High</span>
            </div>
          </div>
        </form>
      </div>

      <div className="back" onClick={() => setType("")}></div>
    </div>
  );
};

export default ShowAd;
