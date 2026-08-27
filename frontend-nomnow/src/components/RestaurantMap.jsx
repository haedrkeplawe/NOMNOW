import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "react-i18next";
import { MdMyLocation } from "react-icons/md";

const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;

const RestaurantMap = ({ setLocation }) => {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_KEY}`,
      center: [36.2021, 32.6251],
      zoom: 17,
    });

    const marker = new maplibregl.Marker({ color: "#f54900", draggable: true })
      .setLngLat([36.2021, 32.6251])
      .addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    const updateLocation = async (lng, lat) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
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

    const { lng, lat } = marker.getLngLat();
    updateLocation(lng, lat);

    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      updateLocation(lng, lat);
    });

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      updateLocation(lng, lat);
    });

    return () => map.remove();
  }, []);

  // البحث عن موقع بالنص مع Debounce 500ms
  const handleSearch = (value) => {
    setQuery(value);
    setResults([]);

    if (!value.trim()) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value,
          )}&limit=5`,
        );
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.log("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  // عند اختيار نتيجة من الـ dropdown
  const handleSelect = (item) => {
    const lng = parseFloat(item.lon);
    const lat = parseFloat(item.lat);

    markerRef.current.setLngLat([lng, lat]);
    mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 16 });

    setLocation([
      lng,
      lat,
      {
        fullAddress: item.display_name || "",
        country: "",
        city: "",
        area: "",
        street: "",
        building: "",
        notes: "",
      },
    ]);

    setQuery(item.display_name);
    setResults([]);
  };

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError(t("settings.mapLocateUnsupported"));
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        markerRef.current.setLngLat([lng, lat]);
        mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 16 });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          );
          const data = await res.json();
          const address = data.address || {};
          setLocation([
            lng,
            lat,
            {
              fullAddress: data.display_name || "",
              country: address.country || "",
              city: address.city || address.town || address.village || "",
              area: address.suburb || "",
              street: address.road || "",
              building: address.house_number || "",
              notes: "",
            },
          ]);
          setQuery(data.display_name || "");
        } catch {
          setLocation([lng, lat, {}]);
        }
        setLocating(false);
      },
      () => {
        setLocateError(t("settings.mapLocateDenied"));
        setLocating(false);
      },
    );
  };

  return (
    <div className="restaurant-map-wrapper">
      {/* Search Box */}
      <div className="restaurant-map-search">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("settings.mapSearch")}
          className="restaurant-map-search__input"
        />
        {searching && (
          <div
            className="restaurant-map-search__spinner"
            title={t("settings.mapSearching")}
          />
        )}

        {/* Dropdown النتائج */}
        {results.length > 0 && (
          <ul className="restaurant-map-search__dropdown">
            {results.map((item) => (
              <li
                key={item.place_id}
                onClick={() => handleSelect(item)}
                className="restaurant-map-search__item"
              >
                {item.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* رسالة خطأ الموقع */}
      {locateError && (
        <p className="restaurant-map-search__error">{locateError}</p>
      )}

      {/* الخريطة + زر الموقع داخلها */}
      <div className="restaurant-map-search__map-wrapper">
        <div ref={mapRef} className="restaurant-map-search__map" />
        <button
          type="button"
          onClick={handleLocate}
          className="restaurant-map-search__locate"
          title={t("settings.mapLocate")}
          disabled={locating}
        >
          {locating ? (
            <div className="restaurant-map-search__locate-spinner" />
          ) : (
            <MdMyLocation />
          )}
        </button>
      </div>
    </div>
  );
};

export default RestaurantMap;
