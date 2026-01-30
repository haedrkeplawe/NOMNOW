import { CiDeliveryTruck } from "react-icons/ci";
import { FiUser, FiCheckCircle } from "react-icons/fi";
import { FaStar } from "react-icons/fa6";
import { FaDollarSign } from "react-icons/fa";
import { LuMail, LuPhone } from "react-icons/lu";
import {
  MdAccessTime,
  MdLocationPin,
  MdOutlineCheckCircle,
} from "react-icons/md";
import { useState } from "react";
import { BiError } from "react-icons/bi";
import { IoMdClose } from "react-icons/io";
import { IoDocumentTextOutline } from "react-icons/io5";
import { toast } from "react-hot-toast";

const ShowDriver = ({
  api,
  type,
  setType,
  setDrivers,
  selectedDriver,
  setSelectedDriver,
}) => {
  const [error, setError] = useState(null);
  const [reasonForSuspension, setReasonForSuspension] = useState([]);

  const handleApprove = async () => {
    try {
      const res = await api.patch("admin/drivers-verified", {
        driverId: selectedDriver._id,
      });

      const updatedDriver = res.data.driver;

      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver._id === updatedDriver._id ? updatedDriver : driver,
        ),
      );

      // تحديث السائق المحدد
      setSelectedDriver(updatedDriver);
      toast.success(`Driver ${selectedDriver.name} Approve`);
      setType("show");
    } catch (err) {
      toast.error(err.response.data.message);
      setError(err.response.data.message);
    }
  };

  const handleSuspend = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/drivers-suspend", {
        driverId: selectedDriver._id,
        reasonForSuspension,
      });

      const updatedDriver = res.data.driver;

      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver._id === updatedDriver._id ? updatedDriver : driver,
        ),
      );

      // تحديث السائق المحدد
      setSelectedDriver(updatedDriver);
      toast.success(`Driver ${selectedDriver.name} Suspend`);
      setType("show");
    } catch (err) {
      toast.error(err.response.data.message);
      setError(err.response.data.message);
    }
  };

  return (
    <>
      {type === "show" && (
        <div>
          <div className="popp showdriver globale-popp">
            <div className="container">
              <div className="one">
                <div className="img">
                  <CiDeliveryTruck size={30} className="icon" />
                </div>
                <div className="text">
                  <h2>Ahmed Mohammed</h2>
                  <p>Driver Profile</p>
                  <div className="status">
                    <span>active</span>
                    <p>
                      Joined
                      {new Date(selectedDriver.createdAt).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="tow">
                <div className="order">
                  <FiUser className="icon" />
                  <p>Total Orders</p>
                  <h2>32</h2>
                </div>
                <div className="rating">
                  <FaStar className="icon" />
                  <p>Rating</p>
                  <h2>4.8</h2>
                </div>
                <div className="total">
                  <FaDollarSign className="icon" />
                  <p>Total Earnings</p>
                  <h2>1000$</h2>
                </div>
              </div>
              <div className="three">
                <div className="left">
                  <h2>Contact Information</h2>
                  <div className="item">
                    <LuPhone className="icon" />
                    <div>
                      <p>phone</p>
                      <h4>{selectedDriver.name}</h4>
                    </div>
                  </div>
                  <div className="item">
                    <LuMail className="icon" />
                    <div>
                      <p>Email</p>
                      <h4>{selectedDriver.email}</h4>
                    </div>
                  </div>
                  <div className="item">
                    <MdLocationPin className="icon" />
                    <div>
                      <p>Assigned Zone</p>
                      <h4>{selectedDriver.zone}</h4>
                    </div>
                  </div>
                </div>
                <div className="right">
                  <h2>Driver Details</h2>
                  <div>
                    <p>Vehicle Type</p>
                    <h4>{selectedDriver.vehicletype}</h4>
                  </div>
                  <div>
                    <p>Documents Status</p>
                    {selectedDriver.isDocumentsVerified ? (
                      <div className="documents">
                        <div className="icon">
                          <MdOutlineCheckCircle />
                        </div>
                        <p>verified</p>
                      </div>
                    ) : (
                      <div className="documents pending">
                        <div className="icon">
                          <MdAccessTime />
                        </div>
                        <p>pending</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p>Join Date</p>
                    <h4>
                      {new Date(selectedDriver.createdAt).toLocaleDateString(
                        "en-GB",
                      )}
                    </h4>
                  </div>
                </div>
              </div>
              <div className="fore">
                <button
                  className="document"
                  onClick={() => setType("document")}
                >
                  View Documents
                </button>
                <button className="approve" onClick={() => setType("approve")}>
                  Approve Driver
                </button>
                <button className="assign" onClick={() => setType("assign")}>
                  Assign Zone
                </button>
                <button className="suspend" onClick={() => setType("suspend")}>
                  Suspend Driver
                </button>
              </div>
            </div>
          </div>
          <div
            className="back"
            onClick={() => {
              setType("");
            }}
          ></div>
        </div>
      )}

      {type !== "show" && (
        <div>
          {type === "approve" && (
            <div className="popp globale-approve  globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>Approve Driver</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to approve ?</p>
                <h3>
                  This will activate their account and allow them to accept
                  orders.
                </h3>
                <div className="info">
                  <p>✓ All documents verified</p>
                  <p>✓ Background check completed</p>
                  <p>✓ Training completed</p>
                </div>
                <div className="error">{error}</div>
                <div className="buttons">
                  <button
                    onClick={() => {
                      setType("show");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="approve" onClick={handleApprove}>
                    Approve Driver
                  </button>
                </div>
              </div>
            </div>
          )}
          {type === "suspend" && (
            <div className="popp globale-approve globale-suspend   globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Suspend Driver</h2>
                <h3>{selectedDriver.name}</h3>
                <p>Are you sure you want to suspend ?</p>
                <h3>They will not be able to accept new orders.</h3>
                <form onSubmit={handleSuspend}>
                  <div className="input">
                    <label>Reason for Suspension *</label>
                    <textarea
                      onChange={(e) => setReasonForSuspension(e.target.value)}
                      id=""
                      placeholder="Enter the reason for suspension..."
                      required
                    ></textarea>
                  </div>
                  <div className="error">{error}</div>
                  <div className="buttons">
                    <button
                      onClick={() => {
                        setType("show");
                      }}
                    >
                      Cancel
                    </button>
                    <button className="suspend">Suspend Driver</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {type === "document" && (
            <div className="popp  globale-popp document">
              <div className="container">
                <div className="one globale-close">
                  <div className="left">
                    <div className="icon">
                      <IoDocumentTextOutline size={30} />
                    </div>
                    <div>
                      <h3>Driver Documents</h3>
                      <p>{selectedDriver.name} - Verification Documents</p>
                    </div>
                  </div>

                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => {
                        setType("show");
                      }}
                    />
                  </div>
                </div>
                <div className="carts">
                  <div className="cart">
                    <img src={selectedDriver.idImage.url} alt="" />
                    <div className="text">
                      <h2>National ID Card</h2>
                    </div>
                  </div>
                  <div className="cart">
                    <img src={selectedDriver.drivingLicenseImage.url} alt="" />
                    <div className="text">
                      <h2>Driving License</h2>
                    </div>
                  </div>
                  <div className="cart">
                    <img
                      src={selectedDriver.vehicleRegistrationImage.url}
                      alt=""
                    />
                    <div className="text">
                      <h2>Vehicle Registration</h2>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div
            className="back"
            onClick={() => {
              setType("show");
            }}
          ></div>
        </div>
      )}
    </>
  );
};

export default ShowDriver;
