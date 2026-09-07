// === ADMIN ===
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "../context/AuthContext";
import { useCountry } from "../context/Countrycontext";
import {
  FiRefreshCw,
  FiX,
  FiUser,
  FiPhone,
  FiClock,
  FiCalendar,
  FiShoppingBag,
  FiDollarSign,
  FiMapPin,
  FiSearch,
} from "react-icons/fi";
import { BsShop } from "react-icons/bs";
import { LuCar } from "react-icons/lu";
import { FaStar } from "react-icons/fa";

const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;
const DEFAULT_CENTER = [36.2021, 32.6251];

// ─── أيقونات SVG لدبابيس المطعم والسائق (بدل الإيموجي القديم) ───
// أيقونة مطعم (شوكة وسكين) — Material Design، خطوط نظيفة تنقرأ
// بوضوح بحجم صغير على الخريطة
const RESTAURANT_PIN_HTML = `
  <div class="omap-pin__circle">
    <svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>
  </div>
  <div class="omap-pin__tail"></div>
`;
// أيقونة سائق (سيارة توصيل) — تشمل كل أنواع المركبات (دراجة/موتور/سيارة)
const DRIVER_PIN_HTML = `
  <div class="omap-pin__circle">
    <svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
  </div>
  <div class="omap-pin__tail"></div>
`;

// ─── Status meta (نفس الألوان المعتمدة بصفحة AdminOrders) ──────
const STATUS_META = {
  pending: { label: "Pending", color: "#b45309", bg: "#fffbeb" },
  accepted: { label: "Accepted", color: "#1447e6", bg: "#eff6ff" },
  preparing: { label: "Preparing", color: "#7e22ce", bg: "#faf5ff" },
  ready: { label: "Ready", color: "#008236", bg: "#f0fdf4" },
  picked_up: { label: "Picked Up", color: "#0369a1", bg: "#f0f9ff" },
  on_the_way: { label: "On the Way", color: "#0369a1", bg: "#f0f9ff" },
  delivered: { label: "Delivered", color: "#008236", bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: "#e7000b", bg: "#fef2f2" },
};
const STATUS_ORDER = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "on_the_way",
  "delivered",
  "cancelled",
];

const fmtDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ─── Small badge ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || {
    label: status,
    color: "#888",
    bg: "#eee",
  };
  return (
    <span className="omap-badge" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
};

// ─── Order list row (sidebar) ──────────────────────────────
const OrderRow = ({ order, active, onClick }) => (
  <div className={`omap-row ${active ? "active" : ""}`} onClick={onClick}>
    <div className="omap-row__top">
      <span className="omap-row__id">#{order.orderNumber}</span>
      <StatusBadge status={order.orderStatus} />
    </div>
    <p className="omap-row__addr">
      <FiMapPin size={11} />
      {order.deliveryAddress?.fullAddress || "—"}
    </p>
    <div className="omap-row__bottom">
      <span>
        <BsShop size={11} /> {order.restaurantId?.name || "—"}
      </span>
      <span>
        <FiClock size={11} /> {timeAgo(order.createdAt)}
      </span>
    </div>
  </div>
);

// ─── Detail panel ───────────────────────────────────────────
const DetailPanel = ({
  order,
  loading,
  onClose,
  showJourney,
  onToggleJourney,
}) => {
  if (loading) {
    return (
      <div className="omap-panel">
        <div className="omap-panel__head">
          <h3>Loading…</h3>
          <button onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
        <div className="omap-center">
          <div className="omap-spinner" />
        </div>
      </div>
    );
  }

  if (!order) return null;
  const currency = order.restaurantId?.currency || "";
  const hasDriver = Boolean(order.driverId?.currentLocation?.coordinates);

  return (
    <div className="omap-panel">
      <div className="omap-panel__head">
        <div>
          <h3>Order #{order.orderNumber}</h3>
          <p>{timeAgo(order.createdAt)}</p>
        </div>
        <div className="omap-panel__head-right">
          <StatusBadge status={order.orderStatus} />
          <button onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
      </div>

      <div className="omap-panel__body">
        {/* Unified map-journey action — one place to see everything
            related to where this order is, geographically */}
        <div className="omap-journey">
          <button
            className={`omap-journey-btn ${showJourney ? "active" : ""}`}
            onClick={onToggleJourney}
          >
            <FiMapPin size={13} />
            {showJourney
              ? "Hide order journey on map"
              : "Show order journey on map"}
          </button>
          <div className="omap-journey-legend">
            <span>
              <span className="omap-dot" style={{ background: "#f54900" }} />
              Customer
            </span>
            <span>
              <span className="omap-dot" style={{ background: "#16a34a" }} />
              Restaurant
            </span>
            <span className={hasDriver ? "" : "omap-journey-legend__off"}>
              <span
                className="omap-dot"
                style={{ background: hasDriver ? "#2563eb" : "#c9c9c9" }}
              />
              {hasDriver ? "Driver" : "No driver assigned yet"}
            </span>
          </div>
        </div>

        {/* Customer */}
        <div className="omap-section">
          <h4>
            <FiUser size={13} /> Customer
          </h4>
          <p className="omap-section__name">{order.userId?.name || "—"}</p>
          {order.userId?.phone && (
            <p className="omap-section__row">
              <FiPhone size={12} /> {order.userId.phone}
            </p>
          )}
          {order.deliveryAddress?.fullAddress && (
            <p className="omap-section__row">
              <FiMapPin size={12} /> {order.deliveryAddress.fullAddress}
            </p>
          )}
        </div>

        {/* Restaurant */}
        <div className="omap-section">
          <h4>
            <BsShop size={13} /> Restaurant
          </h4>
          <p className="omap-section__name">
            {order.restaurantId?.name || "—"}
          </p>
          {order.restaurantId?.phone && (
            <p className="omap-section__row">
              <FiPhone size={12} /> {order.restaurantId.phone}
            </p>
          )}
          {order.restaurantId?.address?.fullAddress && (
            <p className="omap-section__row">
              <FiMapPin size={12} /> {order.restaurantId.address.fullAddress}
            </p>
          )}
        </div>

        {/* Driver */}
        <div className="omap-section">
          <h4>
            <LuCar size={13} /> Driver
          </h4>
          {order.driverId ? (
            <>
              <p className="omap-section__name">{order.driverId.name}</p>
              <p className="omap-section__row">
                <FiPhone size={12} /> {order.driverId.phone}
              </p>
              <p className="omap-section__row">
                <FaStar size={11} style={{ color: "#f0b100" }} />
                {order.driverId.rating > 0
                  ? order.driverId.rating.toFixed(1)
                  : "—"}
                &nbsp;·&nbsp;{order.driverId.vehicletype}
                &nbsp;·&nbsp;{order.driverId.availability}
              </p>
            </>
          ) : (
            <p className="omap-section__row omap-na">Not assigned</p>
          )}
        </div>

        {/* Order items */}
        <div className="omap-section">
          <h4>
            <FiShoppingBag size={13} /> Items
          </h4>
          {order.items?.map((item, i) => (
            <div key={i} className="omap-item">
              <span>
                {item.quantity}× {item.name}
                {item.size?.name ? ` (${item.size.name})` : ""}
              </span>
              <span>
                {item.totalPrice} {currency}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="omap-section">
          <h4>
            <FiDollarSign size={13} /> Payment
          </h4>
          <div className="omap-item">
            <span>Items</span>
            <span>
              {order.itemsPrice?.toFixed(2)} {currency}
            </span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="omap-item">
              <span>Delivery Fee</span>
              <span>
                {order.deliveryFee?.toFixed(2)} {currency}
              </span>
            </div>
          )}
          {order.taxPrice > 0 && (
            <div className="omap-item">
              <span>Tax</span>
              <span>
                {order.taxPrice?.toFixed(2)} {currency}
              </span>
            </div>
          )}
          <div className="omap-item omap-item--total">
            <span>Total</span>
            <span>
              {order.totalPrice?.toFixed(2)} {currency}
            </span>
          </div>
          <p className="omap-section__row" style={{ marginTop: 6 }}>
            {order.paymentMethod} · {order.paymentStatus}
          </p>
        </div>

        {order.notes && (
          <div className="omap-section">
            <h4>Notes</h4>
            <p className="omap-section__row">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────
const OrdersMap = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const extraMarkersRef = useRef({ restaurant: null, driver: null });

  // ── Filters ───────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() =>
    fmtDate(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState(() => fmtDate(Date.now()));
  const [selectedStatuses, setSelectedStatuses] = useState([]); // empty = all

  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ totalMatching: 0, truncated: false });
  const [loading, setLoading] = useState(true);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showJourney, setShowJourney] = useState(false);

  // ── Search — يستبدل فلاتر الفترة/الحالة بالكامل لما يكون مفعّل ──
  const [searchInput, setSearchInput] = useState(""); // القيمة يلي عم يكتبها
  const [activeSearch, setActiveSearch] = useState(null); // القيمة المطبّقة فعلياً

  const toggleStatus = (key) => {
    setSelectedStatuses((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  };

  // ── Fetch orders for map ────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeSearch) {
        // وضع البحث: بيستبدل فلتر الفترة/الحالة بالكامل ويدور بكل
        // الأرشيف — نفس عمل الفلتر العادي بس بمعيار مختلف
        params.set("search", activeSearch);
      } else {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        selectedStatuses.forEach((s) => params.append("status[]", s));
      }

      if (countryParam) {
        const [, val] = countryParam.split("=");
        if (val) params.set("country", val);
      }

      const res = await api.get(`/admin/orders/map?${params.toString()}`);
      setOrders(res.data.orders || []);
      setMeta(res.data.meta || {});
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [api, activeSearch, startDate, endDate, selectedStatuses, countryParam]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Init map once ───────────────────────────────────────────
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_KEY}`,
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      mapLoadedRef.current = true;

      map.addSource("orders", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 45,
      });

      // Cluster circles
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "orders",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#fed7aa",
            15,
            "#fdba74",
            50,
            "#f54900",
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 15, 22, 50, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "orders",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });

      // Unclustered points (customer / delivery address)
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "orders",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "status"],
            "pending",
            "#b45309",
            "accepted",
            "#1447e6",
            "preparing",
            "#7e22ce",
            "ready",
            "#008236",
            "picked_up",
            "#0369a1",
            "on_the_way",
            "#0369a1",
            "delivered",
            "#008236",
            "cancelled",
            "#e7000b",
            "#888888",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      // ── Restaurants of all filtered orders (نفس فكرة تجميع الطلبات
      // البرتقالية، لكن بتدرّج أخضر مميّز للمطاعم) ──────────────
      map.addSource("order-restaurants", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 40,
      });
      map.addLayer({
        id: "restaurant-clusters",
        type: "circle",
        source: "order-restaurants",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#bbf7d0",
            15,
            "#4ade80",
            50,
            "#15803d",
          ],
          "circle-radius": ["step", ["get", "point_count"], 13, 15, 18, 50, 23],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "restaurant-cluster-count",
        type: "symbol",
        source: "order-restaurants",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 11,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#14532d" },
      });
      map.addLayer({
        id: "restaurant-unclustered-point",
        type: "circle",
        source: "order-restaurants",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#16a34a",
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      // Selected order highlight
      map.addSource("selected-order", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "selected-order-ring",
        type: "circle",
        source: "selected-order",
        paint: {
          "circle-radius": 13,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f54900",
        },
      });

      // Line connecting delivery ↔ restaurant / driver
      map.addSource("connector-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "connector-line-layer",
        type: "line",
        source: "connector-line",
        paint: {
          "line-color": "#f54900",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      // نفس منطق التفاعل (تجميع/فتح تفاصيل) على طبقتي عرض الحالة
      // الافتراضي: الطلبات (عنوان التوصيل) والمطاعم
      const clusterLayers = [
        { source: "orders", clusterLayer: "clusters" },
        { source: "order-restaurants", clusterLayer: "restaurant-clusters" },
      ];
      const pointLayers = ["unclustered-point", "restaurant-unclustered-point"];

      clusterLayers.forEach(({ source, clusterLayer }) => {
        map.on("click", clusterLayer, (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: [clusterLayer],
          });
          const clusterId = features[0].properties.cluster_id;
          map
            .getSource(source)
            .getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({ center: features[0].geometry.coordinates, zoom });
            });
        });
        map.on(
          "mouseenter",
          clusterLayer,
          () => (map.getCanvas().style.cursor = "pointer"),
        );
        map.on(
          "mouseleave",
          clusterLayer,
          () => (map.getCanvas().style.cursor = ""),
        );
      });

      pointLayers.forEach((layerId) => {
        map.on("click", layerId, (e) => {
          const props = e.features[0].properties;
          map.flyTo({
            center: e.features[0].geometry.coordinates,
            zoom: Math.max(map.getZoom(), 14),
          });
          selectOrder(props.orderId, e.features[0].geometry.coordinates);
        });
        map.on(
          "mouseenter",
          layerId,
          () => (map.getCanvas().style.cursor = "pointer"),
        );
        map.on(
          "mouseleave",
          layerId,
          () => (map.getCanvas().style.cursor = ""),
        );
      });
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update GeoJSON sources when orders change ─────────────────
  // طبقتين مستقلتين بدون أي خطوط تربطهما ببعض: عنوان التوصيل (مكان
  // صدور الطلب) وموقع المطعم — بالحالة الافتراضية بس، بدون السائق
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const toFeature = (o, coordinates) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties: {
        orderId: o._id,
        orderNumber: o.orderNumber,
        status: o.orderStatus,
      },
    });

    const customerFeatures = orders
      .filter((o) => o.deliveryAddress?.location?.coordinates)
      .map((o) => toFeature(o, o.deliveryAddress.location.coordinates));

    const restaurantFeatures = orders
      .filter((o) => o.restaurantId?.location?.coordinates)
      .map((o) => toFeature(o, o.restaurantId.location.coordinates));

    map
      .getSource("orders")
      ?.setData({ type: "FeatureCollection", features: customerFeatures });
    map
      .getSource("order-restaurants")
      ?.setData({ type: "FeatureCollection", features: restaurantFeatures });
  }, [orders]);

  // ── Show/hide the "all filtered orders" bulk layers ───────────
  // تُستدعى عند اختيار طلب معيّن (نخفيها لنركّز فقط عليه) وعند
  // الإغلاق (نرجعها كلها للظهور)
  const BULK_LAYER_IDS = [
    "clusters",
    "cluster-count",
    "unclustered-point",
    "restaurant-clusters",
    "restaurant-cluster-count",
    "restaurant-unclustered-point",
  ];
  const setBulkLayersVisible = (visible) => {
    const map = mapRef.current;
    if (!map) return;
    BULK_LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    });
  };

  // ── Select order + fetch full details ────────────────────────
  const selectOrder = useCallback(
    async (orderId, coordinates) => {
      setSelectedOrderId(orderId);
      setSelectedOrder(null);
      setShowJourney(false);
      clearExtraMarkers();
      setDetailLoading(true);
      setBulkLayersVisible(false); // نركّز على الطلب المختار فقط ونخفي البقية

      const map = mapRef.current;
      if (map && map.getSource("selected-order")) {
        map.getSource("selected-order").setData(
          coordinates
            ? {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates },
                  },
                ],
              }
            : { type: "FeatureCollection", features: [] },
        );
      }

      try {
        const res = await api.get(`/admin/orders/${orderId}/details`);
        setSelectedOrder(res.data.order);
      } catch {
        // silent
      } finally {
        setDetailLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );

  // ── تفعيل/إلغاء وضع البحث — يستبدل فلاتر الفترة/الحالة بالكامل ──
  // بمجرد التفعيل، الـ effect تبع fetchOrders بيلتقط تغيّر activeSearch
  // ويعيد الجلب تلقائياً بمعيار البحث بدل التاريخ/الحالة
  const applySearch = (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;
    closePanel(); // أي طلب متركّز عليه سابقاً يرجع يختفي مع تبديل الوضع
    setActiveSearch(query);
  };

  const clearSearch = () => {
    setSearchInput("");
    setActiveSearch(null);
  };

  const clearExtraMarkers = () => {
    if (extraMarkersRef.current.restaurant) {
      extraMarkersRef.current.restaurant.remove();
      extraMarkersRef.current.restaurant = null;
    }
    if (extraMarkersRef.current.driver) {
      extraMarkersRef.current.driver.remove();
      extraMarkersRef.current.driver = null;
    }
    const map = mapRef.current;
    if (map && map.getSource("connector-line")) {
      map
        .getSource("connector-line")
        .setData({ type: "FeatureCollection", features: [] });
    }
  };

  const updateConnectorLine = (points) => {
    const map = mapRef.current;
    if (!map || !map.getSource("connector-line")) return;
    if (points.length < 2) {
      map
        .getSource("connector-line")
        .setData({ type: "FeatureCollection", features: [] });
      return;
    }
    map.getSource("connector-line").setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: points },
        },
      ],
    });
  };

  const fitToVisible = (extraPoints) => {
    const map = mapRef.current;
    if (!map || !selectedOrder) return;
    const points = [
      selectedOrder.deliveryAddress?.location?.coordinates,
      ...extraPoints,
    ].filter(Boolean);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 14 });
      return;
    }
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      new maplibregl.LngLatBounds(points[0], points[0]),
    );
    map.fitBounds(bounds, { padding: 90, maxZoom: 15 });
  };

  const toggleJourney = () => {
    const map = mapRef.current;
    if (!map || !selectedOrder) return;

    // إخفاء: نظّف الماركرز الإضافية والخط، وارجع لحالة عرض عنوان
    // التوصيل فقط (النقطة الأساسية المعروضة دائماً على الخريطة)
    if (showJourney) {
      clearExtraMarkers();
      setShowJourney(false);
      return;
    }

    const deliveryCoords = selectedOrder.deliveryAddress?.location?.coordinates;
    const restaurantCoords = selectedOrder.restaurantId?.location?.coordinates;
    // السائق مش مضمون وجوده لكل طلب — نتحقق قبل أي استخدام لبياناته
    const driverCoords = selectedOrder.driverId?.currentLocation?.coordinates;

    const linePoints = [deliveryCoords].filter(Boolean);

    // المطعم مضمون وجوده لكل طلب — نضيف ماركره دائماً إن كان له إحداثيات
    if (restaurantCoords) {
      const el = document.createElement("div");
      el.className = "omap-pin omap-pin--restaurant";
      el.innerHTML = RESTAURANT_PIN_HTML;
      extraMarkersRef.current.restaurant = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat(restaurantCoords)
        .setPopup(
          new maplibregl.Popup().setText(selectedOrder.restaurantId.name),
        )
        .addTo(map);
      linePoints.push(restaurantCoords);
    }

    // السائق فقط إن كان معيّناً فعلاً وله موقع حالي مسجّل
    if (driverCoords) {
      const el = document.createElement("div");
      el.className = "omap-pin omap-pin--driver";
      el.innerHTML = DRIVER_PIN_HTML;
      extraMarkersRef.current.driver = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat(driverCoords)
        .setPopup(new maplibregl.Popup().setText(selectedOrder.driverId.name))
        .addTo(map);
      linePoints.push(driverCoords);
    }

    updateConnectorLine(linePoints);
    fitToVisible([restaurantCoords, driverCoords].filter(Boolean));
    setShowJourney(true);
  };

  const closePanel = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    clearExtraMarkers();
    setShowJourney(false);
    setBulkLayersVisible(true); // رجّع كل الطلبات المفلترة للظهور على الخريطة
    const map = mapRef.current;
    if (map && map.getSource("selected-order")) {
      map
        .getSource("selected-order")
        .setData({ type: "FeatureCollection", features: [] });
    }
  };

  // ── Client-side status tally (for the visible/returned set) ──
  const statusCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      counts[o.orderStatus] = (counts[o.orderStatus] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const visibleRows = orders.slice(0, 300);

  return (
    <div className="omap-page">
      <div className="omap-header">
        <div>
          <h2>Orders Map</h2>
          <p>Geographic distribution of orders — filter by date and status</p>
        </div>
        <button className="omap-refresh" onClick={fetchOrders}>
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Search — replaces the date/status filters entirely when active.
          Matches order ID, customer name/phone, or restaurant name */}
      <form className="omap-search-bar" onSubmit={applySearch}>
        <div className="omap-search-field">
          <FiSearch size={13} />
          <input
            type="text"
            placeholder="Search by order ID, customer, or restaurant — e.g. #ORD-1787939337140-76426937"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="omap-search-clear"
              onClick={clearSearch}
            >
              <FiX size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="omap-search-btn"
          disabled={!searchInput.trim()}
        >
          Search
        </button>
      </form>

      {/* Filters — disabled while search mode is active */}
      <div
        className={`omap-filters ${
          activeSearch ? "omap-filters--disabled" : ""
        }`}
      >
        {activeSearch ? (
          <div className="omap-search-active">
            <FiSearch size={13} />
            Showing results for <strong>"{activeSearch}"</strong> — date and
            status filters are ignored while searching
            <button type="button" onClick={clearSearch}>
              <FiX size={13} /> Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="omap-date-field">
              <FiCalendar size={13} />
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span className="omap-date-sep">→</span>
            <div className="omap-date-field">
              <FiCalendar size={13} />
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={fmtDate(Date.now())}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="omap-status-chips">
              {STATUS_ORDER.map((s) => {
                const meta_ = STATUS_META[s];
                const active = selectedStatuses.includes(s);
                return (
                  <button
                    key={s}
                    className={`omap-chip ${active ? "active" : ""}`}
                    style={
                      active
                        ? {
                            color: meta_.color,
                            background: meta_.bg,
                            borderColor: meta_.color,
                          }
                        : undefined
                    }
                    onClick={() => toggleStatus(s)}
                  >
                    {meta_.label}
                    {statusCounts[s] ? ` (${statusCounts[s]})` : ""}
                  </button>
                );
              })}
              {selectedStatuses.length > 0 && (
                <button
                  className="omap-chip omap-chip--clear"
                  onClick={() => setSelectedStatuses([])}
                >
                  <FiX size={11} /> Clear
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Summary strip */}
      <div className="omap-summary-strip">
        <span>
          <strong>{meta.totalMatching ?? 0}</strong> orders match{" "}
          {activeSearch ? "your search" : "filters"}
        </span>
        {meta.truncated && (
          <span className="omap-truncated-note">
            Showing latest {meta.returned} on map — narrow the date range for
            full precision
          </span>
        )}
      </div>

      <div className="omap-body">
        {/* Sidebar list */}
        <div className="omap-sidebar">
          <div className="omap-sidebar__head">
            <span>{orders.length} orders in view</span>
          </div>
          <div className="omap-sidebar__list">
            {loading ? (
              <div className="omap-center">
                <div className="omap-spinner" />
              </div>
            ) : orders.length === 0 ? (
              <div className="omap-center">
                <FiShoppingBag size={28} style={{ opacity: 0.2 }} />
                <span>
                  {activeSearch
                    ? "No orders match your search"
                    : "No orders match these filters"}
                </span>
              </div>
            ) : (
              visibleRows.map((o) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  active={selectedOrderId === o._id}
                  onClick={() =>
                    selectOrder(o._id, o.deliveryAddress?.location?.coordinates)
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="omap-map-wrap">
          <div ref={mapContainerRef} className="omap-map" />
          <div className="omap-legend">
            <span
              className="omap-legend__dot"
              style={{ background: "#f54900" }}
            />
            Customers (colored by status)
            <span
              className="omap-legend__dot"
              style={{ background: "#16a34a", marginLeft: 10 }}
            />
            Restaurants
          </div>
        </div>

        {/* Detail panel */}
        {selectedOrderId && (
          <DetailPanel
            order={selectedOrder}
            loading={detailLoading}
            onClose={closePanel}
            showJourney={showJourney}
            onToggleJourney={toggleJourney}
          />
        )}
      </div>
    </div>
  );
};

export default OrdersMap;
