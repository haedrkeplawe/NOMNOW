import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useEffect } from "react";
import { adminSocket } from "../socket/adminSocket";

// useEffect(() => {
//   if (localStorage.getItem("adminToken")) {
//     adminSocket.connect();
//   }

//   return () => {
//     adminSocket.disconnect();
//   };
// }, []);

const DashboardLayout = () => {
  useEffect(() => {
    adminSocket.connect();

    return () => {
      adminSocket.disconnect();
    };
  }, []);
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
