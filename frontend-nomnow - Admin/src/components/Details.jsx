import { FiCheckCircle, FiPhone, FiUser } from "react-icons/fi";
import { MdOutlineEmail } from "react-icons/md";
import { LuMapPin, LuShoppingBag } from "react-icons/lu";
import { FaRegStar } from "react-icons/fa6";
import { FaRegClock } from "react-icons/fa6";
import { FaDollarSign } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { HiMiniArrowTrendingUp } from "react-icons/hi2";
import { TiStarOutline } from "react-icons/ti";
import { useEffect, useState } from "react";
import { BiError } from "react-icons/bi";
import { BsShop } from "react-icons/bs";
import { toast } from "react-hot-toast";

const Details = ({
  restaurantChossen,
  setRestaurantChossen,
  type,
  setType,
  api,
  restaurants,
  setRestaurants,
}) => {
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState(null);
  const [reasonForBlock, setReasonForBlock] = useState([]);

  useEffect(() => {
    if (type === "menu" && restaurantChossen?._id) {
      api
        .get(`/admin/getfoodfromrestaurant/${restaurantChossen._id}`)
        .then((res) => {
          setFoods(res.data.foods);
        });
    }
  }, [type, restaurantChossen?._id]);

  const handleUnBlocked = async () => {
    try {
      const res = await api.patch("admin/restaurant-unblock", {
        restaurantId: restaurantChossen._id,
      });

      const updatedRestaurant = res.data.restaurant;

      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((restaurant) =>
          restaurant._id === updatedRestaurant._id
            ? updatedRestaurant
            : restaurant,
        ),
      );

      setRestaurantChossen(updatedRestaurant);
      toast.success(
        `Restaurant ${restaurantChossen.name} UnBlocked Successfully`,
      );
      setType("show");
    } catch (err) {
      setError(err.response.data.message);
    }
  };

  const handleBlocked = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("admin/restaurant-block", {
        restaurantId: restaurantChossen._id,
        reasonForBlock,
      });

      const updatedRestaurant = res.data.restaurant;

      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((restaurant) =>
          restaurant._id === updatedRestaurant._id
            ? updatedRestaurant
            : restaurant,
        ),
      );

      // تحديث السائق المحدد
      setRestaurantChossen(updatedRestaurant);
      toast.success(
        `Restaurant ${restaurantChossen.name} Blocked Successfully`,
      );
      setType("show");
    } catch (err) {
      setError(err.response.data.message);
    }
  };
  return (
    <>
      {type === "details" && (
        <div>
          <div className="popp details globale-popp">
            <div className="detail-card" key={restaurantChossen._id}>
              <div className="one globale-close">
                <div className="left">
                  <div className="img">
                    {restaurantChossen.image ? (
                      <img
                        src={restaurantChossen.image.url}
                        alt=""
                        className="avatar"
                      />
                    ) : (
                      <BsShop className="icon " />
                    )}
                  </div>

                  <div>
                    <h3>{restaurantChossen.name}</h3>
                    <p>Restaurant Profile</p>
                  </div>
                </div>
                <div className="right">
                  {/* <p>online</p> */}
                  <p
                    className={
                      restaurantChossen.status === "open" ? "green" : "red"
                    }
                  >
                    {restaurantChossen.status}
                  </p>
                </div>
              </div>
              <div className="infos">
                <div className="left">
                  <h2>Contact Information</h2>
                  <div className="info">
                    <FiPhone className="icon" />
                    <div>
                      <p>Phone</p>
                      <h4>{restaurantChossen.phone}</h4>
                    </div>
                  </div>
                  <div className="info">
                    <MdOutlineEmail className="icon" />
                    <div>
                      <p>Email</p>
                      <h4>{restaurantChossen.email}</h4>
                    </div>
                  </div>
                  <div className="info">
                    <LuMapPin className="icon" />
                    <div>
                      <p>Location</p>
                      <h4>
                        {restaurantChossen.address.country}-
                        {restaurantChossen.address.city}
                      </h4>
                    </div>
                  </div>
                </div>
                <div className="right">
                  <h2>Performance Metrics</h2>
                  <div className="info">
                    <LuShoppingBag className="icon" />
                    <div>
                      <p>Total Orders</p>
                      <h4>1,245</h4>
                    </div>
                  </div>
                  <div className="info">
                    <FaRegStar className="icon" />
                    <div>
                      <p>Rating</p>
                      <h4>{restaurantChossen.rating}</h4>
                    </div>
                  </div>
                  <div className="info">
                    <FaRegClock className="icon" />
                    <div>
                      <p>Avg. Delivery Time</p>
                      <h4>25 min</h4>
                    </div>
                  </div>
                  <div className="info">
                    <FaDollarSign className="icon" />
                    <div>
                      <p>Commission Rate</p>
                      <h4>{restaurantChossen.commission}%</h4>
                    </div>
                  </div>
                </div>
              </div>
              <div className="buttons">
                <button className="edit">Edit Restaurant</button>
                <button className="view" onClick={() => setType("menu")}>
                  View Menu
                </button>
                {restaurantChossen.status === "blocked" ? (
                  <button
                    className="unblocked-restaurant"
                    onClick={() => setType("unblock")}
                  >
                    Unblocked
                  </button>
                ) : (
                  <button
                    className="blocked-restaurant"
                    onClick={() => setType("block")}
                  >
                    Blocked
                  </button>
                )}
                <button
                  className="analytics"
                  onClick={() => setType("analytics")}
                >
                  Analytics
                </button>
              </div>
            </div>
          </div>
          <div
            className="back"
            onClick={() => {
              setRestaurantChossen([]);
              setType("show");
            }}
          ></div>
        </div>
      )}
      {type !== "details" && (
        <div>
          {type === "analytics" && (
            <div className="popp resaurant-analytics globale-popp">
              <div className="container">
                <div className="globale-close one">
                  <div className="left">
                    <div className="icon">
                      <HiMiniArrowTrendingUp size={26} />
                    </div>
                    <div>
                      <h3>Pizza Palace Analytics</h3>
                      <p>Performance metrics and insights</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => {
                        setType("details");
                      }}
                    />
                  </div>
                </div>
                <div className="summary">
                  <div className="orders">
                    <div>
                      <LuShoppingBag className="icon" size={20} />
                      <p>Total Orders</p>
                    </div>
                    <h2>441</h2>
                    <p>This week</p>
                  </div>
                  <div className="revenue">
                    <div>
                      <FaDollarSign className="icon" size={20} /> <p>Revenue</p>
                    </div>
                    <h2>22500</h2>
                    <p>Active This Month</p>
                  </div>
                  <div className="rating">
                    <div>
                      <TiStarOutline className="icon" size={20} /> Rating
                    </div>
                    <h2>{restaurantChossen.rating}</h2>
                    <p>Avg Order Value</p>
                  </div>
                  <div className="customers">
                    <div>
                      <FiUser className="icon" size={20} /> <p>Customers</p>
                    </div>
                    <h2>87</h2>
                    <p>Unique customers</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {type === "menu" && (
            <div className="popp resaurant-menu globale-popp">
              <div className="container">
                <div className="globale-close one">
                  <div className="left">
                    <div className="icon">
                      <HiMiniArrowTrendingUp size={26} />
                    </div>
                    <div>
                      <h3>Pizza Palace Menu</h3>
                      <p>Manage restaurant menu items</p>
                    </div>
                  </div>
                  <div className="right">
                    <IoMdClose
                      className="icon"
                      onClick={() => {
                        setType("details");
                      }}
                    />
                  </div>
                </div>

                {foods &&
                  foods.map((food) => (
                    <div className="cart" key={food._id}>
                      <div className="left">
                        {food.image && (
                          <img src={food.image.url} alt="" className="avatar" />
                        )}
                        <div>
                          <div className="info">
                            <h2>{food.name}</h2>
                            <p>{food.categoryId.name}</p>
                          </div>
                          <div className="price">{food.price}</div>
                        </div>
                      </div>
                      <div className="rihgt"></div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {type === "unblock" && (
            <div className="popp globale-approve  globale-popp">
              <div className="container">
                <FiCheckCircle className="icon" />
                <h2>Unblock Driver</h2>
                <h3>{restaurantChossen.name}</h3>
                <p>Are you sure you want to Unblock ?</p>
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
                      setType("details");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="approve" onClick={handleUnBlocked}>
                    UnBlocked Restaurant
                  </button>
                </div>
              </div>
            </div>
          )}
          {type === "block" && (
            <div className="popp globale-approve globale-suspend globale-popp">
              <div className="container">
                <BiError className="icon" />
                <h2>Block Restaurant</h2>
                <h3>{restaurantChossen.name}</h3>
                <p>Are you sure you want to Block ?</p>
                <h3>They will not be able to accept new orders.</h3>
                <form onSubmit={handleBlocked}>
                  <div className="input">
                    <label>Reason for Block *</label>
                    <textarea
                      onChange={(e) => setReasonForBlock(e.target.value)}
                      id=""
                      placeholder="Enter the reason for blocked..."
                      required
                    ></textarea>
                  </div>
                  <div className="error">{error}</div>
                  <div className="buttons">
                    <button
                      onClick={() => {
                        setType("details");
                      }}
                    >
                      Cancel
                    </button>
                    <button className="suspend">Blocked Restaurant</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div
            className="back"
            onClick={() => {
              setType("details");
            }}
          ></div>
        </div>
      )}
    </>
  );
};

export default Details;
