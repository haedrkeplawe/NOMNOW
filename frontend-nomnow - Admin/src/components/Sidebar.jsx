// === ADMIN ===
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { RxHamburgerMenu } from "react-icons/rx";
import { CiGrid42 } from "react-icons/ci";
import { LuShoppingBag } from "react-icons/lu";
import { BiDollar } from "react-icons/bi";
import { BsShop } from "react-icons/bs";
import { FaCar, FaTag } from "react-icons/fa";
import { FiUsers } from "react-icons/fi";
import { FaArrowTrendUp } from "react-icons/fa6";
import { IoSettingsOutline } from "react-icons/io5";
import { MdOutlineAccountBalance } from "react-icons/md";
import { TbReportAnalytics } from "react-icons/tb";
import { LuMap } from "react-icons/lu";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const links = [
    {
      path: "/home",
      label: "Dashboard",
      icon: <CiGrid42 className="icon" />,
    },
    {
      path: "/restaurants",
      label: "Restaurants",
      icon: <BsShop className="icon" />,
    },
    {
      path: "/drivers",
      label: "Drivers",
      icon: <FaCar className="icon" />,
    },
    {
      path: "/orders",
      label: "Orders",
      icon: <LuShoppingBag className="icon" />,
    },
    {
      path: "/customers",
      label: "Customers",
      icon: <FiUsers className="icon" />,
    },
    {
      path: "/orders-map",
      label: "Orders Map",
      icon: <LuMap className="icon" />,
    },
    {
      path: "/finance",
      label: "Finance",
      icon: <BiDollar className="icon" />,
    },
    {
      path: "/settlements",
      label: "Settlements",
      icon: <MdOutlineAccountBalance className="icon" />,
    },
    {
      path: "/reports",
      label: "Reports",
      icon: <TbReportAnalytics className="icon" />,
    },
    {
      path: "/promotions",
      label: "Promotions",
      icon: <FaTag className="icon" />,
    },
    {
      path: "/ads-manager",
      label: "Ads Manager",
      icon: <FaArrowTrendUp className="icon" />,
    },
    {
      path: "/settings",
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
