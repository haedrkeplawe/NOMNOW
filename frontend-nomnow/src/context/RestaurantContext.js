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
  const { api, accessToken, refreshAccessToken } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrders, setNewOrders] = useState([]);
  const socketRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [socketInstance, setSocketInstance] = useState(null);
  const [driverAlerts, setDriverAlerts] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const pendingQueue = useRef([]);

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

  const syncOrders = useCallback(async () => {
    try {
      const res = await api.get("/restaurant/orders");
      const fetched = res.data.orders || [];
      setOrders((prev) => {
        const existingMap = new Map(prev.map((o) => [o._id.toString(), o]));
        fetched.forEach((o) => existingMap.set(o._id.toString(), o));
        return Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
      });
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

  // ✅ تشغيل صوت التنبيه عند الأوردر الجديد
  const playOrderSound = useCallback(() => {
    try {
      const soundEnabled = localStorage.getItem("nomnow_sound") !== "false";
      if (!soundEnabled) return;
      const audio = new Audio("/sounds/order.mp3");
      audio.volume = 0.8;
      audio.playbackRate = 0.6;
      audio.play();
    } catch (err) {
      console.log("Sound error:", err);
    }
  }, []);

  const flushQueue = useCallback((socket) => {
    if (!pendingQueue.current.length) return;
    console.log(
      "Flushing " + pendingQueue.current.length + " pending action(s)...",
    );
    pendingQueue.current.forEach(({ event, data }) => {
      socket.emit(event, data);
    });
    pendingQueue.current = [];
  }, []);

  const emitOrQueue = useCallback((event, data) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.log("Offline — queued: " + event, data);
      pendingQueue.current.push({ event, data });
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createRestaurantSocket(accessToken);
    socketRef.current = socket;

    socket.removeAllListeners();
    socket.connect();
    setSocketInstance(socket);

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", async (err) => {
      setIsConnected(false);
      console.error("Socket connection error:", err.message);

      // لو 401 → نجرب refresh ونعيد الاتصال بالـ token الجديد
      if (
        err.message?.includes("401") ||
        err.data?.message?.includes("401") ||
        err.message?.includes("jwt") ||
        err.message?.includes("unauthorized")
      ) {
        try {
          const newToken = await refreshAccessToken();
          socket.auth = { token: newToken };
          socket.connect();
        } catch (refreshErr) {
          console.error("Token refresh failed — logging out");
        }
      }
    });

    socket.io.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after " + attemptNumber + " attempt(s)");
      setIsConnected(true);
      syncOrders();
      flushQueue(socket);
    });

    socket.on("order:new", ({ order }) => {
      playOrderSound();
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

    socket.on("order:cancelled", ({ orderId, order }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o._id.toString() === orderId.toString()
            ? order || { ...o, orderStatus: "cancelled" }
            : o,
        ),
      );
      setNewOrders((prev) =>
        prev.filter((o) => o._id.toString() !== orderId.toString()),
      );
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.io.off("reconnect");
      socket.off("order:new");
      socket.off("order:updated");
      socket.off("order:searchingDriver");
      socket.off("order:noDriverFound");
      socket.off("order:driverAssigned");
      socket.off("order:cancelled");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, syncOrders, flushQueue, playOrderSound]);

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
        syncOrders,
        isConnected,
        emitOrQueue,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};
