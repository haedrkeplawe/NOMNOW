import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const RestaurantContext = createContext();

export const useRestaurant = () => useContext(RestaurantContext);

export const RestaurantProvider = ({ children }) => {
  const { api } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب بيانات المطعم مرة واحدة
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await api.get("/restaurant/setting/restorant-info");

        setRestaurant(res.data.restaurant);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, []);

  // toggle status
  const toggleStatus = async () => {
    const res = await api.patch("/restaurant/toggle-status");
    setRestaurant((prev) => ({
      ...prev,
      status: res.data.status,
    }));
  };

  return (
    <RestaurantContext.Provider value={{ restaurant, loading, toggleStatus }}>
      {children}
    </RestaurantContext.Provider>
  );
};
