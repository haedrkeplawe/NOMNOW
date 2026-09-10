// === ADMIN ===
// v-gmaps-2 — هجرة كاملة من MapLibre + MapTiler لـGoogle Maps.
// التجميع (clustering) عبر @googlemaps/markerclusterer بدل GeoJSON cluster
// source. باقي منطق الصفحة (الفلاتر، البحث، لوحة تفاصيل الطلب) بلا أي تغيير
// — الملف يعتمد على /admin/orders/map و/admin/orders/:id/details بنفس الشكل.
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
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

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const DEFAULT_CENTER = { lat: 32.6251, lng: 36.2021 };

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
const statusColor = (status) => STATUS_META[status]?.color || "#888888";

// ─── مولّدات أيقونات SVG (data URL) — بديل paint expressions لـMapLibre ───
const svgUrl = (svg) =>
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

// نقطة ملوّنة بحافة بيضاء — تُستخدم للطلبات (بلون الحالة) والمطاعم (أخضر)
const dotIcon = (color, diameter) =>
  svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
      <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2 - 2}"
        fill="${color}" stroke="#ffffff" stroke-width="2" />
    </svg>
  `);

// دبوس (teardrop) بلون واحد — يُستخدم لدبوس المطعم/السائق بوضع "رحلة الطلب"
const pinIcon = (color) =>
  svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="6" fill="#ffffff"/>
    </svg>
  `);

// حلقة تحديد ثابتة الحجم بصرياً (بلا اعتماد على مستوى الزوم) — بديل
// circle-radius بالبكسل من MapLibre (google.maps.Circle نصف قطرها بالمتر
// فقط، فبيكبر/يصغّر مع الزوم — الأيقونة هون بتحافظ على نفس الحجم دايماً)
const RING_ICON = svgUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="13" fill="none" stroke="#f54900" stroke-width="3"/>
  </svg>
`);

const RESTAURANT_ICON = pinIcon("#16a34a");
const DRIVER_ICON = pinIcon("#2563eb");

// عتبات ألوان/أحجام التجميع — نفس القيم الأصلية بالضبط (15، 50)
const orderClusterStyle = (count) =>
  count >= 50
    ? { color: "#f54900", size: 56 }
    : count >= 15
    ? { color: "#fdba74", size: 44 }
    : { color: "#fed7aa", size: 32 };

const restaurantClusterStyle = (count) =>
  count >= 50
    ? { color: "#15803d", size: 46 }
    : count >= 15
    ? { color: "#4ade80", size: 36 }
    : { color: "#bbf7d0", size: 26 };

const makeClusterRenderer = (styleFn, textColor) => ({
  render: ({ count, position }) => {
    const { color, size } = styleFn(count);
    return new window.google.maps.Marker({
      position,
      icon: {
        url: dotIcon(color, size),
        scaledSize: new window.google.maps.Size(size, size),
        anchor: new window.google.maps.Point(size / 2, size / 2),
      },
      label: {
        text: String(count),
        color: textColor,
        fontSize: "12px",
        fontWeight: "bold",
      },
      zIndex: 1000 + count,
    });
  },
});

const buildOrderMarker = (order) => {
  const coords = order.deliveryAddress?.location?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  const marker = new window.google.maps.Marker({
    position: { lat, lng },
    icon: {
      url: dotIcon(statusColor(order.orderStatus), 16),
      scaledSize: new window.google.maps.Size(16, 16),
      anchor: new window.google.maps.Point(8, 8),
    },
  });
  marker.__coords = [lng, lat];
  return marker;
};

const buildRestaurantMarker = (order) => {
  const coords = order.restaurantId?.location?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  const marker = new window.google.maps.Marker({
    position: { lat, lng },
    icon: {
      url: dotIcon("#16a34a", 14),
      scaledSize: new window.google.maps.Size(14, 14),
      anchor: new window.google.maps.Point(7, 7),
    },
  });
  marker.__coords = [lng, lat];
  return marker;
};

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

// ─── Map layer — مكوّن غير مرئي (return null)، بيدير الماركرز/التجميع/
// الرحلة إمبراطورياً عبر google.maps مباشرة. لازم يكون ابن لـ<Map> حتى
// useMap() يوصل لنفس نسخة الخريطة ─────────────────────────────
const OrdersMapLayer = ({
  orders,
  selectedCoordinates,
  selectedOrder,
  showJourney,
  bulkVisible,
  onSelectOrder,
}) => {
  const map = useMap();

  const ordersClustererRef = useRef(null);
  const restaurantsClustererRef = useRef(null);
  const orderMarkersRef = useRef([]);
  const restaurantMarkersRef = useRef([]);
  const ringMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const extraMarkersRef = useRef({ restaurant: null, driver: null });
  const infoWindowRef = useRef(null);

  // ── تهيئة الكلسترّرين مرة وحدة بس، بمجرد ما الخريطة تجهز ──────
  useEffect(() => {
    if (!map) return;

    ordersClustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: makeClusterRenderer(orderClusterStyle, "#ffffff"),
    });
    restaurantsClustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: makeClusterRenderer(restaurantClusterStyle, "#14532d"),
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();

    return () => {
      ordersClustererRef.current?.clearMarkers();
      restaurantsClustererRef.current?.clearMarkers();
      ordersClustererRef.current = null;
      restaurantsClustererRef.current = null;
    };
  }, [map]);

  // ── إعادة بناء الماركرز لما orders تتغيّر (فلترة/بحث/تحديث) ────
  useEffect(() => {
    if (!map) return;

    orderMarkersRef.current = [];
    restaurantMarkersRef.current = [];

    orders.forEach((o) => {
      const om = buildOrderMarker(o);
      if (om) {
        om.addListener("click", () => {
          map.panTo({ lat: om.position.lat(), lng: om.position.lng() });
          if (map.getZoom() < 14) map.setZoom(14);
          onSelectOrder(o._id, om.__coords);
        });
        orderMarkersRef.current.push(om);
      }

      const rm = buildRestaurantMarker(o);
      if (rm) {
        rm.addListener("click", () => {
          map.panTo({ lat: rm.position.lat(), lng: rm.position.lng() });
          if (map.getZoom() < 14) map.setZoom(14);
          onSelectOrder(o._id, rm.__coords);
        });
        restaurantMarkersRef.current.push(rm);
      }
    });

    if (bulkVisible) {
      ordersClustererRef.current?.clearMarkers();
      ordersClustererRef.current?.addMarkers(orderMarkersRef.current);
      restaurantsClustererRef.current?.clearMarkers();
      restaurantsClustererRef.current?.addMarkers(restaurantMarkersRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, orders]);

  // ── إظهار/إخفاء الطبقات الجماعية عند اختيار طلب معيّن ──────────
  // (نركّز بس على الطلب المختار، ونرجعهم كلهم لما يُغلق التفاصيل)
  useEffect(() => {
    if (!ordersClustererRef.current || !restaurantsClustererRef.current) return;
    if (bulkVisible) {
      ordersClustererRef.current.clearMarkers();
      ordersClustererRef.current.addMarkers(orderMarkersRef.current);
      restaurantsClustererRef.current.clearMarkers();
      restaurantsClustererRef.current.addMarkers(restaurantMarkersRef.current);
    } else {
      ordersClustererRef.current.clearMarkers();
      restaurantsClustererRef.current.clearMarkers();
    }
  }, [bulkVisible]);

  // ── حلقة التحديد حول الطلب المختار (ثابتة الحجم بصرياً) ─────────
  useEffect(() => {
    if (!map) return;
    if (ringMarkerRef.current) {
      ringMarkerRef.current.setMap(null);
      ringMarkerRef.current = null;
    }
    if (selectedCoordinates) {
      const [lng, lat] = selectedCoordinates;
      ringMarkerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          url: RING_ICON,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        },
        clickable: false,
        zIndex: 2000,
      });
    }
  }, [map, selectedCoordinates]);

  // ── رحلة الطلب: دبوس المطعم + دبوس السائق (إن وجد) + خط اتصال ───
  useEffect(() => {
    const clearJourney = () => {
      if (extraMarkersRef.current.restaurant) {
        extraMarkersRef.current.restaurant.setMap(null);
        extraMarkersRef.current.restaurant = null;
      }
      if (extraMarkersRef.current.driver) {
        extraMarkersRef.current.driver.setMap(null);
        extraMarkersRef.current.driver = null;
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };

    if (!map || !showJourney || !selectedOrder) {
      clearJourney();
      return;
    }

    clearJourney();

    const deliveryCoords = selectedOrder.deliveryAddress?.location?.coordinates;
    const restaurantCoords = selectedOrder.restaurantId?.location?.coordinates;
    // السائق مش مضمون وجوده لكل طلب — نتحقق قبل أي استخدام لبياناته
    const driverCoords = selectedOrder.driverId?.currentLocation?.coordinates;

    const linePoints = [deliveryCoords].filter(Boolean);

    // المطعم مضمون وجوده لكل طلب — نضيف دبوسه دائماً إن كان له إحداثيات
    if (restaurantCoords) {
      const [lng, lat] = restaurantCoords;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          url: RESTAURANT_ICON,
          scaledSize: new window.google.maps.Size(30, 40),
          anchor: new window.google.maps.Point(15, 40),
        },
        zIndex: 1500,
      });
      marker.addListener("click", () => {
        infoWindowRef.current.setContent(
          selectedOrder.restaurantId?.name || "",
        );
        infoWindowRef.current.open(map, marker);
      });
      extraMarkersRef.current.restaurant = marker;
      linePoints.push(restaurantCoords);
    }

    // السائق فقط إن كان معيّناً فعلاً وله موقع حالي مسجّل
    if (driverCoords) {
      const [lng, lat] = driverCoords;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          url: DRIVER_ICON,
          scaledSize: new window.google.maps.Size(30, 40),
          anchor: new window.google.maps.Point(15, 40),
        },
        zIndex: 1500,
      });
      marker.addListener("click", () => {
        infoWindowRef.current.setContent(selectedOrder.driverId?.name || "");
        infoWindowRef.current.open(map, marker);
      });
      extraMarkersRef.current.driver = marker;
      linePoints.push(driverCoords);
    }

    // خط متقطع يربط النقاط — بديل line-dasharray بـMapLibre
    if (linePoints.length >= 2) {
      polylineRef.current = new window.google.maps.Polyline({
        map,
        path: linePoints.map(([lng, lat]) => ({ lat, lng })),
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeColor: "#f54900",
              scale: 2,
            },
            offset: "0",
            repeat: "8px",
          },
        ],
      });
    }

    // fitBounds لتغطية كل نقاط الرحلة الظاهرة
    const boundsPoints = [
      deliveryCoords,
      restaurantCoords,
      driverCoords,
    ].filter(Boolean);
    if (boundsPoints.length === 1) {
      const [lng, lat] = boundsPoints[0];
      map.panTo({ lat, lng });
      map.setZoom(14);
    } else if (boundsPoints.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      boundsPoints.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
      map.fitBounds(bounds, 90);
    }

    return clearJourney;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, showJourney, selectedOrder]);

  return null;
};

// ─── Main ─────────────────────────────────────────────────────
const OrdersMapInner = () => {
  const { api } = useAuth();
  const { countryParam } = useCountry();

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
  // إحداثيات نقطة الاختيار — تُعرف فوراً وقت الكبسة (قبل ما يوصل تفاصيل
  // الطلب الكاملة من الـAPI)، وبتُستخدم لعرض حلقة التحديد على الخريطة
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  // إظهار/إخفاء طبقات التجميع الجماعية (نخفيها لما يكون في طلب مختار)
  const [bulkVisible, setBulkVisible] = useState(true);

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

  // ── Select order + fetch full details ────────────────────────
  const selectOrder = useCallback(
    async (orderId, coordinates) => {
      setSelectedOrderId(orderId);
      setSelectedOrder(null);
      setShowJourney(false);
      setSelectedCoordinates(coordinates || null);
      setDetailLoading(true);
      setBulkVisible(false); // نركّز على الطلب المختار فقط ونخفي البقية

      try {
        const res = await api.get(`/admin/orders/${orderId}/details`);
        setSelectedOrder(res.data.order);
      } catch {
        // silent
      } finally {
        setDetailLoading(false);
      }
    },
    [api],
  );

  const closePanel = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setShowJourney(false);
    setSelectedCoordinates(null);
    setBulkVisible(true); // رجّع كل الطلبات المفلترة للظهور على الخريطة
  };

  const toggleJourney = () => {
    if (!selectedOrder) return;
    setShowJourney((prev) => !prev);
  };

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
          <Map
            className="omap-map"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={11}
            gestureHandling="greedy"
          >
            <OrdersMapLayer
              orders={orders}
              selectedCoordinates={selectedCoordinates}
              selectedOrder={selectedOrder}
              showJourney={showJourney}
              bulkVisible={bulkVisible}
              onSelectOrder={selectOrder}
            />
          </Map>
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

// ─── Wrapper — يحمّل مكتبة Google Maps مرة وحدة، وينزّل كل شي جواته ───
const OrdersMap = () => (
  <APIProvider apiKey={GOOGLE_MAPS_KEY}>
    <OrdersMapInner />
  </APIProvider>
);

export default OrdersMap;
