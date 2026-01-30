import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
// import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import Home from "./pages/Home";
import Restaurants from "./pages/Restaurants";
import Drivers from "./pages/Drivers";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import AdsManager from "./pages/AdsManager";
import ContentManager from "./pages/ContentManager";
import Zones from "./pages/Zones";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { Toaster } from "react-hot-toast";

function App() {
  // night and light
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Router>
        <Routes>
          {/* Public */}
          {/* <Route path="/login" element={<Login />} /> */}

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/ads-manager" element={<AdsManager />} />
              <Route path="/content-manager" element={<ContentManager />} />
              <Route path="/zones" element={<Zones />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;
