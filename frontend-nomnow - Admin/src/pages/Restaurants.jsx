import { useEffect, useState } from "react";
import { LuMapPin } from "react-icons/lu";
import { BsShop, BsThreeDotsVertical } from "react-icons/bs";
import { useAuth } from "../context/AuthContext";
import { MdStar } from "react-icons/md";

import Details from "../components/Details";
import CreateRestaurant from "../components/CreateRestaurant";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

const Restaurants = () => {
  const { api } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const [categoryChosen, setCategoryChosen] = useState("all");
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantChossen, setRestaurantChossen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("show");

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await api.get("/admin/restaurant");
        setRestaurants(res.data.restaurants);
      } catch (error) {
        toast.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [api]);

  const categories = [
    { key: "online", label: "Online" },
    { key: "busy", label: "Busy" },
    { key: "offline", label: "Offline" },
  ];

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const term = searchTerm.toLowerCase();

    return (
      restaurant.name.toLowerCase().includes(term) ||
      restaurant.address.city.toLowerCase().includes(term)
    );
  });

  return (
    <div className="restaurants-page">
      {loading && (
        <div className="globale-loader">
          <div className="spinner"></div>
        </div>
      )}
      <>
        <HeadCreateAndDetails
          text1={"Restaurant"}
          text2={"Manage all restaurant partners"}
          text3={"Add New Restaurant"}
          setType={setType}
        />
        <div className="globale-menu">
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
        <div className="globale-search ">
          <input
            type="text"
            placeholder="Search restaurants by name or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* <button>
            <IoSearch size={20} />
          </button> */}
        </div>
        {!loading && (
          <div className="cards">
            {filteredRestaurants &&
              filteredRestaurants.map((restaurant) => (
                <div className="card" key={restaurant._id}>
                  <div className="one">
                    <div className="left">
                      <div className="img">
                        {restaurant.image ? (
                          <img
                            src={restaurant.image.url}
                            alt=""
                            className="avatar"
                          />
                        ) : (
                          <BsShop className="icon " />
                        )}
                      </div>
                      <div>
                        <h3>{restaurant.name}</h3>
                        <p>
                          <LuMapPin className="icon" />
                          {restaurant.address.country}-{restaurant.address.city}
                        </p>
                      </div>
                    </div>
                    <div className="right">
                      {/* <p>online</p> */}
                      <p
                        className={
                          restaurant.status === "open" ? "green" : "red"
                        }
                      >
                        {restaurant.status}
                      </p>
                    </div>
                  </div>
                  <div className="tow">
                    <div className="left">
                      <p>Total Orders</p>
                      <span>1,245</span>
                    </div>
                    <div className="right">
                      <p>Rating</p>
                      <span>
                        <MdStar className="icon" />
                        {restaurant.rating}
                      </span>
                    </div>
                  </div>
                  <span></span>
                  <div className="three">
                    <div className="top">
                      <p>Owner:</p>
                      <h3>{restaurant.owner.name}</h3>
                    </div>
                    <div className="buttom">
                      <p>Commission</p>
                      <h3>{restaurant.commission}%</h3>
                    </div>
                  </div>
                  <div className="fore">
                    <button
                      onClick={() => {
                        setRestaurantChossen(restaurant);
                        setType("details");
                      }}
                    >
                      View Details
                    </button>
                    <span>
                      <BsThreeDotsVertical />
                    </span>
                  </div>
                </div>
              ))}

            {filteredRestaurants.length <= 0 && (
              <div className="card card-empty">
                <p>Restaurant not found</p>
              </div>
            )}
          </div>
        )}
      </>
      {(type === "details" ||
        type === "analytics" ||
        type === "menu" ||
        type === "block" ||
        type === "unblock") &&
        restaurantChossen && (
          <Details
            type={type}
            restaurantChossen={restaurantChossen}
            setRestaurantChossen={setRestaurantChossen}
            setType={setType}
            api={api}
            restaurants={restaurants}
            setRestaurants={setRestaurants}
          />
        )}

      {type === "create" && (
        <CreateRestaurant
          api={api}
          setRestaurants={setRestaurants}
          setType={setType}
        />
      )}
    </div>
  );
};

export default Restaurants;
