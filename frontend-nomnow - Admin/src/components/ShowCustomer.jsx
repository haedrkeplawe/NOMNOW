import { FiUser, FiCheckCircle } from "react-icons/fi";
import { FaStar } from "react-icons/fa6";
import { FaDollarSign } from "react-icons/fa";
import { LuMail, LuPhone } from "react-icons/lu";

import { useState } from "react";
import { BiError } from "react-icons/bi";
import { toast } from "react-hot-toast";

const ShowCustomer = ({
  api,
  selectedCustomer,
  setSelectedCustomer,
  type,
  setType,
  setCustomers,
}) => {
  const [error, setError] = useState(null);
  const [reasonForBlock, setReasonForBlock] = useState([]);

  const handleUnBlock = async () => {
    try {
      const res = await api.patch("admin/user-unblock", {
        userId: selectedCustomer._id,
      });

      const updatedCustomer = res.data.user;

      setCustomers((prevCustomers) =>
        prevCustomers.map((customer) =>
          customer._id === updatedCustomer._id ? updatedCustomer : customer,
        ),
      );

      setSelectedCustomer(updatedCustomer);

      setType("show");
      toast.success(`Customer ${selectedCustomer.name} UnBlock`);
    } catch (err) {
      toast.error(err.response.data.message);
      setError(err.response.data.message);
    }
  };

  const handleBlock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/user-block", {
        userId: selectedCustomer._id,
        reasonForBlock,
      });

      const updatedCustomer = res.data.user;

      setCustomers((prevCustomers) =>
        prevCustomers.map((customer) =>
          customer._id === updatedCustomer._id ? updatedCustomer : customer,
        ),
      );

      setSelectedCustomer(updatedCustomer);

      setType("show");
      toast.success(`Customer ${selectedCustomer.name} Block`);
    } catch (err) {
      toast.error(err.response.data.message);
      setError(err.response.data.message);
    }
  };

  return (
    <>
      {type === "show" && (
        <div>
          <div className="popp showcustomer globale-popp">
            <div className="container">
              <div className="one">
                <div className="img">
                  <FiUser size={30} className="icon" />
                </div>
                <div className="text">
                  <h2>{selectedCustomer.name}</h2>
                  <p>Driver Profile</p>
                  <div className={"status " + selectedCustomer.status}>
                    <span>{selectedCustomer.status}</span>
                    <p>
                      Joined{" "}
                      {new Date(selectedCustomer.createdAt).toLocaleDateString(
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
                      <h2>{selectedCustomer.phone}</h2>
                    </div>
                  </div>
                  <div className="item">
                    <LuMail className="icon" />
                    <div>
                      <p>Email</p>
                      <h2>{selectedCustomer.email}</h2>
                    </div>
                  </div>
                </div>
                <div className="right">
                  <h2>Customer status </h2>
                  <div className={"status " + selectedCustomer.status}>
                    <span>{selectedCustomer.status}</span>
                  </div>
                </div>
              </div>
              <div className="fore">
                {selectedCustomer.status === "blocked" ? (
                  <button
                    className="approve unblocked-restaurant"
                    onClick={() => setType("unblock")}
                  >
                    Unblocked
                  </button>
                ) : (
                  <button
                    className="suspend blocked-restaurant"
                    onClick={() => setType("block")}
                  >
                    Blocked
                  </button>
                )}
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
          {type === "unblock" && (
            <div className="popp globale-approve  globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>UnBlock Customer</h2>
                <h3>{selectedCustomer.name}</h3>
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
                  <button className="approve" onClick={handleUnBlock}>
                    UnBlock Customer
                  </button>
                </div>
              </div>
            </div>
          )}
          {type === "block" && (
            <div className="popp globale-approve globale-suspend   globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Suspend Driver</h2>
                <h3>{selectedCustomer.name}</h3>
                <p>Are you sure you want to suspend ?</p>
                <h3>They will not be able to accept new orders.</h3>
                <form onSubmit={handleBlock}>
                  <div className="input">
                    <label>Reason for Suspension *</label>
                    <textarea
                      onChange={(e) => setReasonForBlock(e.target.value)}
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
                    <button className="suspend">Block Customer</button>
                  </div>
                </form>
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

export default ShowCustomer;
