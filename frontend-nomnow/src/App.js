import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import MenuManagement from "./pages/MenuManagement";
import Orders from "./pages/Orders";
import SalesReports from "./pages/SalesReports";
import CustomerReviews from "./pages/CustomerReviews";
import WarkingHoursStatus from "./pages/WarkingHoursStatus";
import DeliveryPerformance from "./pages/DeliveryPerformance";
import StaffDrivers from "./pages/StaffDrivers";
import Settings from "./pages/Settings";
import Home from "./pages/Home";
import ResetPassword from "./pages/ResetPassword";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/menu-management" element={<MenuManagement />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/sales-reports" element={<SalesReports />} />
            <Route path="/customer-reviews" element={<CustomerReviews />} />
            <Route
              path="/warking-hours-status"
              element={<WarkingHoursStatus />}
            />
            <Route
              path="/delivery-performance"
              element={<DeliveryPerformance />}
            />
            <Route path="/staff-drivers" element={<StaffDrivers />} />
            <Route path="/sittings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
