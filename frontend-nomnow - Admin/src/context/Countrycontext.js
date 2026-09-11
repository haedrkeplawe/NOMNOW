// === ADMIN ===
import { createContext, useContext, useState, useEffect } from "react";

const CountryContext = createContext();

export const useCountry = () => useContext(CountryContext);

export const COUNTRIES = [
  { key: "all", label: "All", flag: "🌍" },
  { key: "SY", label: "Syria", flag: "🇸🇾" },
  { key: "DE", label: "Germany", flag: "🇩🇪" },
];

export const CountryProvider = ({ children }) => {
  const [country, setCountry] = useState(() => {
    return localStorage.getItem("admin_country") || "all";
  });

  useEffect(() => {
    localStorage.setItem("admin_country", country);
  }, [country]);

  const countryParam = country === "all" ? "" : `country=${country}`;
  const countryQuery = country === "all" ? {} : { country };

  return (
    <CountryContext.Provider
      value={{ country, setCountry, countryParam, countryQuery, COUNTRIES }}
    >
      {children}
    </CountryContext.Provider>
  );
};
