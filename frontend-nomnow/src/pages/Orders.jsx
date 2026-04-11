import { useRestaurant } from "../context/RestaurantContext";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import OrderCard from "../components/OrderCard";

const TABS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  // { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
  { label: "Picked Up", value: "picked_up" },
  { label: "On The Way", value: "on_the_way" },
  { label: "Delivered By Driver", value: "delivered_by_driver" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const Orders = () => {
  const { api } = useAuth();
  const { newOrders, setNewOrders, orders, setOrders } = useRestaurant();
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // debounce - ينتظر ثانية بعد آخر كتابة
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // جلب الأوردرات القديمة مرة واحدة
  useEffect(() => {
    const fetchOrders = async () => {
      setOrders([]);
      setNewOrders([]); // ✅
      setOrdersLoading(true);
      try {
        const res = await api.get("/restaurant/orders");
        setOrders(res.data.orders);
      } catch (err) {
        console.error(err);
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = orders
    .filter((o) => activeTab === "all" || o.orderStatus === activeTab)
    .filter((o) => {
      if (!debouncedSearch) return true;
      const s = debouncedSearch.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(s) ||
        o.userId?.name?.toLowerCase().includes(s)
      );
    });

  return (
    <div className="orders-page">
      <HeadCreateAndDetails
        text1={"Orders Management"}
        text2={"showing orders from the last 30 days"}
      />

      <div className="orders-container">
        {/* <button
          onClick={async () => {
            if (!window.confirm("Delete all orders?")) return;
            await api.delete("/restaurant/orders/all");
            setOrders([]); // حذف كل الأوردرات من الواجهة بعد الحذف من السيرفر
          }}
        >
          Delete All Orders
        </button> */}
        <div className="orderstabs">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={activeTab === tab.value ? "active" : ""}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              {/* عدد الأوردرات في كل تاب */}
              <span>
                {tab.value === "all"
                  ? orders.length
                  : orders.filter((o) => o.orderStatus === tab.value).length}
              </span>
            </button>
          ))}
        </div>
        <p>
          {activeTab === "all" && "Here are all the orders"}
          {activeTab === "pending" &&
            "Here are all the orders received from the user and awaiting the restaurant's response (acceptance or rejection)."}
          {activeTab === "accepted" &&
            "The restaurant accepts the order and assigns a driver for that order."}
          {activeTab === "picked_up" &&
            "The driver's order has been accepted and is being prepared."}
          {activeTab === "on_the_way" && "Drivers are now delivering orders."}
          {activeTab === "delivered_by_driver" &&
            "Drivers have delivered orders to customers, waiting for user confirmation."}
          {activeTab === "delivered" &&
            "Customers have confirmed receipt of the order."}
          {activeTab === "cancelled" &&
            "Orders that have been cancelled either by the restaurant or the customer."}
        </p>
        <div className="search">
          <div className="globale-search ">
            <input
              type="text"
              placeholder="Search by order ID or customer name... ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="orders-list">
          {ordersLoading ? (
            <p className="empty">Loading...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="empty">No orders found</p>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Orders;
