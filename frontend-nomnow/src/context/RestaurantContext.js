import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
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

  // ✅ جلب الأوردرات من API ودمجها مع الموجودة — يُستخدم عند أول تحميل وعند reconnect
  const syncOrders = useCallback(async () => {
    try {
      const res = await api.get("/restaurant/orders");
      const fetched = res.data.orders || [];
      setOrders((prev) => {
        // نبني map من الموجود حتى نتجنب duplicates
        const existingMap = new Map(prev.map((o) => [o._id.toString(), o]));
        // أي أوردر جديد من الـ API يُضاف أو يُحدَّث
        fetched.forEach((o) => existingMap.set(o._id.toString(), o));
        // نرتّب تنازلياً بحسب createdAt
        return Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
      });
      // أي أوردر pending لم يكن في الـ UI يُضاف لـ newOrders أيضاً
      setNewOrders((prevNew) => {
        const existingNewIds = new Set(prevNew.map((o) => o._id.toString()));
        const missedNew = fetched.filter(
          (o) =>
            o.orderStatus === "pending" &&
            !existingNewIds.has(o._id.toString()),
        );
        return missedNew.length > 0 ? [...missedNew, ...prevNew] : prevNew;
      });
    } catch (err) {
      console.error("syncOrders error:", err);
    }
  }, [api]);

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
      // لا نعمل logout هنا — الـ accessToken قد يكون تجدد عبر HTTP interceptor
    });

    // ✅ عند إعادة الاتصال بعد انقطاع → نجلب الأوردرات الفائتة من API
    socket.on("reconnect", (attemptNumber) => {
      console.log(
        `Socket reconnected after ${attemptNumber} attempt(s) — syncing missed orders`,
      );
      syncOrders();
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
      socket.off("connected");
      socket.off("connect_error");
      socket.off("reconnect");
      socket.off("order:new");
      socket.off("order:updated");
      socket.off("order:searchingDriver");
      socket.off("order:noDriverFound");
      socket.off("order:driverAssigned");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, syncOrders]);

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
        syncOrders, // ✅ متاح للمكونات إذا احتاجت manual sync
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};
