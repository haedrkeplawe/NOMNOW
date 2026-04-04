import { GiKnifeFork } from "react-icons/gi";
import { useTheme } from "../context/ThemeContext";
import { MdOutlineWbSunny } from "react-icons/md";
import { IoMoon } from "react-icons/io5";
import { useRestaurant } from "../context/RestaurantContext";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { restaurant } = useRestaurant();

  return (
    <header className="navbar">
      <div className="logo">
        <span>
          <GiKnifeFork />
        </span>
        <h2>NUMNOW</h2>
      </div>
      <div className="menu">
        <div className="left">
          <h2>The Gourmet Kitchen</h2>
          {restaurant?.status === "open" ? (
            <div className="condition green">open</div>
          ) : (
            <div className="condition red">cloase</div>
          )}
        </div>
        <div className="right">
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === "dark" ? <IoMoon /> : <MdOutlineWbSunny />}
          </button>
          <h4>Admin</h4>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
