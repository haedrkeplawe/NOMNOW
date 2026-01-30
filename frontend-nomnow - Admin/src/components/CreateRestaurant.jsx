import { IoMdClose } from "react-icons/io";
import { BsShop } from "react-icons/bs";
import { useState } from "react";
import RestaurantMap from "./RestaurantMap";
import { toast } from "react-hot-toast";

const CreateRestaurant = ({ api, setRestaurants, setType }) => {
  const [data, setData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    restaurantname: "",
    commission: "",
    location: { type: "Point", coordinates: [] },
    address: {
      fullAddress: "",
      country: "",
      city: "",
      area: "",
      street: "",
      building: "",
      notes: "",
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [key]: value,
        },
      }));
    } else {
      setData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!data.location.coordinates.length) {
      return toast.error("Please select restaurant location on the map!");
    }

    try {
      await api.post("/admin/restaurant", data);

      const res = await api.get("/admin/restaurant");
      setRestaurants(res.data.restaurants);

      setData({
        name: "",
        email: "",
        phone: "",
        password: "",
        restaurantname: "",
        commission: "",
        location: { type: "Point", coordinates: [] },
        address: {
          fullAddress: "",
          country: "",
          city: "",
          area: "",
          street: "",
          building: "",
          notes: "",
        },
      });

      setType("show");
      toast.success(`Retaurant ${data.name} Created Successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <>
      <div className="popp form globale-popp">
        <div className="globale-close one">
          <div className="left">
            <div className="icon">
              <BsShop size={26} />
            </div>
            <div>
              <h3>Add New Restaurant</h3>
              <p>Enter restaurant details to onboard</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={() => setType("show")} />
          </div>
        </div>

        {/* 🗺️ Map with Pin */}
        <RestaurantMap
          setLocation={(dataFromMap) =>
            setData((prev) => ({
              ...prev,
              location: {
                type: "Point",
                coordinates: [dataFromMap[0], dataFromMap[1]],
              },
              address: dataFromMap[2] || prev.address,
            }))
          }
        />

        <form onSubmit={handleSubmit}>
          <div className="inputs">
            <div className="input">
              <label>Restaurant Name *</label>
              <input
                name="restaurantname"
                value={data.restaurantname}
                onChange={handleChange}
                placeholder="Name"
                required
              />
            </div>

            {/* Address Fields */}
            <div className="input">
              <label>Full Address *</label>
              <input
                name="address.fullAddress"
                value={data.address.fullAddress}
                onChange={handleChange}
                placeholder="Full Address"
              />
            </div>
            <div className="input">
              <label>Country *</label>
              <input
                name="address.country"
                value={data.address.country}
                onChange={handleChange}
                placeholder="Country"
                required
              />
            </div>
            <div className="input">
              <label>City *</label>
              <input
                name="address.city"
                value={data.address.city}
                onChange={handleChange}
                placeholder="City"
                required
              />
            </div>
            <div className="input">
              <label>Area / Neighborhood</label>
              <input
                name="address.area"
                value={data.address.area}
                onChange={handleChange}
                placeholder="Area"
              />
            </div>
            <div className="input">
              <label>Street</label>
              <input
                name="address.street"
                value={data.address.street}
                onChange={handleChange}
                placeholder="Street"
              />
            </div>
            <div className="input">
              <label>Building / Number</label>
              <input
                name="address.building"
                value={data.address.building}
                onChange={handleChange}
                placeholder="Building"
              />
            </div>
            <div className="input">
              <label>Notes</label>
              <input
                name="address.notes"
                value={data.address.notes}
                onChange={handleChange}
                placeholder="Notes"
              />
            </div>

            {/* Owner Fields */}
            <div className="input">
              <label>Owner Name *</label>
              <input
                name="name"
                value={data.name}
                onChange={handleChange}
                placeholder="Owner Name"
                required
              />
            </div>
            <div className="input">
              <label>Owner Email *</label>
              <input
                name="email"
                value={data.email}
                onChange={handleChange}
                placeholder="Owner Email"
                required
              />
            </div>
            <div className="input">
              <label>Owner Phone *</label>
              <input
                name="phone"
                value={data.phone}
                onChange={handleChange}
                placeholder="Owner Phone"
                required
              />
            </div>
            <div className="input">
              <label>Owner Password *</label>
              <input
                type="password"
                name="password"
                value={data.password}
                onChange={handleChange}
                placeholder="Owner Password"
                required
              />
            </div>

            <div className="input">
              <label>Commission Rate (%) *</label>
              <input
                type="number"
                name="commission"
                value={data.commission}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input"></div>

            <button
              type="button"
              className="cancel"
              onClick={() => setType("show")}
            >
              Cancel
            </button>
            <button type="submit">Add Restaurant</button>
          </div>
        </form>
      </div>

      <div className="back" onClick={() => setType("show")}></div>
    </>
  );
};

export default CreateRestaurant;
