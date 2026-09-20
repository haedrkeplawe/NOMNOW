import { useLocation, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = () => {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  // لا نعيد توجيه إلا إذا انتهى loading
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
