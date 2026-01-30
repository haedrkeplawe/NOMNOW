import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER_KEY = "STjJNld1CISxZARlTnBC";

const RestaurantMap = ({ setLocation }) => {
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
      center: [36.2021, 32.6251],
      zoom: 14,
    });

    // إنشاء Marker
    const marker = new maplibregl.Marker({ draggable: true })
      .setLngLat([36.2021, 32.6251])
      .addTo(map);

    markerRef.current = marker;

    const updateLocation = async (lng, lat) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await res.json();
        const address = data.address || {};

        const addressObj = {
          fullAddress: data.display_name || "",
          country: address.country || "",
          city: address.city || address.town || address.village || "",
          area: address.suburb || "",
          street: address.road || "",
          building: address.house_number || "",
          notes: "",
        };

        setLocation([lng, lat, addressObj]);
      } catch (err) {
        console.log("Reverse geocoding failed:", err);
        setLocation([lng, lat, {}]);
      }
    };

    // أول مرة
    const { lng, lat } = marker.getLngLat();
    updateLocation(lng, lat);

    // عند سحب Marker
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      updateLocation(lng, lat);
    });

    // عند النقر على الخريطة
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      // حرك الدبوس للمكان الجديد
      marker.setLngLat([lng, lat]);
      updateLocation(lng, lat);
    });

    return () => map.remove();
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "450px",
        marginBottom: "20px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    />
  );
};

export default RestaurantMap;
