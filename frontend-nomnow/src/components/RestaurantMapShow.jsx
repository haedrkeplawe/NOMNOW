import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;

const RestaurantMapShow = ({ initialLocation }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    const defaultCoords = initialLocation
      ? [initialLocation.coordinates[0], initialLocation.coordinates[1]]
      : [36.2021, 32.6251];

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_KEY}`,
      center: defaultCoords,
      zoom: 17,
    });

    // دبوس برتقالي ثابت
    new maplibregl.Marker({ color: "#f54900" })
      .setLngLat(defaultCoords)
      .addTo(map);

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
