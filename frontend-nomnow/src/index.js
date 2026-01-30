import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { RestaurantProvider } from "./context/RestaurantContext";
import ToastProvider from "./context/ToastProvider";
import "react-loading-skeleton/dist/skeleton.css";

import { HashRouter as Router } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ToastProvider />
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <RestaurantProvider>
            <App />
          </RestaurantProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  </React.StrictMode>,
);
