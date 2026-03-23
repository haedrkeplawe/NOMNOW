import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Axios instance
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    withCredentials: true,
  });

  // Attach access token
  api.interceptors.request.use((config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  // Auto refresh on 401
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const res = await axios.post(
            `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
            {},
            { withCredentials: true }
          );

          setAccessToken(res.data.accessToken);
          return api(originalRequest);
        } catch (err) {
          logout();
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );

  // 🔁 Check auth on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await axios.post(
          `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
          {},
          { withCredentials: true }
        );

        setAccessToken(res.data.accessToken);
        setUser(res.data.user); // إذا رجعتها من الباك
      } catch (err) {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login (بعد OTP)
  const login = (token, userData) => {
    setAccessToken(token);
    setUser(userData);
  };

  // Logout
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error(err);
    }

    setAccessToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, login, logout, api, loading }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
