import { FiUser } from "react-icons/fi";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import RestaurantMapShow from "../components/RestaurantMapShow";
import RestaurantMap from "../components/RestaurantMap";
import { useTranslation } from "react-i18next";

const Settings = () => {
  const { api } = useAuth();
  const { t } = useTranslation();
  const [image, setImage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingMap, setIsEditingMap] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: {
      fullAddress: "",
      country: "",
      city: "",
      area: "",
      street: "",
      building: "",
      notes: "",
    },
    image: null,
    location: null,
  });

  const fetchRestaurantInfo = async () => {
    try {
      const res = await api.get("/restaurant/setting/restorant-info", {
        withCredentials: true,
      });
      const restaurant = res.data.restaurant;
      setFormData({
        name: restaurant.name || "",
        email: restaurant.email || "",
        phone: restaurant.phone || "",
        address: {
          fullAddress: restaurant.address.fullAddress || "",
          country: restaurant.address.country || "",
          city: restaurant.address.city || "",
          area: restaurant.address.area || "",
          street: restaurant.address.street || "",
          building: restaurant.address.building || "",
          notes: restaurant.address.notes || "",
        },
        description: restaurant.description || "",
        image: restaurant.image || null,
        location: restaurant.location || null,
      });
      setLoadingPage(false);
    } catch (err) {
      console.log(err);
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    fetchRestaurantInfo();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCancel = () => {
    fetchRestaurantInfo();
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append("name", formData.name);
      form.append("description", formData.description);
      form.append("email", formData.email);
      form.append("phone", formData.phone);
      form.append("address", JSON.stringify(formData.address));
      if (formData.location)
        form.append("location", JSON.stringify(formData.location));
      if (image) form.append("image", image);

      await api.patch("/restaurant/setting/restorant-info", form);
      fetchRestaurantInfo();
      setImage(null);
      setIsEditing(false);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="setting-page">
      {loadingPage && (
        <div className="globale-loader">
          <div className="spinner" />
        </div>
      )}
      <div className="text">
        <div>
          <h2>{t("settings.title")}</h2>
          <p>{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="profile">
        <form onSubmit={handleSubmit}>
          <div className="image">
            {formData.image ? (
              <img src={formData.image.url} alt="Restaurant" />
            ) : (
              <div className="img">
                <FiUser className="icon" />
              </div>
            )}
            <div className="text">
              <h2>{t("settings.restaurantProfile")}</h2>
              <p>{t("settings.updateInfo")}</p>
            </div>
          </div>

          <div className="inputs">
            <div className="input">
              <label>{t("settings.restaurantName")}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.contactEmail")}</label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="input">
            <label>{t("settings.phoneNumber")}</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          {/* Map */}
          <div className="map">
            {isEditingMap && isEditing ? (
              <RestaurantMap
                setLocation={(dataFromMap) =>
                  setFormData((prev) => ({
                    ...prev,
                    location: {
                      type: "Point",
                      coordinates: [dataFromMap[0], dataFromMap[1]],
                    },
                    address: dataFromMap[2] || prev.address,
                  }))
                }
              />
            ) : (
              <>
                <RestaurantMapShow initialLocation={formData.location} />
                {isEditing && (
                  <button type="button" onClick={() => setIsEditingMap(true)}>
                    {t("settings.updatePin")}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="inputs">
            <div className="input">
              <label>{t("settings.fullAddress")}</label>
              <input
                name="address.fullAddress"
                value={formData.address.fullAddress}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.country")}</label>
              <input
                name="address.country"
                value={formData.address.country}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.city")}</label>
              <input
                name="address.city"
                value={formData.address.city}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.area")}</label>
              <input
                name="address.area"
                value={formData.address.area}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.street")}</label>
              <input
                name="address.street"
                value={formData.address.street}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("settings.building")}</label>
              <input
                name="address.building"
                value={formData.address.building}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="input">
              <label>{t("common.notes")}</label>
              <input
                name="address.notes"
                value={formData.address.notes}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="input">
            <label>{t("settings.restaurantDescription")}</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          {isEditing && (
            <div className="input">
              <label>{t("settings.restaurantLogo")}</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  id="food-image"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setImage(file);
                  }}
                />
                <label htmlFor="food-image" className="upload-box">
                  <div className="placeholder">
                    {image ? (
                      <img
                        src={URL.createObjectURL(image)}
                        alt="Food preview"
                      />
                    ) : (
                      <div className="img">
                        <FiUser className="icon" />
                      </div>
                    )}
                    <span>{t("settings.clickToUpload")}</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="buttons">
            {!isEditing && (
              <button
                type="button"
                className="orange"
                onClick={() => setIsEditing(true)}
              >
                {t("common.update")}
              </button>
            )}
            {isEditing && (
              <>
                <button type="submit" className="orange">
                  {t("common.save")}
                </button>
                <button type="button" onClick={handleCancel}>
                  {t("common.cancel")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
