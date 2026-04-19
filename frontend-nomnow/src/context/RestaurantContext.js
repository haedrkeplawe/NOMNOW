import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import { createRestaurantSocket } from "../socket/restaurantSocket";

const RestaurantContext = createContext();
export const useRestaurant = () => useContext(RestaurantContext);

export const RestaurantProvider = ({ children }) => {
  const { api, accessToken, logout } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrders, setNewOrders] = useState([]);
  const socketRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [socketInstance, setSocketInstance] = useState(null);
  const [driverAlerts, setDriverAlerts] = useState({});

  useEffect(() => {
    if (!accessToken) return;

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
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    // ✅ إغلاق أي socket قائم قبل إنشاء جديد
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createRestaurantSocket(accessToken);
    socketRef.current = socket;
    socket.connect();
    setSocketInstance(socket);

    socket.on("connected", () => {});

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      if (err.message.includes("Unauthorized")) {
        logout();
      }
    });

    socket.on("order:new", ({ order }) => {
      setNewOrders((prev) => [order, ...prev]);
      setOrders((prev) => {
        if (prev.some((o) => o._id.toString() === order._id.toString()))
          return prev;
        return [order, ...prev];
      });
    });
    socket.on("order:updated", ({ order }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o._id.toString() === order._id.toString() ? order : o,
        ),
      );
    });

    // ✅ إشعارات السائق
    socket.on("order:searchingDriver", (data) => {
      setDriverAlerts((prev) => ({
        ...prev,
        [data.orderId.toString()]: "searching",
      }));
    });
    socket.on("order:noDriverFound", (data) => {
      setDriverAlerts((prev) => ({
        ...prev,
        [data.orderId.toString()]: "noDriver",
      }));
    });
    socket.on("order:driverAssigned", ({ orderId, order }) => {
      // ✅ استبدل الأوردر كامل بدل ما تحدث driverId بس
      setOrders((prev) =>
        prev.map((o) => (o._id.toString() === orderId.toString() ? order : o)),
      );
      setDriverAlerts((prev) => {
        const updated = { ...prev };
        delete updated[orderId.toString()];
        return updated;
      });
    });

    return () => {
      socket.off("connect_error");
      socket.off("order:new");
      socket.off("order:updated");
      socket.off("order:searchingDriver");
      socket.off("order:noDriverFound");
      socket.off("order:driverAssigned");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const toggleStatus = async () => {
    const res = await api.patch("/restaurant/toggle-status");
    setRestaurant((prev) => ({ ...prev, status: res.data.status }));
  };

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        loading,
        toggleStatus,
        newOrders,
        setNewOrders,
        orders,
        setOrders,
        socket: socketInstance,
        driverAlerts,
        setDriverAlerts,
        currency: restaurant?.currency || "SYP",
        taxRate: restaurant?.taxRate || 0,
        country: restaurant?.country || "SY",
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};
