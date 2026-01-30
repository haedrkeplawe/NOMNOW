import { FiPhone, FiUser } from "react-icons/fi";
import { FaStar } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LuShoppingBag } from "react-icons/lu";
import { CiCalendar } from "react-icons/ci";
import { BsThreeDotsVertical } from "react-icons/bs";
import ShowCustomer from "../components/ShowCustomer";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

const Customers = () => {
  const { api } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [newthisweek, setNewthisweek] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await api.get("/admin/customer");
        setCustomers(res.data.customer);
        setTotal(res.data.totalUsers);
        setNewthisweek(res.data.usersThisWeek);
      } catch (error) {
        toast.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [api]);

  return (
    <div className="customers-page">
      {loading && (
        <div className="globale-loader">
          <div className="spinner"></div>
        </div>
      )}
      <HeadCreateAndDetails
        text1={"Customers"}
        text2={"Manage customer accounts and activity"}
        text3={null}
        setType={setType}
      />

      <div className="summary">
        <div>
          <FiUser className="icon" />
          <p>Total Customers</p>
          <h2>{total}</h2>
        </div>
        <div>
          <LuShoppingBag className="icon" />
          <p>Active This Month</p>
          <h2>179</h2>
        </div>
        <div>
          <FaStar className="icon" />
          <p>Avg Order Value</p>
          <h2>1379</h2>
        </div>
        <div>
          <CiCalendar className="icon" />
          <p>New This Week</p>
          <h2>{newthisweek}</h2>
        </div>
      </div>

      <div className="menu-items">
        <div className="head">
          <h3>Customer</h3>
          <h3>Contact</h3>
          <h3>Orders</h3>
          <h3>Total Spent</h3>
          <h3>Rating</h3>
          <h3>Status</h3>
          <h3>Actions</h3>
        </div>
        {customers.map((customer) => (
          <div className="item" key={customer._id}>
            <div className="customer">
              <div className="img">
                {customer?.img ? (
                  <img src={customer.img.url} alt="" />
                ) : (
                  <FiUser className="icon" />
                )}
              </div>
              <div className="text">
                <h4>{customer.name}</h4>
                <p>
                  {new Date(customer.createdAt)
                    .toLocaleDateString("en-GB")
                    .replaceAll("/", "-")}
                </p>
              </div>
            </div>
            <div className="contact">
              <div>
                <FiUser className="icon" />
                <p>{customer.email}</p>
              </div>
              <div>
                <FiPhone className="icon" />
                <p>{customer.phone}</p>
              </div>
            </div>
            <div className="orders">45</div>
            <div className="spend">$1,234</div>
            <div className="rating">
              <FaStar className="icon" />4
            </div>
            <div className={"status " + customer.status}>{customer.status}</div>
            <div className="actions">
              <BsThreeDotsVertical
                className="icon"
                onClick={() => {
                  setSelectedCustomer(customer);
                  setType("show");
                }}
              />
            </div>
          </div>
        ))}

        {customers.length <= 0 && (
          <div className="item item-empty">
            <p>Customer not found</p>
          </div>
        )}
      </div>

      {(type === "show" || type === "block" || type === "unblock") &&
        selectedCustomer && (
          <ShowCustomer
            selectedCustomer={selectedCustomer}
            api={api}
            type={type}
            setType={setType}
            setCustomers={setCustomers}
            setSelectedCustomer={setSelectedCustomer}
          />
        )}
    </div>
  );
};

export default Customers;
