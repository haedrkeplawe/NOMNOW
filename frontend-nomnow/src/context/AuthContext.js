import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// ✅ خارج الـ component — يُنشأ مرة واحدة فقط
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true,
});

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ ref للقراءة الـ live من الـ interceptor
  const accessTokenRef = useRef(null);

  // ✅ تحديث الـ ref والـ state معاً
  const updateToken = (token) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  };

  // ✅ Interceptors تُضاف مرة واحدة
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use((config) => {
      if (accessTokenRef.current) {
        config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
      }
      // إرسال اللغة الحالية مع كل request
      const lang = localStorage.getItem("nomnow_lang") || "en";
      config.headers["Accept-Language"] = lang;
      return config;
    });

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const storedToken = localStorage.getItem("refreshToken");
            const res = await axios.post(
              `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
              { refreshToken: storedToken },
              { withCredentials: true },
            );

            updateToken(res.data.accessToken);
            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return api(originalRequest);
          } catch (err) {
            logout();
            return Promise.reject(err);
          }
        }

        return Promise.reject(error);
      },
    );

    // ✅ إلغاء الـ interceptors عند unmount
    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // 🔁 Check auth on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedRefreshToken = localStorage.getItem("refreshToken");
        if (!storedRefreshToken) {
          setLoading(false);
          return;
        }
        const res = await axios.post(
          `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true },
        );

        updateToken(res.data.accessToken);
        setUser(res.data.user);
      } catch (err) {
        localStorage.removeItem("refreshToken");
        updateToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login (بعد OTP)
  const login = (token, userData, refreshToken) => {
    updateToken(token);
    setUser(userData);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
  };

  // تحديث بيانات المستخدم محلياً
  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  // Logout
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await api.post("/restaurant/logout");
    } catch (err) {
      console.error(err);
    }

    localStorage.removeItem("refreshToken");
    updateToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, login, logout, updateUser, api, loading }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
