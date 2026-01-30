import { Outlet } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";

const ProtectedRoute = () => {
  // const { accessToken, loading } = useAuth();

  // if (loading) return <div>Loading...</div>;

  // if (!accessToken) {
  //   return <Navigate to="/login" replace />;
  // }

  return <Outlet />;
};

export default ProtectedRoute;
