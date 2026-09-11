// === ADMIN ===
import { useTheme } from "../context/ThemeContext";
import { MdOutlineWbSunny } from "react-icons/md";
import { IoMoon } from "react-icons/io5";
import { GiKnifeFork } from "react-icons/gi";
import { useCountry, COUNTRIES } from "../context/Countrycontext";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { country, setCountry } = useCountry();

  const current = COUNTRIES.find((c) => c.key === country) || COUNTRIES[0];

  return (
    <header className="navbar">
      <div className="logo">
        {/* <span>
          <GiKnifeFork />
        </span>
        <h2>NOMNOW</h2> */}
        <img src="/NOMNOWBG.png" alt="NOMNOW" />
      </div>

      <div className="menu">
        <div className="left">
          {/* Country Selector */}
          <div className="country-selector">
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                className={`country-btn ${country === c.key ? "active" : ""}`}
                onClick={() => setCountry(c.key)}
              >
                <span>{c.flag}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
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
