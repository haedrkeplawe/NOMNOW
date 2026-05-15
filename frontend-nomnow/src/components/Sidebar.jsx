import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { LuShoppingBag } from "react-icons/lu";
import { GiKnifeFork } from "react-icons/gi";
import { FaArrowTrendUp } from "react-icons/fa6";
import { CiStar } from "react-icons/ci";
import { IoTimeOutline } from "react-icons/io5";
import { IoSettingsOutline } from "react-icons/io5";
import { RxHamburgerMenu } from "react-icons/rx";
import { CiGrid42 } from "react-icons/ci";
import { BiDollar } from "react-icons/bi";
import { useTranslation } from "react-i18next";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();

  const links = [
    {
      path: "/home",
      labelKey: "sidebar.home",
      icon: <CiGrid42 className="icon" />,
    },
    {
      path: "/orders",
      labelKey: "sidebar.orders",
      icon: <LuShoppingBag className="icon" />,
    },
    {
      path: "/finance",
      labelKey: "sidebar.finance",
      icon: <BiDollar className="icon" />,
    },
    {
      path: "/menu-management",
      labelKey: "sidebar.menu",
      icon: <GiKnifeFork className="icon" />,
    },
    {
      path: "/sales-reports",
      labelKey: "sidebar.sales",
      icon: <FaArrowTrendUp className="icon" />,
    },
    {
      path: "/customer-reviews",
      labelKey: "sidebar.reviews",
      icon: <CiStar className="icon" />,
    },
    {
      path: "/warking-hours-status",
      labelKey: "sidebar.hours",
      icon: <IoTimeOutline className="icon" />,
    },
    {
      path: "/sittings",
      labelKey: "sidebar.settings",
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
            <h3 className={isCollapsed ? "close" : ""}>{t(link.labelKey)}</h3>
          </Link>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
