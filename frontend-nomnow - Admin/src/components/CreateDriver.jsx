// === ADMIN ===
import { CiDeliveryTruck } from "react-icons/ci";
import { IoMdClose } from "react-icons/io";
import { FiUser } from "react-icons/fi";
import { FiUpload } from "react-icons/fi";
import { LuUpload } from "react-icons/lu";
import { useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { toast } from "react-hot-toast";

const CreateDriver = ({ api, setType, setLoading, fetchDrivers }) => {
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    phone: "",
    email: "",
    vehicletype: "",
    vehicleplate: "",
    zone: "",
    country: "SY",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      password: "",
      confirmPassword: "",
      phone: "",
      email: "",
      vehicletype: "",
      vehicleplate: "",
      zone: "",
      country: "SY",
    });
    setDriverImage(null);
    setIdImage(null);
    setDrivingLicenseImage(null);
    setVehicleRegistrationImage(null);
  };

  const [driverImage, setDriverImage] = useState(null);
  const [idImage, setIdImage] = useState(null);
  const [drivingLicenseImage, setDrivingLicenseImage] = useState(null);
  const [vehicleRegistrationImage, setVehicleRegistrationImage] =
    useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();

      data.append("name", formData.name);
      data.append("password", formData.password);
      data.append("email", formData.email);
      data.append("phone", formData.phone);
      data.append("vehicletype", formData.vehicletype);
      data.append("vehicleplate", formData.vehicleplate);
      data.append("zone", formData.zone);
      data.append("country", formData.country);

      if (driverImage) data.append("driverImage", driverImage);
      if (idImage) data.append("idImage", idImage);
      if (drivingLicenseImage)
        data.append("drivingLicenseImage", drivingLicenseImage);
      if (vehicleRegistrationImage)
        data.append("vehicleRegistrationImage", vehicleRegistrationImage);

      await api.post("/admin/drivers", data);

      fetchDrivers();
      resetForm();
      setType("");
      toast.success(`Driver ${formData.name} Created Successfully`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
      console.error(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="popp form globale-popp">
        <div className="one globale-close">
          <div className="left">
            <div className="icon">
              <CiDeliveryTruck size={30} />
            </div>
            <div>
              <h3>Add New Driver</h3>
              <p>Register a new delivery driver to the platform</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose
              className="icon"
              onClick={() => {
                if (!isSubmitting) setType("");
              }}
            />
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-head">
            <div className="icon">
              <FiUser size={20} />
            </div>
            <h2>Personal Information</h2>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Full Name *</label>
              <input
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="input">
              <label>Password *</label>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="input">
              <label>Phone Number *</label>
              <input
                name="phone"
                placeholder={
                  formData.country === "DE" ? "+49XXXXXXXXXX" : "+963XXXXXXXXX"
                }
                value={formData.phone}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Email Address *</label>
              <input
                name="email"
                placeholder="driver@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-head">
            <div className="icon">
              <CiDeliveryTruck size={20} />
            </div>
            <h2>Vehicle Information</h2>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Vehicle Type *</label>
              <select
                name="vehicletype"
                value={formData.vehicletype}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              >
                <option value="">Select vehicle type</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Car">Car</option>
              </select>
            </div>

            <div className="input">
              <label>Vehicle Plate Number *</label>
              <input
                name="vehicleplate"
                placeholder="ABC-1234"
                value={formData.vehicleplate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="inputs">
            <div className="input">
              <label>City / Zone *</label>
              <input
                name="zone"
                placeholder="Enter address"
                value={formData.zone}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="input">
              <label>Operating Country *</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              >
                <option value="SY">🇸🇾 Syria</option>
                <option value="DE">🇩🇪 Germany</option>
              </select>
            </div>
          </div>

          <div className="form-head">
            <div className="icon">
              <FiUser size={20} />
            </div>
            <h2>Driver Photo (Optional)</h2>
          </div>
          <div className="images">
            <div>
              <label htmlFor="">Profile Photo</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  id="driver-image"
                  hidden
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setDriverImage(file);
                  }}
                />
                <label htmlFor="driver-image" className="upload-box">
                  {driverImage ? (
                    <img
                      src={URL.createObjectURL(driverImage)}
                      alt="Driver preview"
                    />
                  ) : (
                    <div className="placeholder">
                      <LuUpload size={24} />
                      <span>Click to upload image</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="form-head">
            <div className="icon">
              <FiUpload size={20} />
            </div>
            <h2>Upload Documents (Optional)</h2>
          </div>
          <div className="images">
            <div>
              <label htmlFor="">ID Card</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  id="id-image"
                  hidden
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setIdImage(file);
                  }}
                />
                <label htmlFor="id-image" className="upload-box">
                  {idImage ? (
                    <img src={URL.createObjectURL(idImage)} alt="Id preview" />
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
              <label htmlFor="">Driving License</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  id="drivingLicense-image"
                  hidden
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setDrivingLicenseImage(file);
                  }}
                />
                <label htmlFor="drivingLicense-image" className="upload-box">
                  {drivingLicenseImage ? (
                    <img
                      src={URL.createObjectURL(drivingLicenseImage)}
                      alt="drivingLicense preview"
                    />
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
              <label htmlFor="">Vehicle Registration</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  id="vehicleRegistration-image"
                  hidden
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setVehicleRegistrationImage(file);
                  }}
                />
                <label
                  htmlFor="vehicleRegistration-image"
                  className="upload-box"
                >
                  {vehicleRegistrationImage ? (
                    <img
                      src={URL.createObjectURL(vehicleRegistrationImage)}
                      alt="vehicleRegistration preview"
                    />
                  ) : (
                    <div className="placeholder">
                      <LuUpload size={24} />
                      <span>Click to upload image</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          <div className="end">
            <HiOutlineExclamationCircle /> Driver will be added to the system
            with "Pending" status. Documents can be uploaded later for
            verification before activation.
          </div>
          <div className="inputs">
            <button
              type="button"
              className="cancel"
              onClick={() => setType("")}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Driver"}
            </button>
          </div>
        </form>
      </div>
      <div
        className="back"
        onClick={() => {
          if (!isSubmitting) setType("");
        }}
      ></div>
    </div>
  );
};

export default CreateDriver;
