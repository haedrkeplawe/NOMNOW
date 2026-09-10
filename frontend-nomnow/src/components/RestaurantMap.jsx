import { useRef, useEffect, useState, useCallback } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useTranslation } from "react-i18next";
import { MdMyLocation } from "react-icons/md";

// v-gmaps-1 — استبدال MapLibre + MapTiler + Nominatim بـGoogle Maps.
// البحث النصي → Places API (New) عبر Place.searchByText.
// عكس الترميز الجغرافي (سحب/ضغط الدبوس) → Geocoding API عبر google.maps.Geocoder،
// كلاهما جزء من مكتبات Maps JavaScript API المحمّلة بنفس مفتاح الويب المقيّد
// (بلا داعي لاستدعاء REST endpoint مباشر — أسلم أمنياً وموصى فيه من غوغل).
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const DEFAULT_POSITION = { lat: 32.6251, lng: 36.2021 };

const PIN_ICON_URL =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="#f54900"/>
      <circle cx="17" cy="17" r="7" fill="#ffffff"/>
    </svg>
  `);

// ── تطبيع latLng: بعض أحداث المكتبة بترجع LatLng object (methods)،
// وبعضها ترجع {lat, lng} خام (numbers) — هالدالة بتتعامل مع الشكلين ──
const toLatLngLiteral = (latLng) => {
  if (!latLng) return null;
  if (typeof latLng.lat === "function") {
    return { lat: latLng.lat(), lng: latLng.lng() };
  }
  return { lat: latLng.lat, lng: latLng.lng };
};

// ── تطبيع عناصر العنوان: تدعم شكل Geocoder الكلاسيكي (address_components:
// long_name/types) وشكل Places-New (addressComponents: longText/types) ──
const normalizeComponents = (components, isNewPlacesApi) =>
  (components || []).map((c) => ({
    longName: isNewPlacesApi ? c.longText : c.long_name,
    types: c.types || [],
  }));

const pickComponent = (components, types) => {
  const found = components.find((c) => types.some((t) => c.types.includes(t)));
  return found?.longName || "";
};

const buildAddressObj = (fullAddress, components) => ({
  fullAddress: fullAddress || "",
  country: pickComponent(components, ["country"]),
  city: pickComponent(components, ["locality", "administrative_area_level_2"]),
  area: pickComponent(components, [
    "sublocality",
    "sublocality_level_1",
    "neighborhood",
  ]),
  street: pickComponent(components, ["route"]),
  building: pickComponent(components, ["street_number"]),
  notes: "",
});

const RestaurantMap = ({ setLocation }) => (
  <APIProvider apiKey={GOOGLE_MAPS_KEY}>
    <RestaurantMapInner setLocation={setLocation} />
  </APIProvider>
);

const RestaurantMapInner = ({ setLocation }) => {
  const { t } = useTranslation();
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");
  const placesLib = useMapsLibrary("places");

  const geocoderRef = useRef(null);
  const debounceRef = useRef(null);
  const didInitRef = useRef(false);

  const [markerPosition, setMarkerPosition] = useState(DEFAULT_POSITION);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  // جهّز الـGeocoder بمجرد ما مكتبة geocoding تخلص تحميل
  useEffect(() => {
    if (geocodingLib) geocoderRef.current = new geocodingLib.Geocoder();
  }, [geocodingLib]);

  const reverseGeocode = useCallback(
    (lat, lng) => {
      if (!geocoderRef.current) {
        setLocation([lng, lat, {}]);
        return;
      }
      geocoderRef.current
        .geocode({ location: { lat, lng } })
        .then(({ results: geoResults }) => {
          const r = geoResults[0];
          const comps = normalizeComponents(r?.address_components, false);
          setLocation([lng, lat, buildAddressObj(r?.formatted_address, comps)]);
        })
        .catch((err) => {
          console.log("Reverse geocoding failed:", err);
          setLocation([lng, lat, {}]);
        });
    },
    [setLocation],
  );

  // أول تحميل بس — ابعت عنوان النقطة الافتراضية بمجرد ما الـGeocoder يجهز
  useEffect(() => {
    if (geocoderRef.current && !didInitRef.current) {
      didInitRef.current = true;
      reverseGeocode(markerPosition.lat, markerPosition.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodingLib]);

  const handleMapClick = (e) => {
    const latLng = toLatLngLiteral(e.detail?.latLng);
    if (!latLng) return;
    setMarkerPosition(latLng);
    reverseGeocode(latLng.lat, latLng.lng);
  };

  const handleMarkerDragEnd = (e) => {
    const latLng = toLatLngLiteral(e.latLng);
    if (!latLng) return;
    setMarkerPosition(latLng);
    reverseGeocode(latLng.lat, latLng.lng);
  };

  // البحث عن موقع بالنص مع Debounce 500ms — Places API (New) Text Search
  const handleSearch = (value) => {
    setQuery(value);
    setResults([]);

    if (!value.trim() || !placesLib) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: value,
          fields: ["id", "formattedAddress", "location", "addressComponents"],
        });
        setResults(places || []);
      } catch (err) {
        console.log("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  // عند اختيار نتيجة من الـ dropdown
  const handleSelect = (place) => {
    const lat = place.location.lat();
    const lng = place.location.lng();

    setMarkerPosition({ lat, lng });
    map?.panTo({ lat, lng });
    map?.setZoom(16);

    const comps = normalizeComponents(place.addressComponents, true);
    setLocation([lng, lat, buildAddressObj(place.formattedAddress, comps)]);

    setQuery(place.formattedAddress || "");
    setResults([]);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError(t("settings.mapLocateUnsupported"));
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPosition({ lat, lng });
        map?.panTo({ lat, lng });
        map?.setZoom(16);
        reverseGeocode(lat, lng);
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
                key={item.id}
                onClick={() => handleSelect(item)}
                className="restaurant-map-search__item"
              >
                {item.formattedAddress}
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
        <Map
          className="restaurant-map-search__map"
          defaultCenter={DEFAULT_POSITION}
          defaultZoom={17}
          gestureHandling="greedy"
          onClick={handleMapClick}
        >
          <Marker
            position={markerPosition}
            draggable
            onDragEnd={handleMarkerDragEnd}
            icon={{ url: PIN_ICON_URL }}
          />
        </Map>
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
