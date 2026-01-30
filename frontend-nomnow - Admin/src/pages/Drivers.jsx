import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FaStar } from "react-icons/fa";
import { FiUser } from "react-icons/fi";
import { BsThreeDotsVertical } from "react-icons/bs";
import CreateDriver from "../components/CreateDriver";
import { MdAccessTime } from "react-icons/md";
import ShowDriver from "../components/ShowDriver";
import { LuCircleCheckBig } from "react-icons/lu";
import { SiAdblock } from "react-icons/si";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

const Drivers = () => {
  const { api } = useAuth();
  const [categoryChosen, setCategoryChosen] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [type, setType] = useState("show");
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await api.get("admin/drivers");

      setDrivers(res.data.drivers);
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const categories = [
    { key: "active", label: "Active" },
    { key: "busy", label: "Busy" },
    { key: "offline", label: "Offline" },
  ];

  const filteredDrivers = drivers.filter((driver) => {
    const term = searchTerm.toLowerCase();

    return (
      driver.name.toLowerCase().includes(term) ||
      driver.zone.toLowerCase().includes(term) ||
      driver.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="driver-page">
      {loading && (
        <div className="globale-loader">
          <div className="spinner"></div>
        </div>
      )}
      <HeadCreateAndDetails
        text1={"Drivers"}
        text2={"Manage delivery drivers and their performance"}
        text3={"Add Driver"}
        setType={setType}
      />

      <div className="summary">
        <div>
          <p>Total Drivers</p>
          <h2>{drivers.length}</h2>
        </div>
        <div>
          <p>Active Now</p>
          <h2 className="active">38</h2>
        </div>
        <div>
          <p>On Delivery</p>
          <h2 className="delivery">23</h2>
        </div>
        <div>
          <p>Avg Rating</p>
          <h2 className="rating">4.8</h2>
        </div>
      </div>

      <div className="globale-search ">
        <input
          type="text"
          placeholder="Search Driver by name or zone or driverstatus ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {/* <button>
            <IoSearch size={20} />
          </button> */}
      </div>

      <div className="globale-menu ">
        <button
          className={categoryChosen === "all" ? "active" : ""}
          onClick={() => setCategoryChosen("all")}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={cat.key}
            className={categoryChosen === cat.key ? "active" : ""}
            onClick={() => setCategoryChosen(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="menu-items">
        <div className="head">
          <h3>Driver</h3>
          <h3>Status</h3>
          <h3>Zone</h3>
          <h3>Vehicle</h3>
          <h3>Orders</h3>
          <h3>Rating</h3>
          <h3>Earnings</h3>
          <h3>DriverStatus</h3>
          <h3>Actions</h3>
        </div>

        {filteredDrivers.length > 0 ? (
          filteredDrivers.map((driver) => (
            <div className="item" key={driver._id}>
              <div className="driver">
                <div className="img">
                  <FiUser className="icon" />
                </div>
                <div className="text">
                  <h4>{driver.name}</h4>
                  <p>{driver.email}</p>
                </div>
              </div>
              <div className="availability">{driver.availability}</div>
              <p className="zone">{driver.zone}</p>
              <p className="vehicle">{driver.vehicletype}</p>
              <p className="orders">310</p>
              <div className="rating">
                <FaStar className="icon" />
                {driver.rating}
              </div>
              <div className="earnings">$1,234</div>
              <div className={`driverstatus ${driver.status}`}>
                <div className="icon">
                  {driver.status === "blocked" && <SiAdblock />}
                  {driver.status === "approved" && <LuCircleCheckBig />}
                  {driver.status === "pending" && <MdAccessTime />}
                </div>

                <p>{driver.status}</p>
              </div>
              <div className="actions">
                <BsThreeDotsVertical
                  className="icon"
                  onClick={() => {
                    setSelectedDriver(driver);
                    setType("show");
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="item item-empty">
            <p>Driver not found</p>
          </div>
        )}
      </div>

      {type === "create" && (
        <CreateDriver
          api={api}
          setType={setType}
          setLoading={setLoading}
          fetchDrivers={fetchDrivers}
        />
      )}
      {(type === "show" ||
        type === "document" ||
        type === "approve" ||
        type === "assign" ||
        type === "suspend") &&
        selectedDriver && (
          <ShowDriver
            selectedDriver={selectedDriver}
            api={api}
            type={type}
            setType={setType}
            setLoading={setLoading}
            fetchDrivers={fetchDrivers}
            setDrivers={setDrivers}
            setSelectedDriver={setSelectedDriver}
          />
        )}
    </div>
  );
};

export default Drivers;
