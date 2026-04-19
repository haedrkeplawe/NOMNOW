import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER_KEY = "STjJNld1CISxZARlTnBC";

const RestaurantMapShow = ({ initialLocation }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    // إحداثيات افتراضية إذا ما في موقع محدد
    const defaultCoords = initialLocation
      ? [initialLocation.coordinates[0], initialLocation.coordinates[1]]
      : [36.2021, 32.6251]; // Daraa

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
      center: defaultCoords,
      zoom: 14,
    });

    // إضافة دبوس بدون أي تفاعل
    new maplibregl.Marker().setLngLat(defaultCoords).addTo(map);

    return () => map.remove();
  }, [initialLocation]);

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

export default RestaurantMapShow;
