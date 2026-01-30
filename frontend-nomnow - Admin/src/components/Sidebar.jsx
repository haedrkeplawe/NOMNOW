import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { LuShoppingBag } from "react-icons/lu";
import { IoTimeOutline } from "react-icons/io5";
import { CiDeliveryTruck } from "react-icons/ci";
import { LuUsers } from "react-icons/lu";
import { IoSettingsOutline } from "react-icons/io5";
import { RxHamburgerMenu } from "react-icons/rx";
import { LuMapPin } from "react-icons/lu";
import { LuDollarSign } from "react-icons/lu";
import { CgPoll } from "react-icons/cg";
import { BsShop } from "react-icons/bs";
import { CiGrid42 } from "react-icons/ci";
import { HiOutlineViewGridAdd } from "react-icons/hi";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation(); // <--- نجيب path الحالي

  const links = [
    { path: "/home", label: "Dashboard", icon: <CiGrid42 className="icon" /> },
    {
      path: "/restaurants",
      label: "Restaurants",
      icon: <BsShop className="icon" />,
    },
    {
      path: "/drivers",
      label: "Drivers",
      icon: <CiDeliveryTruck className="icon" />,
    },
    {
      path: "/orders",
      label: "Orders",
      icon: <LuShoppingBag className="icon" />,
    },
    {
      path: "/customers",
      label: "Customers",
      icon: <LuUsers className="icon" />,
    },
    {
      path: "/ads-manager",
      label: "Ads Manager",
      icon: <IoTimeOutline className="icon" />,
    },
    {
      path: "/content-manager",
      label: "Content Manager",
      icon: <HiOutlineViewGridAdd className="icon" />,
    },
    { path: "/zones", label: "Zones", icon: <LuMapPin className="icon" /> },
    {
      path: "/finance",
      label: "Finance",
      icon: <LuDollarSign className="icon" />,
    },
    { path: "/reports", label: "Reports", icon: <CgPoll className="icon" /> },
    {
      path: "/settings",
      label: "Settings",
      icon: <IoSettingsOutline className="icon" />,
    },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? "close" : ""}`}>
      <div className="top" onClick={() => setIsCollapsed(!isCollapsed)}>
        <RxHamburgerMenu className="icon" size={23} />
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
