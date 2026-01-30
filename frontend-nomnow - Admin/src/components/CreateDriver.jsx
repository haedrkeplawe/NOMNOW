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
    phone: "",
    email: "",
    vehicletype: "",
    vehicleplate: "",
    zone: "",
  });
  const resetForm = () => {
    setFormData({
      name: "",
      password: "",
      phone: "",
      email: "",
      vehicletype: "",
      vehicleplate: "",
      zone: "",
    });
  };
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
    setLoading(true);
    try {
      const data = new FormData();

      data.append("name", formData.name);
      data.append("password", formData.password);
      data.append("email", formData.email);
      data.append("phone", formData.phone);
      data.append("vehicletype", formData.vehicletype);
      data.append("vehicleplate", formData.vehicleplate);
      data.append("zone", formData.zone);

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
      setLoading(false);
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
                setType("");
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
              />
            </div>
            <div className="input">
              <label>Passowrd *</label>
              <input
                type="password"
                name="password"
                placeholder="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="inputs">
            <div className="input">
              <label>Phone Number *</label>
              <input
                name="phone"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input">
              <label>Email Address *</label>
              <input
                name="email"
                placeholder="driver@example.com"
                value={formData.email}
                onChange={handleChange}
                required
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
              <input
                name="vehicletype"
                placeholder="Enter type"
                value={formData.vehicletype}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input">
              <label>Vehicle Plate Number *</label>
              <input
                name="vehicleplate"
                placeholder="ABC-1234"
                value={formData.vehicleplate}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="input">
            <label>City / Zone *</label>
            <input
              name="zone"
              placeholder="Enter address"
              value={formData.zone}
              onChange={handleChange}
              required
            />
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
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setIdImage(file);
                    }
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
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setDrivingLicenseImage(file);
                    }
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
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setVehicleRegistrationImage(file);
                    }
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

export default CreateDriver;
