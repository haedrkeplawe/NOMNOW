import { GiKnifeFork } from "react-icons/gi";
import { useTheme } from "../context/ThemeContext";
import { MdOutlineWbSunny } from "react-icons/md";
import { IoMoon } from "react-icons/io5";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div className="logo">
        <span>
          <GiKnifeFork className="icon" />
        </span>
        <h2>NUMNOW</h2>
      </div>
      <div className="menu">
        <div className="left">
          <h2>The Gourmet Admin</h2>
        </div>
        <div className="right">
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === "dark" ? (
              <IoMoon className="icon" />
            ) : (
              <MdOutlineWbSunny className="icon" />
            )}
          </button>
          <h4>Super Admin</h4>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
