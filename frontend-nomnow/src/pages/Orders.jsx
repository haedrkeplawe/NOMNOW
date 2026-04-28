import { useRestaurant } from "../context/RestaurantContext";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import OrderCard from "../components/OrderCard";
import { useTranslation } from "react-i18next";
import { FiTrash2, FiAlertTriangle } from "react-icons/fi";
import { toast } from "react-hot-toast";

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

// Delete ── Confirmation Dialog ───────────────────────────────────────
const DeleteConfirmDialog = ({ onConfirm, onCancel, loading }) => (
  <div className="ord-confirm-overlay">
    <div className="ord-confirm-box">
      <div className="ord-confirm-icon">
        <FiAlertTriangle size={28} />
      </div>
      <h3>{"Delete All Orders"}</h3>
      <p>
        This will permanently delete all orders for your restaurant. This action
        cannot be undone.
      </p>
      <div className="ord-confirm-actions">
        <button
          className="ord-confirm-cancel"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="ord-confirm-delete"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Deleting..." : "Yes, Delete All"}
        </button>
      </div>
    </div>
  </div>
);

const Orders = () => {
  const { api } = useAuth();
  const { t } = useTranslation();
  const { newOrders, setNewOrders, orders, setOrders } = useRestaurant();
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Delete
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Delete
  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    try {
      await api.delete("/restaurant/orders/all");
      setOrders([]);
      setNewOrders([]);
      setShowConfirm(false);
      toast.success("All orders deleted successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete orders");
    } finally {
      setDeleteLoading(false);
    }
  };

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
      {/* ── Confirmation Dialog ── */}
      {showConfirm && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteAll}
          onCancel={() => setShowConfirm(false)}
          loading={deleteLoading}
        />
      )}

      <HeadCreateAndDetails
        text1={t("orders.title")}
        text2={t("orders.subtitle")}
      />
      {/* Delete */}
      {orders.length > 0 && (
        <button
          className="ord-delete-all-btn"
          onClick={() => setShowConfirm(true)}
        >
          <FiTrash2 size={15} />
          {t("orders.deleteAll") || "Delete All"}
        </button>
      )}

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
            <div className="page-loader">
              <div className="page-loader__spinner" />
              <p>{t("orders.loading")}</p>
            </div>
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
