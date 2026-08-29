// === ADMIN ===
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import maplibregl from "maplibre-gl";
// import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import AdminDashboard from "./pages/AdminDashboard";
import Restaurants from "./pages/Restaurants";
import Drivers from "./pages/Drivers";
import AdminOrders from "./pages/AdminOrders";
import Customers from "./pages/Customers";
import AdsManager from "./pages/AdsManager";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Settlements from "./pages/Settlements";
import PromotionsManager from "./pages/PromotionsManager";
import LiveOrdersMap from "./pages/Liveordersmap";
import { Toaster } from "react-hot-toast";
import { CountryProvider } from "./context/Countrycontext";

// دعم النصوص العربية على الخريطة
maplibregl.setRTLTextPlugin(
  "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
  null,
  true,
);

function App() {
  // night and light
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <CountryProvider>
        <Router>
          <Routes>
            {/* Public */}
            {/* <Route path="/login" element={<Login />} /> */}

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<AdminDashboard />} />
                <Route path="/restaurants" element={<Restaurants />} />
                <Route path="/drivers" element={<Drivers />} />
                <Route path="/orders" element={<AdminOrders />} />
                <Route path="/orders-map" element={<LiveOrdersMap />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/ads-manager" element={<AdsManager />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settlements" element={<Settlements />} />
                <Route path="/promotions" element={<PromotionsManager />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </CountryProvider>
    </>
  );
}

export default App;
