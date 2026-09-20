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

// ✅ Refresh Queue — يمنع Race Condition
// إذا كان refresh جارٍ، نخزّن الطلبات الفاشلة وننتظر نتيجته
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ ref للقراءة الـ live من الـ interceptor
  const accessTokenRef = useRef(null);
  const logoutRef = useRef(null);

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

        // فقط نتدخل عند 401 وإذا لم نحاول من قبل
        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }

        // ✅ إذا كان refresh جارٍ → أضف الطلب للـ queue وانتظر
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        // ✅ أول طلب يبدأ الـ refresh
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const storedToken = localStorage.getItem("refreshToken");
          const res = await axios.post(
            `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
            { refreshToken: storedToken },
            { withCredentials: true },
          );

          const newAccessToken = res.data.accessToken;
          const newRefreshToken = res.data.refreshToken;

          // ✅ حدّث الـ access token
          updateToken(newAccessToken);

          // ✅ حدّث الـ refresh token في localStorage (Rotation)
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }

          // ✅ أطلق جميع الطلبات المنتظرة بالـ token الجديد
          processQueue(null, newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (err) {
          // ✅ الـ refresh فشل → أخبر جميع الطلبات المنتظرة ثم logout
          processQueue(err, null);
          if (logoutRef.current) logoutRef.current();
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
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

        // ✅ حدّث الـ refreshToken الجديد في localStorage (Rotation)
        if (res.data.refreshToken) {
          localStorage.setItem("refreshToken", res.data.refreshToken);
        }
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

  // ✅ refresh يدوي — يُستخدم من RestaurantContext عند Socket 401
  const refreshAccessToken = async () => {
    try {
      const storedToken = localStorage.getItem("refreshToken");
      if (!storedToken) throw new Error("No refresh token");
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
        { refreshToken: storedToken },
        { withCredentials: true },
      );
      const newAccessToken = res.data.accessToken;
      const newRefreshToken = res.data.refreshToken;
      updateToken(newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }
      return newAccessToken;
    } catch (err) {
      if (logoutRef.current) logoutRef.current();
      throw err;
    }
  };

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

  // ✅ نربط logout بالـ ref حتى يستطيع الـ interceptor استدعاءه
  useEffect(() => {
    logoutRef.current = logout;
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        updateUser,
        api,
        loading,
        refreshAccessToken,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
