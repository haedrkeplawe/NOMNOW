import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const DashboardLayout = () => {
  return (
    <div style={{ height: "100vh" }}>
      <Navbar />

      <main className="main">
        <Sidebar />
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
