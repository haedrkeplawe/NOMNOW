import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { LuShoppingBag } from "react-icons/lu";
import { GiKnifeFork } from "react-icons/gi";
import { FaArrowTrendUp } from "react-icons/fa6";
import { CiStar } from "react-icons/ci";
import { IoTimeOutline } from "react-icons/io5";
import { CiDeliveryTruck } from "react-icons/ci";
import { LuUsers } from "react-icons/lu";
import { IoSettingsOutline } from "react-icons/io5";
import { RxHamburgerMenu } from "react-icons/rx";
import { CiGrid42 } from "react-icons/ci";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation(); // <--- نجيب path الحالي

  const links = [
    {
      path: "/home",
      label: "Home Dashboard",
      icon: <CiGrid42 className="icon" />,
    },
    {
      path: "/orders",
      label: "Orders",
      icon: <LuShoppingBag className="icon" />,
    },
    {
      path: "/menu-management",
      label: "Menu Management",
      icon: <GiKnifeFork className="icon" />,
    },
    {
      path: "/sales-reports",
      label: "Sales Reports",
      icon: <FaArrowTrendUp className="icon" />,
    },
    {
      path: "/customer-reviews",
      label: "Customer Reviews",
      icon: <CiStar className="icon" />,
    },
    {
      path: "/warking-hours-status",
      label: "Working Hours & Status",
      icon: <IoTimeOutline className="icon" />,
    },
    {
      path: "/delivery-performance",
      label: "Delivery Performance",
      icon: <CiDeliveryTruck className="icon" />,
    },
    {
      path: "/staff-drivers",
      label: "Staff / Drivers",
      icon: <LuUsers className="icon" />,
    },
    {
      path: "/sittings",
      label: "Settings",
      icon: <IoSettingsOutline className="icon" />,
    },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? "close" : ""}`}>
      <div className="top" onClick={() => setIsCollapsed(!isCollapsed)}>
        <RxHamburgerMenu className="icon" />
      </div>
      <div className="links">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={location.pathname === link.path ? "orange" : ""}
          >
            {link.icon}
            <h3 className={isCollapsed ? "close" : ""}>{link.label}</h3>
          </Link>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
