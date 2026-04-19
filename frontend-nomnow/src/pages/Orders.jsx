import { useRestaurant } from "../context/RestaurantContext";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import OrderCard from "../components/OrderCard";
import { useTranslation } from "react-i18next";

const TAB_KEYS = [
  "all",
  "pending",
  "accepted",
  "ready",
  "picked_up",
  "on_the_way",
  "delivered_by_driver",
  "delivered",
  "cancelled",
];

const Orders = () => {
  const { api } = useAuth();
  const { t } = useTranslation();
  const { newOrders, setNewOrders, orders, setOrders } = useRestaurant();
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchOrders = async () => {
      setOrders([]);
      setNewOrders([]);
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
        text1={t("orders.title")}
        text2={t("orders.subtitle")}
      />

      <div className="orders-container">
        {/* Tabs */}
        <div className="orderstabs">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {t(`orders.tabs.${key}`)}
              <span>
                {key === "all"
                  ? orders.length
                  : orders.filter((o) => o.orderStatus === key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        {TAB_KEYS.includes(activeTab) && (
          <p>{t(`orders.tabDesc.${activeTab}`)}</p>
        )}

        {/* Search */}
        <div className="search">
          <div className="globale-search">
            <input
              type="text"
              placeholder={t("orders.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="orders-list">
          {ordersLoading ? (
            <p className="empty">{t("orders.loading")}</p>
          ) : filteredOrders.length === 0 ? (
            <p className="empty">{t("orders.noOrders")}</p>
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
