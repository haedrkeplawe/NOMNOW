import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

// v-gmaps-1 — استبدال MapLibre + MapTiler بـGoogle Maps (@vis.gl/react-google-maps)
// هاد أبسط مكوّن بالثلاثة: خريطة عرض فقط، دبوس واحد ثابت، بلا أي تفاعل.
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const DEFAULT_POSITION = { lat: 32.6251, lng: 36.2021 };

const RestaurantMapShow = ({ initialLocation }) => {
  // ملاحظة: coordinates بقاعدة البيانات محفوظة GeoJSON-style [lng, lat]
  // (نفس ترتيب MongoDB/$geoNear) — بينما Google Maps بده {lat, lng}.
  // التحويل هون بس، الباك إند ما تغيّر إطلاقاً.
  const position = initialLocation
    ? {
        lat: initialLocation.coordinates[1],
        lng: initialLocation.coordinates[0],
      }
    : DEFAULT_POSITION;

  return (
    <div style={{ marginBottom: "20px" }}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map
          style={{
            width: "100%",
            height: "450px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
          defaultCenter={position}
          defaultZoom={17}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {/* دبوس برتقالي ثابت — نفس لون الأصلي (#f54900) */}
          <Marker position={position} icon={{ url: PIN_ICON_URL }} />
        </Map>
      </APIProvider>
    </div>
  );
};

// دبوس SVG برتقالي بسيط كـdata URL — بديل بصري لدبوس MapLibre البرتقالي
// الأصلي، بلا الحاجة لـAdvanced Markers أو Map ID
const PIN_ICON_URL =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="#f54900"/>
      <circle cx="17" cy="17" r="7" fill="#ffffff"/>
    </svg>
  `);

export default RestaurantMapShow;
